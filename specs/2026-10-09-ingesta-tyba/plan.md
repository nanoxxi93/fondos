# Plan de Implementación Técnico: Ingesta Serverless de Tyba

## Información general sobre la arquitectura

Este plan define la estrategia de ingeniería para implementar el componente de ingesta serverless de fondos mutuos y portafolios de Tyba (Credicorp Capital) bajo AWS Lambda con Node.js 24 y TypeScript estricto. A diferencia de las fuentes públicas (ERNI y BBVA), la ingesta de Tyba opera bajo demanda manual suministrando el Bearer token JWT (`authorization`) y la prueba criptográfica de app (`x-app-proof`) directamente en el payload del evento.

### Diagrama de Flujo y Componentes:
```text
 ┌────────────────────────────────────────────────────────────┐
 │  Invocación Manual (AWS CLI, Consola AWS o run-local.ts)   │
 │  Payload: { authorization, xAppProof, refreshToken?, ... } │
 └─────────────────────────────┬──────────────────────────────┘
                               │ (Evento)
                               ▼
 ┌────────────────────────────────────────────────────────────┐
 │           AWS Lambda: TybaScraperFunction (TS)             │
 │                                                            │
 │   1. Inicializar conexión MongoDB (Singleton global)       │
 │   2. Validar payload del evento con @sinclair/typebox      │
 │      - Normalizar authorization (remover prefijo 'Bearer') │
 │      - Resolver xAppProof / x-app-proof                    │
 │      - Extraer refreshToken opcional                       │
 │   3. Sincronizar catálogo (/v2/portfolios/sqi?product=...) │
 │      - Si 401 y hay refreshToken: autorefresco y reintento │
 │      - Si falla (4xx/5xx/timeout): Abortar con HTTP 502    │
 │      - Si responde OK: Enriquecer metadatos en 'funds'     │
 │   4. Extraer valores cuota con pMap concurrente (max 4)    │
 │      - GET /portfolios/{idFondo}/historic-performance      │
 │      - Si 401 y hay refreshToken: renovación coordinada    │
 │        single-flight y reintento transparente              │
 │      - Validar con TypeBox (graphData)                     │
 │      - Recortar cuotas: graphData.slice(-days) o all: true │
 │      - Normalizar a medianoche UTC (date, value, null)     │
 │   5. Upsert masivo idempotente en colección 'tybas'        │
 │   6. Retornar resumen métrico estructurado (HTTP 200)      │
 └──────────────┬───────────────────────────────┬─────────────┘
                │                               │
                ▼                               ▼
 ┌───────────────────────────┐   ┌────────────────────────────┐
 │     Tyba API Endpoints    │   │     MongoDB Atlas (M0)     │
 │                           │   │                            │
 │ - /portfolios/sqi         │   │ - Colección 'funds'        │
 │ - /portfolios/{id}/...    │   │ - Colección 'tybas'(cuotas)│
 │ - /auth/refresh-token     │   │                            │
 └───────────────────────────┘   └────────────────────────────┘
```

### Estructura de Archivos a Crear / Modificar:
```text
fondos/
├── src/
│   ├── scrapers/
│   │   └── tyba/
│   │       ├── catalog.ts        # Catálogo canónico base (30 fondos legacy de Credicorp Capital)
│   │       ├── crypto.ts         # Generación criptográfica RSA-4096 OAEP de x-app-proof
│   │       ├── types.ts          # Contratos TypeBox y tipos estáticos TypeScript
│   │       ├── client.ts         # Cliente HTTP con fetch nativo para catálogo y cuotas
│   │       ├── parser.ts         # Lógica pura de normalización, recorte y sanitización
│   │       ├── handler.ts        # Lambda Handler entrypoint
│   │       └── run-local.ts      # Script de prueba local interactivo
│   └── shared/
│       └── models/
│           └── quota.model.ts    # Exportación de TybaQuotaModel (colección 'tybas')
├── test/
│   └── scrapers/
│       └── tyba.test.ts          # Pruebas unitarias TDD con Vitest (parser, client, handler)
├── infra/
│   ├── lib/
│   │   └── fondos-stack.ts       # Definición de TybaScraperFunction (sin Scheduler)
│   └── test/
│       └── fondos-stack.test.ts  # Verificación sintética con @aws-cdk/assertions
└── specs/
    └── 2026-10-09-ingesta-tyba/
        ├── spec.md
        ├── plan.md
        ├── tasks.md
        └── checklist.md
```

---

## Pila tecnológica y decisiones clave

### 1. Validación de Esquemas con `@sinclair/typebox`
- **Por qué:** Mantiene estricta paridad con ERNI y BBVA. Valida el evento de entrada garantizando que las cabeceras `authorization` y `x-app-proof` tengan longitud mínima y formato válido antes de efectuar llamadas salientes, y valida la estructura de `graphData` devuelta por Tyba.
- **Alternativas consideradas:**
  - *Comprobaciones condicionales `typeof` manuales:* Frágiles y propensas a omitir validaciones de tipos anidados.
- **Implementación:**
  - `TybaLambdaEventSchema`: Acepta `authorization`, `xAppProof`, `x-app-proof`, `days` (opcional entero $\ge 1$), `all` (opcional booleano) y `syncCatalog` (opcional booleano).
  - `TybaPortfoliosResponseSchema`: Valida arreglos `recommended` y `notRecommended` con `id`, `name`, `currency`, `comission`, `risk`, etc.
  - `TybaHistoricPerformanceResponseSchema`: Valida `graphData: Array<{ interval: string, value: number }>`.
  - `TybaLambdaResultSchema`: Estructura el resumen de ejecución con `statusCode: 200`, `summary` y conteo de cuotas sincronizadas.

### 2. Recorte de Cuotas Fiel al Comportamiento Legacy (`slice(-days)`)
- **Por qué:** En el código legado (`legacy/tyba.js`), el endpoint histórico no acepta rangos de fecha por URL; devuelve la serie histórica completa. El código realizaba `json.graphData?.slice(-days)`. Debido a que Tyba entrega observaciones espaciadas cada 6 días en periodos antiguos y diarias en recientes, el uso de `.slice(-days)` garantiza que si se solicitan 30 cuotas, se persistan exactamente los últimos 30 registros disponibles sin descalibrar series con frecuencias heterogéneas. Si se especifica `all: true`, se persiste la totalidad del arreglo sin recorte.
- **Alternativas consideradas:**
  - *Filtro por fecha calendario (`date >= now - days`):* Podría descartar fondos con baja periodicidad de reporte si no hubo cuotas en los últimos días calendario.

### 3. Aborto Inmediato ante Fallo del Catálogo (`/v2/portfolios/sqi`)
- **Por qué:** Si la llamada al endpoint de catálogo falla (error 4xx/5xx o de red), la Lambda se detiene inmediatamente y devuelve HTTP 502 Bad Gateway. Esto previene sincronizar cuotas con un catálogo desfasado o con comisiones corruptas, asegurando la consistencia e integridad analítica.
- **Alternativas consideradas:**
  - *Continuar silenciosamente con catálogo en memoria:* Podría ocultar problemas de autenticación global en Tyba y generar estados parciales inconsistentes.

### 4. Normalización Flexible de Cabeceras
- **Por qué:** Los operadores suelen copiar el token desde las herramientas de desarrollador del navegador (DevTools) ya sea como Bearer token (`Bearer eyJ...`) o como JWT directo (`eyJ...`), y la cabecera de firma como `x-app-proof` o `xAppProof`.
- **Implementación:**
  - `const token = event.authorization.replace(/^Bearer\s+/i, '').trim()`
  - `const appProof = (event.xAppProof ?? event['x-app-proof'] ?? '').trim()`

### 5. Invocación Manual en AWS CDK (`TybaScraperFunction`)
- **Por qué:** Al requerir usuario y contraseña interactivos para obtener la sesión, no es viable programar un cron automático con EventBridge.
- **Implementación:**
  - En `infra/lib/fondos-stack.ts`, se crea la Lambda `TybaScraperFunction` con memoria de 256 MB y timeout de 60 segundos usando el construct `FondosFunction`.
  - **Sin regla de EventBridge Scheduler**: La función queda disponible exclusivamente para invocación manual bajo demanda.

### 6. Persistencia Idempotente en MongoDB Atlas (`src/shared/models/quota.model.ts`)
- **Por qué:** Mongoose mapea el identificador `"tyba"` a la colección `"tybas"`, exactamente idéntico al comportamiento del código legado (`createQuotaModel("tyba")`).
- **Implementación:**
  - Se exporta `TybaQuotaModel = getQuotaModel("tyba")`.
  - Cada cuota se normaliza con `{ idFondo: string, idSerie: null, date: Date, value: number }`.
  - Operación masiva desordenada `bulkWrite` con filtro `{ idFondo, idSerie, date }` y `$set: { value }`.

### 7. Renovación Automática de Token ante HTTP 401 (`refreshToken`)
- **Por qué:** Los tokens de acceso JWT de Tyba expiran típicamente a los 5 minutos (`exp - iat = 300s`). Si una sincronización masiva o invocación inicia con un token próximo a expirar, las consultas subsiguientes devuelven HTTP 401 Unauthorized. Recibir el `refreshToken` permite autorefrescar la sesión sin abortar la ejecución.
- **Implementación:**
  - Endpoint: `POST https://tyba.io/api-master/auth/refresh-token` con payload `{ refreshToken }`.
  - Retorna `{ token: "<newToken>" }`.
  - Si una petición devuelve error 401 y hay `refreshToken`, se solicita un nuevo token, se actualiza el token en memoria y se reintenta la petición.
  - Para evitar carreras entre las 4 promesas concurrentes de `pMap`, la renovación se centraliza con una promesa compartida (single-flight lock).

### 8. Auto-generación Criptográfica de `x-app-proof` (`src/scrapers/tyba/crypto.ts`)
- **Por qué:** La cabecera `x-app-proof` de Tyba es efímera, ruta-específica y cambia con cada petición HTTP (`method`, `route`, `reqUTCDate`, `sourceApp`, `versionNumber`). Exigir que el operador copie esta cabecera manualmente para 30 fondos distintos resulta impráctico e inviable. Mediante ingeniería inversa del cliente oficial Flutter Web (`web.tyba.pe`), se extrajo la clave pública RSA de 4096 bits y el algoritmo canónico de firma.
- **Implementación:**
  - `crypto.publicEncrypt` nativo de `node:crypto` con `RSA_PKCS1_OAEP_PADDING` y `oaepHash: 'sha256'`.
  - Construye el payload `{ versionNumber: "5.65.3", method, route, reqUTCDate: ISOString, sourceApp: "TYBA_WEB_PE" }` y genera 512 bytes cifrados codificados en Base64 (684 caracteres).
  - Integrado de forma transparente en `buildTybaHeaders()`, autogenerando un `x-app-proof` fresco y específico para cada ruta consultada, permitiendo que el operador solo proporcione `authorization`.

---

## Contratos de Datos y Esquemas TypeBox

### 1. Evento de Invocación de Lambda:
```typescript
export const TybaLambdaEventSchema = Type.Object({
  authorization: Type.String({ minLength: 20 }),
  xAppProof: Type.Optional(Type.String({ minLength: 20 })),
  'x-app-proof': Type.Optional(Type.String({ minLength: 20 })),
  refreshToken: Type.Optional(Type.String({ minLength: 20 })),
  'refresh-token': Type.Optional(Type.String({ minLength: 20 })),
  days: Type.Optional(Type.Integer({ minimum: 1, maximum: 3650 })),
  all: Type.Optional(Type.Boolean()),
  syncCatalog: Type.Optional(Type.Boolean()),
});
```

### 2. Respuesta de Refresh Token (`/auth/refresh-token`):
```typescript
export const TybaRefreshTokenResponseSchema = Type.Object(
  {
    token: Type.String({ minLength: 20 }),
  },
  { additionalProperties: true }
);
```

### 3. Respuesta de Catálogo de Portafolios (`/v2/portfolios/sqi`):
```typescript
export const TybaPortfolioItemSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    currency: Type.Union([Type.Literal('PEN'), Type.Literal('USD')]),
    assetType: Type.Optional(Type.String()),
    risk: Type.Optional(Type.String()),
    riskLevel: Type.Optional(Type.String()),
    comission: Type.Optional(Type.Number()),
  },
  { additionalProperties: true }
);

export const TybaPortfoliosResponseSchema = Type.Object(
  {
    recommended: Type.Array(TybaPortfolioItemSchema),
    notRecommended: Type.Array(TybaPortfolioItemSchema),
  },
  { additionalProperties: true }
);
```

### 3. Rendimiento Histórico (`/portfolios/{id}/historic-performance`):
```typescript
export const TybaHistoricPointSchema = Type.Object({
  interval: Type.String(), // "YYYY-MM-DD"
  value: Type.Number(),
});

export const TybaHistoricPerformanceResponseSchema = Type.Object(
  {
    graphData: Type.Array(TybaHistoricPointSchema),
  },
  { additionalProperties: true }
);
```

### 4. Resultado de la Lambda:
```typescript
export const TybaExecutionSummarySchema = Type.Object({
  totalFondos: Type.Number(),
  procesados: Type.Number(),
  fallidos: Type.Number(),
  cuotasSincronizadas: Type.Number(),
});

export const TybaLambdaResultSchema = Type.Object({
  statusCode: Type.Literal(200),
  source: Type.Literal('tyba'),
  timestamp: Type.String(),
  summary: TybaExecutionSummarySchema,
});
```

---

## Catálogo Canónico Base (30 Fondos de Credicorp Capital)

| UUID | Nombre Base | Moneda | Riesgo (1-7) | Comisión (%) |
|---|---|---|---|---|
| `4f28ebf4-6d3c-53f0-9a48-8e415e83f323` | CC Acciones China | USD | 7 | 1.0252% |
| `3cad7d53-9f01-504f-b6fb-0eccf5d9bb4d` | CC Acciones LATAM | USD | 7 | 1.5200% |
| `a07f3416-7f92-40a5-97c7-c3f74199f79a` | CC Duración Objetivo Latam | USD | 4 | 0.7200% |
| `bbf51aa8-0bf4-5559-8688-93b31b207b59` | CC Acciones Innovación | USD | 7 | 1.0000% |
| `daac03ec-1ba3-52b4-a285-7f194dd42680` | CC Acciones (Perú) | USD | 7 | 3.5000% |
| `1730784c-4e44-5c91-88cc-d493e65bcea6` | CC Acciones Estados Unidos | USD | 7 | 1.0000% |
| `d32bf791-d171-587d-93f9-b00744fedf59` | CC Crecimiento VCS | PEN | 7 | 3.2500% |
| `1da207ad-9565-5c76-a7c6-b737bef8ed91` | CC Tendencias Globales | USD | 7 | 1.0200% |
| `1ed5d0bb-f31f-506e-93f4-2d05025a08cd` | CC Acciones Sector Seguridad | USD | 7 | 1.0000% |
| `c3a4ac8b-e33a-5b61-ba4c-75eae3ec035b` | CC Acciones Global | USD | 7 | 1.7500% |
| `c15ba775-320a-579a-88bf-535e5d3e1ae8` | CC Equilibrado | USD | 4 | 3.0000% |
| `edb6dd05-47c6-575d-86c1-bce019804635` | CC Acciones Europa | USD | 7 | 1.0000% |
| `20711166-937a-5665-9430-c08e0872da48` | CC Renta Futura II Soles | PEN | 7 | 1.3252% |
| `8c2f0120-5156-53ca-b9e7-7fb7059a3a6b` | CC Renta Futura III | USD | 7 | 1.6000% |
| `ddff9d87-4c36-5926-af27-b0af189c1cc9` | CC Moderado VCS | PEN | 4 | 2.7500% |
| `1c28975a-60d2-5eb9-a20b-c73519208ef4` | CC Renta Futura II | USD | 7 | 1.3000% |
| `161059a2-5cfa-5524-81a6-882c8e050476` | CC Deuda Flotante | USD | 4 | 1.0000% |
| `375a7a9c-e76f-5718-b437-b6a0e25706bd` | CC Consumo Global | USD | 7 | 1.0000% |
| `311d3341-e64e-5a1b-b7bf-23f43f33fcac` | CC Moderado | USD | 4 | 2.7500% |
| `e004b6e4-a93f-56a4-9611-540b8c29c9b8` | CC Activos Preferentes | USD | 4 | 1.0000% |
| `e18b3494-ddf6-5edc-886a-7d2805d91a43` | CC Mediano Plazo Soles | PEN | 1 | 1.4000% |
| `c3be60ae-96f8-57e7-adc1-cb1aba33bbc6` | CC Deuda High Yield Global | USD | 4 | 1.0000% |
| `da592a0c-c3a8-57b8-9acc-9eda4334f9ab` | CC Conservador Corto Plazo Soles | PEN | 1 | 1.0500% |
| `e0a2b151-a1f6-5593-9fe6-e74881088152` | CC Mediano Plazo Dólares | USD | 1 | 1.4000% |
| `bd2445cd-a8b1-5d84-9e32-5838e19d78e1` | CC Liquidez Soles | PEN | 1 | 0.7700% |
| `f917fe6f-c8b4-5ef2-bcb7-68b2007db0c0` | CC Renta Futura I | USD | 4 | 1.0000% |
| `50d70f0c-8e7e-5077-9eaf-53df7ad82e0f` | CC Conservador Corto Plazo Dólares | USD | 1 | 0.7600% |
| `b90e05f6-8b3f-5448-81cb-0f7a9eaad358` | CC Liquidez Dólares | USD | 1 | 0.5400% |
| `09abc36a-3d6b-5427-9aca-c6a0e35017cd` | CC Deuda Global | USD | 4 | 0.9500% |
| `ea4305df-ff68-5707-9482-0a0e121c6b63` | CC Acciones Asia | USD | 7 | 1.0000% |

---

## Secuencia de implementación

La implementación se ejecutará en 6 pasos progresivos y verificables mediante TDD:

### Paso 1: Modelo de Base de Datos (`src/shared/models/quota.model.ts`)
1. Exportar `TybaQuotaModel = getQuotaModel("tyba")` asegurando la conexión hacia la colección `tybas` de MongoDB.

### Paso 2: Catálogo Canónico y Contratos TypeBox (`src/scrapers/tyba/`)
1. Crear `src/scrapers/tyba/catalog.ts` con el diccionario base de 30 fondos de Credicorp Capital.
2. Crear `src/scrapers/tyba/types.ts` con los contratos TypeBox para el evento (incluyendo `refreshToken` y `refresh-token`), respuestas de catálogo, refresh token y cuotas históricas.

### Paso 3: Parser y Lógica Pura (`src/scrapers/tyba/parser.ts`)
1. Implementar `sanitizeAuthToken(raw: string)`: remueve prefijo `Bearer ` y espacios en blanco.
2. Implementar `resolveAppProof(event: any)`: extrae `xAppProof` o `x-app-proof`.
3. Implementar `resolveRefreshToken(event: any)`: extrae `refreshToken` o `refresh-token`.
4. Implementar `normalizeHistoricQuotas(idFondo: string, points: TybaHistoricPoint[], days?: number, all?: boolean)`:
   - Aplica `.slice(-days)` (por defecto 30) o toma todo si `all === true`.
   - Mapea cada punto a `{ idFondo, idSerie: null, date: parseUtcMidnight(interval), value }`.
5. Implementar `mapPortfolioMetadata(item: TybaPortfolioItem)`: normaliza moneda, mapeo de riesgo textual (LOW/MEDIUM/HIGH a 1/4/7) y comisión.

### Paso 4: Cliente HTTP de Tyba (`src/scrapers/tyba/client.ts`)
1. Implementar `refreshAuthToken(refreshToken: string)`: invoca `POST /api-master/auth/refresh-token` y retorna el nuevo token saneado.
2. Implementar `fetchPortfoliosCatalog(authorization: string, appProof: string)`: consulta `GET /v2/portfolios/sqi?product=PARKER&orderByProfitability=true` con validación TypeBox.
3. Implementar `fetchHistoricPerformance(idFondo: string, authorization: string, appProof: string)`: consulta `GET /portfolios/{idFondo}/historic-performance` con validación TypeBox.

### Paso 5: Suite de Pruebas Unitarias TDD (`test/scrapers/tyba.test.ts`)
1. Pruebas del parser (saneamiento de Bearer, resolución de app-proof y refresh-token, recorte `slice(-days)` y `all: true`, truncado de fechas UTC).
2. Pruebas de validación TypeBox (respuestas válidas, errores de esquema, eventos con o sin refreshToken).
3. Pruebas del cliente con mocks (gestión de cabeceras, refresco de token, manejo de 401/403/502).
4. Pruebas de integración del handler con mocks de base de datos y autorefresco ante 401 con reintento exitoso.

### Paso 6: Lambda Handler y Script Local (`src/scrapers/tyba/`)
1. Implementar `src/scrapers/tyba/handler.ts`:
   - Valida evento de entrada (rechaza con 400 si faltan credenciales obligatorias).
   - Conecta a MongoDB vía singleton `src/shared/db.ts`.
   - Soporte de reintento transparente ante error 401 usando `refreshToken` con mutex / single-flight promise.
   - Consulta catálogo y enriquece `funds` (aborta con 502 si falla).
   - Itera los fondos con `pMap` (concurrencia máx = 4) y ejecuta `bulkWrite` sobre `tybas`.
   - Retorna resumen con `statusCode: 200`.
2. Implementar `src/scrapers/tyba/run-local.ts`: script interactivo para pruebas locales con soporte `--refresh-token`, `--dry-run`, flags CLI y fallback a `.env`.

### Paso 7: Infraestructura AWS CDK (`infra/`)
1. En `infra/lib/fondos-stack.ts`, instanciar `TybaScraperFunction` usando `FondosFunction` sin regla de EventBridge Scheduler.
2. Actualizar pruebas sintéticas en `infra/test/fondos-stack.test.ts` verificando la creación de la Lambda y la ausencia de Scheduler.

---

## Comprobación de la Constitución

| Principio de `constitution.md` | Cumplimiento en este Plan |
|---|---|
| **Presupuesto Estricto de $0.00 (Always Free)** | **Cumple:** Al ser una Lambda de invocación manual, no genera consumo recurrente de EventBridge ni ejecuciones desatendidas. El cómputo en ejecuciones manuales es ínfimo y encaja holgadamente en el límite gratuito perpetuo (1M invocaciones y 400,000 GB-s). |
| **Cero Secretos en el Repositorio** | **Cumple:** Los tokens de sesión privada se reciben exclusivamente en tiempo de ejecución en el evento de la Lambda o en `.env` local. No se queman credenciales en ningún archivo. |
| **Mínimo Privilegio IAM** | **Cumple:** El rol IAM de la Lambda solo posee permisos para emitir logs en CloudWatch y lectura en SSM para la URI de MongoDB Atlas. |
| **Fetch Nativo** | **Cumple:** Se utiliza exclusivamente el `fetch` nativo de Node.js 24. Prohibido `axios`. |
| **Validación con Sinclair TypeBox** | **Cumple:** Todo contrato de entrada (evento Lambda) y salida de la API de Tyba se valida con `@sinclair/typebox`. |
| **Serverless Database Best Practice (Mongo Pool)** | **Cumple:** Conexión Mongoose singleton cacheada en el ámbito global del contenedor en `src/shared/db.ts`. |
| **Test-Driven Development (TDD)** | **Cumple:** Se crean pruebas unitarias automatizadas exhaustivas con Vitest en `test/scrapers/tyba.test.ts` antes de dar por cerrada la fase. |
| **Coexistencia con Código Legado** | **Cumple:** `legacy/tyba.js` permanece inalterado. Todo nuevo código reside en `src/scrapers/tyba/`. |
| **Sin logs ruidosos en Producción** | **Cumple:** Los tokens de sesión se ocultan y nunca se imprimen en logs. Se emiten resúmenes concisos con `console.info` y `console.error`. |

---

## Suposiciones y preguntas abiertas

### Suposiciones:
1. **Validez del Token de Sesión:** Se asume que el operador ingresa un token `authorization` y un `x-app-proof` activos obtenidos de una sesión reciente en `web.tyba.pe`.
2. **Estructura de `graphData`:** Se asume que la respuesta histórica de Tyba mantiene el formato `interval: "YYYY-MM-DD"` y `value: number` en todos los portafolios.
3. **Persistencia en colección `tybas`:** Se asume que la colección histórica en MongoDB Atlas es `tybas`, manteniendo compatibilidad total con la colección creada por el código legado.

### Preguntas abiertas:
- *Ninguna:* Todas las decisiones sobre el recorte `slice(-days)`, el aborto ante fallo de catálogo (502), el formato flexible de `Bearer` y la ausencia de EventBridge fueron resueltas y ratificadas en las fases previas de SDD.
