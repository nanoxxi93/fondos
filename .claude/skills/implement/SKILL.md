---
name: implement
description: Construye el código sistemáticamente siguiendo tasks.md, tarea por tarea. Toma spec.md, plan.md y tasks.md como base. Pausa ante ambigüedades y registra explícitamente las dependencias bloqueadas.
---

# Implementar Tareas (Spec-Driven Development)

En el Spec-Driven Development, el comando `implement` reemplaza la escritura caótica por una generación de código sistemática. En lugar de intentar programar características completas en un solo paso, la IA trabaja de forma secuencial, tarea por tarea a través de `tasks.md`, produciendo un código mucho más enfocado y correcto.

## 0. Contexto y Punto de Partida

Antes de escribir código:
1. **Verifica la rama**: Comprueba que estás en la rama de trabajo derivada de `main` (creada para esta feature).
2. **Carga la documentación base**: Lee `spec.md`, `plan.md` y `tasks.md`. El código generado debe alinearse absolutamente con la arquitectura, dependencias y secuencias descritas en ellos.

## 1. Flujo Sistemático

Puedes invocar esta skill pidiendo un número de tarea específico, un intervalo de tareas (ej. Fase 1), o simplemente pidiendo implementar la siguiente tarea pendiente en `tasks.md`.

Para la(s) tarea(s) en curso:
1. **Identifica el alcance preciso**: Concéntrate exclusivamente en lo que pide la tarea.
2. **Ejecuta la tarea**: Escribe el código necesario respetando las directivas técnicas. Si la tarea es de lógica, recuerda el ciclo de Test-Driven Development (prueba primero, falla, luego implementa).
3. **Marca el progreso**: Al finalizar, actualiza `tasks.md` marcando la casilla de la tarea (`[x]`).

*(Nota: Los commits se recomiendan a discreción o al finalizar el ciclo con la skill `cierra`, a menos que el usuario pida explícitamente comitear tarea por tarea).*

## 2. Manejo de Ambigüedades (Pausa Obligatoria)

La regla de oro de la implementación es no adivinar. 
- Si durante la programación descubres que una tarea es vaga, falta un detalle en la interfaz o hay un comportamiento no especificado ante un error: **PAUSA LA IMPLEMENTACIÓN INMEDIATAMENTE**.
- Busca la intención original en el `spec.md` y `plan.md`.
- Si sigue sin estar claro, pídele aclaración al usuario.
- **Acción Obligatoria**: Una vez aclarado, actualiza la descripción de la tarea en `tasks.md` (y de ser necesario el `spec.md`) con un lenguaje específico e inequívoco antes de escribir el código.

## 3. Manejo de Bloqueos (Dependencias Externas)

A veces, las tareas no pueden avanzar por dependencias externas (esperando aprovisionamiento de recursos en la nube, contraseñas, acceso a APIs o trabajo de otro equipo).
- **Márcalas explícitamente en `tasks.md`** cambiando su línea a este formato:
  `- [ ] BLOQUEADO: esperando <razón del bloqueo> - <ticket o referencia si existe>`.
- Lleva un seguimiento separado (puede ser una nota al final del archivo `tasks.md` bajo una sección `## Bloqueos`) para asegurar que esas tareas no se olviden.
- Salta a la siguiente tarea que sea independiente y continúa trabajando.

## 4. Al finalizar la interacción

Reporta al usuario:
- Qué tarea(s) completaste exactamente.
- Si tuviste que pausar por ambigüedad.
- Si registraste algún bloqueo.
- Si las pruebas locales corrieron correctamente para ese fragmento de código.
