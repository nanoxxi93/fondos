# Ingesta Serverless de Tyba (Credicorp Capital) con Invocación Manual y Autenticación por Sesión

## Resumen
Define la especificación del componente de ingesta para fondos mutuos y portafolios de Tyba (Credicorp Capital) ejecutado en AWS Lambda sin servidor. A diferencia de las fuentes públicas o con tokens anónimos (ERNI y BBVA), la plataforma de Tyba requiere autenticación de sesión con credenciales de usuario mediante token Bearer (`authorization`) y cabecera de integridad criptográfica (`x-app-proof`). Por consiguiente, el componente opera como una función Lambda desacoplada sin disparador automático de EventBridge, diseñada para ejecutarse bajo demanda de forma manual proporcionando las cabeceras de sesión directamente en el payload del evento. El componente gestiona el catálogo híbrido de 29 fondos de Credicorp Capital (con consulta y enriquecimiento obligatorio desde el endpoint de portafolios), extrae las series temporales de valores cuota vía el endpoint de rendimiento histórico, valida todos los contratos con `@sinclair/typebox`, sincroniza los metadatos en la colección `funds` y almacena de forma idempotente las cuotas en la colección `tyba` de MongoDB Atlas respetando el presupuesto estricto de $0.00 (AWS Always Free Tier).

## Casos de usuario
1. **Como Inversionista / Usuario del Dashboard**, quiero contar con el historial de valores cuota de todos los fondos mutuos y portafolios de Tyba (Credicorp Capital) en el sistema, para comparar su rendimiento neto de comisión frente a BBVA e Inteligo.
2. **Como Administrador / Operador del Sistema**, quiero invocar manualmente la función Lambda de Tyba pasando los tokens temporales (`authorization` y `x-app-proof`) obtenidos tras iniciar sesión en la web o app de Tyba, para actualizar el histórico sin exponer contraseñas permanentes ni requerir almacenamiento riesgoso de credenciales privadas.
3. **Como Desarrollador / Analista**, quiero disponer de la flexibilidad de sincronizar tanto la ventana habitual de cuotas recientes (`days = 30` por defecto con comportamiento legacy `slice(-days)`) como la serie temporal completa (`all: true` o `days: N`) para reconstrucción histórica de valores cuota en MongoDB Atlas.
4. **Como Auditor de Seguridad y Arquitectura**, quiero que la Lambda rechace solicitudes sin cabeceras válidas y garantice que ningún token sensible se filtre en los registros de CloudWatch Logs, cumpliendo las directrices de `specs/constitution.md`.

## Criterios de aceptación
- [x] La función Lambda `TybaScraperFunction` requiere en su evento de invocación únicamente el campo obligatorio `authorization` (token JWT Bearer de sesión), admitiendo opcionalmente `refreshToken` (o `refresh-token`) y `xAppProof` (o `x-app-proof`). Si falta `authorization` o es vacío (< 20 caracteres), la ejecución finaliza con error descriptivo (código 400).
- [x] La cabecera criptográfica de integridad `x-app-proof` se calcula y firma **automáticamente por petición** mediante cifrado asimétrico RSA-4096 con padding OAEP y hash SHA-256 (`node:crypto`), construyendo el payload canónico `{ versionNumber: "5.65.3", method, route, reqUTCDate: ISOString, sourceApp: "TYBA_WEB_PE" }`, eliminando la necesidad de que el operador copie manualmente esta cabecera efímera. Si el evento proporciona un `xAppProof` explícito, se utiliza como respaldo.
- [x] El payload del evento de entrada se valida estrictamente mediante esquemas de `@sinclair/typebox` (`Type.Object({ authorization: Type.String({ minLength: 20 }), xAppProof: Type.Optional(Type.String({ minLength: 20 })), "x-app-proof": Type.Optional(Type.String({ minLength: 20 })), refreshToken: Type.Optional(Type.String({ minLength: 20 })), "refresh-token": Type.Optional(Type.String({ minLength: 20 })), days: Type.Optional(Type.Integer({ minimum: 1 })), all: Type.Optional(Type.Boolean()), syncCatalog: Type.Optional(Type.Boolean()) })`).
- [x] El parámetro `authorization` se normaliza automáticamente eliminando el prefijo `Bearer ` si está presente (`auth.replace(/^Bearer\s+/i, "")`), enviando a la API de Tyba el token JWT crudo exacto.
- [x] Si se proporciona `refreshToken` y una llamada a la API de Tyba devuelve HTTP 401 Unauthorized (debido a la expiración del access token JWT en medio de la ejecución), el sistema invoca automáticamente el endpoint `POST https://tyba.io/api-master/auth/refresh-token` con `{ refreshToken }`, obtiene un nuevo `token`, actualiza el token de autorización en memoria y reintenta la petición fallida de forma transparente.
- [x] La renovación concurrente de token mediante `refreshToken` se coordina de manera sincronizada (single-flight / promise lock) para evitar llamadas duplicadas simultáneas al endpoint de refresco cuando múltiples fondos en `pMap` reciban 401 al mismo tiempo.
- [x] El catálogo opera bajo modelo híbrido: mantiene un catálogo canónico base de 30 fondos y portafolios de Credicorp Capital con sus metadatos verificados (nombres, monedas `PEN`/`USD`, nivel de riesgo mapeado del 1 al 7 y comisiones oficiales de administración).
- [x] Si se habilita la sincronización de catálogo (`syncCatalog !== false`), el scraper consulta `GET https://tyba.io/api-master/robo-advisor/v2/portfolios/sqi?product=PARKER&orderByProfitability=true` combinando las listas `recommended` y `notRecommended` para actualizar y enriquecer la colección `funds` en MongoDB Atlas con `{ idFondo, source: "tyba", name, currency, risk, fee, serie: "-", updatedAt }`.
- [x] Si la consulta de catálogo (`/v2/portfolios/sqi?product=PARKER`) falla por error HTTP (4xx/5xx) o de red (y tras intentar refresco de token si corresponde), la Lambda aborta inmediatamente la ejecución respondiendo con error descriptivo (código 502 Bad Gateway) sin intentar procesar cuotas sobre un catálogo en estado inconsistente.
- [x] Para cada fondo del catálogo, se consulta el endpoint `GET https://tyba.io/api-master/robo-advisor/portfolios/{idFondo}/historic-performance` enviando las cabeceras `authorization` y el `x-app-proof` auto-generado para la ruta del fondo.
- [x] La respuesta de rendimiento histórico se valida con `@sinclair/typebox` verificando la presencia del arreglo `graphData` con elementos `{ interval: string, value: number }`.
- [x] Por defecto se extraen las últimas observaciones aplicando `graphData.slice(-days)` (con `days = 30` por defecto, replicando fielmente el comportamiento de `legacy/tyba.js`), admitiendo la persistencia completa de toda la serie cuando se especifica `all: true` o un valor mayor de `days`.
- [x] Las consultas a los 30 fondos se ejecutan con concurrencia controlada en lotes (`pMap` con concurrencia máxima = 4) completando el proceso en menos de 15 segundos sin provocar saturación ni Rate Limiting.
- [x] Cada observación de cuota (`{ interval, value }`) se normaliza al formato canónico `{ idFondo: string, idSerie: null, date: Date, value: number }` con fecha truncada a medianoche UTC (`00:00:00.000Z`).
- [x] Las cuotas normalizadas se insertan o actualizan de forma idempotente mediante operaciones masivas (`bulkWrite` con `upsert: true`) en la colección `tyba` de MongoDB Atlas (modelo Mongoose `TybaQuotaModel` en colección `tybas`), preservando el índice único `{ idFondo: 1, idSerie: 1, date: 1 }`.
- [x] Errores en la consulta de un fondo individual (ej. fondo cerrado o serie temporal vacía) se capturan con `console.error` y no abortan la sincronización de los fondos restantes.
- [x] El handler de la Lambda retorna un JSON estructurado con el resumen métrico de la ejecución (`{ statusCode: 200, source: "tyba", timestamp: string, summary: { totalFondos: 30, procesados: number, fallidos: number, cuotasSincronizadas: number } }`).
- [x] En la infraestructura CDK (`infra/lib/fondos-stack.ts`), se define `TybaScraperFunction` sin regla de Amazon EventBridge Scheduler asociada, reflejando su naturaleza exclusiva de ejecución manual.
- [x] El script local `src/scrapers/tyba/run-local.ts` admite argumentos por línea de comandos (`--authorization`, `--app-proof`, `--refresh-token`, `--days`, `--all`, `--dry-run`) y lectura de respaldo desde `.env` (`TYBA_APIKEY`, `TYBA_AUTHORIZATION`, `TYBA_REFRESH_TOKEN`).
- [x] Ningún token, cabecera de sesión ni credencial se expone en texto claro en los registros de CloudWatch Logs (`specs/constitution.md`).

## Requisitos funcionales
1. **Validación del Evento de Invocación:**
   - Validar el objeto del evento con un esquema estricto TypeBox:
     - `authorization`: string obligatorio no vacío con el Bearer token JWT de la sesión. Se sanea eliminando prefijo `Bearer ` si está presente.
     - `xAppProof` o `x-app-proof`: string opcional con la firma de integridad de la app (si se omite, se autogenera).
     - `refreshToken` o `refresh-token`: string opcional para renovación de sesión.
     - `days`: número entero opcional (valor por defecto: 30).
     - `all`: booleano opcional (valor por defecto: false). Si es `true`, ignora el límite `days` y sincroniza todo `graphData`.
     - `syncCatalog`: booleano opcional (valor por defecto: true).
2. **Catálogo Canónico y Enriquecimiento de Metadatos:**
   - Mantener el diccionario base de 29 fondos de Credicorp Capital con sus identificadores UUID, monedas (`PEN` o `USD`), niveles de riesgo del 1 al 7 y comisiones anuales de administración.
   - Enriquecer los metadatos consultando el endpoint `/v2/portfolios/sqi?product=PARKER`, extrayendo `comission`, nombres actualizados y mapeando el nivel de riesgo textual (`LOW` -> 1, `MEDIUM` -> 4, `HIGH` -> 7).
   - Si la petición de catálogo falla, abortar inmediatamente con código 502 Bad Gateway.
   - Upsertar los metadatos en la colección `funds` con filtro `{ idFondo, source: "tyba" }`.
3. **Extracción Concurrente y Normalización de Cuotas (Comportamiento Legacy):**
   - Construir la URL para `/historic-performance` por cada `idFondo`.
   - Ejecutar peticiones concurrentes con límite de 4 llamadas simultáneas utilizando Node.js `fetch` nativo.
   - Recortar las observaciones aplicando `.slice(-days)` sobre `graphData` por defecto (30 elementos), o persistir la totalidad si `all: true`.
   - Truncar la fecha `interval` ("YYYY-MM-DD") al inicio del día UTC (`YYYY-MM-DDT00:00:00.000Z`).
   - Normalizar `value` a número de precisión flotante.
   - Establecer `idSerie` en `null`.
   - Realizar upsert masivo desordenado (`ordered: false`) en la colección `tyba` de MongoDB Atlas.
4. **Resumen de Resultados y Resiliencia:**
   - Contabilizar fondos descubiertos, fondos procesados exitosamente, fondos fallidos y cantidad total de cuotas sincronizadas.
   - Responder al invocador con el código HTTP 200 y el cuerpo JSON con las métricas consolidadas.

## Requisitos no funcionales
1. **Presupuesto Estricto de $0.00 (Constitution Compliance):**
   - Función Lambda aprovisionada con 256 MB de memoria y timeout de 60 segundos dentro del AWS Always Free Tier.
2. **Uso Exclusivo de Fetch Nativo:**
   - Sin dependencias pesadas de HTTP como `axios` ni emulación de navegador.
3. **Validación con TypeBox:**
   - Adopción transversal de `@sinclair/typebox` para validar eventos de entrada y respuestas de la API de Tyba.
4. **Reutilización del Pool de Conexiones Serverless:**
   - Conexión singleton a MongoDB Atlas en el ámbito global del contenedor para evitar la saturación de conexiones.
5. **Seguridad y Confidencialidad de Sesión:**
   - Prohibido loguear los valores de `authorization` o `x-app-proof` en CloudWatch Logs o consola estándar.

## Casos extremos
1. **Fallo en la consulta de catálogo (`/v2/portfolios/sqi` responde 4xx, 5xx o timeout):**
   - A diferencia de los fondos individuales, el fallo del catálogo general detiene la ejecución inmediatamente retornando HTTP 502 con mensaje explicativo, impidiendo que el scraper continúe con un catálogo potencialmente desactualizado o incompleto.
2. **Token JWT expirado o `x-app-proof` no válido (HTTP 401 / 403 / 400):**
   - Si una llamada responde con HTTP 401 Unauthorized y se suministró `refreshToken` en el evento, el sistema ejecuta automáticamente `POST /api-master/auth/refresh-token` con `{ refreshToken }`, actualiza el token `authorization` en memoria y reintenta la operación de forma transparente. Si no se proveyó `refreshToken`, o si la renovación también falla (ej. sesión cerrada o refreshToken caducado), la ejecución finaliza con error descriptivo indicando al operador renovar sus cabeceras en web.tyba.pe.
3. **Token suministrado con prefijo 'Bearer ':**
   - Si el operador copia la cabecera directamente con el texto `Bearer eyJ...`, el parser lo detecta y remueve automáticamente el prefijo antes de enviar la petición a Tyba.
4. **Fondo nuevo o sin historial de cuotas (`graphData: []`):**
   - Si un portafolio no cuenta con observaciones históricas o retorna un arreglo vacío, el scraper registra un log informativo y continúa procesando los demás fondos sin lanzar excepciones no controladas.
5. **Periodicidad irregular de intervalos en series históricas:**
   - La API de Tyba entrega intervalos con espaciamiento de 6 días en periodos antiguos y diarios en fechas recientes. Al usar el recorte fiel del código legado `graphData.slice(-days)` o `all: true`, cada observación se almacena con su fecha ISO exacta sin asumir una frecuencia diaria uniforme.
6. **Ejecución de backfill masivo (`all: true`):**
   - Ante la petición de sincronizar todo el historial (hasta ~7,500 cuotas entre los 29 fondos), las operaciones en lotes con `bulkWrite` y concurrencia controlada completan la carga masiva en menos de 15 segundos, manteniéndose muy por debajo del timeout de 60 segundos.
7. **Diferencias entre nombres o comisiones del catálogo estático y la API de Tyba:**
   - Si Credicorp Capital actualiza la comisión o el nombre de un portafolio en la API, la sincronización de metadatos actualiza automáticamente la colección `funds` reflejando los valores oficiales vigentes.
8. **Ejecución repetida el mismo día (Idempotencia):**
   - Si el operador invoca la Lambda múltiples veces en la misma jornada, las operaciones de upsert sobrescriben las observaciones existentes para esa misma fecha sin generar documentos duplicados.
