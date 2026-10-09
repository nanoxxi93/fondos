---
name: analyze
description: Realiza la comprobación de coherencia cruzada entre todos los artefactos SDD (spec, plan, tasks) y la constitución. Detecta inconsistencias, lagunas y violaciones de reglas antes de empezar a programar para evitar retrabajos.
---

# Análisis de Coherencia de Artefactos (Quality Assurance)

En el Spec-Driven Development (SDD), la integridad documental es la base del éxito. La skill `analyze` actúa como un auditor de sistemas estricto que evalúa la coherencia cruzada de los artefactos generados, idealmente justo antes de que comience la fase de programación (construcción). 

Cada incoherencia identificada aquí es un error, un "bug arquitectónico" o una refactorización que de otro modo explotaría durante la implementación o en la revisión de código.

## 1. Comprobaciones de Integridad

Al ejecutar esta skill, debes cargar todos los archivos de la funcionalidad (`spec.md`, `plan.md`, `tasks.md`) y contrastarlos con las reglas maestras (`specs/constitution.md`). Realiza estas 4 auditorías:

### A. Cobertura de Requisitos (`spec.md` ➔ `plan.md`)
- Cruza cada Criterio de Aceptación, Requisito y Caso Extremo del `spec.md` contra el `plan.md`.
- **Fallo si:** El `spec.md` exige algo (ej. "Mostrar un mensaje de error para archivos mayores a 50MB") pero el `plan.md` omite explicar *dónde y cómo* se va a manejar esa validación (en el front, en un middleware, etc.).

### B. Cobertura de Implementación (`plan.md` ➔ `tasks.md`)
- Revisa las decisiones arquitectónicas y la pila tecnológica del `plan.md`.
- Verifica que el `tasks.md` incluya al menos una tarea explícita para cada componente del plan.
- **Fallo si:** El `plan.md` detalla que "Se usará Amazon S3 para guardar los documentos", pero en el `tasks.md` no existe ninguna tarea de configuración de S3 ni de implementación de su SDK.

### C. Auditoría de Constitución (Todos ➔ `constitution.md`)
- Contrapón las propuestas contra las reglas innegociables de `specs/constitution.md`, así como las herramientas de `specs/tech-stack.md`.
- **Fallo si:** Las tareas proponen almacenar un token en un lugar inseguro, o se propone una librería externa no listada en el stack sin justificación, o se rompe la arquitectura Local-First.

### D. Secuencia y Bloqueos (`tasks.md`)
- Analiza la secuencia de fases.
- **Fallo si:** Hay tareas de frontend planificadas antes de que se haya listado la creación de las tablas de base de datos o los endpoints que ese frontend va a consumir.

## 2. Reporte de Análisis

Tras el escrutinio, genera un **Reporte de Coherencia**:

1. Si no hay fallos, notifica que "El Análisis ha finalizado con éxito. Los artefactos están 100% alineados y listos para la implementación."
2. Si detectas problemas, agrupalos por tipo (Laguna de especificación, Falta de tarea, Violación de constitución).
3. Para cada problema, sé accionable:
   - Menciona el documento que está incompleto o erróneo.
   - Explica el motivo de la inconsistencia.
   - **Propón la solución exacta** (ej. "Sugiero agregar la Tarea 4.2 en tasks.md para el manejo de logs de auditoría estipulado en el plan").

## 3. Resolución Interactiva

Pregunta al usuario si da luz verde para que apliques las correcciones sugeridas en los archivos correspondientes. Si acepta, actualiza los documentos para blindar el paquete antes de la fase de código.
