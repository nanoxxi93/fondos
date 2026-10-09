# Hoja de ruta (Roadmap)

> **Versión publicada:** v1.0.0 (Legacy en Fly.io)
> **Estado actual:** Fase 0 (Inicialización SDD y Diseño de Arquitectura AWS Serverless)

## Fase 0: Validación Técnica y Bases SDD (Completada)
- [x] Establecer gobernanza Spec-Driven Development (SDD) importando plantilla de `sdd-template`.
- [x] Redactar documentos fundacionales (`mission.md`, `constitution.md`, `tech-stack.md`, `intentos-fallidos.md`).
- [x] Evaluar y descartar DynamoDB por estrangulamiento de RCU/WCU en Free Tier (`IF-001`).
- [x] Diseñar arquitectura Always Free (\$0) con AWS CDK, MongoDB Atlas M0, EventBridge Scheduler y Lambda Function URLs.
- [x] Preservar compatibilidad total con el monolito legacy de Fly.io.

## Fase 1: Infraestructura Base con AWS CDK
- [ ] Inicializar módulo `infra/` con AWS CDK v2 en TypeScript.
- [ ] Configurar Stack de SSM Parameter Store para almacenar de forma segura la URI de MongoDB Atlas y tokens de APIs bancarias.
- [ ] Definir constructs reutilizables para funciones Lambda con bundling de esbuild (`NodejsFunction`).
- [ ] Implementar tests unitarios de infraestructura (`assertions`).

## Fase 2: Ingesta Serverless Desacoplada (Scrapers en Lambdas)
- [ ] Migrar catálogo y scraper de ERNI (Inteligo) a TypeScript con tipado estricto y handler de Lambda.
- [ ] Migrar catálogo y scraper de BBVA a TypeScript y handler de Lambda.
- [ ] Migrar catálogo y scraper de Tyba a TypeScript y handler de Lambda.
- [ ] Configurar reglas de EventBridge Scheduler para disparo diario sincronizado post-cierre de mercado.
- [ ] Implementar manejo singleton y reutilización de conexión a MongoDB Atlas en `src/shared/db.ts`.

## Fase 3: API Serverless y Motor de Analítica
- [ ] Migrar motor de cálculo de variación neta (`tea.js`) a TypeScript puro en `src/domain/tea.ts` con cobertura de tests TDD.
- [ ] Crear Lambda Handler para la API de consulta y enlazarla con una **AWS Lambda Function URL** (HTTPS con cabeceras CORS).
- [ ] Implementar caché de cabeceras HTTP (`Cache-Control`) para optimizar llamadas repetitivas.

## Fase 4: Frontend Estático y Despliegue en GitHub Pages
- [ ] Adaptar el dashboard de visualización (Chart.js) a una Single Page Application (SPA) estática en `public/`.
- [ ] Conectar la SPA a la Lambda Function URL en lugar de las rutas Express de Fly.io.
- [ ] Configurar GitHub Pages para servir el dashboard con dominio o subdominio gratuito.
- [ ] Configurar GitHub Actions para validación automática de SDD y verificación de tipos en cada PR.

---

## Tareas Sueltas

### En curso
- Inicialización del marco SDD y documentación en `README.md`.

### En main, sin versión todavía
- Ninguna.

### Después de la 2.0.0
- Notificaciones vía SNS / Telegram ante anomalías o fallos en las APIs bancarias.
- Soporte para fondos adicionales de SURA o Scotia Fondos.
