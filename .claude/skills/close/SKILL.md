---
name: close
description: Revisa el diff, pasa QA (lint/tests), valida si es cierre total o parcial (según tasks.md y checklist.md generados por implement), hace commit y push, y opcionalmente genera el PR Markdown.
---

# Close (Cerrar Trabajo y Preparar PR)

Esta skill es una herramienta genérica de tu flujo de trabajo (integrada con los artefactos de SDD) para automatizar el cierre seguro de una rama. Audita la calidad del código, evalúa el progreso mediante `tasks.md`, realiza el commit y empuja la rama sin hacer merge.

## 0. Punto de partida
- `git status -sb` y `git fetch origin`.
- Debes estar en la rama de trabajo (no en `main`).

## 1. Revisar el diff y Reglas Técnicas
Lee el diff entero (`git diff main --stat` y `git status -s`). Busca y limpia antes de continuar:
- **Restos de desarrollo**: `console.log`, `debugger`, `it.only`, código comentado, `TODO`s sin motivo o archivos de prueba mal ubicados.
- **Validación de Reglas (Constitución/Tech Stack)**:
  - Cada comportamiento nuevo debe tener su test.
  - Nada de credenciales en `localStorage`, `session` o logs.
  - Lo nativo detrás de `isNativePlatform()`.
  - **Backward compatibility de API**: La API no rompe a los APK instalados (no quita campos ni cambia formatos usados en producción).
  - Si hay variables de entorno nuevas, deben estar en `.env.example`.
- **Guías**: Revisa si el `README.md` o la documentación de la API deben actualizarse según este diff.

## 2. Validación SDD (Cierre Total o Parcial)
La skill `implement` te dejó un rastro. Revisa `tasks.md` y `checklist.md`:
- Verifica qué tareas están completadas (`[x]`).
- Si quedan tareas sin marcar o marcadas como `BLOQUEADO`, este es un **Cierre Parcial**. Informa al usuario.
- Si todas las tareas y el `checklist.md` (casos de QA manual) están en `[x]`, es un **Cierre Total**.

## 3. Quality Assurance (QA) Automático
```bash
npm run lint
npm run typecheck
npm test
```
Si falla, detén la skill y muestra el error.

## 4. Changelog (Opcional)
Si el flujo lo requiere para esta feature antes del release, actualiza el `CHANGELOG.md`.

## 5. Commit y Push
Empaqueta los cambios en un solo commit semántico.
- `feat/fix/docs/chore: <título>`
- Usa la información de `tasks.md` para detallar el cuerpo del commit.
```bash
git add .
git commit -m "<tipo>: <título>" -m "<cuerpo del commit>"
git push -u origin <nombre-de-rama>
```

## 6. Generación de Markdown para Pull Request
Si el usuario lo pide o se pasa por parámetro (ej. "genera el PR"), imprime un bloque Markdown listo para GitHub basándote estrictamente en `tasks.md` y `checklist.md`:

```markdown
# [Título del PR]

## Descripción
Resumen basado en el propósito del trabajo.

## Estado del Cierre
**[Total / Parcial]** *(Si es parcial, lista las dependencias bloqueadas o lo que falta).*

## Tareas Implementadas (`tasks.md`)
- [x] Tarea técnica 1
- [x] Tarea técnica 2

## QA y Casos de Prueba (`checklist.md`)
- [x] Caso de prueba 1 validado.
- [x] Edge case 2 validado.
```

