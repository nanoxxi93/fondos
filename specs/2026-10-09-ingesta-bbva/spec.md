# Ingesta Serverless de BBVA con Autenticación Dinámica TSEC y Series Temporales

## Resumen
Define la especificación del componente de ingesta para fondos mutuos de BBVA Asset Management (Perú) ejecutado en AWS Lambda sin servidor. A diferencia del código legado monolítico que dependía de Chromium / Puppeteer para capturar el token de sesión, esta versión moderna utiliza directamente el endpoint oficial de concesión de tickets ASO (`grantingTickets/V02`) para adquirir y refrescar de forma transparente el token efímero `tsec`. El componente sincroniza el catálogo de 21 fondos mutuos de BBVA (los 19 provenientes del código legado más los 2 nuevos fondos incorporados: `421` y `BBVAEM`), enriquece sus metadatos desde el endpoint de gestión de fondos, extrae las series temporales de valores cuota vía el endpoint `past-returns`, valida todos los esquemas mediante `@sinclair/typebox`, y persiste de manera idempotente las cuotas en la colección `bbva` y los metadatos en la colección `funds` de MongoDB Atlas respetando el presupuesto estricto de $0.00 (AWS Always Free Tier).

## Casos de usuario
1. **Como Inversionista / Usuario del Dashboard**, quiero contar con el historial diario actualizado de valores cuota de todos los fondos mutuos de BBVA al cierre de mercado, para comparar su rendimiento neto de comisión frente a otras entidades financieras (ERNI, Tyba).
2. **Como Administrador del Sistema**, quiero prescindir por completo de navegadores pesados (Puppeteer/Chromium) y de tokens manuales en el scraper de BBVA, para que el proceso de autenticación sea 100% ligero, resiliente y de arranque ultra-rápido en AWS Lambda.
3. **Como Desarrollador / Analista**, quiero que los 2 nuevos fondos incorporados (`421` - BBVA Tesorería Soles FMIV y `BBVAEM` - BBVA Renta Fija Mercados Emergentes FMIV) formen parte del catálogo analítico con sus monedas, niveles de riesgo y comisiones de administración oficiales debidamente catalogados.
4. **Como Operador de Infraestructura**, quiero que la ingesta soporte ejecución programada diaria por EventBridge Scheduler (post-cierre de mercado) e invocación manual parametrizada (`days?: number`), permitiendo backfill histórico o sincronización periódica sin generar duplicados.

## Criterios de aceptación
- [ ] La autenticación genera dinámicamente el token `tsec` invocando `POST https://www.bbva.es/ASO/TechArchitecture/grantingTickets/V02` con cabeceras de navegador y cuerpo de autenticación JSON, extrayendo el token desde la cabecera HTTP de respuesta `tsec`.
- [ ] El cliente mantiene el `tsec` en caché en memoria durante la ejecución, y ante una respuesta HTTP 401/403 invalida el token y reintenta de forma automática una vez con un nuevo ticket.
- [ ] El catálogo contempla exactamente los 21 códigos de fondos verificados:
  `CASHSOL-PE`, `CASHDOL-PE`, `421`, `BBVATSO-PE`, `SUPRDMNPEEQU`, `SUPRACCPEEQU`, `SUPRVIP-PE`, `SUPRSOL-PE`, `SUPRDOLPEEQU`, `382`, `BBVAEM`, `MUTIIEQ-PE`, `0452`, `BBVABAL-PE`, `BBVAAGR-PE`, `BBVARE-PE`, `0372`, `MUIIIAG-PE`, `BBVSEST-PE`, `BBVAANDI-PE`, `BBVAMIL-PE`.
- [ ] Toda respuesta de API y evento de Lambda se valida mediante esquemas estrictos de `@sinclair/typebox`.
- [ ] Se consulta el endpoint `GET https://www.bbva.es/ASO/management-entity-funds/v1/management-entities-funds/{idFondo}` para extraer metadatos oficiales (nombre actualizado, moneda, nivel de riesgo y comisiones de administración).
- [ ] Los metadatos de los 21 fondos se sincronizan mediante `bulkWrite` con `upsert: true` en la colección `funds` con `{ idFondo, source: "bbva", name, currency, risk, fee, serie: "-", updatedAt }`.
- [ ] Se consulta el endpoint `POST https://www.bbva.es/ASO/management-entity-funds/v1/management-entities-funds/past-returns` enviando el rango de fechas (`fromDate`, `toDate`) y la moneda correspondiente del fondo (`PEN` o `USD`).
- [ ] Por defecto en invocaciones programadas se sincronizan los últimos 30 días (`days = 30`), y se admiten rangos personalizados (`days?: number` o `fromDate`/`toDate`) ante invocaciones manuales.
- [ ] Las consultas de cuotas se ejecutan en lotes concurrentes con `pMap` (concurrencia máxima = 4) completando los 21 fondos en menos de 15 segundos sin provocar Rate Limiting (429).
- [ ] Cada registro de cuota (`valueDate`, `valueAmount.amount`) se normaliza al formato canónico `{ idFondo: string, idSerie: null, date: Date, value: number }` con fecha truncada a medianoche UTC (`00:00:00.000Z`).
- [ ] Las cuotas se insertan/actualizan en la colección `bbva` mediante `bulkWrite` (`upsert: true`) respetando el índice único `{ idFondo: 1, idSerie: 1, date: 1 }`.
- [ ] Fallos individuales en la consulta de un fondo se capturan con `console.error` y no abortan la sincronización de los fondos restantes.
- [ ] El handler de la Lambda retorna un JSON estructurado con el resumen de ejecución (`{ statusCode: 200, source: "bbva", timestamp: string, summary: { totalFondos: 21, procesados: number, fallidos: number, cuotasSincronizadas: number } }`).
- [ ] Ningún secreto ni credencial sensible queda quemado en el código fuente, respetando los estándares de `specs/constitution.md`.

## Requisitos funcionales
1. **Adquisición Transparente de Token TSEC:**
   - Realizar petición HTTP POST a `grantingTickets/V02` con User-Agent de navegador y credenciales configurables.
   - Extraer el valor del header `tsec`.
   - Cachear el token con expiración interna (4 minutos).
   - Reintento transparente con nuevo token ante errores 401/403.
2. **Catálogo y Consulta de Metadatos de Fondos:**
   - Mantener el diccionario base de 21 fondos identificando su código, moneda (`PEN` o `USD`), riesgo y comisión de administración.
   - Enriquecer o validar los nombres y categorías consultando el endpoint de detalle `/management-entities-funds/{id}`.
   - Guardar metadatos en colección `funds` con filtro `{ idFondo, source: "bbva" }`.
3. **Extracción y Normalización de Valores Cuota:**
   - Formatear el cuerpo de petición para `/past-returns` con `{ funds: [{ id: idFondo, weight: 100 }], period: { fromDate, toDate }, assetValuesCurrency: { id: currency } }`.
   - Iterar `weightedAverageAssetValues` y convertir `valueDate` a `Date` en UTC medianoche y `amount` a número flotante `value`.
   - Persistir en MongoDB Atlas colección `bbva` con operación masiva `bulkWrite` desordenada (`ordered: false`).
4. **Parámetros de Invocación:**
   - Evento de Lambda validado con TypeBox: `{ days?: number, fromDate?: string, toDate?: string }`.
   - Valor por defecto: `days = 30`.

## Requisitos no funcionales
1. **Presupuesto Estricto de $0.00:**
   - Función Lambda dimensionada a 256 MB y timeout de 60 segundos dentro del AWS Always Free Tier.
2. **Uso Exclusivo de Fetch Nativo:**
   - Sin dependencias de `axios` ni `puppeteer`. Node.js 24 `fetch` nativo con User-Agent emulado.
3. **Validación de Tipos y Esquemas:**
   - Contratos TypeBox `@sinclair/typebox` para respuestas HTTP y eventos Lambda.
4. **Conexión Serverless Eficiente:**
   - Reutilización del pool de conexión de Mongoose en ámbito global vía `src/shared/db.ts`.

## Casos extremos
1. **Caducidad del Token TSEC durante el recorrido:**
   - Si el token expira a mitad de las consultas de los 21 fondos, el cliente detecta 401/403, solicita un nuevo ticket y repite la llamada sin lanzar error al usuario.
2. **Fondo con periodo sin cuotas o feriados bancarios largos:**
   - Si `weightedAverageAssetValues` retorna array vacío `[]`, el proceso registra un log informativo y continúa con los demás fondos.
3. **Diferencias de Nomenclatura entre Legacy y API Oficial:**
   - Fondos que en legacy se llamaban "FOES" han sido renombrados por BBVA en el API (ej: `BBVSEST-PE` ahora es "BBVA Acciones Globales Tecnologicas FMIV"). El catálogo sincronizado refleja el nombre oficial vigente en la colección `funds`.
4. **Idempotencia de Ejecución Repetida:**
   - Múltiples ejecuciones en la misma fecha actualizan los documentos existentes sin generar duplicidad gracias al índice único `{ idFondo: 1, idSerie: 1, date: 1 }`.
