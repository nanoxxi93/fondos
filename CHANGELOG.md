# Changelog

Registro de cambios de Fondos Mutuos Perú (fondos). Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); el proyecto usa [Versionado Semántico](https://semver.org/lang/es/) desde la primera versión publicada.

Mientras no haya versiones, todo va en **Sin publicar**, agrupado por fecha (la más reciente arriba).

Categorías: **Añadido** (algo nuevo) · **Cambiado** (algo existente se comporta distinto) · **Obsoleto** (se eliminará pronto) · **Eliminado** · **Corregido** (bugs) · **Seguridad**.

## [Sin publicar]

### 2026-10-10

#### Añadido
- Workflow programado de GitHub Actions para ingesta diaria de BBVA (`.github/workflows/scrape-bbva.yml`):
  - Ejecución diaria programada a las 23:15 UTC (18:15 PET) y soporte manual bajo demanda (`workflow_dispatch` con parámetro opcional `days`).
  - Sincronización directa contra MongoDB Atlas mediante el secret `MONGO_DB_URI` preservando presupuesto \$0.

#### Cambiado
- Deshabilitación de la regla de EventBridge Scheduler para BBVA en AWS CDK (`infra/lib/fondos-stack.ts`, `infra/test/fondos-stack.test.ts`):
  - Se establece `enabled: false` en `BbvaScraperScheduleRule` para evitar ejecuciones fallidas con HTTP 403 provocadas por el filtrado de Akamai Bot Manager sobre IPs de datacenters de AWS (documentado en `specs/intentos-fallidos.md` como `IF-002`).

#### Corregido
- Compatibilidad de versiones de npm (`package.json`):
  - Ajustar el motor requerido a `"npm": ">=10"` para admitir npm 11.x provisto por defecto en Node 24 dentro de runners de GitHub Actions, resolviendo fallo `EBADENGINE` en `npm ci`.

### 2026-10-09

#### Eliminado
- Retiro definitivo del código y dependencias legacy (`legacy/`, `puppeteer`):
  - Eliminación de la carpeta `legacy/` tras su absorción completa por el servidor Express en TypeScript (`src/server.ts`), la plantilla SSR (`src/views/html.ts`), el motor TEA (`src/domain/tea.ts`) y los adaptadores serverless en `src/scrapers/`.
  - Desinstalación de la dependencia pesada `puppeteer` de `package.json`, eliminando el requerimiento de binarios de Chromium.
  - Actualización de los scripts en `package.json` (`main`, `start`, `dev`) para apuntar directamente al servidor TypeScript (`dist/src/server.js`, `tsx watch src/server.ts`).

#### Cambiado
- Normalización y depuración visual de nombres de fondos mutuos para BBVA y ERNI (`src/shared/utils.ts`, `src/scrapers/bbva/catalog.ts`, `src/scrapers/bbva/parser.ts`, `src/scrapers/erni/parser.ts`, `src/domain/tea.ts`):
  - Creación de la utilidad `normalizeFundName` para eliminar de manera determinística prefijos redundantes ("Fondo de Fondos" / "FDF").
  - Limpieza de los fondos de BBVA que tenían el prefijo "Fondo de Fondos", asegurando la denominación directa "BBVA ..." (incluyendo "BBVA Acciones Globales Real Estate FMIV").
  - Limpieza de los fondos de ERNI (Inteligo) con prefijo "FDF", mostrando directamente la denominación "IF ...".
  - Saneamiento y migración en caliente de los 17 registros existentes en la colección `funds` de MongoDB Atlas.

#### Añadido
- Implementación completa de la Fase 4: [Dashboard SPA Moderno (React + Vite + Tailwind) y Despliegue en GitHub Pages](specs/2026-10-09-frontend-dashboard-gh-pages/):
  - Creación de la Single Page Application (SPA) desacoplada en `frontend/` utilizando React 19, TypeScript estricto, Vite 6 y Tailwind CSS v3 con empaquetado optimizado de alto rendimiento (~145 kB gzip total).
  - Diseño Fintech moderno con tema dual (Dark / Light mode) persistente en `localStorage` con detección inicial del sistema operativo (`useTheme.ts`).
  - Cuadrícula bento de métricas financieras clave (`KpiBentoGrid.tsx`): cálculo reactivo del Top 1 de rentabilidad neta, fondo más conservador (menor riesgo con retorno positivo), promedio del mercado y conteo total de fondos activos.
  - Barra de filtros interactiva (`FilterBar.tsx`): selector en píldoras (`7D`, `30D`, `90D`, `180D`, `1A`, `3A`, `YTD`), input manual de días, interruptores de moneda (`Todas`, `PEN`, `USD`), slider de riesgo (1 a 7) y pestañas por administradora (`BBVA`, `Inteligo`, `Tyba`).
  - Gráfico interactivo de series temporales (`ChartView.tsx`): renderizado con Chart.js y `react-chartjs-2`, puenteo de feriados con `spanGaps: true`, padding dinámico de escala Y (`grace: '5%'`), tooltips financieros contextuales y botones de acción rápida (*"Ver solo Top 5"*, *"Mostrar todos"*, *"Ocultar todos"*).
  - Simulador de retorno financiero (`Simulator.tsx`): calculadora interactiva para proyectar la ganancia o pérdida neta real en soles o dólares a partir de un capital ingresado.
  - Tabla de datos responsiva (`FundsTable.tsx`): encabezados sticky, buscador de texto en tiempo real, ordenamiento interactivo por cualquier columna (ascendente/descendente), badges visuales por administradora y nivel de riesgo, y checkboxes sincronizados bidireccionalmente con las curvas del gráfico.
  - Componentes de retroalimentación de estado (`Feedback.tsx`): skeletons animados durante la carga, tarjeta de error con botón de reintento ante fallos de red o backend offline, y vista vacía para combinaciones de filtros sin resultados.
  - Flujo de integración y despliegue continuo (`.github/workflows/deploy-gh-pages.yml`): pipeline de GitHub Actions para compilación estática y publicación automática en GitHub Pages con `actions/deploy-pages@v4`.
  - Aislamiento total del entorno de Fly.io: configuración de `.dockerignore` y `tsconfig.json` para garantizar cero impacto en el tamaño de la imagen Docker de producción (<40 MB RAM) y preservación intacta del SSR legacy en `src/views/html.ts`.
  - 7 pruebas unitarias nuevas en `test/frontend/formatters.test.ts` (135 pruebas automatizadas pasando al 100%).

- Servidor Express unificado y vista Server-Side Rendering (SSR) en TypeScript (`src/server.ts`, `src/views/html.ts`):
  - Punto de entrada Express modular y ligero para despliegue en Fly.io o ejecución local sin dependencias de frameworks frontend (cero React, cero Vite) preservando la interactividad del dashboard clásico.
  - Endpoint `GET /` que sirve el HTML interactivo completo con formulario de filtros (`days`, `currency`, `risk`), checkboxes dinámicos agrupados por administradora, canvas Chart.js y tabla comparativa de rendimientos.
  - Endpoint `GET /api/tea` que expone los datos analíticos normalizados en formato JSON con cabecera de caché (`Cache-Control: public, max-age=3600...`).
  - Endpoints de ingesta protegidos por `SCRAPE_TOKEN`: `GET /api/erni`, `GET /api/bbva` y `GET /api/tyba`, invocando directamente los handlers serverless de `src/scrapers/` con `fetch` nativo.
  - Endpoint `GET /health` compatible con las verificaciones automáticas de Fly.io y monitoreo de MongoDB Atlas.
  - `Dockerfile` multi-stage ligero en la raíz y actualización de `fly.toml` para compilación y ejecución de Node 24 con consumo mínimo de memoria (<40 MB).
  - 26 nuevas pruebas unitarias en `test/server.test.ts`, `test/views/html.test.ts` y `test/shared/utils.test.ts` (122 pruebas pasando al 100%).
- Implementación completa de la Fase 3 (API Serverless y Motor de Analítica TEA):
  - Especificación SDD completa en [`specs/2026-10-09-api-serverless-analitica/`](specs/2026-10-09-api-serverless-analitica/) (`spec.md`, `plan.md`, `tasks.md`, `checklist.md`).
  - Motor analítico TEA puro en `src/domain/tea.ts`: migración completa de la lógica legacy a TypeScript funcional, cálculo de rendimiento relativo porcentual ponderado, ordenamiento alfabético determinístico de datasets y enriquecimiento de metadatos (`idFondo`, `fee`).
  - Validación de contratos HTTP y parámetros con TypeBox en `src/api/types.ts` (`days`, `since`, `currency`, `provider`).
  - API Serverless en `src/api/handler.ts` compatible con AWS Lambda Function URL (formato payload v2), enrutador para `GET /`, `GET /api/tea`, `GET /health` y preflight `OPTIONS` (HTTP 204), y política de caché asimétrica (`Cache-Control: public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400` para 200 OK y `no-store, no-cache, must-revalidate` para 4xx/5xx).
  - Función Lambda `ApiFunction` (256 MB, 15s timeout, Node.js 24) y Function URL pública con CORS (`AuthType.NONE`) aprovisionadas en AWS CDK en `infra/lib/fondos-stack.ts` con CloudFormation Output `ApiFunctionUrlOutput`.
  - Servidor de desarrollo local en `src/api/run-local.ts` accesible vía `npm run api:local` simulando eventos Lambda Function URL v2 sobre `node:http`.
  - Suite de pruebas unitarias exhaustivas con Vitest (25 pruebas nuevas, 96/96 pruebas totales en la raíz) en `test/api/types.test.ts`, `test/domain/tea.test.ts` y `test/api/handler.test.ts`.
  - Pruebas sintéticas en `infra/test/fondos-stack.test.ts` con `@aws-cdk/assertions` verificando `ApiFunction`, `AWS::Lambda::Url` y optimización de compilación con `beforeAll` (13/13 pruebas Jest pasando).
- Plan de pruebas de control de calidad y matriz de aceptación de la Fase 3 en [`specs/2026-10-09-api-serverless-analitica/checklist.md`](specs/2026-10-09-api-serverless-analitica/checklist.md) con 18 criterios de aceptación y 11 pruebas de casos extremos.
- Plan de tareas de implementación de la Fase 3 en [`specs/2026-10-09-api-serverless-analitica/tasks.md`](specs/2026-10-09-api-serverless-analitica/tasks.md) estructurado en 5 fases lógicas de desarrollo y verificación.
- Plan de implementación técnico de la Fase 3 en [`specs/2026-10-09-api-serverless-analitica/plan.md`](specs/2026-10-09-api-serverless-analitica/plan.md) definiendo la arquitectura modular de la API Serverless, contratos TypeBox, motor analítico TEA puro, caché asimétrico y aprovisionamiento de AWS Lambda Function URL con CORS.
- Refinamiento de la especificación SDD de la Fase 3 ([`specs/2026-10-09-api-serverless-analitica/spec.md`](specs/2026-10-09-api-serverless-analitica/spec.md)) tras la fase `clarify`, incorporando cálculo determinístico de `since` a medianoche UTC, anti-caché estricto en respuestas de error (4xx/5xx), enriquecimiento de `meta` con `idFondo` y `fee`, y servidor local en `src/api/run-local.ts`.
- Especificación SDD de la Fase 3 en [`specs/2026-10-09-api-serverless-analitica/spec.md`](specs/2026-10-09-api-serverless-analitica/spec.md) para la API Serverless con AWS Lambda Function URL, motor de cálculo de variación neta (`tea`) y caché HTTP.
- Implementación completa de la Fase 2.3 (Ingesta Serverless de Tyba / Credicorp Capital):
  - Especificación SDD completa en [`specs/2026-10-09-ingesta-tyba/`](specs/2026-10-09-ingesta-tyba/) (`spec.md`, `plan.md`, `tasks.md`, `checklist.md`).
  - Scraper modular en `src/scrapers/tyba/`: catálogo canónico de 30 fondos de Credicorp Capital en `catalog.ts`, contratos TypeBox en `types.ts`, normalización canónica en `parser.ts` (con saneamiento de `Bearer `, soporte `xAppProof` / `x-app-proof` y recorte de días fiel al legacy `slice(-days)` o persistencia total `all: true`), cliente HTTP con `fetch` nativo en `client.ts` y Lambda handler serverless en `handler.ts`.
  - Módulo criptográfico `src/scrapers/tyba/crypto.ts` para auto-generación transparente de la cabecera `x-app-proof` usando cifrado asimétrico RSA-4096 con padding OAEP y SHA-256 (`node:crypto`), eliminando la necesidad de provisión manual por el operador y flexibilizando el evento para requerir únicamente `authorization`.
  - Mecanismo de ingesta bajo demanda con autenticación por sesión (`authorization`), aborto inmediato con HTTP 502 Bad Gateway si falla el catálogo de portafolios, y ejecución concurrente controlada con `pMap` (concurrencia máxima 4).
  - Resiliencia y auto-recuperación ante expiración de sesión (HTTP 401): soporte opcional para `refreshToken` (o `refresh-token`), invocando automáticamente `POST /api-master/auth/refresh-token` y reintentando de forma transparente con coordinación concurrente single-flight para evitar llamadas duplicadas.
  - Persistencia idempotente de valores cuota en la colección `tybas` de MongoDB Atlas (`TybaQuotaModel = getQuotaModel("tyba")`) y sincronización automática del catálogo en la colección `funds`.
  - Función Lambda `TybaScraperFunction` (256 MB, 60s timeout, Node.js 24) aprovisionada en AWS CDK en `infra/lib/fondos-stack.ts` **sin regla de Amazon EventBridge Scheduler** para invocación exclusivamente manual/on-demand.
  - Script de ejecución y prueba local interactivo en `src/scrapers/tyba/run-local.ts` accesible vía `npm run scrape:tyba` con soporte de flags CLI (`--authorization`, `--app-proof`, `--refresh-token`, `--days`, `--all`, `--dry-run`) y variables en `.env`.
  - Suite de 46 pruebas unitarias exhaustivas en `test/scrapers/tyba.test.ts` con Vitest cubriendo criptografía RSA, parser, cliente HTTP y handler serverless (71/71 pruebas totales en la raíz).
  - Pruebas sintéticas en `infra/test/fondos-stack.test.ts` con `@aws-cdk/assertions` verificando la creación de `TybaScraperFunction` y confirmando la ausencia de reglas EventBridge para Tyba (11/11 tests de Jest pasando).
- Plan de pruebas de control de calidad y matriz de aceptación de la Fase 2.3 en [`specs/2026-10-09-ingesta-tyba/checklist.md`](specs/2026-10-09-ingesta-tyba/checklist.md) con 16 criterios de aceptación y 9 casos extremos.
- Plan de tareas de implementación detallado de la Fase 2.3 en [`specs/2026-10-09-ingesta-tyba/tasks.md`](specs/2026-10-09-ingesta-tyba/tasks.md) estructurado en 6 fases lógicas de desarrollo y verificación.
- Plan de implementación técnico de la Fase 2.3 en [`specs/2026-10-09-ingesta-tyba/plan.md`](specs/2026-10-09-ingesta-tyba/plan.md) definiendo la arquitectura modular de Tyba, contratos TypeBox, modelo `TybaQuotaModel`, catálogo canónico de 30 fondos y aprovisionamiento en AWS CDK sin Scheduler.
- Refinamiento de la especificación SDD de Tyba ([`specs/2026-10-09-ingesta-tyba/spec.md`](specs/2026-10-09-ingesta-tyba/spec.md)) tras la fase `clarify`, incorporando recorte de cuotas con comportamiento legacy `slice(-days)`, aborto inmediato ante fallo de catálogo (502), saneamiento del prefijo 'Bearer' y soporte local en `run-local.ts`.
- Especificación SDD de la Fase 2.3 en [`specs/2026-10-09-ingesta-tyba/spec.md`](specs/2026-10-09-ingesta-tyba/spec.md) para la ingesta serverless de Tyba (Credicorp Capital) con invocación manual por sesión y catálogo de 30 fondos.
- Implementación completa de la Fase 2.2 (Ingesta Serverless de BBVA Asset Management):
  - Especificación SDD completa en [`specs/2026-10-09-ingesta-bbva/`](specs/2026-10-09-ingesta-bbva/) (`spec.md`, `plan.md`, `tasks.md`, `checklist.md`).
  - Scraper modular en `src/scrapers/bbva/`: catálogo canónico de 21 fondos en `catalog.ts` (cruzando los 19 legados e incorporando los 2 nuevos fondos `421` y `BBVAEM`), contratos TypeBox en `types.ts`, normalización canónica en `parser.ts`, cliente HTTP con `fetch` nativo y autenticación dinámica TSEC en `client.ts`, y Lambda handler serverless en `handler.ts`.
  - Autenticación dinámica TSEC vía `POST /ASO/TechArchitecture/grantingTickets/V02`, eliminando por completo la dependencia pesada de Puppeteer/Chromium del código legado.
  - Sincronización del catálogo de 21 fondos mutuos de BBVA en la colección `funds` e inserción masiva idempotente de valores cuota en la colección `bbva` (modelo Mongoose `BbvaQuotaModel`).
  - Función Lambda `BbvaScraperFunction` (256 MB, 60s timeout, Node.js 24) aprovisionada en AWS CDK en `infra/lib/fondos-stack.ts`.
  - Regla de Amazon EventBridge Scheduler `BbvaScraperScheduleRule` para ejecución diaria a las 23:15 UTC (18:15 PET), escalonada 15 minutos después de ERNI.
  - Suite de 12 pruebas unitarias en `test/scrapers/bbva.test.ts` con Vitest (25/25 pruebas totales en la raíz).
  - Pruebas sintéticas con `@aws-cdk/assertions` en `infra/test/fondos-stack.test.ts` (8/8 pruebas Jest pasando).
  - Script de prueba local en `src/scrapers/bbva/run-local.ts`.
- Implementación completa de la Fase 2.1 (Ingesta Serverless de ERNI / Inteligo):
  - Scraper modular en `src/scrapers/erni/`: contratos TypeBox en `types.ts`, parser y lógica de series en `parser.ts`, cliente HTTP con `fetch` nativo en `client.ts`, y Lambda handler serverless en `handler.ts`.
  - Capa de persistencia y utilidades en `src/shared/`: conexión singleton a MongoDB Atlas en `db.ts`, esquemas Mongoose para catálogo dinámico `funds` y cuotas canónicas `erni`, concurrencia controlada por lotes `pMap` y formateo de fechas en `utils.ts`, y resolución de parámetros en SSM Parameter Store con caché en memoria en `config.ts`.
  - Función Lambda `ErniScraperFunction` (256 MB, 60s timeout, Node.js 24) aprovisionada mediante AWS CDK en `infra/lib/fondos-stack.ts`.
  - Regla de Amazon EventBridge Scheduler `ErniScraperScheduleRule` con expresión cron diaria a las 23:00 UTC (18:00 PET) post-cierre de mercado.
  - Suite de 13 pruebas unitarias exhaustivas en `test/scrapers/erni.test.ts` con Vitest cubriendo discriminación de series (A, C, -), fondos sin cuotas (96), fondos inactivos (41), validación TypeBox y concurrencia por lotes.
  - Actualización de tests sintéticos en `infra/test/fondos-stack.test.ts` (6 pruebas Jest pasando al 100%).
  - Script de prueba local `src/scrapers/erni/run-local.ts`.

#### Corregido
- Escala de comisiones de Tyba normalizada a porcentaje (`src/scrapers/tyba/catalog.ts`, `src/scrapers/tyba/parser.ts`, `src/domain/tea.ts`):
  - Detección y conversión automática de valores en ratio decimal de la API de Tyba (`0.01` = 1%, `0.0081` = 0.81%) multiplicándolos por 100 para unificar el estándar porcentual del proyecto.
  - Corrección de la fórmula de variación neta de TEA en `tea.ts` `(100 - meta.fee)` y compatibilidad retroactiva para registros previamente persistidos en MongoDB Atlas.
  - Actualización de los 30 fondos del catálogo estático de Tyba con su porcentaje nominal directo.
- Refinamientos de UX, responsividad y estabilidad en el Dashboard SPA (`frontend/`):
  - Soporte universal de respuesta de salud en `frontend/src/services/api.ts` tolerando texto plano (`"OK"`) de Fly.io y JSON de la API Serverless.
  - Adaptación completa de contraste y modo dual (Light/Dark) con clases semánticas `dark:` en toda la interfaz.
  - Preservación de selección personalizada de fondos (`viewMode: 'custom'`) ante cambios de horizonte temporal.
  - Cálculo dinámico de Top 5 restringido por administradora seleccionada (`BBVA`, `Inteligo`, `Tyba`).
  - Tooltips de Chart.js aislados (`mode: 'nearest'`, `axis: 'xy'`) para mostrar exclusivamente la curva bajo el cursor.
  - Diseño responsivo al corte de 1024px: botones de visualización y píldoras del simulador se ubican en fila propia en pantallas menores a 1024px y se alinean a la derecha en escritorio (>= 1024px).
  - Eliminación de saltos de scroll involuntarios en el simulador mediante desactivación de Scroll Anchoring del navegador (`overflow-anchor: none`), `history.scrollRestoration = 'manual'` y `animation: false` en Chart.js.
  - Ajuste de etiqueta de niveles de riesgo 1 y 2 a únicamente "Bajo" (eliminando "Muy Bajo").
  - Limpieza de menciones técnicas de infraestructura en la cabecera y simplificación del pie de página a "Fondos Mutuos Perú · 2026".
- Configuración de `eslint.config.js` para ignorar artefactos temporales y empaquetados de AWS CDK (`**/cdk.out/**`).
- Configuración de empaquetado `esbuild` en `FondosFunction` CDK construct para compilar código fuente en `src/` relativo a la raíz del repositorio.

### 2026-10-08

#### Añadido
- Plan de pruebas y lista de comprobación de QA de la Fase 2.1 en [`specs/2026-10-08-ingesta-erni/checklist.md`](specs/2026-10-08-ingesta-erni/checklist.md) con 12 casos de aceptación y 8 pruebas de casos extremos.
- Plan de tareas de implementación detallado de la Fase 2.1 en [`specs/2026-10-08-ingesta-erni/tasks.md`](specs/2026-10-08-ingesta-erni/tasks.md) estructurado en 6 fases lógicas de desarrollo y verificación.
- Plan de implementación técnico de la Fase 2.1 en [`specs/2026-10-08-ingesta-erni/plan.md`](specs/2026-10-08-ingesta-erni/plan.md) definiendo la arquitectura modular en `src/`, concurrencia controlada por lotes, conexión singleton a MongoDB y orquestación con EventBridge Scheduler.
- Adopción de `@sinclair/typebox` como el estándar transversal de validación de esquemas y contratos en tiempo de compilación y ejecución para las funciones Lambda, documentado en `specs/constitution.md` y `specs/tech-stack.md`.
- Refinamiento de la especificación SDD de ERNI ([`specs/2026-10-08-ingesta-erni/spec.md`](specs/2026-10-08-ingesta-erni/spec.md)) tras la fase `clarify`, incorporando persistencia del catálogo en la colección `funds`, concurrencia por lotes (3-4 peticiones) y validación estricta con TypeBox.
- Especificación SDD de la Fase 2.1 en [`specs/2026-10-08-ingesta-erni/spec.md`](specs/2026-10-08-ingesta-erni/spec.md) para la ingesta serverless de ERNI (Inteligo) con descubrimiento dinámico de fondos y extracción de series temporales vía API v2.
- Módulo de Infraestructura como Código en `infra/` utilizando AWS CDK v2 en TypeScript (`FondosStack`).
- Aprovisionamiento persistente de 5 parámetros en AWS SSM Parameter Store (`/fondos/prod/*`) con `RemovalPolicy.RETAIN`.
- Construct base reutilizable `FondosFunction` con empaquetado nativo `esbuild` local (sin Docker), `LogGroup` con retención a 7 días y rol IAM con permisos mínimos hacia SSM.
- Suite de pruebas unitarias de infraestructura con `@aws-cdk/assertions` en `infra/test/fondos-stack.test.ts`.
- Especificación SDD completa para la Fase 1 en `specs/2026-10-08-infra-cdk-base/` (`spec.md`, `plan.md`, `tasks.md`, `checklist.md`).
- Inicialización del marco metodológico Spec-Driven Development (SDD) importado desde `sdd-template`.
- Documentos fundacionales en `specs/` (`mission.md`, `constitution.md`, `tech-stack.md`, `roadmap.md`, `intentos-fallidos.md`).
- Registro `IF-001` documentando el descarte de DynamoDB frente a MongoDB Atlas por restricciones de RCU/WCU en agregaciones del dashboard.
- Workflow de GitHub Actions `sdd-validation.yml` y scripts de validación (`validate_sdd.py`, `check_constitution.py`).
- Diagrama de arquitectura desacoplada Serverless (Always Free) en `README.md`.

#### Cambiado
- Reorganización y encapsulación de todo el código legado de Express, scrapers y Dockerfile dentro del subdirectorio `legacy/`.
- Actualización de `fly.toml` (`[build] dockerfile = "legacy/Dockerfile"`) y `package.json` (`main: "legacy/index.js"`) para mantener 100% operativo el despliegue en Fly.io y la ejecución local.
