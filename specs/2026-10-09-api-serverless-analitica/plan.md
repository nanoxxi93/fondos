# Plan de Implementación Técnico: API Serverless y Motor de Analítica (Fase 3)

## Información general sobre la arquitectura

Este plan define la estrategia técnica para la migración del motor analítico de rentabilidad neta (`legacy/tea.js`) y las rutas de consulta HTTP de Express hacia una arquitectura serverless desacoplada en AWS, compuesta por un motor de dominio en TypeScript puro (`src/domain/tea.ts`), un handler de AWS Lambda (`src/api/handler.ts`) expuesto mediante una **AWS Lambda Function URL** pública con HTTPS nativo y CORS, y un servidor ligero de desarrollo local (`src/api/run-local.ts`).

### Diagrama de Flujo y Arquitectura:
```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │            Cliente / SPA en Navegador (o invocación HTTP)              │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS GET / o /api/tea?days=30&currency=PEN
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │           AWS Lambda Function URL (Auth: NONE, CORS: *)                │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ Payload v2 (rawPath, queryStringParameters)
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                 Lambda Entrypoint: ApiFunction (TS)                    │
 │                                                                        │
 │   1. Inicializar/reutilizar pool de conexión a MongoDB Atlas (db.ts)   │
 │   2. Enrutador HTTP ultra ligero:                                      │
 │      - GET /health ─────────► isMongoReady() ──► 200 OK / 503          │
 │      - OPTIONS *   ─────────► CORS Preflight ──► 204 No Content        │
 │      - GET / o /api/tea:                                               │
 │         a. Validar queryStringParameters con TypeBox (days, currency)  │
 │         b. Normalizar ventana: since = toUtcMidnight(now) - days       │
 │         c. Invocar calculateTea({ days, currency, risk })              │
 │         d. Retornar 200 con Cache-Control: public, max-age=3600        │
 │      - Cualquier otra ruta ──► 404 / 405 con Cache-Control: no-store   │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                Motor Analítico de Dominio (src/domain/tea.ts)          │
 │                                                                        │
 │   - Consulta concurrente con Promise.all() a 'ernis', 'bbvas', 'tybas' │
 │   - Consulta y mapeo de catálogo dinámico desde colección 'funds'      │
 │   - Filtrado en memoria por moneda (PEN/USD) y riesgo (1-7)            │
 │   - Construcción de eje cronológico universal 'labels' (YYYY-MM-DD)    │
 │   - Normalización de variación relativa: ((val - first) / first) * 100 │
 │   - Rendimiento neto ponderado: ((last/first - 1) * (100 - fee))       │
 │   - Asignación determinística de colores HSL (colorFromKey)            │
 │   - Enriquecimiento de metadatos en 'meta' (idFondo, fee, source, etc) │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                       MongoDB Atlas (Tier M0)                          │
 │                                                                        │
 │   - Colección 'funds'   (metadatos canónicos de 60 fondos)             │
 │   - Colecciones de cuotas: 'ernis', 'bbvas', 'tybas' (series de tiempo)│
 └────────────────────────────────────────────────────────────────────────┘
```

### Estructura de Archivos a Crear / Modificar:
```text
fondos/
├── src/
│   ├── api/
│   │   ├── types.ts          # Esquemas TypeBox para query params y contratos de respuesta
│   │   ├── handler.ts        # Entrypoint Lambda para Function URL (enrutador y headers)
│   │   └── run-local.ts      # Servidor HTTP nativo local para desarrollo interactivo
│   ├── domain/
│   │   └── tea.ts            # Motor analítico puro de rentabilidad neta y datasets
│   └── shared/
│       └── utils.ts          # Helpers (colorFromKey, capitalize, toUtcMidnight)
├── infra/
│   ├── lib/
│   │   └── fondos-stack.ts   # Aprovisionamiento de ApiFunction y Function URL pública
│   └── test/
│       └── fondos-stack.test.ts # Tests de infraestructura CDK para Function URL y CORS
├── test/
│   ├── api/
│   │   └── handler.test.ts   # Tests unitarios del handler HTTP (rutas, errores, cabeceras)
│   └── domain/
│       └── tea.test.ts       # Tests unitarios del cálculo TEA, filtros y series
└── package.json              # Script 'api:local' para desarrollo en local
```

---

## Pila tecnológica y decisiones clave

### 1. AWS Lambda Function URL en lugar de Amazon API Gateway
- **Por qué:** Cumplimiento innegociable con el presupuesto \$0.00 (`specs/constitution.md`). Las Function URLs son un recurso Always Free incluido en el millón de invocaciones perpetuas de AWS Lambda, con soporte nativo para certificados HTTPS gestionados por AWS y cabeceras CORS integradas.
- **Alternativas consideradas:**
  - *Amazon API Gateway (HTTP APIs o REST APIs):* Descartado por incurrir en costos de \$1.00 por millón de solicitudes tras caducar el primer año de prueba gratuita de AWS.
  - *Application Load Balancer (ALB):* Descartado por costos fijos horarios mensuales.

### 2. Enrutador HTTP Mínimo Nativo en Lambda Handler en lugar de Express en Serverless
- **Por qué:** Un enrutador funcional de apenas ~30 líneas que evalúe `rawPath` y `requestContext.http.method` elimina la necesidad de empaquetar adaptadores pesados como `@vendia/serverless-express` o `aws-serverless-express`, reduciendo drásticamente el tamaño del artefacto (< 25 KB empaquetado con esbuild) y minimizando los arranques en frío (*cold start* < 1.0s).
- **Alternativas consideradas:**
  - *Express + Serverless Http adapter:* Descartado por sobrecarga de empaquetado, dependencias redundantes y lentitud en cold start.

### 3. Validación Estricta con `@sinclair/typebox`
- **Por qué:** Es el estándar del proyecto (`constitution.md`). Proporciona esquemas JSON Schema de alta velocidad, tipado estricto inferido en TypeScript (`Static<typeof Schema>`) y validación instantánea de `days`, `currency` y `risk` sin arrastrar validadores pesados.

### 4. Directivas de Caché HTTP Asimétricas
- **Por qué:** Las administradoras publican sus valores cuota únicamente una vez al día tras el cierre bursátil (entre las 23:00 y 23:15 UTC).
  - Respuestas HTTP 200 exitosas: `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`. Esto permite que navegadores y proxies intermedios reutilicen la respuesta durante 1 hora completa y revaliden asíncronamente durante 24 horas, reduciendo las invocaciones a la Lambda y las lecturas a MongoDB Atlas en más de un 95%.
  - Respuestas de error (4xx y 5xx): `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`. Previene que fallos transitorios de red o bases de datos queden cacheados por clientes (*negative caching prevention*).

### 5. Enriquecimiento de Metadatos en Datasets (`idFondo` y `fee`)
- **Por qué:** Aunque el legado de Chart.js requería campos básicos (`index`, `source`, `value`, `firstValue`, `lastValue`, `currency`, `risk`), enriquecer el objeto `meta` con `idFondo` y `fee` permite al futuro frontend de la Fase 4 (React + Vite) renderizar tarjetas detalladas y desgloses de comisión de administración sin consultas adicionales.

### 6. Servidor de Desarrollo Local con `node:http`
- **Por qué:** Siguiendo el principio de desarrollo ágil y autosuficiente, `src/api/run-local.ts` implementa un servidor HTTP nativo en Node.js que transforma las peticiones locales en eventos de Function URL v2 y llama directamente a `handler()`, permitiendo probar la API de forma interactiva en `http://localhost:3000` con `npm run api:local` contra MongoDB Atlas sin emular AWS.

---

## Secuencia de implementación

La implementación se llevará a cabo en 6 etapas lógicas siguiendo Test-Driven Development (TDD):

### Etapa 1: Tipos, Contratos y Esquemas TypeBox (`src/api/types.ts`)
- Definir `TeaQueryParamsSchema` con TypeBox para validar `{ days?, currency?, risk? }`.
- Definir tipos TypeScript para los datasets de Chart.js (`TeaDatasetMeta`, `TeaDataset`, `TeaChartData`).
- Definir esquema para respuestas de error `{ error: string, timestamp: string }`.

### Etapa 2: Migración del Motor Analítico a TypeScript Puro (`src/domain/tea.ts`)
- Implementar helpers visuales en `src/shared/utils.ts` (`colorFromKey`, `capitalize`).
- Implementar la función `calculateTea(options: TeaOptions): Promise<TeaChartData>`.
- Orquestar consultas concurrentes a `ErniQuotaModel`, `BbvaQuotaModel` y `TybaQuotaModel` filtrando por `date >= since`.
- Integrar resolución de metadatos desde `FundModel` con fallback a catálogos estáticos de BBVA y Tyba.
- Implementar normalización de cuotas y cálculo de variación neta de comisión:
  $$\text{rendimiento} = \text{round}_2\left(\left(\frac{\text{lastValue}}{\text{firstValue}} - 1\right) \times (100 - \text{fee})\right)$$
- Ordenar datasets alfabéticamente y generar la estructura completa de Chart.js.

### Etapa 3: Cobertura TDD del Motor Analítico (`test/domain/tea.test.ts`)
- Test unitario: cálculo exacto de rendimiento neto aplicando comisión de administración.
- Test unitario: normalización relativa porcentual frente al primer valor cuota.
- Test unitario: descarte de fondos con `firstValue === 0` o sin cotizaciones en el periodo.
- Test unitario: fondo con única cotización (`lastValue === firstValue`).
- Test unitario: filtros por moneda (`PEN`, `USD`) y riesgo máximo (1 a 7).
- Test unitario: fechas desalineadas entre fuentes con relleno de `null` en el eje universal.
- Test unitario: generación determinística de paletas de color HSL.

### Etapa 4: Lambda Handler de la API Serverless (`src/api/handler.ts`)
- Implementar extracción de rutas y métodos desde el evento de AWS Function URL v2 (`rawPath`, `requestContext.http.method`, `queryStringParameters`).
- Implementar endpoint `GET /health` conectado a `isMongoReady()`.
- Implementar endpoint `GET /` y `GET /api/tea` conectando TypeBox y `calculateTea()`.
- Implementar manejo de preflight `OPTIONS` y códigos HTTP 400, 404, 405, 500, 503.
- Inyectar cabeceras CORS (`Access-Control-Allow-Origin: *`) y cabeceras de caché asimétricas (`Cache-Control`).

### Etapa 5: Cobertura TDD del Lambda Handler (`test/api/handler.test.ts`)
- Test: respuesta HTTP 200 con `labels`, `datasets` y cabecera `Cache-Control: public, max-age=3600...`.
- Test: respuesta HTTP 200 en `GET /health` cuando Mongo está listo, y 503 cuando está desconectado.
- Test: validación TypeBox con HTTP 400 y `Cache-Control: no-store` ante parámetros inválidos (`days = -10`, `currency = "EUR"`).
- Test: respuesta HTTP 404 ante rutas no reconocidas y HTTP 405 ante métodos `POST`, `PUT`, `DELETE`.
- Test: respuesta HTTP 204 ante preflight `OPTIONS` con cabeceras CORS.
- Test: respuesta HTTP 500 ante error interno de base de datos sin filtrar secretos ni stacks.

### Etapa 6: Infraestructura AWS CDK y Servidor Local
- Implementar script local `src/api/run-local.ts` y registrar comando `npm run api:local` en `package.json`.
- Aprovisionar `ApiFunction` en `infra/lib/fondos-stack.ts` usando `FondosFunction` con Function URL pública y CORS.
- Exportar CloudFormation Output `ApiFunctionUrl`.
- Escribir tests de síntesis en `infra/test/fondos-stack.test.ts` con `@aws-cdk/assertions` verificando la creación de la Function URL y configuración CORS.

---

## Comprobación de la Constitución

Alineación estricta con los principios innegociables de `specs/constitution.md`:

| Principio Constitucional | Cumplimiento en este Plan |
|---|---|
| **Presupuesto Estricto de \$0.00 (Always Free)** | Uso exclusivo de AWS Lambda Function URLs sin costo de API Gateway. Reutilización de MongoDB Atlas M0 (512 MB gratuitos). Lectura de configuración vía SSM Parameter Store Standard. |
| **Fetch Nativo** | No se introducen dependencias HTTP pesadas (`axios`, etc.). |
| **Validación de Esquemas con Sinclair TypeBox** | Adopción de `@sinclair/typebox` para validar parámetros de consulta HTTP (`days`, `currency`, `risk`) y tipado estático seguro. |
| **Serverless Database Best Practice (Mongo Pool)** | Reutilización de la conexión de Mongoose en ámbito global mediante `src/shared/db.ts` con `context.callbackWaitsForEmptyEventLoop = false`. |
| **Test-Driven Development (TDD)** | Cobertura unitaria exhaustiva tanto para la lógica matemática de `tea.ts` como para el enrutador HTTP en `handler.ts` antes de la integración final. |
| **Sin logs ruidosos en Producción** | Logs estructurados mediante `console.error` descriptivo sin volcados ciegos de secretos ni trazas crudas al cliente. |
| **Coexistencia con Código Legado** | No se modifica el servidor monolítico de Fly.io (`legacy/`); la nueva API serverless reside de forma desacoplada en `src/api/` y `src/domain/`. |

---

## Suposiciones y preguntas abiertas

### Suposiciones:
1. **Normalización de cuotas existentes:** Se asume que las colecciones `ernis`, `bbvas` y `tybas` tienen sus documentos almacenados con el campo `date` en UTC medianoche y el campo numérico `value`, según las especificaciones previas de la Fase 2.
2. **Volumen de series temporales:** Para el periodo máximo habitual de 365 días en ~60 fondos activos ($\sim 21,900$ cuotas indexadas), la consulta agregada con `.lean()` y proyección mínima en MongoDB Atlas M0 se completa en menos de 300 ms, cumpliendo con holgura el objetivo de respuesta menor a 800 ms.
3. **Compatibilidad con Chart.js en Frontend:** Se asume que el frontend de la Fase 4 utilizará `spanGaps: true` en las opciones del gráfico de Chart.js para conectar visualmente observaciones con días no cotizados (fines de semana o feriados).
4. **Catálogo de metadatos:** Si algún fondo aún no figura en la colección `funds` (ej. recién incorporado o ejecución de ingesta pendiente), el motor analítico resolverá sus metadatos desde los diccionarios canónicos estáticos (`catalog.ts`), asegurando que ningún dataset tenga campos indefinidos.

### Preguntas abiertas:
- *Ninguna:* Todas las decisiones críticas (contrato Chart.js, caché de 1 hora, negative caching estricto, enriquecimiento de metadatos con `idFondo` y `fee`, y servidor local en `run-local.ts`) fueron consultadas y confirmadas durante la fase `clarify`.
