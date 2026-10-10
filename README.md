# Fondos Mutuos Perú

Plataforma de seguimiento y comparación de valor cuota y rendimiento neto de comisiones para fondos mutuos peruanos (**BBVA**, **ERNI / Inteligo** y **Tyba / Credicorp Capital**).

El proyecto implementa una **arquitectura Serverless desacoplada en AWS (Always Free Tier)** gobernada por **Spec-Driven Development (SDD)**, manteniendo a su vez un acceso monolítico legado desplegado en **Fly.io**.

Rendimiento de la tabla: variación del periodo neta de comisión, `(último / primero - 1) * (100 - fee)`.

---

## 1. Arquitectura Serverless Desacoplada (AWS Always Free)

La modernización del proyecto traslada la ingesta y consulta a una infraestructura en la nube sin servidores 24/7, garantizando un **costo mensual de \$0.00 de por vida**:

```mermaid
flowchart TD
    subgraph INGESTA["1. Flujo de Ingesta Asíncrona (AWS Always Free)"]
        Cron["Amazon EventBridge Scheduler\n(Trigger Diario post-cierre de mercado)"]
        Dispatcher["AWS Lambda Dispatcher\n(TypeScript)"]
        
        subgraph Scrapers["Scrapers Independientes"]
            S_BBVA["Lambda Scraper BBVA\n(ASO Past-returns)"]
            S_ERNI["Lambda Scraper ERNI\n(Inteligo API)"]
            S_TYBA["Lambda Scraper Tyba\n(Robo-Advisor API)"]
        end
        
        SSM["AWS SSM Parameter Store (Standard)\n(MONGO_DB_URI & Claves bancarias a $0)"]
        
        Cron -->|Disparo programado| Dispatcher
        Dispatcher -->|Invocación desacoplada| S_BBVA
        Dispatcher -->|Invocación desacoplada| S_ERNI
        Dispatcher -->|Invocación desacoplada| S_TYBA
        
        SSM -.->|Inyección segura de credenciales| S_BBVA
        SSM -.->|Inyección segura de credenciales| S_ERNI
        SSM -.->|Inyección segura de credenciales| S_TYBA
    end

    subgraph STORAGE["2. Almacenamiento Persistente"]
        Mongo[("MongoDB Atlas (Tier M0 Sandbox)\n512 MB Gratis de por vida\nColección: quotas")]
        S_BBVA -->|Upsert cuotas| Mongo
        S_ERNI -->|Upsert cuotas| Mongo
        S_TYBA -->|Upsert cuotas| Mongo
    end

    subgraph CONSULTA["3. Flujo de Consulta y Presentación"]
        User(("Usuario"))
        GHP["GitHub Pages\n(SPA estática + Chart.js)\nAlojamiento $0 de por vida"]
        LambdaURL["AWS Lambda Function URL\n(Cálculo TEA & Ranking)\nHTTPS nativo sin API Gateway"]

        User -->|1. Carga Dashboard| GHP
        GHP -->|2. Petición HTTPS /api/tea| LambdaURL
        LambdaURL -->|Query indexada por rango de fecha| Mongo
    end

    classDef aws fill:#FF9900,stroke:#232F3E,stroke-width:2px,color:#232F3E;
    classDef storage fill:#13AA52,stroke:#232F3E,stroke-width:2px,color:#fff;
    classDef client fill:#107C41,stroke:#232F3E,stroke-width:2px,color:#fff;

    class Cron,Dispatcher,S_BBVA,S_ERNI,S_TYBA,SSM,LambdaURL aws;
    class Mongo storage;
    class User,GHP client;
```

### Principios del Desacoplamiento:
1. **Desacoplamiento Temporal (Ingesta vs Consulta):** No hay servidores encendidos 24/7. La extracción corre en pocos segundos una vez al día con EventBridge.
2. **Aislamiento por Proveedor:** Cada banco/SAF tiene su propia función Lambda aislada. Si una API externa cambia su contrato o tiene downtime, no impacta a las demás fuentes ni a la API de consulta.
3. **Optimización de Costos (\$0 Always Free):**
   - **AWS Lambda:** 1,000,000 invocaciones/mes gratuitas de por vida.
   - **Amazon EventBridge Scheduler:** 14,000,000 invocaciones/mes gratuitas de por vida.
   - **Lambda Function URLs:** Permite HTTPS directo y CORS sin necesidad de pagar por Amazon API Gateway tras los primeros 12 meses.
   - **AWS SSM Parameter Store (Standard):** Secretos a costo \$0 (reemplaza a AWS Secrets Manager).
   - **MongoDB Atlas (M0 Sandbox):** 512 MB sin cobro de RCU/WCU por lecturas analíticas masivas (ver [`IF-001`](specs/intentos-fallidos.md)).
   - **GitHub Pages:** Hosting estático gratuito e ilimitado para el dashboard.
4. **Infraestructura como Código (IaC):** Definida mediante **AWS CDK en TypeScript** bajo el directorio `infra/`.

---

## 2. Metodología Spec-Driven Development (SDD)

El proyecto se gestiona mediante la metodología **Spec-Driven Development** en [`specs/`](specs/README.md):
- [`specs/mission.md`](specs/mission.md) — Misión del producto, usuarios objetivo y alcance.
- [`specs/constitution.md`](specs/constitution.md) — Reglas y restricciones no negociables (presupuesto \$0, TypeScript estricto, TDD, convivencia con el legado).
- [`specs/tech-stack.md`](specs/tech-stack.md) — Justificación de tecnologías y alternativas analizadas.
- [`specs/roadmap.md`](specs/roadmap.md) — Fases de evolución del proyecto.
- [`specs/intentos-fallidos.md`](specs/intentos-fallidos.md) — Registro de enfoques descartados (ej. `IF-001`: descarte de DynamoDB por estrangulamiento de RCU/WCU).

---

## 3. Servidor Express Unificado (Fly.io / Local)

El servidor Express modular en TypeScript (`src/server.ts`) y su despliegue en Fly.io vía Docker multi-stage se mantienen plenamente operativos.

### Requisitos Locales
- Node.js 24+
- npm 12+
- MongoDB (local o Atlas)
- Claves de API de cada fuente

### Configuración
```bash
cp .env.example .env
```

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto HTTP. Default `3000` |
| `NODE_ENV` | Si existe, carga también `.env.{NODE_ENV}` y pisa valores |
| `MONGO_DB_URI` | URI de MongoDB. Obligatoria |
| `ERNI_APIKEY` | Subscription key de Inteligo / ERNI |
| `TYBA_APIKEY` / `TYBA_AUTHORIZATION` | Token Bearer JWT (`authorization`) de Tyba |
| `TYBA_REFRESH_TOKEN` | Token opcional para auto-renovación transparente de sesión (HTTP 401) |
| `TYBA_APP_PROOF` | Cabecera `x-app-proof` de Tyba (opcional; se autogenera dinámicamente vía RSA-4096) |
| `BBVA_APIKEY` | Header `Tsec` opcional de BBVA (por defecto se autogenera dinámicamente vía API ASO) |
| `SCRAPE_TOKEN` | Token secreto para proteger los endpoints `/api/erni`, `/api/bbva` y `/api/tyba` (vía `?token=` o `Authorization: Bearer`) |

### Ejecución de Scrapers Serverless (Local)
Cada scraper modular puede ejecutarse de forma aislada en local antes o después de desplegar en AWS:

```bash
# Ingesta de ERNI (Inteligo)
npm run scrape:erni

# Ingesta de BBVA Asset Management
npm run scrape:bbva

# Ingesta bajo demanda de Tyba (Credicorp Capital)
npm run scrape:tyba -- --authorization "<token_jwt>" [--refresh-token "<token>"] [--days 30] [--dry-run]
```

### Servidor Express Unificado (Fly.io / Local)
El proyecto cuenta con un servidor Express en TypeScript (`src/server.ts`) que unifica la vista SSR del dashboard y todos los endpoints de ingesta y analítica, consumiendo directamente la lógica de dominio sin sobrecargar Fly.io con frameworks frontend pesados:

```bash
# Ejecución en desarrollo
npm run server

# Desarrollo con auto-recarga
npm run server:dev

# Compilar para producción
npm run build:server

# Iniciar servidor compilado
npm run start:server
```

Dashboard interactivo: [http://localhost:3000](http://localhost:3000)

### Dashboard SPA Moderno (React + Vite + Tailwind)
El nuevo dashboard estático interactivo para GitHub Pages se puede ejecutar en modo desarrollo o compilar directamente desde la raíz del proyecto:

```bash
# Iniciar servidor de desarrollo del dashboard (Vite en http://localhost:5173)
npm run frontend

# O alternativamente:
npm run frontend:dev

# Compilar para producción (genera bundle estático optimizado en frontend/dist/)
npm run frontend:build

# Previsualizar el build estático localmente
npm run frontend:preview
```

### Endpoints del Servidor Express (`src/server.ts`)

#### 1. Consulta y Visualización (Públicos)

| Método | Ruta | Parámetros (Query) | Descripción y Respuesta |
| --- | --- | --- | --- |
| `GET` | `/` | • `days`: Periodo en días (`1` a `3650`, default: `30`)<br>• `currency`: Moneda a filtrar (`PEN` o `USD`, opcional)<br>• `risk`: Nivel de riesgo máximo (`1` a `7`, opcional) | **Dashboard SSR interactivo.** Genera HTML Server-Side Rendered con formulario de filtros, checkboxes dinámicos agrupados por administradora, gráfica interactiva Chart.js y tabla comparativa ordenada por variación neta de comisión: `(último / primero - 1) * (100 - fee)`. |
| `GET` | `/api/tea` | • `days`: Periodo en días (`1` a `3650`, default: `30`)<br>• `currency`: Moneda a filtrar (`PEN` o `USD`, opcional)<br>• `risk`: Nivel de riesgo máximo (`1` a `7`, opcional) | **API Analítica JSON.** Retorna `{ labels: string[], datasets: TeaDataset[] }` para consumo por clientes o SPA. Incluye cabecera HTTP `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`. |
| `GET` | `/health` | Ninguno | **Health check.** Retorna `200 OK` (texto `"OK"`) si la conexión a MongoDB está operativa (`isMongoReady()`); o `503 Service Unavailable` (`"Mongo unavailable"`) si la base de datos no está disponible. |

#### 2. Ingesta y Scraping de Datos (`/api/*`)

> **Seguridad (`SCRAPE_TOKEN`):** Si la variable de entorno `SCRAPE_TOKEN` está configurada, estos endpoints exigen validación pasando el token por query param `?token=<SCRAPE_TOKEN>` o por cabecera `Authorization: Bearer <SCRAPE_TOKEN>`. Si no coincide, responden `401 Unauthorized`. Si la variable no está definida en `.env`, el acceso es libre (modo desarrollo local).

| Método | Ruta | Parámetros (Query / Headers) | Descripción y Respuesta |
| --- | --- | --- | --- |
| `GET` | `/api/erni` | **Query:**<br>• `days`: Días de histórico (default: `30`; calcula meses equivalentes `Math.ceil(days / 30)`)<br>• `token`: Token de scraping si `SCRAPE_TOKEN` está activo | **Scraper ERNI (Inteligo).** Invoca el handler de ERNI autenticado con `ERNI_APIKEY`. Retorna JSON `{ statusCode: 200, message, totalCuotas, fondosProcesados }`. |
| `GET` | `/api/bbva` | **Query:**<br>• `days`: Días de histórico a extraer (`1` a `3650`, default: `30`)<br>• `token`: Token de scraping si `SCRAPE_TOKEN` está activo | **Scraper BBVA Asset Management.** Consulta la API ASO de BBVA con autenticación dinámica TSEC (o `BBVA_APIKEY`). Retorna JSON `{ statusCode: 200, message, totalFondos, cuotasInsertadas }`. |
| `GET` | `/api/tyba` | **Autenticación Tyba (requerida):**<br>• Header `Authorization: Bearer <jwt>` o query `?authorization=` / `?apikey=` (fallback: variable `TYBA_AUTHORIZATION` en `.env`)<br>**Parámetros opcionales:**<br>• Header `x-app-proof` o query `?appproof=`: Token de verificación anti-bot (se autogenera vía RSA-4096 si se omite)<br>• Header `x-refresh-token` o query `?refreshtoken=` / `?refreshToken=`: Token para auto-renovación de sesión ante HTTP 401 (fallback: `TYBA_REFRESH_TOKEN`)<br>• Query `days`: Días de histórico a recortar (default: `30`)<br>• Query `all`: `true` o `1` para persistir todo el histórico sin recortar<br>• Query `token`: Token de scraping si `SCRAPE_TOKEN` está configurado (recomendado para no interferir con `Authorization` de Tyba) | **Scraper Tyba (Credicorp Capital).** Descarga observaciones históricas y sincroniza el catálogo de 30 fondos. Retorna JSON `{ statusCode: 200, message, totalFondos, cuotasInsertadas }`. |

### Despliegue en Fly.io
El despliegue en Fly.io utiliza un `Dockerfile` multi-stage ultraligero que compila el código TypeScript a JavaScript nativo y corre sobre Node 24 Alpine consumiendo menos de 40 MB de memoria:

```bash
fly deploy
```

---

## 4. Estructura del Repositorio

| Directorio / Archivo | Rol |
| --- | --- |
| `specs/` | Documentos fundacionales y especificaciones SDD por funcionalidad |
| `infra/` | Infraestructura como Código con AWS CDK v2 en TypeScript (`FondosStack`, Lambdas, EventBridge, Function URLs) |
| `frontend/` | Single Page Application (SPA) desacoplada en React 19 + Vite + Tailwind CSS para GitHub Pages |
| `src/scrapers/` | Módulos de ingesta y adaptadores bancarios serverless (ERNI, BBVA, Tyba) con `fetch` nativo |
| `src/domain/` | Motor matemático puro de variación relativa neta de comisiones (`tea.ts`) |
| `src/api/` | Handler de la AWS Lambda Function URL (`handler.ts`), esquemas TypeBox y servidor local |
| `src/views/` | Plantilla HTML para Server-Side Rendering (SSR) del dashboard sin dependencias de cliente |
| `src/server.ts` | Servidor Express unificado para despliegue en Fly.io y ejecución local |
| `src/shared/` | Conexión singleton a MongoDB Atlas, lectura de parámetros SSM y utilidades de concurrencia |
| `Dockerfile` | Imagen Docker multi-stage optimizada para Fly.io |
| `fly.toml` | Archivo de configuración de la aplicación en Fly.io |
| `scripts/` | Validadores de especificaciones (`validate_sdd.py`, `check_constitution.py`) |
