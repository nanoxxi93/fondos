# Lista de Tareas: Ingesta Serverless de BBVA

## Fase 1: Catálogo y Contratos TypeBox (`src/scrapers/bbva/`)
- [x] 1.1 Implementar `src/scrapers/bbva/catalog.ts` con la definición canónica de los 21 fondos mutuos de BBVA (`BBVA_FUNDS_CATALOG`), incluyendo códigos, monedas (`PEN`/`USD`), niveles de riesgo y tasas de comisión de administración.
- [x] 1.2 Implementar `src/scrapers/bbva/types.ts` definiendo los esquemas TypeBox para:
  - `BbvaAuthRequestSchema` y respuesta de concesión de tickets.
  - `BbvaFundDetailResponseSchema` para enriquecimiento de catálogo.
  - `BbvaPastReturnsRequestSchema` y `BbvaPastReturnsResponseSchema` para valores cuota.
  - `BbvaLambdaEventSchema`, `BbvaExecutionSummarySchema` y `BbvaLambdaResultSchema`.
- [x] 1.3 Exportar tipos estáticos TypeScript inferidos con `Static<typeof ...>`.

*(No hay dependencias. Desbloquea la construcción del cliente HTTP y parser).*

---

## Fase 2: Parser y Normalización Canónica (`src/scrapers/bbva/parser.ts`)
- [x] 2.1 Implementar `normalizeBbvaQuotas()`: convierte registros de `weightedAverageAssetValues` al modelo canónico `{ idFondo, idSerie: null, date: Date, value: number }` con fecha en UTC medianoche.
- [x] 2.2 Implementar `toBbvaFundMetadata()`: genera el objeto para la colección `funds` `{ idFondo, source: "bbva", name, currency, risk, fee, serie: "-", updatedAt: Date }` combinando los datos del catálogo base con el detalle enriquecido de la API.
- [x] 2.3 Implementar pruebas unitarias en `test/scrapers/bbva.test.ts` para verificar la normalización de cuotas y metadatos.

*(Depende de la Fase 1. Desbloquea la persistencia en base de datos).*

---

## Fase 3: Cliente HTTP con Autenticación Dinámica TSEC (`src/scrapers/bbva/client.ts`)
- [x] 3.1 Implementar `getBbvaTsec()` en `src/scrapers/bbva/client.ts`:
  - Envío de POST a `https://www.bbva.es/ASO/TechArchitecture/grantingTickets/V02`.
  - Simulación de cabeceras de navegador (User-Agent, Origin, Referer) para evitar restricciones de Akamai.
  - Extracción segura del header de respuesta `tsec`.
  - Manejo de expiración en memoria (TTL de ~4 minutos).
- [x] 3.2 Implementar `fetchFundDetail(idFondo, tsec)`: consulta `/management-entities-funds/{id}` con validación TypeBox.
- [x] 3.3 Implementar `fetchPastReturns(params, tsec)`: consulta `/past-returns` con validación TypeBox y reintento automático ante HTTP 401/403 renovando el `tsec`.
- [x] 3.4 Agregar pruebas unitarias y mocks en `test/scrapers/bbva.test.ts` para el cliente HTTP y la gestión del token `tsec`.

*(Depende de la Fase 2. Desbloquea el handler de Lambda).*

---

## Fase 4: Lambda Handler y Orquestación Serverless (`src/scrapers/bbva/handler.ts`)
- [x] 4.1 Actualizar `src/shared/models/quota.model.ts` para exportar `BbvaQuotaModel = getQuotaModel("bbva")`.
- [x] 4.2 Actualizar `src/shared/config.ts` para soportar credenciales o parámetros de autenticación opcionales de BBVA (`bbva_apikey` / auth).
- [x] 4.3 Implementar `src/scrapers/bbva/handler.ts`:
  - Conexión a MongoDB Atlas con pool singleton.
  - Validación del evento `{ days?: number, fromDate?: string, toDate?: string }` (por defecto `days = 30`).
  - Obtención del ticket `tsec`.
  - Sincronización del catálogo en la colección `funds` de MongoDB.
  - Descarga y guardado masivo idempotente de valores cuota en la colección `bbva` usando `pMap` con concurrencia máxima 4.
  - Aislamiento de errores individuales con `console.error` para que un fallo en un fondo no detenga el proceso global.
  - Retorno de resumen métrico JSON estructurado.
- [x] 4.4 Crear script local `src/scrapers/bbva/run-local.ts` para verificación directa contra `.env`.

*(Depende de la Fase 3. Desbloquea la infraestructura en CDK).*

---

## Fase 5: Infraestructura CDK y Automatización EventBridge (`infra/`)
- [x] 5.1 En `infra/lib/fondos-stack.ts`, instanciar `BbvaScraperFunction` usando `FondosFunction` con entrypoint en `src/scrapers/bbva/handler.ts` (256 MB, 60s timeout).
- [x] 5.2 Añadir regla de Amazon EventBridge Scheduler `BbvaScraperScheduleRule` para ejecución diaria a las 23:15 UTC (`cron(15 23 * * ? *)`), escalonada 15 minutos después de ERNI.
- [x] 5.3 Actualizar `infra/test/fondos-stack.test.ts` con pruebas sintéticas de `@aws-cdk/assertions` para validar la existencia de `BbvaScraperFunction` y su regla EventBridge.
- [x] 5.4 Ejecutar y verificar que pasen todas las suites de tests: `npm test` y `npm --prefix infra test`.

*(Depende de la Fase 4. Desbloquea la validación y cierre de la especificación).*

---

## Fase 6: Gobernanza SDD y Cierre
- [x] 6.1 Completar la lista de comprobación en `specs/2026-10-09-ingesta-bbva/checklist.md`.
- [x] 6.2 Actualizar `specs/roadmap.md` marcando la Fase 2.2 como completada.
- [x] 6.3 Agregar entrada en `CHANGELOG.md` documentando la nueva ingesta serverless de BBVA.
- [x] 6.4 Ejecutar scripts de validación `python scripts/validate_sdd.py` y `python scripts/check_constitution.py`.
