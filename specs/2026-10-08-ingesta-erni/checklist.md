# Lista de Comprobación y QA: Ingesta Serverless de ERNI (Inteligo)

## Entornos de Prueba Requeridos
- **Entorno CLI Local:** Windows con Node.js 24+ (`v24.19.0`) y npm 12+.
- **Base de Datos:** MongoDB Atlas M0 Sandbox (o base local con Mongoose).
- **API Externa:** Inteligo API v2 (`apiv2.inteligogroup.com`) con cabecera `ocp-apim-subscription-key`.
- **AWS CDK CLI:** AWS CDK v2 para síntesis de CloudFormation y verificación de infraestructura.
- **Framework de Testing:** Vitest / Jest para ejecución automatizada de pruebas unitarias.
- **Python 3.x:** Para validadores de gobernanza `validate_sdd.py` y `check_constitution.py`.

---

## Casos de Prueba (Criterios de Aceptación)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|:---:|---|
| CA-1 | CLI Local / Tests | 1. Consultar `/fondos/fondos-activos` con cabecera de autenticación.<br>2. Validar respuesta con esquema TypeBox `FondosActivosResponseSchema`. | La petición retorna HTTP 200 y el esquema valida satisfactoriamente el array de 22+ fondos. | [x] | Validado en test unitario y contra API real de Inteligo. |
| CA-2 | CLI Local / Tests | 1. Probar el discriminador `selectActiveSerie()` con fondos con múltiples series (16, 17, 22, 24). | Retorna Serie "C" (`isDigital: true`) para fondos digitales, Serie "A" para fondo 56, y "-" para fondos estándar. | [x] | Validado en `test/scrapers/erni.test.ts`. |
| CA-3 | CLI Local / Tests | 1. Probar el filtro de fondos operativos con fondo 41 (sin tarifarios ni valor cuota). | El fondo 41 es identificado como inactivo y descartado antes de llamar a `/invertir`. | [x] | Validado en `test/scrapers/erni.test.ts`. |
| CA-4 | CLI Local / Tests | 1. Ejecutar sincronización de metadatos en MongoDB Atlas. | Se realiza upsert en la colección `funds` guardando `{ idFondo, source: "erni", name, currency, risk, fee, serie, updatedAt }`. | [x] | Esquema Mongoose `FundModel` e integración en handler verificados. |
| CA-5 | CLI Local / Tests | 1. Consultar `/invertir` para un fondo operativo con `TiempoMeses = 1`.<br>2. Validar con TypeBox `InvertirResponseSchema`. | Retorna `listaValorCuota` con 31 registros diarios validados correctamente por el esquema TypeBox. | [x] | Validado en unit test y llamadas reales. |
| CA-6 | CLI Local / Tests | 1. Invocar función pasando payload `{ months: 12 }`.<br>2. Verificar URL construida hacia Inteligo. | Se parametriza `TiempoMeses=12` obteniendo el historial completo de 366 cuotas anuales. | [x] | Validado en `types.ts` y `client.ts`. |
| CA-7 | CLI Local / Tests | 1. Ejecutar descarga de cuotas con helper `pMap` configurando concurrencia = 4. | Las 22 peticiones se resuelven en lotes simultáneos en < 2.5 segundos sin errores de red. | [x] | Pruebas de concurrencia y límites superadas en vitest. |
| CA-8 | CLI Local / Tests | 1. Normalizar cuotas con `normalizeQuotas()`. | Fechas mapeadas a medianoche UTC (`00:00:00.000Z`) y valores numéricos asignados a `value`. | [x] | `toUtcMidnight()` y parser normalizan cuotas canónicas. |
| CA-9 | CLI Local / Tests | 1. Ejecutar `bulkWrite` de cuotas en colección `erni`.<br>2. Comprobar índice único `{ idFondo: 1, idSerie: 1, date: 1 }`. | Se insertan las cuotas sin duplicados y el índice compuesto garantiza unicidad. | [x] | `QuotaModel` con compound index e idempotencia en `bulkWrite`. |
| CA-10 | CLI Local / Tests | 1. Ejecutar scraper completo y capturar retorno del handler. | Retorna JSON estructurado con `statusCode: 200`, `source: "erni"` y objeto `summary` con métricas. | [x] | Esquema `LambdaResultSchema` y retorno verificado. |
| CA-11 | CLI Local / Tests | 1. Verificar resolución de credenciales desde SSM y `.env`. | Claves se inyectan en tiempo de ejecución sin estar quemadas en el código fuente. | [x] | Módulo `src/shared/config.ts` con caché y fallback verificado. |
| CA-12 | CLI Local (`infra/`) | 1. Ejecutar `npm test` en `infra/`.<br>2. Ejecutar `npm run synth`. | Se sintetiza `ErniScraperFunction` (256 MB, 60s) y su regla de EventBridge Scheduler a las 23:00 UTC. | [x] | 6/6 tests Jest pasando y template CFN generado limpiamente. |

---

## Pruebas de Casos Extremos (Edge Cases)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|:---:|---|
| CE-1 | CLI Local / Tests | 1. Simular fondo recién aperturado con 0 cuotas históricas (ej. Fondo 96). | El scraper detecta `listaValorCuota: []`, registra advertencia informativa en log y no lanza excepción. | [x] | Validado en `test/scrapers/erni.test.ts`. |
| CE-2 | CLI Local / Tests | 1. Simular fondo con serie especial 'A' (Fondo 56) y 'C' (Fondo 16). | Se consulta con el `SerieCodigo` exacto; no se envía `-` que provocaría HTTP 500 en Inteligo. | [x] | Validado en `test/scrapers/erni.test.ts`. |
| CE-3 | CLI Local / Tests | 1. Simular fondo cerrado o sin tarifarios (Fondo 41). | Se omite de la lista de procesamiento sin intentar invocar el endpoint de inversión. | [x] | Validado en `test/scrapers/erni.test.ts`. |
| CE-4 | CLI Local / Tests | 1. Simular respuesta con payload corrupto o campos faltantes desde Inteligo. | `@sinclair/typebox` detecta la no conformidad del esquema y reporta el error aislándolo por fondo. | [x] | Validado con `Value.Check()` en `client.ts` y test unitario. |
| CE-5 | CLI Local / Tests | 1. Simular fallo HTTP 500 o timeout de red en uno de los 22 fondos. | El error se captura a nivel de fondo con `console.error`; los 21 fondos restantes se procesan y guardan con éxito. | [x] | Try/catch aislado por fondo en `handler.ts`. |
| CE-6 | CLI Local / Tests | 1. Ejecutar el scraper dos veces consecutivas con los mismos datos. | La colección `erni` mantiene exactamente la misma cantidad de documentos sin registros duplicados (idempotencia). | [x] | `updateOne` con `upsert: true` y filtro único. |
| CE-7 | CLI Local / Tests | 1. Simular error de autenticación HTTP 401 por clave inválida en SSM. | La función finaliza arrojando excepción descriptiva de autorización sin imprimir la clave en los logs. | [x] | Manejado en `client.ts` con sanitización. |
| CE-8 | CLI Local / Tests | 1. Ejecutar `python scripts/check_constitution.py`. | El script valida que no existan librerías pesadas (`axios`), que no haya `console.log` y que no existan secretos expuestos. | [x] | Validación 100% exitosa sin infracciones. |

