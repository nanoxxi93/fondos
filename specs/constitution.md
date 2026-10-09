# Constitución del Proyecto

Este archivo captura los principios, restricciones y estándares no negociables que rigen el proyecto **Fondos Mutuos Perú**. Sirve como barandilla para el desarrollo asistido por IA (Spec-Driven Development) y es la única fuente de la verdad para estas reglas. Las decisiones técnicas puntuales viven en [`tech-stack.md`](tech-stack.md) y la motivación en [`mission.md`](mission.md).

## Estándares Tecnológicos y Presupuestarios

- **Presupuesto Estricto de \$0.00 (AWS Always Free Tier):**
  Todo nuevo recurso en la nube debe encajar en el tier gratuito permanente de AWS (*Always Free*) o en planes gratuitos sin expiración:
  - **Cómputo:** AWS Lambda (1,000,000 invocaciones/mes y 400,000 GB-s gratis de por vida).
  - **Orquestación:** Amazon EventBridge Scheduler (14 millones de invocaciones/mes gratis de por vida).
  - **API Externa:** AWS Lambda Function URLs (HTTPS nativo sin costo adicional).
  - **Secretos:** AWS Systems Manager (SSM) Parameter Store en modo Standard (almacenamiento y lecturas a \$0, prohibido el uso de AWS Secrets Manager por su cobro mensual).
  - **Base de Datos:** MongoDB Atlas Tier M0 Sandbox (512 MB gratis perpetuos).
  - **Frontend:** GitHub Pages (gratuito ilimitado).
  - **Servicios Prohibidos por Costo:** Queda vetado el uso de Amazon S3 como hosting, Amazon API Gateway y AWS Secrets Manager por generar costos al haber expirado la ventana de 12 meses.
- **Infraestructura como Código (IaC):** AWS CDK utilizando **TypeScript**.
- **Lenguaje de Nuevos Componentes:** **TypeScript** con compilación estricta (`strict: true`).
- **Coexistencia y Respeto al Código Legado:**
  El servidor monolítico Node.js/Express de Fly.io (`index.js`, `fly.toml`, `Dockerfile`, `bbva.js`, `erni.js`, `tyba.js`, `tea.js`, `html.js`) no debe romperse ni eliminarse; se mantiene 100% operativo para despliegues en Fly.io mientras se construye la arquitectura Serverless en `infra/` y `src/`.

## Privacidad, Seguridad y Credenciales

- **Cero Secretos en el Repositorio:**
  Nunca se deben quemar credenciales, API keys bancarias o connection strings en el código ni en plantillas de commit. En la nube se inyectan mediante SSM Parameter Store; en local mediante `.env` (ignorado en `.gitignore`).
- **Mínimo Privilegio IAM:**
  Las políticas y roles generados en CDK deben conceder únicamente permisos específicos a los parámetros SSM requeridos y logs de CloudWatch.

## Estándares de Codificación y Calidad

- **Fetch Nativo:**
  Se prohíbe el uso de librerías HTTP pesadas como `axios`. Se debe usar la API nativa de `fetch` de Node.js.
- **Serverless Database Best Practice (Mongo Pool):**
  Toda Lambda que conecte a MongoDB Atlas debe mantener y cachear la conexión de Mongoose en el ámbito global del contenedor (fuera del `handler`) para reutilizar conexiones entre invocaciones calientes y evitar la saturación de sockets.
- **Test-Driven Development (TDD):**
  La lógica de cálculo de rentabilidad neta de comisión (`tea`), parseo de cuotas y adaptadores bancarios debe tener tests unitarios automatizados que pasen antes de integrar código.
- **Sin logs ruidosos en Producción:**
  Usar logs estructurados o informativos con niveles controlados (`console.info`, `console.error`), evitando volcados ciegos de objetos completos o secretos en CloudWatch Logs.
- **Commits Semánticos y Líneas LF:**
  Commits con formato convencional (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`). Todos los archivos deben guardarse con saltos de línea Unix (`LF`).
