# Lista de Tareas: Ingesta Serverless de Tyba

## Fase 1: Modelo de Base de Datos y Contratos TypeBox (`src/scrapers/tyba/`)
- [x] 1.1 Actualizar `src/shared/models/quota.model.ts` para exportar `TybaQuotaModel = getQuotaModel("tyba")` asegurando la persistencia en la colección `tybas` de MongoDB Atlas.
- [x] 1.2 Implementar `src/scrapers/tyba/catalog.ts` con la definición canónica base de los 30 fondos de Credicorp Capital (`TYBA_FUNDS_CATALOG`), incluyendo identificadores UUID, nombres, monedas (`PEN`/`USD`), niveles de riesgo del 1 al 7 y comisiones anuales de administración.
- [x] 1.3 Implementar `src/scrapers/tyba/types.ts` definiendo los esquemas TypeBox:
  - `TybaLambdaEventSchema`: Validación del payload manual (`authorization`, `xAppProof`, `x-app-proof`, `refreshToken`, `refresh-token`, `days`, `all`, `syncCatalog`).
  - `TybaRefreshTokenResponseSchema`: Contrato para la respuesta de renovación `{ token: string }` de `/api-master/auth/refresh-token`.
  - `TybaPortfolioItemSchema` y `TybaPortfoliosResponseSchema`: Contrato para `recommended` y `notRecommended` del endpoint `/v2/portfolios/sqi`.
  - `TybaHistoricPointSchema` y `TybaHistoricPerformanceResponseSchema`: Contrato para `graphData` del endpoint `/historic-performance`.
  - `TybaExecutionSummarySchema` y `TybaLambdaResultSchema`: Contrato para la respuesta estructurada de la Lambda.
- [x] 1.4 Exportar los tipos estáticos inferidos de TypeScript (`Static<typeof ...>`).

*(No hay dependencias. Desbloquea la construcción del parser y del cliente HTTP).*

---

## Fase 2: Parser y Normalización Canónica (`src/scrapers/tyba/parser.ts`)
- [x] 2.1 Implementar `sanitizeAuthToken(raw: string)`: remueve el prefijo `Bearer ` (case-insensitive) y espacios en blanco al inicio o final.
- [x] 2.2 Implementar `resolveAppProof(event: any)`: resuelve la cabecera de integridad indistintamente desde `xAppProof` o `x-app-proof`.
- [x] 2.3 Implementar `resolveRefreshToken(event: any)`: resuelve el token de renovación desde `refreshToken` o `refresh-token`.
- [x] 2.4 Implementar `normalizeHistoricQuotas(idFondo: string, points: TybaHistoricPoint[], days?: number, all?: boolean)`:
  - Aplica recorte `.slice(-days)` (por defecto 30) o conserva la totalidad si `all === true` (comportamiento fiel al monolito legacy).
  - Trunca la fecha `interval` ("YYYY-MM-DD") a medianoche UTC (`00:00:00.000Z`).
  - Mapea al modelo canónico `{ idFondo, idSerie: null, date: Date, value: number }`.
- [x] 2.5 Implementar `mapPortfolioMetadata(item: TybaPortfolioItem)`: mapea riesgo textual (`LOW` -> 1, `MEDIUM` -> 4, `HIGH` -> 7) y normaliza campos para la colección `funds` con `{ idFondo, source: "tyba", name, currency, risk, fee, serie: "-", updatedAt }`.
- [x] 2.6 Implementar pruebas unitarias en `test/scrapers/tyba.test.ts` para verificar saneamiento de token, resolución de app-proof, resolución de refresh-token, recorte legacy `slice(-days)` vs `all: true`, truncado UTC y mapeo de metadatos.

*(Depende de la Fase 1. Desbloquea el cliente HTTP y el handler).*

---

## Fase 3: Cliente HTTP con Fetch Nativo (`src/scrapers/tyba/client.ts`)
- [x] 3.1 Implementar `refreshAuthToken(refreshToken: string)`:
  - Petición HTTP POST a `https://tyba.io/api-master/auth/refresh-token` con `{ refreshToken }`.
  - Envío de cabeceras estándar JSON y validación con `TybaRefreshTokenResponseSchema`.
  - Retorna nuevo token JWT saneado.
- [x] 3.2 Implementar `fetchPortfoliosCatalog(authorization: string, appProof: string)`:
  - Petición HTTP GET a `https://tyba.io/api-master/robo-advisor/v2/portfolios/sqi?product=PARKER&orderByProfitability=true`.
  - Envío de cabeceras HTTP `authorization` y `x-app-proof`.
  - Validación del payload de respuesta con `TybaPortfoliosResponseSchema`.
  - Manejo de error: lanzar error descriptivo ante respuestas HTTP 4xx/5xx (adjuntando status).
- [x] 3.3 Implementar `fetchHistoricPerformance(idFondo: string, authorization: string, appProof: string)`:
  - Petición HTTP GET a `https://tyba.io/api-master/robo-advisor/portfolios/{idFondo}/historic-performance`.
  - Envío de cabeceras HTTP `authorization` y `x-app-proof`.
  - Validación del payload de respuesta con `TybaHistoricPerformanceResponseSchema`.
- [x] 3.4 Agregar pruebas unitarias y mocks en `test/scrapers/tyba.test.ts` para el cliente HTTP, refresh token, cabeceras enviadas y manejo de errores 401/403/500.
- [x] 3.5 Implementar módulo criptográfico `src/scrapers/tyba/crypto.ts` con la clave pública RSA de Tyba (`TYBA_PUBLIC_KEY_PEM`) y la función `generateAppProof(method, route, options)` cifrando con RSA-OAEP SHA-256 (`node:crypto`). Integrar auto-generación transparente en `buildTybaHeaders()`, `fetchPortfoliosCatalog()` y `fetchHistoricPerformance()`.

*(Depende de la Fase 2. Desbloquea el Lambda handler).*

---

## Fase 4: Lambda Handler y Orquestación Serverless (`src/scrapers/tyba/handler.ts`)
- [x] 4.1 Implementar autorefresco coordinado y resiliente ante HTTP 401 en `src/scrapers/tyba/handler.ts`:
  - Mecanismo `executeWithAuthRetry` con lock de promesa compartida ante 401 concurrentes en `pMap`.
  - Sincronización obligatoria de catálogo (con reintento de refresh ante 401) y aborto con 502 si persiste el fallo.
  - Iteración concurrente de 30 fondos actualizando dinámicamente el `authorization` vigente.
- [x] 4.2 Actualizar script local `src/scrapers/tyba/run-local.ts`:
  - Soporte de flag CLI: `--refresh-token` / `-r`.
  - Fallback a variable local en `.env`: `TYBA_REFRESH_TOKEN`.
  - Parámetro `appProof` opcional con generación automática al vuelo.
- [x] 4.3 Implementar pruebas de integración en `test/scrapers/tyba.test.ts` simulando expiración a mitad de ejecución (401), auto-recuperación exitosa con `refreshToken` y continuidad sin pérdida de fondos.
- [x] 4.4 Flexibilizar validación del handler en `src/scrapers/tyba/handler.ts` exigiendo únicamente `authorization` obligatorio (código 400), autogenerando cabeceras `x-app-proof` y testeando ciclo completo sin `xAppProof`.

*(Depende de la Fase 3. Desbloquea la infraestructura en CDK).*

---

## Fase 5: Infraestructura AWS CDK (`infra/`)
- [x] 5.1 En `infra/lib/fondos-stack.ts`, instanciar `TybaScraperFunction` usando `FondosFunction` con entrypoint en `src/scrapers/tyba/handler.ts` (256 MB, 60s timeout, Node.js 24) **sin regla de Amazon EventBridge Scheduler**.
- [x] 5.2 Actualizar `infra/test/fondos-stack.test.ts` con pruebas sintéticas de `@aws-cdk/assertions` verificando la creación de `TybaScraperFunction` y ratificando la ausencia de reglas EventBridge para Tyba.
- [x] 5.3 Ejecutar y verificar que pasen todas las suites de tests: `npm test` y `npm --prefix infra test`.

*(Depende de la Fase 4. Desbloquea el cierre de la funcionalidad).*

---

## Fase 6: Gobernanza SDD y Cierre
- [x] 6.1 Crear y completar la lista de comprobación de QA en `specs/2026-10-09-ingesta-tyba/checklist.md`.
- [x] 6.2 Actualizar `specs/roadmap.md` marcando la Fase 2.3 como completada.
- [x] 6.3 Agregar entrada en `CHANGELOG.md` documentando la nueva ingesta serverless de Tyba.
- [x] 6.4 Ejecutar scripts de validación `python scripts/validate_sdd.py` y `python scripts/check_constitution.py`.

*(Depende de la Fase 5).*
