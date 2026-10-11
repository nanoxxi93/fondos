# Intentos Fallidos

Este documento registra enfoques, librerías y experimentos que **fallaron o fueron descartados** tras probarse, para evitar que otro desarrollador (o la IA) pierda tiempo volviendo a intentarlos.

> **Importante para la IA:** Antes de proponer usar una librería, cambiar un patrón de diseño o abordar un problema complejo, **revisa siempre este archivo**. Si lo que vas a proponer está aquí y no se cumple su condición de *Reconsiderar si*, descártalo y busca otra opción.

## Índice
- [IF-002: Ingesta directa de BBVA desde AWS Lambda bloqueada con HTTP 403 por Akamai Bot Manager](#if-002-ingesta-directa-de-bbva-desde-aws-lambda-bloqueada-con-http-403-por-akamai-bot-manager)
- [IF-001: Descarte de DynamoDB por cuellos de botella de RCU/WCU en analítica de dashboard](#if-001-descarte-de-dynamodb-por-cuellos-de-botella-de-rcuwcu-en-analítica-de-dashboard)

---

## IF-002: Ingesta directa de BBVA desde AWS Lambda bloqueada con HTTP 403 por Akamai Bot Manager
* **Fecha:** 2026-10-10
* **Problema que intentaba resolver:** Ingesta serverless diaria programada de BBVA Asset Management directamente desde AWS Lambda invocada por EventBridge Scheduler.
* **Enfoque / Librería:** Invocación directa a `POST https://www.bbva.es/ASO/TechArchitecture/grantingTickets/V02` con `fetch` nativo de Node.js 24 en AWS Lambda (`us-east-1`).
* **Por qué falló:**
  1. **Bloqueo estricto por Akamai Bot Manager:** El dominio `www.bbva.es` está protegido por el WAF/CDN de Akamai (`ak_bmsc`, `bm_sz`, `Akamai-BM-Telemetry`). Akamai clasifica automáticamente los bloques CIDR de datacenters de AWS (`us-east-1` / AS16509) como tráfico automatizado/hosting de alto riesgo.
  2. **Respuesta inmediata HTTP 403:** Al recibir la solicitud desde la IP de AWS Lambda, Akamai responde inmediatamente con `HTTP 403 Forbidden` antes de que la petición toque los servidores de backend de BBVA, impidiendo la adquisición del token de sesión efímero `tsec`.
  3. **Verificación de lógica:** La misma petición con idéntico payload y cabeceras funciona al 100% desde conexiones residenciales/ISP (588 cuotas sincronizadas en 5 segundos).
* **Decisión adoptada:** Deshabilitar la regla programada de EventBridge para BBVA en AWS CDK (`BbvaScraperScheduleRule` en `fondos-stack.ts`) y delegar la ejecución periódica a GitHub Actions (`.github/workflows/scrape-bbva.yml`) persistiendo directamente en MongoDB Atlas.
* **Resultado:** Confirmado y verificado en GitHub Actions (`ubuntu-latest`): el runner adquiere el token `tsec` y sincroniza los 21 fondos y 588 cuotas exitosamente en ~5 segundos sin bloqueos de WAF.
* **Reconsiderar si:**
  - Se añade un proxy residencial / smart proxy (ej. ScrapingBee, ScraperAPI, Webshare) en la Lambda para enrutar las peticiones a `bbva.es`.
  - BBVA o la SMV habilitan una API pública/gubernamental sin filtrado de WAF para datacenters.

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
