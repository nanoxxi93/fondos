---
name: clarify
description: Analiza una especificación existente para identificar ambigüedades, suposiciones, lagunas y casos extremos infraespecificados. Actúa como un analista experimentado que refina la especificación antes de la implementación.
---

# Clarificar una especificación (Refinamiento SDD)

Esta skill se usa en el desarrollo controlado por especificaciones (SDD) para auditar y refinar una especificación (`spec.md`) **antes** de que comience la implementación. El objetivo es detectar problemas de forma temprana, actuando como un analista de producto/sistemas experimentado.

## 1. Análisis de la especificación

Al invocar esta skill, debes leer la especificación objetivo y evaluarla rigurosamente contra los siguientes criterios:

- **Ambigüedades**: Busca palabras vagas o imprecisas (ej. "rápido", "a veces", "muchos", "adecuado") y señala que necesitan ser reemplazadas por valores exactos y medibles.
- **Lagunas (Gaps) y Detalles Faltantes**: Identifica estados no manejados. Por ejemplo: estados vacíos, estados de carga, paginación, límites de caracteres, respuestas de error específicas.
- **Suposiciones**: Detecta decisiones implícitas que no están escritas pero que el desarrollador tendría que tomar por su cuenta (ej. "el sistema envía un email"... ¿con qué plantilla?, ¿desde qué dirección?).
- **Casos Extremos (Edge Cases) Infraespecificados**: Pregúntate qué pasa si: la red se cae a la mitad, el token expira justo antes de guardar, el usuario introduce datos inválidos o extremos, o hay intentos concurrentes.
- **Incoherencias de Terminología**: Verifica que los términos se usen de manera consistente a lo largo de todo el documento.
- **Alineación Estratégica**: Asegúrate de que no haya conflictos ocultos con las reglas de `specs/constitution.md` o la visión de `specs/mission.md`.

## 2. Interacción con el usuario

1. **Elaboración del reporte**: Genera una lista estructurada y concisa de los hallazgos.
2. **Entrevista al usuario**: Presenta estas dudas al usuario de forma clara (preferiblemente numeradas o agrupadas) para que sea fácil responder a cada punto.
3. **Recomienda soluciones**: Como analista experimentado, no solo hagas preguntas abiertas. Para cada laguna o ambigüedad, propón la solución técnica o de negocio más lógica, de manera que el usuario pueda simplemente confirmar tu recomendación.

## 3. Actualización de la Especificación

Una vez que el usuario responda y aclare las dudas:
1. Actualiza directamente el archivo `spec.md`, reescribiendo las secciones necesarias para insertar la precisión acordada.
2. Asegúrate de mover los escenarios complejos a la sección de **Casos extremos** y de crear nuevos **Criterios de aceptación** si la aclaración lo amerita.
3. Informa al usuario que la especificación ha sido refinada, blindada y está lista para la fase de diseño técnico (`plan.md`) y construcción.
