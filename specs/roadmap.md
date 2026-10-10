# Hoja de ruta (Roadmap)

> **Versión publicada:** v1.0.0 (Legacy en Fly.io)
> **Estado actual:** Fase 4 Completada (Dashboard SPA en GitHub Pages)
 
## Fase 0: Validación Técnica y Bases SDD (Completada)
- [x] Establecer gobernanza Spec-Driven Development (SDD) importando plantilla de `sdd-template`.
- [x] Redactar documentos fundacionales (`mission.md`, `constitution.md`, `tech-stack.md`, `intentos-fallidos.md`).
- [x] Evaluar y descartar DynamoDB por estrangulamiento de RCU/WCU en Free Tier (`IF-001`).
- [x] Diseñar arquitectura Always Free ($0) con AWS CDK, MongoDB Atlas M0, EventBridge Scheduler y Lambda Function URLs.
- [x] Preservar compatibilidad total con el monolito legacy de Fly.io.

## Fase 1: Infraestructura Base con AWS CDK (Completada)
- [x] Reorganizar y encapsular el monolito Express en `legacy/` manteniendo `fly.toml` y `npm start`.
- [x] Inicializar módulo `infra/` con AWS CDK v2 en TypeScript.
- [x] Configurar Stack de SSM Parameter Store para almacenar de forma segura la URI de MongoDB Atlas y tokens de APIs bancarias con `RemovalPolicy.RETAIN`.
- [x] Definir construct reutilizable `FondosFunction` para funciones Lambda con bundling de esbuild local (`NodejsFunction`).
- [x] Implementar tests unitarios de infraestructura con `@aws-cdk/assertions` (`npm test`) y síntesis de CloudFormation (`npm run synth`).


## Fase 2: Ingesta Serverless Desacoplada (Scrapers en Lambdas por Fuente)
- [x] **Fase 2.1 (ERNI / Inteligo):** [Ingesta Serverless de ERNI](2026-10-08-ingesta-erni/) — Descubrimiento dinámico de fondos activos, extracción de series temporales de valores cuota vía API v2 y sincronización en MongoDB Atlas.
- [x] **Fase 2.2 (BBVA):** [Ingesta Serverless de BBVA](2026-10-09-ingesta-bbva/) — Autenticación dinámica TSEC vía ASO V02, catálogo canónico de 21 fondos (incluyendo 421 y BBVAEM), extracción de retornos diarios y Lambda BbvaScraperFunction con EventBridge a las 23:15 UTC.
- [x] **Fase 2.3 (Tyba):** [Ingesta Serverless de Tyba](2026-10-09-ingesta-tyba/) — Ingesta bajo demanda con autenticación por sesión, catálogo híbrido de 30 fondos de Credicorp Capital y persistencia en MongoDB Atlas.
- [x] Configurar reglas de EventBridge Scheduler para disparo diario de ERNI (23:00 UTC) y BBVA (23:15 UTC) post-cierre de mercado.
- [x] Implementar manejo singleton y reutilización de conexión a MongoDB Atlas en `src/shared/db.ts`.

## Fase 3: API Serverless y Motor de Analítica (Completada)
- [x] **Fase 3:** [API Serverless y Motor de Analítica](2026-10-09-api-serverless-analitica/) — Migrar motor de cálculo de variación neta (`tea.js`) a TypeScript puro en `src/domain/tea.ts` con cobertura 100% TDD.
- [x] Crear Lambda Handler para la API de consulta en `src/api/handler.ts` y enlazarla con una **AWS Lambda Function URL** pública (HTTPS nativo con cabeceras CORS).
- [x] Implementar caché de cabeceras HTTP asimétrico (`Cache-Control: public, max-age=3600...` en éxito y `no-store` en errores).
- [x] Implementar servidor de desarrollo local interactivo en `src/api/run-local.ts` accesible vía `npm run api:local`.

## Fase 4: Frontend Estático (React + Vite) y Despliegue en GitHub Pages (Completada)
- [x] **Fase 4:** [Dashboard SPA Moderno y Despliegue en GitHub Pages](2026-10-09-frontend-dashboard-gh-pages/) — Construir el dashboard de visualización con React + Vite + TypeScript, Tailwind CSS y Chart.js como SPA estática en `frontend/` y despliegue a costo $0 en GitHub Pages.
- [x] Conectar la SPA a la Lambda Function URL en lugar de las rutas Express de Fly.io.
- [x] Configurar GitHub Pages para servir el dashboard con dominio o subdominio gratuito.
- [x] Configurar GitHub Actions para validación automática de SDD y verificación de tipos en cada PR.


---

## Tareas Sueltas

### En curso
- Ninguna.



### En main, sin versión todavía
- Ninguna.

### Después de la 2.0.0
- Notificaciones vía SNS / Telegram ante anomalías o fallos en las APIs bancarias.
- Soporte para fondos adicionales de SURA o Scotia Fondos.
