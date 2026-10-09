---
name: checklist
description: Genera el plan de pruebas manuales y calidad (checklist.md) basándose en los Criterios de Aceptación y Casos Extremos de la especificación para verificar su cumplimiento real.
---

# Generar Lista de Comprobación (checklist.md)

En el Spec-Driven Development, la skill `checklist` toma los requerimientos del documento de especificación y los convierte en un plan estricto de Control de Calidad (QA). Es lo equivalente a escribir "pruebas unitarias para la prosa". 

Su objetivo es comprobar la integridad de los requisitos asegurando que cada uno pueda ser validado empíricamente una vez implementado el código.

## 1. Reglas de Generación

- **Trazabilidad estricta**: Cada "Criterio de Aceptación" y cada "Caso Extremo" definidos en el archivo `spec.md` de la funcionalidad actual debe convertirse en, al menos, un elemento verificable en el checklist.
- **Contexto de entorno**: Debes inferir dónde se realiza la prueba basándote en la funcionalidad (ej. si interactúa con hardware o la red sin conexión, requiere el **emulador**; si es de interfaz estándar, se prueba en el **navegador**). Apóyate en `specs/intentos-fallidos.md` si tienes dudas.
- **Pasos accionables**: No uses descripciones vagas como "Probar la carga de archivos". Define explícitamente qué acciones debe tomar quien hace el QA para validar el flujo.

## 2. Estructura de `checklist.md`

Crea el archivo `checklist.md` dentro de la misma carpeta de la funcionalidad, usando exactamente este formato Markdown:

```markdown
# Lista de Comprobación y QA

## Entornos de Prueba Requeridos
*(Enumera los entornos necesarios: Navegador web, Emulador de Android, Entorno CLI de pruebas).*

## Casos de Prueba (Criterios de Aceptación)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| CA-1 | Navegador | 1. ... 2. ... | ... | [ ] | |

## Pruebas de Casos Extremos (Edge Cases)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| CE-1 | Emulador | 1. Simular pérdida de red... | ... | [ ] | |
```

## 3. Revisión Final e Instrucciones

1. Al finalizar de redactar la tabla, cruza mentalmente los IDs generados contra el `spec.md` original para confirmar cobertura total.
2. Infórmale al usuario que el plan de pruebas de QA ha sido creado con éxito.
3. Recuérdale que el archivo `checklist.md` será evaluado por la skill `cierra` al final del desarrollo; no se podrá llevar el código a `main` si existen casos de prueba sin marcar.
