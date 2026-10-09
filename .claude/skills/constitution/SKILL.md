---
name: constitution
description: Aplica los principios, restricciones y estándares no negociables definidos en /specs/constitution.md para el Spec-Driven Development. Úsala para validar especificaciones, planes, tareas o código.
---

# Desarrollo Guiado por Especificaciones: Constitución

Esta skill instruye al agente a aplicar y respetar la constitución del proyecto en el desarrollo asistido por IA (Spec-Driven Development), usando el archivo `/specs/constitution.md`.

## El archivo de constitución

Un archivo de constitución captura principios, restricciones y estándares no negociables que rigen el proyecto. También sirve como barandilla para el desarrollo asistido por IA. 

Cuando el agente genera especificaciones, planes, tareas o código, **debe hacer referencia a la constitución** para comprobar que las propuestas cumplen con sus estándares. Para proyectos brownfield, documenta los patrones y restricciones arquitectónicos existentes.

## Ventajas principales

- **Aplicación de la coherencia:** Garantiza la alineación con las decisiones arquitectónicas durante proyectos largos con varios desarrolladores.
- **Documentación de cumplimiento:** Hace que los requisitos normativos y las directivas de seguridad sean explícitos y auditables.
- **Captura de conocimientos institucionales:** Conserva las lecciones ganadas de forma que guía la generación de código de inteligencia artificial.
- **Carga cognitiva reducida:** Automatiza la aplicación de directivas organizativas durante el desarrollo.

## Estructura de la Constitución

Una constitución bien estructurada organiza los principios en categorías a las que los asistentes de inteligencia artificial pueden hacer referencia fácilmente. Las secciones comunes que contiene `/specs/constitution.md` son:

- **Estándares tecnológicos:** Se usan para especificar tecnologías, plataformas y marcos aprobados.
- **Requisitos de seguridad:** Se pueden usar para definir elementos como autenticación, autorización, cifrado y reglas de protección de datos.
- **Rendimiento y escalabilidad:** Se usan para establecer expectativas para el comportamiento del sistema bajo carga.
- **Estándares de codificación:** Proporcionan requisitos que ayudan a garantizar la calidad del código.
- **Cumplimiento y gobernanza:** Se utilizan para documentar los requisitos normativos y de políticas internas.

## Instrucciones para el Agente

1. **Validación:** Antes de proponer una nueva arquitectura, escribir especificaciones o generar código, lee `/specs/constitution.md` y verifica que la propuesta cumple con las reglas descritas.
2. **Defensa de los estándares:** Si se propone algo que entra en conflicto con la constitución, señala la violación de los estándares documentados.
3. **Mantenimiento:** Si se acuerdan nuevas reglas o restricciones innegociables durante el proyecto, sugiere añadirlas a `/specs/constitution.md`.
