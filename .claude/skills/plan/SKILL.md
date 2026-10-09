---
name: plan
description: Elabora el documento de diseño técnico (plan.md) que sirve de puente entre los requisitos de spec.md y la implementación. Define la arquitectura, decisiones tecnológicas, secuencia de desarrollo y valida el cumplimiento de la constitución.
---

# Diseñar el Plan Técnico (plan.md)

En el Spec-Driven Development, esta skill toma los requisitos de alto nivel definidos en `spec.md` (el *qué*) y diseña la estrategia técnica de implementación (el *cómo*). 

La **separación de preocupaciones** es fundamental: la especificación debe permanecer estable definiendo los requisitos, mientras que el plan es un documento vivo que puede evolucionar a medida que se refina el enfoque técnico.

## 1. Reglas estrictas para la Planificación

Al redactar o refinar el `plan.md`, debes aplicar estos criterios rigurosamente:
- **Mapeo Sistemático**: Todo requisito (funcional, no funcional y caso extremo) de `spec.md` debe asignarse a un enfoque de implementación en el plan. Si `spec.md` pide validar el tamaño de un archivo, el plan debe describir exactamente **dónde** (frontend, middleware, backend) y **cómo** se produce esta validación.
- **Cero instrucciones vagas**: Prohibido usar frases como "implementar manejo de errores adecuado". Debes empujar el detalle: ¿Qué errores pueden ocurrir? ¿Cómo se captura cada error? ¿Qué información va a los logs y qué se le muestra al usuario?
- **Factibilidad Técnica y Restricciones**: Comprueba que la solución es técnicamente viable con la infraestructura actual. Por ejemplo, operaciones pesadas no deben bloquear el hilo principal ni agotar tiempos de espera cortos.
- **Alineación Tecnológica**: Las opciones deben usar estrictamente las herramientas y patrones ya aprobados en `specs/tech-stack.md`. Respeta los sistemas existentes.
- **Justificar el "Por qué"**: No solo documentes qué se va a hacer, sino el razonamiento. Documenta siempre las alternativas que consideraste y por qué seleccionaste una sobre las demás.
- **Explicitar Suposiciones**: Cualquier creencia sobre infraestructura, datos previos o comportamiento de terceros debe quedar por escrito.

## 2. Estructura obligatoria de `plan.md`

Dentro de la carpeta de la funcionalidad (la misma que tiene `spec.md`), crea o actualiza `plan.md` con exactamente estas 5 secciones:

```markdown
# Plan de Implementación Técnico

## Información general sobre la arquitectura
Vista general de cómo interactuarán los componentes. Establece el flujo general de los datos y el control sin profundizar en detalles granulares de código.

## Pila tecnológica y decisiones clave
Documentación explícita de las opciones tecnológicas elegidas y su justificación.
- **Por qué:** Evita confusiones futuras explicando la razón técnica detrás de librerías o patrones elegidos.
- **Alternativas consideradas:** Qué otros enfoques se evaluaron y por qué se descartaron.
- **Requisitos No Funcionales:** Explica cómo esta arquitectura aborda el rendimiento, seguridad, escalabilidad o mantenimiento exigidos en la spec.

## Secuencia de implementación
Progresión lógica de los pasos de desarrollo. Proporciona el orden coherente en que se debe construir la funcionalidad (ej. 1. Modelo de Datos, 2. Endpoint, 3. Capa de Sync, 4. UI).

## Comprobación de la Constitución
Punto de control explícito. Verifica sistemáticamente que la solución respeta `specs/constitution.md` (ej. cumplimiento de Local-First, aislamiento de DB, etc.). **Si la arquitectura propuesta infringe un principio, detén el diseño y busca otro enfoque.**

## Suposiciones y preguntas abiertas
Lista de suposiciones hechas durante el diseño sobre el entorno, integraciones o componentes. Documentar esto de antemano previene desviaciones de alcance. Si una suposición falla durante el desarrollo, el plan deberá actualizarse.
```

## 3. Revisión Final

1. Una vez redactado, lee `spec.md` una última vez y verifica que ningún criterio de aceptación haya quedado "huérfano" (sin solución técnica en el plan).
2. Presenta el plan al usuario haciendo énfasis en la **Comprobación de la Constitución** y en las **Suposiciones y preguntas abiertas**.
3. Pídele que confirme el enfoque antes de proceder a la fase de construcción de código.
