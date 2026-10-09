# Lista de Comprobación y QA: Ingesta Serverless de BBVA

## Entornos de Prueba Requeridos
- **Entorno CLI Local:** Windows con Node.js 24+ (`v24.19.0`) y npm 12+.
- **Base de Datos:** MongoDB Atlas M0 Sandbox (o base local con Mongoose).
- **API Externa:** Endpoints ASO de BBVA (`grantingTickets/V02`, `/management-entities-funds/{id}`, `/past-returns`).
- **AWS CDK CLI:** AWS CDK v2 para síntesis de CloudFormation y verificación de infraestructura.
- **Framework de Testing:** Vitest para pruebas unitarias de `src/` y Jest para `infra/`.
- **Python 3.x:** Para validadores de gobernanza `validate_sdd.py` y `check_constitution.py`.

---

## Casos de Prueba (Criterios de Aceptación)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|:---:|---|
| CA-1 | CLI Local / Tests | 1. Invocar `getBbvaTsec()`.<br>2. Validar extracción del token desde la cabecera `tsec`. | Se adquiere token alfanumérico válido sin lanzar excepciones. | [x] | Validado contra endpoint real y con mock en Vitest. |
| CA-2 | CLI Local / Tests | 1. Consultar `/management-entities-funds/{id}` para los 21 fondos.<br>2. Validar con `BbvaFundDetailResponseSchema`. | HTTP 200 y validación de esquemas conforme para todos los códigos. | [x] | Comprobado en vivo para los 21 códigos (incluidos `421` y `BBVAEM`). |
| CA-3 | CLI Local / Tests | 1. Consultar `/past-returns` para un fondo en soles y otro en dólares.<br>2. Validar con `BbvaPastReturnsResponseSchema`. | HTTP 201 y obtención de array `weightedAverageAssetValues`. | [x] | Probado en vivo y en unit tests para soles (`CASHSOL-PE`) y dólares (`CASHDOL-PE`). |
| CA-4 | CLI Local / Tests | 1. Normalizar cuotas con `normalizeBbvaQuotas()`. | Fechas mapeadas a medianoche UTC (`00:00:00.000Z`) y valores numéricos asignados a `value`. | [x] | Testeado en `test/scrapers/bbva.test.ts`. |
| CA-5 | CLI Local / Tests | 1. Probar `toBbvaFundMetadata()` con los 21 fondos. | Retorna metadatos canónicos con `source: "bbva"`, comisión y riesgo exactos. | [x] | Validado en `test/scrapers/bbva.test.ts`. |
| CA-6 | CLI Local / Tests | 1. Ejecutar descarga de cuotas con `pMap` y concurrencia 4. | Las 21 consultas se resuelven en < 15 segundos sin bloqueos por Rate Limit. | [x] | Verificado en prueba de concurrencia y live test. |
| CA-7 | CLI Local / Tests | 1. Ejecutar inserción masiva idempotente en colección `bbva`. | Inserción sin duplicados respetando índice único `{ idFondo: 1, idSerie: 1, date: 1 }`. | [x] | Mongoose `BbvaQuotaModel` con `bulkWrite` y `upsert: true`. |
| CA-8 | CLI Local / Tests | 1. Invocar handler pasando `{ days: 60 }`. | Se consulta el rango de 60 días hacia atrás correctamente. | [x] | Verificado en `calculateBbvaDateRange` y cliente. |
| CA-9 | CLI Local / Tests | 1. Ejecutar `npm test` en la raíz. | Todas las pruebas unitarias de ERNI y BBVA pasan exitosamente. | [x] | 25/25 tests unitarios pasando en Vitest. |
| CA-10 | CLI Local (`infra/`) | 1. Ejecutar `npm test` en `infra/`.<br>2. Ejecutar `npm run synth`. | Se sintetiza `BbvaScraperFunction` y su regla EventBridge diaria a las 23:15 UTC. | [x] | 8/8 tests Jest pasando y CloudFormation generado limpiamente. |

---

## Pruebas de Casos Extremos (Edge Cases)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|:---:|---|
| CE-1 | CLI Local / Tests | 1. Simular expiración de `tsec` (HTTP 401/403) durante una petición. | El cliente invalida el token, solicita uno nuevo y reintenta la petición exitosamente. | [x] | Testeado con mock en `test/scrapers/bbva.test.ts`. |
| CE-2 | CLI Local / Tests | 1. Simular fondo con 0 cuotas retornadas (`[]`). | El scraper registra log informativo y no detiene la ingesta de los demás fondos. | [x] | Verificado en `handler.ts`. |
| CE-3 | CLI Local / Tests | 1. Simular fallo 500 en un fondo específico de los 21. | El fallo se captura con `console.error`; los 20 fondos restantes se procesan y sincronizan. | [x] | Aislamiento por fondo implementado en `handler.ts`. |
| CE-4 | CLI Local / Tests | 1. Ejecutar el scraper dos veces consecutivas en la misma fecha. | La colección `bbva` no duplica registros (idempotencia garantizada por upsert). | [x] | `bulkWrite` con filtro `{ idFondo, idSerie, date }` y `$set`. |
| CE-5 | CLI Local / Tests | 1. Ejecutar `python scripts/check_constitution.py`. | Cero infracciones a la constitución (fetch nativo, sin console.log de depuración, sin secretos quemados). | [x] | Verificación 100% exitosa con el script de la constitución. |
