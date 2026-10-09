---
name: specify
description: Especifica una nueva funcionalidad siguiendo el Spec-Driven Development (SDD). Define el resumen, casos de usuario, criterios de aceptación, requisitos y casos extremos, preguntando siempre antes de asumir. Úsala cuando el usuario pida una funcionalidad nueva, diga «specify», «especifica» o /specify.
---

# Especificar una funcionalidad (Spec-Driven Development)

En el desarrollo controlado por especificaciones, la especificación define **exactamente** lo que debe hacer el software y cada decisión de implementación realiza un seguimiento hacia él. 

La skill **termina cuando la spec está escrita y el usuario la ha validado**. 

**REGLA DE ORO**: Para generar una especificación, **es preferible preguntar antes de suponer**. No asumas comportamientos, UI, ni alcances sin validar con el usuario.

## 0. Antes de escribir

1. Lee `specs/constitution.md` para tener claras las reglas innegociables (seguridad, testing, convenciones).
2. Lee `specs/mission.md` para alinear la funcionalidad con la visión del producto y sus principios de experiencia de usuario.
3. Lee `specs/tech-stack.md` para conocer las herramientas y arquitectura sobre las que se construirá.
4. Comprueba en `specs/roadmap.md` el estado de la funcionalidad y de dónde viene.
5. Pregunta todo lo necesario antes de escribir la especificación.

## 1. Lo que decide el usuario

Pregunta todo lo que no esté claro, ofreciendo tu recomendación primero:
- Alcance exacto (lo que entra y lo que se queda fuera).
- UI/UX y flujos de navegación.
- Qué ocurre en escenarios de error.

## 2. Reglas de redacción de la especificación

Al redactar la especificación, aplica estrictamente estas reglas:
- **Específico y medible**: Reemplaza términos imprecisos por valores precisos (ej. "rápido" por "< 200ms", "varios" por un límite exacto).
- **Vocabulario consistente**: Define los términos una vez y reutilízalos a lo largo del documento. No uses sinónimos para el mismo concepto (ej. si usas "boletas", no cambies a "recibos" después).
- **El Qué, no el Cómo**: Las especificaciones definen requisitos, no implementaciones. Indica lo que debe hacer el sistema, no cómo codificarlo (las decisiones de código pertenecen al `plan.md`).
- **Límite de tamaño**: Si la característica va a requerir más de 300 líneas para ser especificada, detente y sugiere al usuario dividirla en especificaciones más pequeñas e incrementales.

## 3. La carpeta y el archivo

Crea la carpeta `specs/AAAA-MM-DD-nombre/` con la fecha en que empieza el trabajo y un nombre descriptivo en kebab-case. 
Allí escribirás el archivo principal de la especificación: `spec.md` (y su respectivo `plan.md` técnico).

## 4. Estructura de `spec.md`

El archivo de especificación DEBE contener exactamente estas secciones, en este orden:

```markdown
# <Título de la funcionalidad>

## Resumen
<Descripción concisa de la aplicación o nueva característica desde una perspectiva del usuario final. Responde a "¿Qué hace esta característica?" en una o dos oraciones.>

## Casos de usuario
<Breves narraciones sobre cómo interactúan los usuarios con la característica. Capturan la intención y el valor en lugar de la implementación técnica.>

## Criterios de aceptación
<Condiciones específicas y medibles que deben ser verdaderas para que la característica se considere completa. Forman una lista de comprobación [ ] para comprobar la implementación.>

## Requisitos funcionales
<Descripciones detalladas del comportamiento del sistema. Indica QUÉ debe hacer el sistema, sus flujos y validaciones, sin dictar la implementación del código.>

## Requisitos no funcionales
<Atributos de calidad, como el rendimiento, la seguridad, la escalabilidad y el cumplimiento. Estos requisitos deben hacer referencia directa a las reglas de `specs/constitution.md`.>

## Casos extremos
<Escenarios inusuales, condiciones de error y comportamientos de límite (ej. pérdida de red a mitad del proceso, inputs maliciosos). La documentación explícita de casos perimetrales impide hacer suposiciones.>
```

*(Nota: Los archivos técnicos subsecuentes como `plan.md`, `tasks.md` y `checklist.md` serán generados posteriormente por sus respectivas skills. `specify` solo debe enfocarse en generar un `spec.md` perfecto).*

## 5. Actualizar la hoja de ruta

En `specs/roadmap.md`, añade la funcionalidad a la sección «En curso»:
`- [<Título>](AAAA-MM-DD-nombre/) — <una frase con lo que entrega>.`

## 6. Revisión Final

Antes de dar por terminada la skill:
1. **Verificación contra principios**: Comprueba exhaustivamente que la especificación recién escrita no entra en conflicto con la constitución (`constitution.md`) ni los principios del proyecto (`mission.md`).
2. Al presentar el resultado al usuario, muéstrale:
   - El enlace a la especificación generada (`spec.md`).
   - Lo que quedó definido en los Casos Extremos.
   - Pregúntale explícitamente si está conforme con la especificación para dar por concluida la tarea y continuar con la skill `clarify`.
