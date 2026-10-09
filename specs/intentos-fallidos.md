# Intentos Fallidos

Este documento registra enfoques, librerías y experimentos que **fallaron o fueron descartados** tras probarse, para evitar que otro desarrollador (o la IA) pierda tiempo volviendo a intentarlos.

> **Importante para la IA:** Antes de proponer usar una librería, cambiar un patrón de diseño o abordar un problema complejo, **revisa siempre este archivo**. Si lo que vas a proponer está aquí y no se cumple su condición de *Reconsiderar si*, descártalo y busca otra opción.

## Índice
- [IF-001: Descarte de DynamoDB por cuellos de botella de RCU/WCU en analítica de dashboard](#if-001-descarte-de-dynamodb-por-cuellos-de-botella-de-rcuwcu-en-analítica-de-dashboard)

---

## IF-001: Descarte de DynamoDB por cuellos de botella de RCU/WCU en analítica de dashboard
* **Fecha:** 2026-10-08
* **Problema que intentaba resolver:** Almacenamiento persistente serverless de cuotas históricas en AWS bajo el Free Tier perpetuo.
* **Enfoque / Librería:** Amazon DynamoDB (Single Table Design con PK: `FONDO#<id>`, SK: `DATE#<YYYY-MM-DD>`).
* **Por qué falló:**
  1. **Agotamiento de WCU en ingesta masiva:** Al sembrar o actualizar cuotas históricas (60 fondos $\times$ 365 días = 21,900 registros), el modo Provisioned del Free Tier (limitado a 25 WCU) se saturó de inmediato, arrojando constantes excepciones `ProvisionedThroughputExceededException`.
  2. **Estrangulamiento de RCU en consultas analíticas:** Al renderizar el dashboard con gráficos de Chart.js para un periodo anual, se deben leer las series temporales completas de decenas de fondos simultáneamente. Consultar $\sim$21,900 registros con 25 RCU provocaría tiempos de respuesta de decenas de segundos por throttling o exigiría pasar a modo On-Demand con costos recurrentes fuera del presupuesto \$0.
  3. **Incompatibilidad de modelo:** DynamoDB es óptimo para búsquedas operacionales clave-valor puntuales, no para agregaciones analíticas de series temporales heterogéneas sin una capa de caché adicional.
* **Decisión adoptada:** Mantener **MongoDB Atlas (Tier M0 Free)**, que ofrece 512 MB de almacenamiento gratuito sin restricciones de capacidad por segundo (RCU/WCU) y permite consultas indexadas nativas por rango de fechas (`date: { $gte: ... }`).
* **Reconsiderar si:**
  - Se implementa una capa de preagregación que guarde un único documento comprimido con todo el año por fondo, o si el proyecto cuenta con presupuesto para DynamoDB On-Demand y DAX (DynamoDB Accelerator).
