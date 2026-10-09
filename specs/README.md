# Especificaciones (Spec-Driven Development)

**Fondos Mutuos Perú** sigue la metodología **Spec-Driven Development (SDD)** para su modernización Serverless en AWS. Antes de escribir una sola línea de código para la infraestructura o las Lambdas, cada funcionalidad se diseña, se valida, se desglosa y se audita de forma rigurosa.

Este directorio (`specs/`) contiene tanto los documentos fundacionales del proyecto como las carpetas individuales de cada funcionalidad a implementar (`specs/AAAA-MM-DD-<nombre>/`).

## 1. Documentos Fundacionales (La Base)

Estos archivos mandan sobre todo el código y deben ser consultados continuamente por las skills:

- [`mission.md`](mission.md) — Qué es Fondos Mutuos Perú, para quién está diseñado y su propuesta de valor.
- [`constitution.md`](constitution.md) — Los principios no negociables: Serverless puro, regla de \$0 Always Free, TypeScript estricto, preservación del legado Fly.io y TDD.
- [`tech-stack.md`](tech-stack.md) — La pila tecnológica (AWS CDK en TypeScript, MongoDB Atlas M0, Lambdas, EventBridge Scheduler, Function URLs, GitHub Pages).
- [`roadmap.md`](roadmap.md) — Fases de evolución del proyecto.
- [`intentos-fallidos.md`](intentos-fallidos.md) — Registro de enfoques y herramientas descartadas (incluyendo IF-001: descarte de DynamoDB por estrangulamiento de RCU/WCU).

## 2. El Flujo de Trabajo SDD (Paso a Paso)

Cuando se va a implementar una funcionalidad nueva, el trabajo se guarda en su propia carpeta `specs/AAAA-MM-DD-nombre-en-kebab/`.

Las skills de IA están diseñadas para ejecutarse estrictamente en este orden:

### Etapa 1: Diseño y Requisitos (El Qué)
1. **`specify`**: Dialoga para definir exactamente qué se va a hacer. Genera el **`spec.md`** (Criterios de Aceptación, Requisitos y Casos Extremos).
2. **`clarify`**: Actúa como Analista de Producto. Lee el `spec.md` buscando palabras ambiguas, lagunas lógicas o casos no contemplados. Reescribe el documento para blindarlo.

### Etapa 2: Arquitectura y Tareas (El Cómo)
3. **`plan`**: Traduce el `spec.md` en un diseño de arquitectura técnica generando **`plan.md`**. Justifica dependencias y valida cumplimiento con la constitución.
4. **`tasks`**: Lee el `plan.md` y lo desglosa en unidades de trabajo ejecutables agrupadas por fases. Genera la hoja de ruta **`tasks.md`**.
5. **`checklist`**: Vuelve al `spec.md` y genera el plan de pruebas y QA en **`checklist.md`**.

### Etapa 3: Auditoría y Construcción (La Ejecución)
6. **`analyze`**: Control de calidad cruzado. Revisa automáticamente que nada se haya escapado entre `spec`, `plan` y `tasks`.
7. **`implement`**: El motor de desarrollo. Lee `tasks.md` y ejecuta TDD (Test-Driven Development) tarea por tarea, marcando casillas a medida que escribe el código.

### Etapa 4: Finalización
8. **`close`**: Corre linters y tests, verifica que tareas y checklist estén completadas y consolida el commit.
9. **`publish`**: Salto de versión SemVer y release.

*(Nota: Los arreglos menores aislados no requieren crear toda una carpeta de spec, pueden ser ejecutados y cerrados directamente).*
