# Plan de Implementación Técnico: Ingesta Serverless de ERNI (Inteligo)

## Información general sobre la arquitectura

Este plan define la estrategia de ingeniería para implementar el componente de ingesta serverless de fondos mutuos de ERNI (Inteligo SAB / Interfondos) bajo AWS Lambda con Node.js 24 y TypeScript estricto, interactuando con las nuevas APIs v2 de Inteligo y persistiendo los datos en MongoDB Atlas M0.

### Diagrama de Flujo y Componentes:
```text
 ┌────────────────────────────────────────────────────────────┐
 │  Amazon EventBridge Scheduler (Cron diario: 23:00 UTC)     │
 │  o Invocación Manual ({ months?: number })                 │
 └─────────────────────────────┬──────────────────────────────┘
                               │ (Evento)
                               ▼
 ┌────────────────────────────────────────────────────────────┐
 │           AWS Lambda: ErniScraperFunction (TS)             │
 │                                                            │
 │   1. Inicializar conexión MongoDB (Singleton global)       │
 │   2. Obtener ERNI_APIKEY y MONGO_DB_URI (Cache SSM / .env) │
 │   3. Consultar /fondos-activos con fetch nativo            │
 │      - Validar respuesta con @sinclair/typebox             │
 │      - Upsert de metadatos de fondos en colección 'funds'  │
 │      - Extraer series activas (priorizando Serie C digital)│
 │   4. Consultar /invertir por lotes concurrentes (max 4)    │
 │      - Validar serie temporal con @sinclair/typebox        │
 │      - Normalizar fechas y valores cuota                   │
 │   5. Upsert masivo idempotente en colección 'erni'         │
 │   6. Retornar resumen métrico de ejecución                 │
 └──────────────┬───────────────────────────────┬─────────────┘
                │                               │
                ▼                               ▼
 ┌───────────────────────────┐   ┌────────────────────────────┐
 │   Inteligo API Gateway    │   │     MongoDB Atlas (M0)     │
 │                           │   │                            │
 │ - /fondos/fondos-activos  │   │ - Colección 'funds'        │
 │ - /erni-api/v1/fondo/...  │   │ - Colección 'erni' (cuotas)│
 └───────────────────────────┘   └────────────────────────────┘
```

### Estructura de Archivos a Crear / Modificar:
```text
fondos/
├── src/
│   ├── scrapers/
│   │   └── erni/
│   │       ├── types.ts          # Contratos TypeBox y tipos estáticos TypeScript
│   │       ├── client.ts         # Cliente HTTP (fetch nativo, headers APIM)
│   │       ├── parser.ts         # Lógica pura de selección de serie y normalización
│   │       └── handler.ts        # Lambda Handler entrypoint
│   └── shared/
│       ├── config.ts             # Proveedor singleton de configuración (SSM / .env)
│       ├── db.ts                 # Conexión Mongoose singleton reutilizable
│       ├── utils.ts              # Utilidad de lotes concurrentes (chunking)
│       └── models/
│           ├── quota.model.ts    # Esquema Mongoose para cuotas (colección 'erni')
│           └── fund.model.ts     # Esquema Mongoose para catálogo (colección 'funds')
├── test/
│   └── scrapers/
│       └── erni.test.ts          # Tests unitarios TDD (cliente, parser, lotes)
├── infra/
│   ├── lib/
│   │   └── fondos-stack.ts       # Definición de ErniScraperFunction y EventBridge Rule
│   └── test/
│       └── fondos-stack.test.ts  # Verificación sintética con @aws-cdk/assertions
├── package.json                  # Inclusión de @sinclair/typebox, @aws-sdk/client-ssm
└── tsconfig.json                 # Configuración de compilación para src/
```

---

## Pila tecnológica y decisiones clave

### 1. Validación de Esquemas con `@sinclair/typebox`
- **Por qué:** TypeBox compila esquemas a JSON Schema estándar y genera tipos TypeScript puros (`Static<typeof Schema>`) en tiempo de compilación sin duplicar interfaces. En tiempo de ejecución, la validación se realiza mediante compiladores de tipo compilados o evaluadores de valor (`Value.Check` / `Value.Errors`), ofreciendo un rendimiento órdenes de magnitud más rápido y un impacto nulo en el arranque en frío (*cold start*).
- **Alternativas consideradas:**
  - *Zod:* Mayor peso en bundle y lentitud en evaluación de esquemas grandes con cientos de cuotas.
  - *Tipado TS manual sin validación runtime:* No protegería al sistema ante cambios inesperados de esquema por parte de Inteligo.
- **Implementación:**
  - `FondosActivosResponseSchema`: Valida `code === "SUCCESS"`, array de fondos, campos `idFondo`, `nombreFondo`, `moneda`, `riesgo` y `tarifarios`.
  - `InvertirResponseSchema`: Valida `code === "SUCCESS"` y el array `listaValorCuota` (`fecha`, `numeroValorCuota`).
  - `LambdaEventSchema`: Valida el payload de entrada opcional `{ months?: number }`.

### 2. Conexión Singleton a MongoDB Atlas en `src/shared/db.ts`
- **Por qué:** En entornos serverless, cada invocación de Lambda puede reutilizar el contenedor si está caliente (*warm start*). Si se abre una nueva conexión Mongoose en cada ejecución, se satura el límite de sockets del tier gratuito M0 de MongoDB Atlas.
- **Implementación:**
  - Almacenar `cachedPromise: Promise<typeof mongoose> | null` en el ámbito global del módulo.
  - Si `mongoose.connection.readyState === 1`, reutilizar inmediatamente.
  - Parámetros de conexión: `serverSelectionTimeoutMS: 5000`, `socketTimeoutMS: 30000`, `maxPoolSize: 5`.

### 3. Concurrencia Controlada por Lotes en `src/shared/utils.ts`
- **Por qué:** Disparar 22 peticiones concurrentes simultáneas (`Promise.all`) puede provocar HTTP 429 en el API Management de Inteligo. Ejecutarlas secuencialmente tardaría ~6 segundos.
- **Implementación:**
  - Función utilitaria `pMap<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency: number): Promise<R[]>` implementada sin dependencias externas pesadas.
  - Concurrencia fijada en `3` o `4` peticiones simultáneas, logrando que los 22 fondos se descarguen en $\sim 1.5$ a $2.0$ segundos de forma estable.

### 4. Recuperación de Secretos con Caché en Memoria (`src/shared/config.ts`)
- **Por qué:** La clave `ocp-apim-subscription-key` y la URI de MongoDB residen en SSM Parameter Store (`/fondos/prod/*`). Consultar SSM en cada invocación es redundante y añade latencia innecesaria.
- **Implementación:**
  - En local: lee directamente de `process.env`.
  - En Lambda: consulta SSM mediante `@aws-sdk/client-ssm` usando `GetParametersCommand` una sola vez en el primer arranque en frío y almacena los valores en memoria durante la vida útil del contenedor.

### 5. Idempotencia y Modelo Canónico en MongoDB Atlas
- **Por qué:** Previene registros duplicados si la Lambda se ejecuta más de una vez al día o ante reintentos de EventBridge.
- **Implementación:**
  - Colección `erni`: Modelo de cuotas con índice único compuesto `{ idFondo: 1, idSerie: 1, date: 1 }`. Las cuotas se actualizan con `bulkWrite`:
    ```typescript
    {
      updateOne: {
        filter: { idFondo, idSerie, date },
        update: { $set: { value } },
        upsert: true
      }
    }
    ```
  - Colección `funds`: Actualización de catálogo de fondos con filtro `{ idFondo, source: "erni" }` y `$set: { name, currency, risk, fee, serie, updatedAt }`.

---

## Secuencia de implementación

La implementación se ejecutará en 6 pasos progresivos y verificables:

### Paso 1: Configuración de Dependencias y TypeScript para `src/`
1. Instalar `@sinclair/typebox` en dependencias de producción.
2. Instalar `@aws-sdk/client-ssm`, `@types/aws-lambda`, `@types/node` en dependencias del proyecto.
3. Configurar `tsconfig.json` en la raíz para habilitar compilación modular de `src/` con `"strict": true`, `"moduleResolution": "bundler"` y alias de rutas.

### Paso 2: Capa Compartida (`src/shared/`)
1. Implementar `src/shared/utils.ts`: Helper de concurrencia controlada (`pMap`) y formateo de fechas ISO a medianoche UTC.
2. Implementar `src/shared/config.ts`: Proveedor de configuración con fallback `process.env` y resolución SSM.
3. Implementar `src/shared/models/quota.model.ts`: Modelo e índice compuesto para la colección `erni`.
4. Implementar `src/shared/models/fund.model.ts`: Modelo e índice para el catálogo dinámico en la colección `funds`.
5. Implementar `src/shared/db.ts`: Conexión singleton gestionada para MongoDB.

### Paso 3: Tipos y Contratos de Validación (`src/scrapers/erni/types.ts`)
1. Declarar esquemas TypeBox: `FondosActivosResponseSchema`, `InvertirResponseSchema`, `LambdaEventSchema`, `LambdaResultSchema`.
2. Exportar los tipos TypeScript estáticos inferidos (`Static<typeof ...>`).

### Paso 4: Cliente HTTP y Parseador Puro (`src/scrapers/erni/`)
1. Implementar `src/scrapers/erni/parser.ts`:
   - Función pura de selección de serie (`selectActiveSerie`): busca primero `isDigital: true` (Serie "C"), fallback a primer tarifario disponible (Serie "A" o "-").
   - Función pura de normalización de cuotas (`normalizeQuotas`): mapea `fecha` a `Date` UTC y `numeroValorCuota` a `value`.
2. Implementar `src/scrapers/erni/client.ts`:
   - `fetchFondosActivos(apiKey)`: Petición GET con validación TypeBox.
   - `fetchFondoInvertir(apiKey, params)`: Petición GET con validación TypeBox.
3. Implementar pruebas unitarias en `test/scrapers/erni.test.ts` con Vitest/Jest para verificar la selección de series ("C", "A", "-"), validación de esquemas y normalización con mocks.

### Paso 5: Lambda Handler de ERNI (`src/scrapers/erni/handler.ts`)
1. Orquestar el flujo completo:
   - Inicializar conexión a DB y obtener secretos.
   - Obtener fondos activos y upsertar en `funds`.
   - Iterar con concurrencia controlada (máximo 4) sobre los fondos con tarifarios válidos.
   - Capturar y reportar errores individuales sin abortar el procesamiento global.
   - Ejecutar `bulkWrite` masivo sobre `erni`.
   - Retornar payload JSON con métricas de ejecución.

### Paso 6: Infraestructura CDK y Automatización EventBridge (`infra/`)
1. En `infra/lib/fondos-stack.ts`, instanciar `ErniScraperFunction` utilizando `FondosFunction` apuntando a `src/scrapers/erni/handler.ts`.
2. Asignar regla de Amazon EventBridge Scheduler con expresión cron diaria: `cron(0 23 * * ? *)` (18:00 hora de Lima).
3. Conceder permisos IAM de lectura sobre `/fondos/prod/*` mediante el construct base.
4. Actualizar `infra/test/fondos-stack.test.ts` para verificar la creación de la función Lambda y su regla de scheduling.
5. Ejecutar `npm test` en `infra/` y `npx cdk synth`.

---

## Comprobación de la Constitución

| Principio de `constitution.md` | Cumplimiento en este Plan |
|---|---|
| **Presupuesto Estricto de $0.00 (Always Free)** | **Cumple:** 1 ejecución diaria de Lambda = 30-31 invocaciones/mes (límite gratis: 1,000,000). MongoDB Atlas M0 Sandbox gratis. EventBridge Scheduler gratis (14M/mes). SSM Parameter Store Standard a $0. |
| **Cero Secretos en el Repositorio** | **Cumple:** Clave de Inteligo (`ocp-apim-subscription-key`) y URI de MongoDB se inyectan desde SSM en AWS y desde `.env` en local. No existen valores quemados en código ni commits. |
| **Mínimo Privilegio IAM** | **Cumple:** El rol IAM de la Lambda solo tiene concedido `ssm:GetParameters` restringido a la ruta `arn:aws:ssm:*:*:parameter/fondos/prod/*` y permisos básicos de logs en CloudWatch. |
| **Fetch Nativo** | **Cumple:** Se utiliza exclusivamente el `fetch` nativo de Node.js 24. No se instala `axios`. |
| **Validación con Sinclair TypeBox** | **Cumple:** Todo contrato y payload externo se valida con `@sinclair/typebox`. |
| **Serverless Database Best Practice (Mongo Pool)** | **Cumple:** Conexión Mongoose singleton cacheada en el ámbito global del contenedor en `src/shared/db.ts` para reutilización entre llamadas cálidas. |
| **Test-Driven Development (TDD)** | **Cumple:** Se desarrollan pruebas unitarias automatizadas para el parser, cliente y concurrencia antes de desplegar. |
| **Coexistencia con Código Legado** | **Cumple:** El código en `legacy/` permanece intacto e inalterado. Todo nuevo desarrollo vive en `src/` e `infra/`. |
| **Sin logs ruidosos en Producción** | **Cumple:** Se emiten logs concisos y métricas resumidas con `console.info` y `console.error`, sin volcados de datos completos ni credenciales. |

---

## Suposiciones y preguntas abiertas

### Suposiciones:
1. **Contrato de API de Inteligo estable:** Se asume que el endpoint `fondos-activos` mantendrá su formato de respuesta actual (`code: "SUCCESS"`, campos `idFondo`, `tarifarios`, etc.).
2. **Corte diario de valores cuota:** Se asume que a las 23:00 UTC (18:00 Lima), Inteligo ya procesó y publicó los valores cuota correspondientes al cierre de mercado del día hábil.
3. **Persistencia aditiva:** Se asume que las cuotas ya existentes en MongoDB Atlas para fechas pasadas no deben eliminarse; el scraper opera de manera estrictamente aditiva/upsert.

### Preguntas abiertas:
- *Ninguna actualmente:* Todas las dudas sobre selección de series ("C" digital vs "A" presencial), parámetros de tiempo (`TiempoMeses = 1` por defecto, configurable para backfill) y uso de TypeBox fueron aclaradas y validadas en la fase `clarify`.
