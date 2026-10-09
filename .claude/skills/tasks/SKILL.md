---
name: tasks
description: Convierte las decisiones de spec.md y plan.md en una lista de tareas de implementación (tasks.md). Las organiza por fases lógicas, asegurando dependencias correctas, granularidad adecuada y trazabilidad total.
---

# Generar Tareas de Implementación (tasks.md)

En la metodología Spec-Driven Development, los planes técnicos (`plan.md`) proporcionan la dirección arquitectónica, pero la implementación requiere pasos concretos. Esta skill toma `spec.md` y `plan.md` y genera el archivo `tasks.md` (la hoja de ruta de ejecución).

## 1. Características de una Tarea Bien Definida

Toda tarea redactada en `tasks.md` debe cumplir con estos cuatro criterios:
- **Accionable**: Indica claramente qué se va a construir (ej. "Implementar el endpoint POST /api/documents/upload que acepte X y devuelva Y").
- **Verificable (Testable)**: Es evidente cuándo la tarea está terminada y puede probarse de forma aislada.
- **Independiente**: Se puede completar sin esperar a otro trabajo paralelo (respetando la secuencia lógica).
- **Límite de tiempo (Granularidad correcta)**: Su alcance representa horas o máximo un día de trabajo. No debe ser inmensa ("Implementar todo el backend") ni excesivamente prescriptiva o diminuta ("Añadir un punto y coma en la línea 42").

## 2. Organización Basada en Fases y Secuenciación

Las funcionalidades complejas deben dividirse en hitos lógicos. El orden de las fases es crítico para evitar bloqueos. Genera el `tasks.md` con una estructura similar a esta:

```markdown
# Lista de Tareas: <Nombre de Funcionalidad>

## Fase 1: Fundación y Configuración
- [ ] 1.1 Configurar variables de entorno y esquemas de base de datos.
*(No hay dependencias. Desbloquea el backend).*

## Fase 2: Funcionalidad Base (Backend/API)
- [ ] 2.1 Implementar servicios y controladores.
*(Depende de la Fase 1. Desbloquea el frontend).*

## Fase 3: Implementación Front-end
- [ ] 3.1 Construir componentes de UI y conectar con la API.
*(Depende de la Fase 2).*

## Fase 4: Seguridad y Casos Perimetrales
- [ ] 4.1 Añadir validaciones, control de abusos y auditoría.
*(Endurece la funcionalidad principal).*

## Fase 5: Pruebas y Documentación
- [ ] 5.1 Escribir pruebas unitarias, de integración y actualizar documentación.
*(Depende del código terminado).*
```

## 3. Revisión Crítica (Auditoría Interna)

Antes de entregar el `tasks.md`, realiza estas tres comprobaciones de calidad en silencio:
1. **Cobertura del Plan**: Mapea sistemáticamente contra `plan.md` y `spec.md`. Cada decisión arquitectónica (ej. "auditoría de logs") y cada criterio de aceptación DEBE corresponder a una o más tareas explícitas. Si falta algo, añádelo.
2. **Caza de Lagunas (Gaps) lógicas**: Busca vacíos evidentes que el plan omitió pero el código necesitará. ¿Hay tareas para el manejo de errores (ej. caídas de red)? ¿Se contemplan estados de carga (spinners) o respuestas de éxito para el usuario? ¿Limpieza de datos fallidos?
3. **Revisión de Dependencias**: Asegúrate de que las tareas de UI no estén listadas antes que los endpoints de los que dependen.

## 4. Paso a Producción

Al presentar el resultado al usuario:
- Confírmale que el documento `tasks.md` se ha generado como hoja de ruta.
- Explícale brevemente las fases que definiste.
- Recuérdale que `tasks.md` es un documento vivo: se irán marcando las casillas `[x]` a medida que se implemente con la skill de construcción, y puede actualizarse si surgen nuevos requerimientos durante el desarrollo.
