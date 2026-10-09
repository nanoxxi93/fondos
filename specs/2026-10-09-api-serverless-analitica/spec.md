# API Serverless y Motor de Analítica de Rendimiento Neto (TEA)

## Resumen
Define la especificación del motor de analítica de rentabilidad neta de comisiones (`tea`) y la API pública Serverless expuesta mediante una AWS Lambda Function URL con HTTPS nativo y CORS. El sistema consolida las series temporales de valores cuota de todas las administradoras integradas (ERNI/Inteligo, BBVA y Tyba/Credicorp Capital) almacenadas en MongoDB Atlas M0, calcula la variación relativa neta de comisiones de administración para ventanas temporales configurables (de 1 a 3650 días), aplica filtros por moneda y nivel de riesgo, genera el payload estructurado compatible con Chart.js e implementa políticas de caché HTTP (`Cache-Control`) para optimizar llamadas repetitivas respetando el presupuesto estricto de $0.00 (AWS Always Free Tier).

## Casos de usuario
1. **Como Inversionista / Usuario del Dashboard**, quiero consultar en un solo endpoint HTTPS el rendimiento relativo neto de comisiones de todos los fondos mutuos en una ventana de tiempo específica (ej. 30, 90, 365 días), con opciones de filtrado por moneda (`PEN`, `USD`) y riesgo máximo (1 a 7), para comparar qué fondo ha generado el mejor resultado real.
2. **Como Desarrollador del Frontend (SPA React + Vite)**, quiero invocar la API mediante una URL pública con cabeceras CORS permisivas y recibir directamente la estructura `{ labels, datasets }` con colores precalculados y metadatos financieros enriquecidos (`idFondo`, `fee`), para renderizar de forma instantánea el gráfico de Chart.js y la tabla de ranking sin recalcular métricas en el navegador.
3. **Como Operador / Monitor de Infraestructura**, quiero disponer de un endpoint `/health` que verifique la conectividad con el clúster de MongoDB Atlas sin procesar analítica pesada, respondiendo HTTP 200 si la base de datos está disponible o HTTP 503 si está inaccesible.
4. **Como Arquitecto de Soluciones Serverless**, quiero que las respuestas exitosas de analítica incluyan directivas de caché HTTP (`Cache-Control: public, max-age=3600, stale-while-revalidate=86400`), mientras que las respuestas de error inhiban estrictamente cualquier caché (`no-store`), reduciendo el cómputo de Lambda y evitando que fallos transitorios se propaguen en navegadores o proxies.
5. **Como Desarrollador en Local**, quiero disponer de un script interactivo local `src/api/run-local.ts` ejecutable vía `npm run api:local` con un servidor HTTP nativo (`node:http`) para probar el cálculo de TEA y los endpoints directamente contra MongoDB Atlas sin necesidad de emuladores pesados ni despliegues en AWS.

## Criterios de aceptación
- [x] La función Lambda `ApiFunction` se despliega con una **AWS Lambda Function URL** pública (modo de autenticación `NONE`) configurada con soporte nativo de CORS (`allowOrigins: ['*']`, `allowMethods: ['GET', 'OPTIONS']`, `allowHeaders: ['content-type']`, `maxAge: Duration.days(1)`).
- [x] La API procesa peticiones HTTP `GET` en las rutas `/` y `/api/tea`, aceptando los siguientes parámetros de consulta (query string):
  - `days`: Entero opcional entre 1 y 3650 (valor predeterminado: 30).
  - `currency`: String opcional restringido a `"PEN"` o `"USD"` (case-insensitive, valor predeterminado: sin filtrar, todas las monedas).
  - `risk`: Entero opcional entre 1 y 7 (valor predeterminado: sin filtrar, hasta riesgo 7).
- [x] Los parámetros de consulta se validan rigurosamente mediante esquemas de `@sinclair/typebox`. Si se envía un parámetro inválido (ej. `days = -5`, `currency = "EUR"` o `risk = 9`), la API responde inmediatamente con código HTTP 400 Bad Request y un JSON estructurado descriptivo.
- [x] La fecha de corte inicial (`since`) para la consulta de cuotas se calcula de manera determinística truncando la fecha actual UTC a medianoche (`toUtcMidnight(now)`) y restando exactamente `days` días calendario (`since = new Date(nowUtc.getTime() - days * 86_400_000)`), garantizando series idénticas sin importar la hora de invocación.
- [x] La API procesa peticiones HTTP `GET` en la ruta `/health` verificando el estado de conexión a MongoDB Atlas mediante `isMongoReady()`. Si la base de datos está conectada y lista (`readyState === 1`), responde con código HTTP 200 OK y `{ status: "OK", timestamp: string }`. Si no está conectada, responde con código HTTP 503 Service Unavailable y `{ status: "Mongo unavailable" }`.
- [x] Las solicitudes HTTP con método `OPTIONS` (preflight CORS) son gestionadas de forma nativa por la Function URL o retornan código HTTP 204 No Content con cabeceras CORS adecuadas. Peticiones con métodos no permitidos (`POST`, `PUT`, `DELETE`) responden con código HTTP 405 Method Not Allowed e incluyen la cabecera `Allow: GET, OPTIONS`. Rutas no reconocidas responden con código HTTP 404 Not Found.
- [x] El motor de cálculo analítico `tea` se implementa en TypeScript puro (`src/domain/tea.ts`) como una función desacoplada, tipada e independiente del transporte HTTP, con cobertura de pruebas unitarias al 100% siguiendo TDD.
- [x] Para calcular la analítica, el motor consulta las observaciones de cuotas en MongoDB Atlas (`ernis`, `bbvas`, `tybas`) registradas con `date >= since`.
- [x] Para cada fondo con al menos una observación en el periodo:
  - Se extrae la serie temporal ordenada cronológicamente por fecha ascendente (`date: 1`).
  - Se determina la primera cuota observada (`firstValue`) y la última cuota observada (`lastValue`).
  - Si `firstValue === 0` o no hay cuotas válidas en el periodo, el fondo se omite del resultado analítico.
  - Se calcula el rendimiento neto de comisión según la fórmula matemática canónica del proyecto:
    $$\text{rendimiento} = \text{round}_2\left(\left(\frac{\text{lastValue}}{\text{firstValue}} - 1\right) \times (100 - \text{fee})\right)$$
  - Se normaliza cada valor cuota de la serie respecto a la primera observación como porcentaje relativo:
    $$\text{variaciónRelativa}_t = \left(\frac{\text{value}_t - \text{firstValue}}{\text{firstValue}}\right) \times 100$$
    (insertando `null` en fechas del eje temporal universal donde el fondo particular no registre cotización).
- [x] Los metadatos de los fondos (`name`, `currency`, `risk`, `fee`, `source`) se resuelven a partir de la colección `funds` de MongoDB Atlas, complementados con un catálogo de respaldo estático para garantizar disponibilidad si algún metadato no ha completado su sincronización.
- [x] La respuesta exitosa en `/` o `/api/tea` entrega un código HTTP 200 OK, `Content-Type: application/json; charset=utf-8`, y las cabeceras de caché:
  `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`
- [x] Toda respuesta de error (códigos HTTP 400, 404, 405, 500 y 503) incluye obligatoriamente la cabecera anti-caché:
  `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`
- [x] El cuerpo JSON entregado por la API cumple la estructura canónica esperada por Chart.js con metadatos enriquecidos:
  ```json
  {
    "labels": ["YYYY-MM-DD", ...],
    "datasets": [
      {
        "label": "Nombre Del Fondo Formateado",
        "data": [number | null, ...],
        "backgroundColor": "hsla(H, 70%, 50%, 0.2)",
        "borderColor": "hsla(H, 70%, 40%, 1)",
        "borderWidth": 1,
        "pointRadius": 1,
        "hidden": true,
        "meta": {
          "index": number,
          "idFondo": string,
          "source": "erni" | "bbva" | "tyba",
          "value": number,
          "firstValue": number,
          "lastValue": number,
          "fee": number,
          "currency": "PEN" | "USD",
          "risk": number
        }
      }
    ]
  }
  ```
- [x] Los datasets se ordenan alfabéticamente por el nombre del fondo de manera predeterminada (`id.toLowerCase().localeCompare(...)`).
- [x] La paleta de colores para cada fondo se genera determinísticamente a partir del hash de la clave combinada `"${source}:${id}"`, garantizando colores idénticos entre renderizados y sesiones.
- [x] Si ocurre un error no controlado en la base de datos o durante el cómputo, la API responde con código HTTP 500 Internal Server Error y payload `{ error: "Error interno del servidor", timestamp: string }`, sin filtrar trazas de stack ni secretos en la respuesta (`constitution.md`).
- [x] El tiempo de cómputo y respuesta para una consulta estándar de 60 fondos en 365 días se mantiene por debajo de 800 ms (`mission.md`).
- [x] La función Lambda `ApiFunction` se define en AWS CDK reutilizando el construct `FondosFunction` con configuración de 256 MB de memoria y timeout de 15 segundos, conectada al prefijo SSM `/fondos/${stage}` para resolver `mongo_db_uri`.
- [x] Se implementa el script local `src/api/run-local.ts` con servidor HTTP nativo (`node:http`) accesible mediante el comando `npm run api:local` en el puerto configurable `PORT = 3000`.

## Requisitos funcionales
1. **Enrutamiento y Validación de Entrada en Lambda Handler:**
   - La función Lambda procesa eventos en formato AWS Lambda Function URL (payload format version 2.0).
   - Extrae el método HTTP (`requestContext.http.method`), la ruta (`rawPath` o fallback a `requestContext.http.path`) y los parámetros de consulta (`queryStringParameters`).
   - Rutas admitidas:
     - `GET /health`: invoca `isMongoReady()` y responde 200 o 503 sin consultar colecciones.
     - `GET /` y `GET /api/tea`: valida `queryStringParameters` con TypeBox y ejecuta el motor analítico `calculateTea()`.
     - `OPTIONS *`: responde 204 con cabeceras CORS.
     - Cualquier otra combinación de método y ruta retorna 404 Not Found o 405 Method Not Allowed.
   - Parámetros de consulta validados con `@sinclair/typebox`:
     - `days`: entero acotado entre 1 y 3650 (por defecto 30).
     - `currency`: string acotado a `"PEN"` o `"USD"` (por defecto sin filtrar).
     - `risk`: entero acotado entre 1 y 7 (por defecto sin filtrar).

2. **Motor de Analítica Desacoplado (`src/domain/tea.ts`):**
   - Función pura y asíncrona `calculateTea(options: TeaOptions): Promise<TeaChartData>`.
   - Normalización de fecha de inicio `since` truncada a UTC medianoche (`toUtcMidnight`).
   - Consulta concurrente a las colecciones de cuotas (`ernis`, `bbvas`, `tybas`) mediante `Promise.all()` filtrando por `date: { $gte: since }` y ordenando por `{ date: 1 }`.
   - Resolución dinámica de metadatos de fondos desde la colección `funds`, complementada con catálogo canónico en memoria si algún fondo no fue sincronizado previamente.
   - Filtros en memoria por moneda (`currency`) y nivel de riesgo (`risk <= maxRisk`).
   - Construcción del eje cronológico universal (`labels`) mediante conjunto ordenado de fechas ISO (`YYYY-MM-DD`).
   - Mapeo de valores cuota en el eje universal rellenando con `null` cuando no exista observación.
   - Cálculo de variación relativa porcentual normalizada:
     `((cuotaActual - primeraCuota) / primeraCuota) * 100`
   - Cálculo de rentabilidad neta final descontando comisión de administración:
     `+((ultimaCuota / primeraCuota - 1) * (100 - comisionAnual)).toFixed(2)`
   - Generación determinística de colores con matiz HSL a partir del hash de `"${source}:${id}"`.

3. **Caché HTTP y Optimización:**
   - En respuestas 200: cabecera `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`.
   - En respuestas 4xx y 5xx: cabecera `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`.
   - Cabecera de seguridad obligatoria `X-Content-Type-Options: nosniff`.
   - Serialización JSON compacta sin Pretty-print para optimizar el ancho de banda.

4. **Infraestructura como Código (AWS CDK):**
   - Declaración de `ApiFunction` mediante `FondosFunction` en `infra/lib/fondos-stack.ts`.
   - Creación de Function URL pública con `lambda.FunctionUrlAuthType.NONE`.
   - Configuración de CORS en el construct CDK con `allowOrigins: ['*']` y métodos `GET`, `OPTIONS`.
   - Exposición de la URL generada mediante CloudFormation Output `ApiFunctionUrl`.

## Requisitos no funcionales
1. **Presupuesto Estricto de $0.00 (Constitution Compliance):**
   - Uso exclusivo de AWS Lambda Function URLs (eliminando costos de API Gateway).
   - Conexión a MongoDB Atlas Tier M0 (512 MB gratuitos).
   - Uso de SSM Parameter Store en modo Standard para almacenar `mongo_db_uri`.
2. **Reutilización del Pool de Conexiones Serverless:**
   - La conexión de Mongoose debe mantenerse en el ámbito global del contenedor (`src/shared/db.ts`) con `context.callbackWaitsForEmptyEventLoop = false` para reutilizar conexiones entre invocaciones calientes.
3. **Validación de Esquemas con Sinclair TypeBox:**
   - Validación estricta y ligera sin dependencias pesadas adicionales, garantizando arranque en frío ultra veloz (< 1.5s).
4. **Test-Driven Development (TDD):**
   - Lógica de `tea.ts` y enrutador del handler cubiertos por pruebas unitarias automatizadas con Vitest antes de integrar.
5. **Cero Secretos y Logs Controlados:**
   - Ninguna cadena de conexión ni secreto se expone en logs de CloudWatch ni respuestas HTTP.

## Casos extremos
1. **Periodo sin cotizaciones en una o más administradoras:**
   - Si una administradora no tiene observaciones en la ventana seleccionada (ej. feriado bancario o fondo inactivo), dicho fondo se omite de `datasets` sin provocar error general ni corromper el eje `labels`.
2. **Fondo con una única cotización en el periodo (`lastValue === firstValue`):**
   - El fondo se grafica con variación 0% en esa fecha y rendimiento neto final de 0.00%. No genera división por cero ni `NaN`.
3. **Fondo con valor cuota anómalo o cero (`firstValue === 0`):**
   - Si una cuota inicial registra valor 0 por anomalía bancaria, el fondo se omite para evitar indeterminaciones matemáticas (`Infinity` / `NaN`).
4. **Fechas no sincronizadas entre administradoras:**
   - ERNI cotiza de lunes a viernes, BBVA incluye sábados y Tyba espacia observaciones históricas cada 6 días. El eje universal `labels` consolida la unión de todas las fechas distintas y rellena con `null` los días donde una administradora no publicó cotización, permitiendo a Chart.js utilizar `spanGaps: true`.
5. **Parámetros inválidos o fuera de rango en la petición HTTP:**
   - Peticiones con `days = -10`, `days = 10000`, `currency = "EUR"` o `risk = 10` son interceptadas por la validación TypeBox y responden HTTP 400 Bad Request con mensaje explicativo, sin tocar MongoDB Atlas ni cachear la respuesta.
6. **Fallo transitorio de conectividad con MongoDB Atlas:**
   - Si la conexión a MongoDB se interrumpe durante el cálculo, la Lambda captura el error, emite un `console.error` descriptivo y responde HTTP 500 con mensaje genérico `{ error: "Error interno del servidor", timestamp: string }` y `Cache-Control: no-store` sin revelar detalles internos del clúster.
7. **Petición con método HTTP no soportado (POST / PUT / DELETE):**
   - Responde inmediatamente con HTTP 405 Method Not Allowed e incluye cabeceras `Allow: GET, OPTIONS` y `Cache-Control: no-store`.
8. **Consulta sin fondos coincidentes con los filtros (`currency` o `risk` restrictivos):**
   - Si el usuario filtra por una combinación que no arroja fondos (ej. riesgo máximo 1 en USD cuando todos son riesgo 2+), la API responde HTTP 200 con `{ labels: [], datasets: [] }` de forma consistente, permitiendo al frontend mostrar un estado vacío sin errores.
9. **Fondo presente en cotizaciones pero ausente en la colección `funds`:**
   - El motor de analítica consulta el catálogo estático de respaldo para resolver el nombre, moneda, riesgo y comisión oficial de administración, evitando campos indefinidos en `meta`.
10. **Invocación con `queryStringParameters` nulo o vacío:**
    - Si el cliente invoca la Function URL sin query params (ej. `GET /`), el handler inicializa un objeto vacío de parámetros y adopta los valores por defecto (`days: 30`, sin filtro de moneda ni riesgo) sin lanzar excepciones `Cannot read properties of undefined`.
