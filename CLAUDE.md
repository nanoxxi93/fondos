# Fondos Mutuos Perú (fondos)

Comparador y rastreador de rendimiento neto de comisiones para fondos mutuos peruanos (BBVA, ERNI e Inteligo, Tyba / Credicorp Capital).

El proyecto convive bajo dos modalidades:
1. **Legacy (Fly.io):** Monolito Node.js/Express con Docker y Mongoose existente en la raíz, que se mantiene plenamente operativo para despliegues en Fly.io.
2. **Modern Serverless (AWS + SDD):** Arquitectura desacoplada en AWS (EventBridge Scheduler → Lambdas TypeScript → MongoDB Atlas M0 → Lambda Function URL → GitHub Pages) gestionada con AWS CDK en TypeScript.

- **Spec-Driven Development (SDD)**: Todo nuevo desarrollo sigue estrictamente el ciclo de SDD mediante las skills en `.claude/skills/` (`specify` → `clarify` → `plan` → `tasks` → `checklist` → `analyze` → `implement` → `close` → `publish`).
- **Base del Producto**: `specs/mission.md`, `specs/tech-stack.md`, `specs/roadmap.md`, `specs/constitution.md`. Siempre consúltalos.
- **Specs por funcionalidad**: `specs/AAAA-MM-DD-<nombre>/` generadas por las skills.
- Idioma de la documentación: español. Finales de línea: LF.

## Registros que se mantienen mientras se trabaja

### `CHANGELOG.md` — qué cambió
Agrega una entrada **en el mismo turno** en que termines un cambio que afecte al producto, la arquitectura, las specs o la configuración del repo:
- Dentro de `## [Sin publicar]`, bajo el encabezado de la fecha de hoy (`date +%F`); créalo arriba de los demás si no existe.
- En la categoría que corresponda (Añadido, Cambiado, Obsoleto, Eliminado, Corregido, Seguridad). Crea la categoría si no existe en esa fecha.
- Una línea por cambio, desde el punto de vista de quien lee el proyecto, no la lista de archivos tocados. Enlaza la spec si la hay.
- No registres ediciones menores sin efecto (typos, formato).

### `specs/intentos-fallidos.md` — qué no funcionó
Antes de proponer un enfoque, una librería o una solución a un bug, **busca en este archivo**. Si ya está registrado, no lo repitas salvo que se cumpla su condición de *Reconsiderar si*, y dilo explícitamente.

Agrega una entrada cuando:
- Algo que se probó falló: build, test, librería, configuración, experimento de la Fase 0, comportamiento de un servicio AWS.
- Un enfoque se descartó tras analizarlo y es probable que alguien lo vuelva a proponer (ej. DynamoDB vs MongoDB Atlas documentado en `IF-001`).

Cómo:
- Usa la plantilla del archivo, con el siguiente ID `IF-NNN`, y agrégala **arriba** de las demás y en el índice.
- Anota la causa, no solo el síntoma, e incluye mensajes de error textuales y versiones.
- Las entradas no se borran. Si algo cambia (p. ej. una nueva versión de la librería lo arregla), agrega una nota con fecha al final de la entrada.
- No registres errores triviales corregidos al momento (typos, imports faltantes).
