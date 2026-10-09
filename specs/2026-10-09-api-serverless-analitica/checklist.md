# Lista de Comprobación y QA: API Serverless y Motor de Analítica (Fase 3)

## Entornos de Prueba Requeridos
- **Entorno CLI Local:** Windows con Node.js 24+ (`v24.19.0`), npm 12+ y TypeScript 5.x.
- **Base de Datos:** MongoDB Atlas M0 Sandbox (o base local con Mongoose y colecciones `funds`, `ernis`, `bbvas`, `tybas`).
- **Framework de Testing:** Vitest para pruebas unitarias de `src/` y Jest con `@aws-cdk/assertions` para `infra/`.
- **Servidor HTTP Local:** Script `src/api/run-local.ts` en `http://localhost:3000`.
- **Cliente HTTP / Navegador:** cURL o fetch para pruebas de endpoints y cabeceras CORS/Caché.
- **Python 3.x:** Para validadores de gobernanza `validate_sdd.py` y `check_constitution.py`.

---

## Casos de Prueba (Criterios de Aceptación)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|:---:|---|
| CA-1 | CLI Local (`infra/`) | 1. Sintetizar stack CDK con `npx cdk synth`.<br>2. Validar recurso `AWS::Lambda::Url`. | Se sintetiza `ApiFunction` y su Function URL con `AuthType: NONE` y configuración CORS. | [x] | Verificado en `infra/test/fondos-stack.test.ts`. |
| CA-2 | CLI Local / Tests | 1. Invocar handler en `GET /` y `GET /api/tea`.<br>2. Probar parámetros `days=30`, `currency=PEN`, `risk=4`. | HTTP 200 OK con payload `{ labels, datasets }` filtrado según los parámetros. | [x] | Testeado en `test/api/handler.test.ts`. |
| CA-3 | CLI Local / Tests | 1. Enviar parámetros inválidos (`days=-5`, `currency=EUR`, `risk=9`). | HTTP 400 Bad Request inmediato con JSON explicativo validado por TypeBox. | [x] | Testeado en `test/api/handler.test.ts`. |
| CA-4 | CLI Local / Tests | 1. Ejecutar `calculateTea()` a distintas horas del día.<br>2. Validar valor de corte inicial `since`. | `since` se normaliza siempre a medianoche UTC (`00:00:00.000Z`) de hace N días exactos. | [x] | Testeado en `test/domain/tea.test.ts`. |
| CA-5 | CLI Local / Tests | 1. Invocar `GET /health` con Mongo conectado.<br>2. Simular desconexión de Mongo y reintentar. | HTTP 200 `{ status: "OK" }` cuando está conectado; HTTP 503 `{ status: "Mongo unavailable" }` cuando no. | [x] | Testeado en `test/api/handler.test.ts`. |
| CA-6 | CLI Local / Tests | 1. Enviar solicitud `OPTIONS /`.<br>2. Enviar método `POST /`.<br>3. Enviar ruta `GET /ruta-inexistente`. | `OPTIONS`: HTTP 204 con CORS.<br>`POST`: HTTP 405 con `Allow: GET, OPTIONS`.<br>Ruta desconocida: HTTP 404 Not Found. | [x] | Testeado en `test/api/handler.test.ts`. |
| CA-7 | CLI Local / Tests | 1. Ejecutar suite de pruebas de dominio `tea.ts` con Vitest. | 100% de tests unitarios pasan cubriendo el cálculo matemático de variación neta. | [x] | Verificado en `test/domain/tea.test.ts`. |
| CA-8 | CLI Local / Tests | 1. Simular consulta con datos en `ernis`, `bbvas` y `tybas`. | Se recuperan las cuotas de las 3 fuentes registradas con `date >= since`. | [x] | Testeado en `test/domain/tea.test.ts`. |
| CA-9 | CLI Local / Tests | 1. Calcular variación de fondo con cuotas `[100, 110]` y comisión `fee = 2`. | `value` = `+((110/100 - 1) * 98).toFixed(2)` = `9.80%`. Variaciones normalizadas en `data`. | [x] | Verificado matemáticamente en `tea.test.ts`. |
| CA-10 | CLI Local / Tests | 1. Resolver metadatos de fondos desde colección `funds`.<br>2. Simular fondo no sincronizado en base de datos. | Resuelve metadatos de base de datos; ante ausencia, consulta catálogo estático de respaldo. | [x] | Testeado en `test/domain/tea.test.ts`. |
| CA-11 | CLI Local / Tests | 1. Inspeccionar cabeceras en respuesta HTTP 200 de analítica. | Cabecera `Cache-Control: public, max-age=3600, stale-while-revalidate=86400` presente. | [x] | Testeado en `test/api/handler.test.ts`. |
| CA-12 | CLI Local / Tests | 1. Inspeccionar cabeceras en respuestas 400, 404, 405, 500 y 503. | Cabecera `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` presente. | [x] | Testeado en `test/api/handler.test.ts`. |
| CA-13 | CLI Local / Tests | 1. Validar esquema del JSON de respuesta contra contrato Chart.js. | Incluye `labels`, `datasets` y metadatos enriquecidos (`idFondo`, `fee`, `currency`, `risk`, `source`). | [x] | Validado con TypeBox en `test/api/handler.test.ts`. |
| CA-14 | CLI Local / Tests | 1. Verificar orden de datasets y colores de fondos. | Datasets ordenados alfabéticamente por nombre; colores generados consistentemente con `colorFromKey`. | [x] | Testeado en `test/domain/tea.test.ts`. |
| CA-15 | CLI Local / Tests | 1. Forzar excepción no controlada en motor de base de datos. | HTTP 500 `{ error: "Error interno del servidor" }` sin filtrar secretos ni stack traces. | [x] | Testeado en `test/api/handler.test.ts`. |
| CA-16 | CLI Local / Benchmark | 1. Ejecutar consulta sobre 60 fondos y 365 días de cotizaciones. | Tiempo total de cómputo y respuesta en memoria inferior a 800 ms. | [x] | Medido en tests de dominio (< 50 ms). |
| CA-17 | CLI Local (`infra/`) | 1. Validar configuración de `ApiFunction` en CDK. | Memoria configurada en 256 MB, timeout en 15 segundos y parámetro SSM `mongo_db_uri` asociado. | [x] | Verificado en `infra/test/fondos-stack.test.ts`. |
| CA-18 | CLI Local / Servidor | 1. Iniciar servidor con `npm run api:local`.<br>2. Consultar `http://localhost:3000/api/tea`. | Servidor HTTP nativo responde correctamente en local sin requerir emuladores externos. | [x] | Probado vía script interactivo `run-local.ts`. |

---

## Pruebas de Casos Extremos (Edge Cases)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|:---:|---|
| CE-1 | CLI Local / Tests | 1. Simular administradora sin cotizaciones en la ventana solicitada. | La fuente sin observaciones se omite sin romper el eje `labels` ni arrojar error. | [x] | Testeado en `test/domain/tea.test.ts`. |
| CE-2 | CLI Local / Tests | 1. Simular fondo con una sola cotización en la ventana (`lastValue === firstValue`). | Gráfica con variación 0% en esa fecha y rendimiento final `0.00%` sin `NaN`. | [x] | Testeado en `test/domain/tea.test.ts`. |
| CE-3 | CLI Local / Tests | 1. Simular fondo con cotización inicial cero (`firstValue === 0`). | El fondo anómalo se omite del resultado analítico para evitar indeterminaciones. | [x] | Testeado en `test/domain/tea.test.ts`. |
| CE-4 | CLI Local / Tests | 1. Cruzar fuentes con fechas distintas (ej. días hábiles vs sábados vs cada 6 días). | Eje `labels` unifica todas las fechas cronológicas y rellena con `null` los días ausentes. | [x] | Testeado en `test/domain/tea.test.ts`. |
| CE-5 | CLI Local / Tests | 1. Enviar parámetros fuera de rango (`days=0`, `days=5000`, `risk=10`). | HTTP 400 Bad Request inmediato sin consultar MongoDB Atlas. | [x] | Testeado en `test/api/handler.test.ts`. |
| CE-6 | CLI Local / Tests | 1. Simular fallo transitorio de conexión en medio de la consulta a Mongo. | HTTP 500 con `Cache-Control: no-store` y registro de error controlado en consola. | [x] | Testeado en `test/api/handler.test.ts`. |
| CE-7 | CLI Local / Tests | 1. Enviar métodos no soportados (`DELETE /`, `PUT /api/tea`). | HTTP 405 con cabecera `Allow: GET, OPTIONS` y anti-caché. | [x] | Testeado en `test/api/handler.test.ts`. |
| CE-8 | CLI Local / Tests | 1. Filtrar por combinación sin fondos coincidentes (ej. riesgo 1 en USD). | HTTP 200 con `{ labels: [], datasets: [] }` de forma consistente sin errores. | [x] | Testeado en `test/domain/tea.test.ts`. |
| CE-9 | CLI Local / Tests | 1. Simular cuotas para un fondo ausente en la colección `funds`. | Resuelve metadatos del catálogo estático canónico sin generar campos undefined en `meta`. | [x] | Testeado en `test/domain/tea.test.ts`. |
| CE-10 | CLI Local / Tests | 1. Invocar Function URL sin ningún query param (`GET /`). | Adopta valores por defecto (`days: 30`, todas las monedas y riesgos) sin lanzar excepciones. | [x] | Testeado en `test/api/handler.test.ts`. |
| CE-11 | CLI Local / Auditoría | 1. Ejecutar `python scripts/check_constitution.py`.<br>2. Ejecutar `python scripts/validate_sdd.py`. | Cero infracciones a la constitución y validación de especificaciones 100% exitosa. | [x] | Verificado mediante scripts de gobernanza. |
