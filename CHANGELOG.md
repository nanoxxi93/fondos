# Changelog

Registro de cambios de Fondos Mutuos Perú (fondos). Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); el proyecto usa [Versionado Semántico](https://semver.org/lang/es/) desde la primera versión publicada.

Mientras no haya versiones, todo va en **Sin publicar**, agrupado por fecha (la más reciente arriba).

Categorías: **Añadido** (algo nuevo) · **Cambiado** (algo existente se comporta distinto) · **Obsoleto** (se eliminará pronto) · **Eliminado** · **Corregido** (bugs) · **Seguridad**.

## [Sin publicar]

### 2026-10-08

#### Añadido
- Inicialización del marco metodológico Spec-Driven Development (SDD) importado desde `sdd-template`.
- Documentos fundacionales en `specs/` (`mission.md`, `constitution.md`, `tech-stack.md`, `roadmap.md`, `intentos-fallidos.md`).
- Registro `IF-001` documentando el descarte de DynamoDB frente a MongoDB Atlas por restricciones de RCU/WCU en agregaciones del dashboard.
- Workflow de GitHub Actions `sdd-validation.yml` y scripts de validación (`validate_sdd.py`, `check_constitution.py`).
- Diagrama de arquitectura desacoplada Serverless (Always Free) en `README.md`.
