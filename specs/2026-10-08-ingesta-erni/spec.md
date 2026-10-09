# Ingesta Serverless de ERNI (Inteligo) con Descubrimiento Dinámico y Series Temporales

## Resumen
Define el comportamiento del componente de ingesta para fondos mutuos de ERNI (Inteligo SAB / Interfondos) ejecutado en AWS Lambda sin servidor. El componente descubre de manera dinámica el catálogo de fondos mutuos activos y sus series desde la API de onboarding corporativo de Inteligo, extrae la serie temporal histórica de valores cuota a través del servicio de inversión de ERNI utilizando la cabecera de autenticación `ocp-apim-subscription-key`, valida todos los esquemas de entrada y respuesta con `@sinclair/typebox`, sincroniza el catálogo de metadatos en la colección `funds`, y almacena de forma idempotente las cuotas en la colección `erni` de MongoDB Atlas respetando el presupuesto estricto de $0.00 (AWS Always Free).

## Casos de usuario
1. **Como Inversionista / Usuario del Dashboard**, quiero que los valores cuota diarios de todos los fondos mutuos de ERNI (Inteligo) se encuentren actualizados al último día hábil de mercado, para poder analizar la rentabilidad neta del periodo con datos verídicos y sin desfases.
2. **Como Administrador del Sistema**, quiero que el catálogo de fondos de ERNI no dependa de listas estáticas ni IDs quemados en el código, para que la incorporación de nuevos fondos mutuos o cambios de series (ej. Serie C digital vs Serie A presencial) y comisiones se reflejen automáticamente en la base de datos sin redespliegues.
3. **Como Operador / Desarrollador**, quiero que la ingesta soporte tanto la sincronización diaria incremental (`TiempoMeses = 1`) como la carga inicial o backfill de series temporales históricas (hasta 60 meses), para poder reconstruir el historial completo de cuotas cuando sea necesario sin alterar el esquema existente.
4. **Como Auditor de Costos y Seguridad**, quiero que las credenciales de la API de Inteligo se lean de forma segura desde AWS SSM Parameter Store (`/fondos/prod/erni_apikey`) y que la ejecución de la función Lambda opere dentro de los límites del AWS Always Free Tier, manteniendo el costo en $0.00.

## Criterios de aceptación
- [ ] La ingesta consulta el endpoint `GET https://apiv2.inteligogroup.com/onboarding-corp/v1/fondos/fondos-activos` utilizando la cabecera `ocp-apim-subscription-key` obtenida de la variable de entorno o SSM Parameter Store (`/fondos/prod/erni_apikey`).
- [ ] Toda validación de respuestas HTTP de Inteligo y eventos de entrada de la Lambda se implementa con esquemas tipados de `@sinclair/typebox` como estándar del proyecto.
- [ ] La ingesta extrae la lista de fondos activos filtrando aquellos fondos sin valor cuota operativo (`valorCuota > 0` o `showQuoteValues === true`).
- [ ] Para cada fondo activo válido, se extrae el código de serie aplicable priorizando la serie digital (`tarifarios.find(t => t.isDigital) ?? tarifarios[0]`), adoptando la serie Digital "C" en fondos como 16, 17, 22 y 24 (con menor comisión unificada), la serie "A" en fondos presenciales sin alternativa digital (ej. fondo 56), o "-" en fondos de serie única.
- [ ] La ingesta upserta los metadatos de los fondos activos en la colección `funds` de MongoDB Atlas con `{ idFondo: string, source: "erni", name: string, currency: "PEN" | "USD", risk: number, fee: number, serie: string, updatedAt: Date }`.
- [ ] La ingesta consulta el endpoint `GET https://apiv2.inteligogroup.com/erni-api/v1/fondo/{idFondo}/invertir?SerieCodigo={serie}&MontoInversion={monto}&TiempoMeses={meses}` para extraer la serie temporal `listaValorCuota`.
- [ ] El parámetro `TiempoMeses` toma el valor por defecto `1` (31 cuotas diarias) en invocaciones de EventBridge Scheduler, y acepta valores parametrizados (`{ months: 12 }` o `{ months: 60 }`) ante invocaciones manuales.
- [ ] Las consultas a los fondos se ejecutan con concurrencia controlada en lotes de 3 a 4 peticiones simultáneas para optimizar el tiempo total (< 2 segundos) sin incurrir en HTTP 429 (Rate Limit).
- [ ] Cada registro de cuota (`{ fecha, numeroValorCuota }`) se normaliza al formato canónico `{ idFondo: string, idSerie: string, date: Date, value: number }`, preservando el código textual exacto de serie ("-", "C", "A").
- [ ] Las cuotas normalizadas se insertan o actualizan de forma idempotente mediante operaciones masivas (`bulkWrite` con `upsert: true`) en la colección `erni` de MongoDB Atlas, preservando el índice único `{ idFondo: 1, idSerie: 1, date: 1 }`.
- [ ] Fondos recién lanzados o con 0 cuotas en el historial (ej. fondo 96 con menos de 6 meses) son procesados sin detener el flujo general ni lanzar excepciones no controladas.
- [ ] Errores en la consulta de un fondo individual son capturados, registrados con nivel `console.error` y no impiden la ingesta de los fondos restantes.
- [ ] El handler de la Lambda retorna un JSON estructurado con el resumen métrico de la ejecución (`{ statusCode: 200, source: "erni", timestamp: string, summary: { totalFondos, procesados, omitidos, fallidos, cuotasSincronizadas } }`).
- [ ] Ninguna clave de API ni secreto bancario está quemado en el código fuente, respetando `specs/constitution.md`.
- [ ] La función Lambda opera con un límite de memoria de 256 MB y un timeout de ejecución menor o igual a 60 segundos, cumpliendo el Free Tier perpetuo de AWS.

## Requisitos funcionales
1. **Descubrimiento Dinámico de Fondos y Validación con TypeBox:**
   - Realizar una petición HTTP GET al endpoint de fondos activos de Inteligo.
   - Validar la estructura del payload mediante un TypeBox Schema (`Type.Object({ code: Type.Literal("SUCCESS"), data: Type.Array(...) })`).
   - Iterar cada fondo identificando: `idFondo`, `nombreFondo`, `moneda` (00=PEN, 10=USD), `riesgo` (idRiesgo / descripción).
   - Determinar la serie a consultar mediante la regla de selección digital: buscar primero un tarifario con `isDigital: true` (Serie "C" en fondos 16, 17, 22 y 24); si no existe, tomar el primer tarifario disponible (Serie "A" en fondo 56, o "-" en fondos tradicionales).
   - Omitir fondos inactivos, en estructuración o que no tengan `tarifarios` declarados (como el fondo 41 con valor cuota 0).
   - Upsertar la información de catálogo en la colección `funds` con filtro `{ idFondo, source: "erni" }`.
2. **Extracción Concurrente de Serie Temporal de Cuotas:**
   - Construir la URL de simulación de inversión parametrizando `idFondo`, `SerieCodigo`, `MontoInversion` (valor por defecto 500) y `TiempoMeses` (1 por defecto, o configurable vía evento).
   - Ejecutar las consultas en lotes concurrentes (concurrencia máxima = 4).
   - Validar la respuesta de cada fondo mediante un TypeBox Schema (`Type.Object({ code: Type.Literal("SUCCESS"), data: Type.Object({ listaValorCuota: Type.Array(...) }) })`).
3. **Normalización e Idempotencia:**
   - Convertir cada elemento de `listaValorCuota`:
     - `fecha`: normalizado a objeto `Date` truncado al inicio del día UTC (`YYYY-MM-DDT00:00:00.000Z`).
     - `numeroValorCuota`: número de precisión flotante mapeado al campo `value`.
     - `idSerie`: serie extraída del fondo preservando el valor textual exacto ("-", "C", "A").
   - Ejecutar upsert masivo por lotes desordenados (`ordered: false`) con filtro `{ idFondo, idSerie, date }` y actualización `$set: { value }`.
4. **Ejecución Programada y Manual:**
   - Aceptar payload de evento validado con TypeBox: `Type.Object({ months: Type.Optional(Type.Integer({ minimum: 1, maximum: 60 })) })`.
   - Cuando es disparada por EventBridge Scheduler sin parámetros, asume `months = 1`.
   - Generar y retornar el objeto resumen de ejecución para monitoreo.

## Requisitos no funcionales
1. **Presupuesto Estricto de $0.00 (Constitution Compliance):**
   - Ejecución dentro de los límites Always Free de AWS Lambda (1M invocaciones/mes) y MongoDB Atlas M0 (512 MB).
2. **Estándar de Validación:**
   - Adopción de `@sinclair/typebox` para la definición de esquemas y contratos de tipado en tiempo de compilación y ejecución en funciones Lambda.
3. **Seguridad y Parámetros en SSM:**
   - La API Key de Inteligo (`ocp-apim-subscription-key`) se lee en producción de `/fondos/prod/erni_apikey` y en desarrollo de la variable de entorno `ERNI_APIKEY`.
   - Prohibido registrar o loguear el valor de la clave de suscripción en CloudWatch Logs o consola.
4. **Fetch Nativo:**
   - Uso exclusivo de la API nativa de `fetch` de Node.js 24.x sin librerías HTTP externas como `axios`.
5. **Manejo de Conexiones Serverless (Mongo Pool):**
   - La conexión a MongoDB Atlas se inicializa y cachea a nivel de módulo (ámbito global fuera del handler) para ser reutilizada en invocaciones subsecuentes y evitar saturación de sockets.
6. **Observabilidad:**
   - Logs informativos estructurados (`console.info`) que indiquen la cantidad de fondos descubiertos, fondos procesados exitosamente, cuotas guardadas y fondos omitidos.

## Casos extremos
1. **Fondo nuevo sin cuotas históricas (ej. Fondo 96):**
   - El endpoint `/invertir` retorna `listaValorCuota: []` con 0 elementos. El scraper registra una advertencia informativa y continúa con el siguiente fondo sin fallar.
2. **Diferenciación entre Serie Digital ('C') y Serie Presencial ('A'):**
   - En fondos con múltiples series (16, 17, 22, 24), la serie 'A' corresponde a gestión presencial con mayor comisión, mientras la serie 'C' es la serie digital transaccionada en ERNI con menor comisión y valores cuota diferenciados. El scraper prioriza explícitamente el tarifario con `isDigital: true` ('C') garantizando coherencia analítica con el comparador digital. En fondos como el 56 donde solo existe serie 'A', se adopta 'A'; en fondos sin series diferenciadas, se usa '-'. Si se consultara '-' en un fondo que exige 'A' o 'C', la API arroja HTTP 500.
3. **Fondo inactivo o sin tarifario disponible (ej. Fondo 41):**
   - Fondos cerrados o en estructuración pueden tener `tarifarios: []` o `valorCuota: 0`. El scraper detecta la ausencia de tarifario válido y descarta el fondo antes de consultar la API de inversión.
4. **Respuesta no conforme al contrato de API (Schema Validation Failure):**
   - Si la API de Inteligo cambia su formato o devuelve un tipo inesperado en algún campo, la validación de `@sinclair/typebox` arroja un error descriptivo capturado a nivel de fondo, reportándolo en CloudWatch Logs sin interrumpir la persistencia de los fondos válidos.
5. **Fallo intermitente de red o timeout en un fondo específico:**
   - Si la petición de un fondo individual falla por timeout (504) o error del servidor (500), el error se captura y acumula; el proceso no aborta la transacción para los otros fondos. Al finalizar, la Lambda reporta el resumen indicando qué fondos fallaron.
6. **Reintento o ejecución repetida el mismo día (Idempotencia):**
   - Si la Lambda se ejecuta múltiples veces en el mismo día, los `bulkWrite` con `upsert: true` y filtro único `{ idFondo, idSerie, date }` sobrescriben el valor existente sin generar duplicados en la colección de MongoDB Atlas.
7. **Caducidad o rotación de la API Key en SSM:**
   - Si la cabecera `ocp-apim-subscription-key` es rechazada con HTTP 401 Unauthorized, la Lambda finaliza lanzando un error descriptivo indicando fallo de autenticación en la API de Inteligo para que el operador actualice el parámetro en SSM sin exponer secretos en el log.
