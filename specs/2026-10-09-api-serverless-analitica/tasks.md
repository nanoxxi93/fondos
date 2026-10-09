# Lista de Tareas: API Serverless y Motor de Analítica (Fase 3)

## Fase 1: Esquemas TypeBox y Utilidades Visuales (`src/api/`, `src/shared/`)
- [x] 1.1 Implementar `src/api/types.ts` con esquemas de validación TypeBox:
  - `TeaQueryParamsSchema`: validación estricta de `days` (entero 1 a 3650), `currency` (`"PEN"` o `"USD"`), `risk` (entero 1 a 7).
  - `TeaDatasetMetaSchema`, `TeaDatasetSchema` y `TeaChartDataResponseSchema` para contratos de datos de Chart.js con metadatos enriquecidos (`idFondo`, `fee`).
  - `ApiErrorResponseSchema` y `HealthResponseSchema`.
  - Exportar tipos estáticos TypeScript inferidos con `Static<typeof ...>`.
- [x] 1.2 Incorporar utilidades visuales en `src/shared/utils.ts`:
  - `capitalize(str: string)`: formateo legible de nombres de fondos.
  - `colorFromKey(key: string)`: cálculo determinístico de matiz HSL (`backgroundColor`, `borderColor`).
- [x] 1.3 Implementar pruebas unitarias para validación de esquemas y helpers en `test/api/types.test.ts` (o en suite de dominio).

*(No hay dependencias. Desbloquea el motor analítico de dominio).*

---

## Fase 2: Motor Analítico de Dominio TEA (`src/domain/tea.ts`)
- [x] 2.1 Implementar `calculateTea(options: TeaOptions): Promise<TeaChartData>` en `src/domain/tea.ts`:
  - Cálculo determinístico de fecha inicial `since` mediante `toUtcMidnight(now)` y resta de `days * 86_400_000` ms.
  - Consulta paralela con `Promise.all()` a las colecciones `ernis`, `bbvas` y `tybas` con filtro `{ date: { $gte: since } }` y ordenación `{ date: 1 }`.
  - Resolución dinámica de catálogo desde la colección `funds` con fallback a catálogos canónicos locales.
  - Filtrado en memoria por moneda (`currency`) y nivel de riesgo (`risk <= maxRisk`).
  - Construcción del eje cronológico universal `labels` con fechas `YYYY-MM-DD` únicas ordenadas.
  - Normalización de variación relativa porcentual `((val - first) / first) * 100` y relleno de `null` en fechas sin cotización.
  - Cálculo de variación neta de comisión anual: `round_2(((last / first) - 1) * (100 - fee))`.
  - Generación de datasets ordenados alfabéticamente con metadatos enriquecidos (`index`, `idFondo`, `source`, `value`, `firstValue`, `lastValue`, `fee`, `currency`, `risk`).
- [x] 2.2 Implementar suite exhaustiva de pruebas unitarias en `test/domain/tea.test.ts` con Vitest:
  - Cálculo matemático exacto de rendimiento neto aplicando comisión de administración.
  - Normalización relativa porcentual frente a primera cuota observada.
  - Descarte de fondos con cotización inicial cero (`firstValue === 0`) o sin registros en el periodo.
  - Manejo de fondos con una sola cotización en la ventana (`lastValue === firstValue`).
  - Filtros por moneda (`PEN`, `USD`) y riesgo máximo (1 a 7).
  - Fechas desalineadas entre fuentes bancarias con relleno de `null` en el eje universal.
  - Paletas de colores determinísticas basadas en hash HSL.

*(Depende de la Fase 1. Desbloquea el Lambda handler).*

---

## Fase 3: Lambda Handler Serverless y Enrutador HTTP (`src/api/handler.ts`)
- [x] 3.1 Implementar `src/api/handler.ts` procesando eventos de AWS Lambda Function URL (formato payload v2):
  - Extracción segura de método HTTP (`requestContext.http.method`), ruta (`rawPath`) y query params.
  - Reutilización de conexión a MongoDB Atlas mediante `connectToDatabase()` (`src/shared/db.ts`).
  - Enrutamiento de `GET /health` invocando `isMongoReady()` respondiendo HTTP 200 OK o HTTP 503 Service Unavailable.
  - Enrutamiento de `GET /` y `GET /api/tea`: parseo de query params con saneamiento seguro, validación con TypeBox y ejecución de `calculateTea()`.
  - Inyección de cabecera `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` en respuestas 200.
  - Inyección de cabecera `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` en respuestas de error (4xx y 5xx).
  - Manejo de preflight `OPTIONS` retornando HTTP 204 con cabeceras CORS.
  - Manejo de métodos no permitidos (HTTP 405 Method Not Allowed con `Allow: GET, OPTIONS`) y rutas no encontradas (HTTP 404 Not Found).
  - Manejo de excepciones capturadas con `console.error` respondiendo HTTP 500 sin filtrar secretos ni stack traces.
- [x] 3.2 Implementar suite de pruebas unitarias para el handler en `test/api/handler.test.ts` con Vitest:
  - Cobertura de todas las rutas (`/`, `/api/tea`, `/health`, rutas 404, métodos 405).
  - Verificación de cabeceras CORS y directivas de caché `Cache-Control` (éxito vs error).
  - Verificación de validación TypeBox ante query params inválidos (HTTP 400).
  - Verificación de desconexión de MongoDB Atlas en `/health` (HTTP 503).

*(Depende de la Fase 2. Desbloquea la infraestructura CDK y runner local).*

---

## Fase 4: Servidor Local e Infraestructura AWS CDK
- [x] 4.1 Implementar servidor HTTP local nativo `src/api/run-local.ts` (`node:http`):
  - Adaptación de peticiones entrantes locales a eventos Function URL v2.
  - Registro del script `"api:local": "tsx src/api/run-local.ts"` en `package.json`.
- [x] 4.2 Aprovisionar `ApiFunction` en `infra/lib/fondos-stack.ts`:
  - Construct `FondosFunction` con entrypoint `src/api/handler.ts`, 256 MB RAM y timeout de 15 segundos.
  - Creación de AWS Lambda Function URL pública con `FunctionUrlAuthType.NONE`.
  - Configuración nativa de CORS (`allowOrigins: ['*']`, `allowMethods: ['GET']`, `allowHeaders: ['content-type']`).
  - Exportación de CloudFormation Output `ApiFunctionUrl`.
- [x] 4.3 Implementar pruebas sintéticas en `infra/test/fondos-stack.test.ts` con `@aws-cdk/assertions`:
  - Verificación de creación de `ApiFunction` y recurso `AWS::Lambda::Url`.
  - Verificación de configuración CORS y permisos de invocación pública.

*(Depende de la Fase 3. Desbloquea la fase de QA y cierre).*

---

## Fase 5: Control de Calidad y Validación de Gobernanza
- [x] 5.1 Ejecución completa de suites de pruebas con cobertura: `npm test` y `npm --prefix infra test`.
- [x] 5.2 Verificación de gobernanza SDD y Constitución:
  - Ejecutar `python scripts/validate_sdd.py`.
  - Ejecutar `python scripts/check_constitution.py`.
- [x] 5.3 Actualización de `CHANGELOG.md` y `specs/roadmap.md`.

*(Depende de la Fase 4).*
