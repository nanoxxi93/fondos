# Changelog

Registro de cambios de Fondos Mutuos Perú (fondos). Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); el proyecto usa [Versionado Semántico](https://semver.org/lang/es/) desde la primera versión publicada.

Mientras no haya versiones, todo va en **Sin publicar**, agrupado por fecha (la más reciente arriba).

Categorías: **Añadido** (algo nuevo) · **Cambiado** (algo existente se comporta distinto) · **Obsoleto** (se eliminará pronto) · **Eliminado** · **Corregido** (bugs) · **Seguridad**.

## [Sin publicar]

### 2026-10-09

#### Añadido
- Implementación completa de la Fase 2.1 (Ingesta Serverless de ERNI / Inteligo):
  - Scraper modular en `src/scrapers/erni/`: contratos TypeBox en `types.ts`, parser y lógica de series en `parser.ts`, cliente HTTP con `fetch` nativo en `client.ts`, y Lambda handler serverless en `handler.ts`.
  - Capa de persistencia y utilidades en `src/shared/`: conexión singleton a MongoDB Atlas en `db.ts`, esquemas Mongoose para catálogo dinámico `funds` y cuotas canónicas `erni`, concurrencia controlada por lotes `pMap` y formateo de fechas en `utils.ts`, y resolución de parámetros en SSM Parameter Store con caché en memoria en `config.ts`.
  - Función Lambda `ErniScraperFunction` (256 MB, 60s timeout, Node.js 24) aprovisionada mediante AWS CDK en `infra/lib/fondos-stack.ts`.
  - Regla de Amazon EventBridge Scheduler `ErniScraperScheduleRule` con expresión cron diaria a las 23:00 UTC (18:00 PET) post-cierre de mercado.
  - Suite de 13 pruebas unitarias exhaustivas en `test/scrapers/erni.test.ts` con Vitest cubriendo discriminación de series (A, C, -), fondos sin cuotas (96), fondos inactivos (41), validación TypeBox y concurrencia por lotes.
  - Actualización de tests sintéticos en `infra/test/fondos-stack.test.ts` (6 pruebas Jest pasando al 100%).
  - Script de prueba local `src/scrapers/erni/run-local.ts`.

#### Corregido
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
