# Lista de Comprobación y QA: Ingesta Serverless de Tyba

## Entornos de Prueba Requeridos
- **Entorno CLI Local:** Windows con Node.js 24+ (`v24.19.0`) y npm 12+.
- **Base de Datos:** MongoDB Atlas M0 Sandbox (o conexión local con Mongoose).
- **API Externa:** Endpoints de Tyba (`/api-master/robo-advisor/v2/portfolios/sqi`, `/portfolios/{id}/historic-performance`).
- **AWS CDK CLI:** AWS CDK v2 para síntesis de CloudFormation y verificación de infraestructura en `infra/`.
- **Framework de Testing:** Vitest para pruebas unitarias de `src/` y Jest para `infra/`.
- **Python 3.x:** Para validadores de gobernanza `validate_sdd.py` y `check_constitution.py`.

---

## Casos de Prueba (Criterios de Aceptación)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|:---:|---|
| CA-1 | CLI Local / Tests | 1. Invocar Lambda handler sin `authorization` o con token vacío (< 20 caracteres). | Retorna código HTTP 400 indicando que `authorization` es obligatorio. | [x] | Validación en `handler.ts`. `xAppProof` es opcional y se autogenera si se omite. |
| CA-2 | CLI Local / Tests | 1. Pasar token con prefijo `Bearer eyJ...` a `sanitizeAuthToken()`. | Se remueve el prefijo `Bearer ` quedando el token JWT crudo exacto. | [x] | Testeado en `test/scrapers/tyba.test.ts`. |
| CA-3 | CLI Local / Tests | 1. Suministrar payload con `xAppProof` o con `x-app-proof`. | `resolveAppProof()` extrae el valor correctamente en ambos formatos. | [x] | Testeado en `test/scrapers/tyba.test.ts`. |
| CA-4 | CLI Local / Tests | 1. Consultar catálogo `/v2/portfolios/sqi?product=PARKER`.<br>2. Validar respuesta con `TybaPortfoliosResponseSchema`. | HTTP 200 y validación de arreglos `recommended` y `notRecommended` con sus metadatos. | [x] | Mapeo y enriquecimiento de colección `funds`. |
| CA-5 | CLI Local / Tests | 1. Consultar `/portfolios/{idFondo}/historic-performance` para un fondo de Credicorp Capital.<br>2. Validar con `TybaHistoricPerformanceResponseSchema`. | HTTP 200 y obtención del arreglo `graphData` con elementos `{ interval, value }`. | [x] | Validado en cliente HTTP con mocks. |
| CA-6 | CLI Local / Tests | 1. Ejecutar `normalizeHistoricQuotas()` con `days = 30` (por defecto). | Se recortan las últimas 30 observaciones mediante `slice(-30)` con fechas en UTC medianoche y `idSerie: null`. | [x] | Paridad fiel con el código de `legacy/tyba.js`. |
| CA-7 | CLI Local / Tests | 1. Ejecutar `normalizeHistoricQuotas()` con bandera `all: true`. | Se conserva la totalidad de los puntos de `graphData` sin recorte. | [x] | Soporte para backfill histórico completo. |
| CA-8 | CLI Local / Tests | 1. Normalizar metadatos de un portafolio con `mapPortfolioMetadata()`. | Retorna objeto con `source: "tyba"`, `currency` (PEN/USD), riesgo mapeado del 1 al 7 y comisión anual. | [x] | Validado en `test/scrapers/tyba.test.ts`. |
| CA-9 | CLI Local / Tests | 1. Ejecutar descarga concurrente con `pMap` y concurrencia 4 sobre los 30 fondos. | Las 30 consultas se completan en < 15 segundos sin provocar Rate Limiting. | [x] | Verificado en prueba de concurrencia. |
| CA-10 | CLI Local / Tests | 1. Ejecutar inserción masiva en colección `tybas` vía `TybaQuotaModel`. | Inserción idempotente sin duplicados respetando índice `{ idFondo: 1, idSerie: 1, date: 1 }`. | [x] | `bulkWrite` con `upsert: true` desordenado. |
| CA-11 | CLI Local / Tests | 1. Ejecutar `TybaScraperFunction` con credenciales válidas en handler. | Responde con `statusCode: 200` y resumen `{ totalFondos: 30, procesados, fallidos, cuotasSincronizadas }`. | [x] | Probado con mock de MongoDB y APIs. |
| CA-12 | CLI Local / Tests | 1. Ejecutar script local `run-local.ts` con bandera `--dry-run`. | Ejecuta consulta y normalización mostrando métricas en consola sin escribir en base de datos. | [x] | Soporte para desarrollo seguro. |
| CA-13 | CLI Local / Tests | 1. Ejecutar `npm test` en la raíz del proyecto. | Todas las suites de pruebas unitarias de ERNI, BBVA y Tyba pasan al 100%. | [x] | Cobertura TDD con Vitest (71/71 tests). |
| CA-14 | CLI Local (`infra/`) | 1. Ejecutar `npm test` en `infra/`.<br>2. Ejecutar `npm run synth`. | Se sintetiza `TybaScraperFunction` y se verifica la **ausencia** de regla EventBridge Scheduler. | [x] | Verificado con `@aws-cdk/assertions`. |
| CA-15 | CLI Local / Tests | 1. Simular respuesta HTTP 401 en cuotas con `refreshToken` configurado. | Se invoca `POST /api-master/auth/refresh-token`, se obtiene nuevo token y se reintenta exitosamente la petición. | [x] | Autorefresco transparente ante expiración. |
| CA-16 | CLI Local / Tests | 1. Invocar Lambda handler pasando ÚNICAMENTE `authorization` (sin `xAppProof`). | Autogenera dinámicamente `x-app-proof` para cada endpoint vía RSA-OAEP SHA-256 y completa exitosamente con HTTP 200. | [x] | Testeado en `test/scrapers/tyba.test.ts`. |

---

## Pruebas de Casos Extremos (Edge Cases)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|:---:|---|
| CE-1 | CLI Local / Tests | 1. Simular error HTTP 500 o timeout en endpoint de catálogo `/v2/portfolios/sqi`. | La Lambda aborta inmediatamente retornando HTTP 502 Bad Gateway sin consultar cuotas. | [x] | Aborto inmediato definido en especificación y plan. |
| CE-2 | CLI Local / Tests | 1. Simular error de sesión inválida o caducada (HTTP 401/403) sin refreshToken. | La llamada lanza error descriptivo indicando al operador renovar sus cabeceras de sesión. | [x] | Manejo de autenticación por sesión. |
| CE-3 | CLI Local / Tests | 1. Enviar token con espacios y prefijo `Bearer ` mezclado (`Bearer  eyJ...  `). | El saneador limpia correctamente el token entregando solo el valor JWT alfanumérico. | [x] | Validado en `parser.test.ts`. |
| CE-4 | CLI Local / Tests | 1. Simular fondo con historial vacío (`graphData: []`). | Se registra advertencia informativa con `console.error`/`info` y se continúa con los demás fondos sin fallar. | [x] | Tolerancia a fondos vacíos o nuevos. |
| CE-5 | CLI Local / Tests | 1. Procesar `graphData` con espaciamiento de 6 días e irregular. | Cada observación se almacena con su fecha ISO exacta sin forzar periodicidad diaria uniforme. | [x] | Fiel a la estructura real de Tyba. |
| CE-6 | CLI Local / Tests | 1. Simular backfill de ~7,500 cuotas (`all: true`) para los 30 fondos. | El proceso completa en menos de 15 segundos sin desbordar memoria ni superar el timeout de 60s. | [x] | Prueba de carga y rendimiento. |
| CE-7 | CLI Local / Tests | 1. Ejecutar el scraper dos veces consecutivas en la misma jornada. | La colección `tybas` no duplica registros gracias al índice único y operación de upsert. | [x] | Idempotencia comprobada. |
| CE-8 | CLI Local / Tests | 1. Ejecutar `python scripts/check_constitution.py`. | Cero infracciones de constitución (fetch nativo, sin console.log residuales, sin secretos quemados). | [x] | Verificación 100% exitosa. |
| CE-9 | CLI Local / Tests | 1. Simular 401 concurrentes en varios fondos simultáneos con `refreshToken`. | Se ejecuta un único refresco coordinado (single-flight) y todos los reintentos continúan con el nuevo token. | [x] | Prevención de llamadas duplicadas a refresh-token. |
