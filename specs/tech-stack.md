# Tech Stack

> **Estado:** Fase 0 (Migración a AWS Serverless con SDD)

## 1. Restricciones de plataforma que definen la arquitectura

### Plataforma Principal
- **Nube:** **Amazon Web Services (AWS)** bajo la capa **Always Free** (recursos gratuitos permanentes).
- **Base de Datos Cloud:** **MongoDB Atlas (Tier M0 Sandbox)** con réplicas en 3 nodos y 512 MB de almacenamiento perpetuo.
- **Hosting Web:** **GitHub Pages** (gratuito de por vida) para la Single Page Application (SPA).

### Restricciones Críticas Presupuestarias
Al haber caducado los 12 meses de prueba estándar de AWS:
1. **Amazon S3:** Descartado como hosting web para evitar microfacturaciones de almacenamiento y solicitudes GET/PUT. Se utiliza GitHub Pages.
2. **Amazon API Gateway:** Descartado (\$1.00/millón tras 12 meses). Se utiliza **AWS Lambda Function URLs** con soporte HTTPS nativo y CORS.
3. **AWS Secrets Manager:** Descartado (\$0.40/mes por cada secreto). Se utiliza **AWS SSM Parameter Store (Standard parameters)** a \$0.

---

## 2. Decisiones de Ingeniería Core

| Decisión | Estado | Motivo |
|---|---|---|
| **DynamoDB** | ❌ Descartada | Agotamiento crítico de **WCU** en cargas por lotes (21,900 cuotas históricas) y de **RCU** en lecturas del dashboard (60 fondos $\times$ 365 días), generando throttling continuo en Free Tier (`IF-001`). |
| **MongoDB Atlas (M0)** | ✅ **Elegida** | 512 MB de almacenamiento gratuito sin cuellos de botella de WCU/RCU, índices B-Tree optimizados para series de tiempo, queries `.find()` por rango de fecha y soporte nativo del modelo existente de Mongoose. |
| **Terraform / SAM / SLS** | ❌ Descartadas | SAM usa YAML sin tipado estricto; Serverless Framework cambió de licencia en v4; Terraform es más verboso para el empaquetado y tipado de Lambdas en TypeScript. |
| **AWS CDK (TypeScript)** | ✅ **Elegida** | Estándar de la industria para arquitecturas Serverless en TypeScript. Permite tipado estricto, L2 Constructs, tests sintéticos de infraestructura (`assertions`) y compartir interfaces entre infra y código de aplicación. |
| **API Gateway** | ❌ Descartada | No es Always Free tras el primer año. |
| **Lambda Function URL** | ✅ **Elegida** | Integrada de forma nativa en AWS Lambda, gratuita dentro de las 1M invocaciones mensuales perpetuas, con HTTPS y cabeceras CORS automáticas. |

---

## 3. Arquitectura General y Flujo de Datos

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA DESACOPLADA                        │
│                                                                        │
│   [ EventBridge Scheduler ] ──────────> [ Lambda Scrapers (TS) ]       │
│        (Cron diario)                               │                   │
│                                            (Upsert cuotas)             │
│                                                    ▼                   │
│                                           [ MongoDB Atlas M0 ]         │
│                                                    ▲                   │
│                                            (Query histórico)           │
│                                                    │                   │
│   [ Navegador / Usuario ] ──(HTTPS)───> [ Lambda Function URL ]        │
│             │                                                          │
│     (Carga Dashboard)                                                  │
│             ▼                                                          │
│   [ GitHub Pages (SPA) ]                                               │
└────────────────────────────────────────────────────────────────────────┘
```

### Estrategia de Conexión / Flujo de Datos
1. **Flujo de Ingesta (Asíncrono):** Un evento diario de EventBridge Scheduler despierta a las funciones Lambda de scraping (BBVA, ERNI, Tyba), las cuales obtienen sus credenciales desde SSM Parameter Store, descargan las cuotas del día y ejecutan un upsert en la colección `quotas` de MongoDB Atlas.
2. **Flujo de Consulta (Síncrono):** El usuario carga el dashboard estático (Chart.js) alojado en GitHub Pages. La aplicación realiza un `fetch()` a la Lambda Function URL con los filtros de periodo (`days`), moneda (`currency`) y riesgo (`risk`). La Lambda calcula la variación del periodo neta de comisión (`tea`) y devuelve el JSON formateado.

---

## 4. Tecnologías Elegidas

| Área | Elección | Justificación |
|---|---|---|
| **Infraestructura como Código (IaC)** | **AWS CDK v2 (TypeScript)** | Permite infraestructura tipada, reutilizable y declarada en el mismo lenguaje del runtime de las Lambdas. |
| **Runtime de Cómputo** | **Node.js 24.x (TypeScript)** | Versión moderna con soporte nativo de ESM, `fetch`, y paridad exacta entre el entorno local y AWS Lambda (`nodejs24.x`). |

| **Base de Datos** | **MongoDB Atlas M0 (Mongoose)** | Compatibilidad comprobada con el volumen de cuotas, consultas analíticas por rango de fechas sin cobro de RCU. |
| **Orquestación de Cron** | **Amazon EventBridge Scheduler** | Alta precisión horaria, reintentos automáticos y 14 millones de invocaciones gratuitas al mes. |
| **Gestión de Configuración y Secretos** | **AWS SSM Parameter Store (Standard)** | Almacenamiento cifrado y llamadas a la API a costo \$0. |
| **Frontend** | **React + Vite (TypeScript) + Chart.js** | Arquitectura SPA moderna por componentes, bundling ultrarrápido con Vite y hospedaje gratuito de por vida en GitHub Pages. |

| **Testing** | **Vitest / Jest** | Ejecución rápida de tests unitarios tanto para la lógica de cálculo de rentabilidad como para los constructs de CDK. |
| **Validación de Esquemas** | **@sinclair/typebox** | Validación tipada de esquemas JSON ultra ligera y de alto rendimiento para Lambdas, adoptada como el estándar del proyecto por su compatibilidad nativa con JSON Schema y optimización en serverless. |

---

## 5. Estructura de Módulos (Propuesta)

```text
fondos/
├── infra/                  # Infraestructura como Código (AWS CDK)
│   ├── bin/                # Entrypoint de la app CDK
│   ├── lib/                # Stacks y Constructs (FondosStack, FondosFunction)
│   └── test/               # Tests de infraestructura (cdk assertions)
├── src/                    # Código de las funciones Lambda (TypeScript)
│   ├── scrapers/           # Handlers de BBVA, ERNI y Tyba
│   ├── api/                # Handler de la Lambda Function URL (cálculo TEA)
│   ├── domain/             # Entidades de cuotas, fondos y lógica matemática pura
│   └── shared/             # Conexión singleton a MongoDB Atlas y utilidades
├── frontend/               # Dashboard SPA (React + Vite + TypeScript) para GitHub Pages
├── legacy/                 # [LEGACY] Monolito Express, Dockerfile y scrapers para Fly.io
├── specs/                  # Documentación y ciclo SDD
├── scripts/                # Scripts de validación SDD y gobernanza
└── fly.toml                # Configuración Fly.io apuntando a legacy/Dockerfile

```

---

## 6. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| **Agotamiento de sockets en Mongo Atlas** | Medio | Mantener la variable de conexión de Mongoose en el scope global del archivo de la Lambda para reutilizar el pool entre invocaciones calientes (`context.callbackWaitsForEmptyEventLoop = false`). |
| **Cold Starts en Lambdas** | Bajo | La ingesta es asíncrona (el cold start no afecta al usuario) y la Lambda de consulta es ligera al no usar frameworks pesados. |
| **Cambios en contratos de APIs bancarias** | Medio | Aislamiento modular de scrapers: cada entidad tiene su propia función Lambda independiente; si una falla, no afecta a las demás. |
