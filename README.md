# Fondos

App Node.js que descarga valores cuota de fondos mutuos (ERNI, BBVA y Tyba), los guarda en MongoDB y muestra un comparador con Chart.js.

Rendimiento de la tabla: variación del periodo neta de comisión, `(último / primero - 1) * (100 - fee)`.

## Requisitos

- Node.js 24+
- npm 12+
- MongoDB (local o Atlas)
- Claves de API de cada fuente

## Configuración

```bash
cp .env.example .env
```

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto HTTP. Default `3000` |
| `NODE_ENV` | Si existe, carga también `.env.{NODE_ENV}` y pisa valores |
| `MONGO_DB_URI` | URI de MongoDB. Obligatoria |
| `ERNI_APIKEY` | Subscription key de Inteligo / ERNI |
| `TYBA_APIKEY` | Token `authorization` de Tyba |
| `TYBA_APP_PROOF` | Header `X-App-Proof` de Tyba. También `?appproof=` |
| `BBVA_APIKEY` | Header `Tsec` de BBVA. En producción usa esto; evita Puppeteer |
| `SCRAPE_TOKEN` | Si está definida, `/api/*` exige `?token=` o `Authorization: Bearer` |
| `BBVA_HEADLESS` | `false` abre Chrome visible al capturar `tsec`. Default headless |

## Uso local

```bash
npm install
npm start
```

Desarrollo con recarga:

```bash
npm run dev
```

Dashboard: [http://localhost:3000](http://localhost:3000)

## Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/` | Dashboard. Query: `days` (1-3650, default 30), `currency` (`PEN` o `USD`), `risk` (máximo 1-7) |
| `GET` | `/health` | `OK` si Mongo está conectado; `503` si no |
| `GET` | `/api/erni` | Descarga cuotas ERNI. Query: `days` |
| `GET` | `/api/bbva` | Descarga cuotas BBVA. Query: `days`, `apikey` (tsec opcional) |
| `GET` | `/api/tyba` | Descarga cuotas Tyba. Query: `days`, `apikey` y `appproof` opcionales |

Ejemplos:

```bash
curl "http://localhost:3000/?days=90&currency=USD&risk=4"
curl "http://localhost:3000/api/erni?days=30"
curl "http://localhost:3000/api/bbva?days=30&apikey=$BBVA_APIKEY"
```

Scrapers corren en serie (un fondo tras otro) para no saturar las APIs.

## Docker

```bash
./run.sh
```

Compose publica `5001 -> 3000` y lee `.env.development`. Imagen Alpine omite el download de Chrome (`PUPPETEER_SKIP_DOWNLOAD`). En contenedor, BBVA necesita `BBVA_APIKEY`.

## Deploy (Fly.io)

Push a `main` dispara `.github/workflows/fly-deploy.yml`. Health check usa `/health` para no cargar el dashboard en cada probe.

Secrets típicos: `MONGO_DB_URI`, `ERNI_APIKEY`, `TYBA_APIKEY`, `TYBA_APP_PROOF`, `BBVA_APIKEY`, `SCRAPE_TOKEN`.

## Estructura

| Archivo | Rol |
| --- | --- |
| `index.js` | Express, rutas, arranque |
| `load-env.js` | Carga `.env` antes del resto de módulos |
| `db.js` | Conexión Mongo y modelo de cuotas |
| `utils.js` | Fechas, HTTP, upsert, parseo, escape HTML |
| `erni.js` / `bbva.js` / `tyba.js` | Catálogo + scraper de cada fuente |
| `tea.js` | Serie relativa y ranking |
| `html.js` | Dashboard Chart.js |

## Notas

- Colores del gráfico son estables por fondo (hash), no cambian en cada refresh.
- Puppeteer solo entra si BBVA no tiene `apikey` ni `BBVA_APIKEY`.
- `npm run lint` corre ESLint.
