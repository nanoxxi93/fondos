# Changelog

Registro de cambios de Fondos Mutuos Perú (fondos). Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); el proyecto usa [Versionado Semántico](https://semver.org/lang/es/) desde la primera versión publicada.

Mientras no haya versiones, todo va en **Sin publicar**, agrupado por fecha (la más reciente arriba).

Categorías: **Añadido** (algo nuevo) · **Cambiado** (algo existente se comporta distinto) · **Obsoleto** (se eliminará pronto) · **Eliminado** · **Corregido** (bugs) · **Seguridad**.

## [Sin publicar]

### 2026-10-08

#### Añadido
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
