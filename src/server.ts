import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { connectToDatabase, isMongoReady } from "./shared/db.js";
import { calculateTea } from "./domain/tea.js";
import { renderHtml } from "./views/html.js";
import { handler as erniHandler } from "./scrapers/erni/handler.js";
import { handler as bbvaHandler } from "./scrapers/bbva/handler.js";
import { handler as tybaHandler } from "./scrapers/tyba/handler.js";
import { parseDays, parseCurrency, parseRisk } from "./shared/utils.js";

const requireScrapeToken = (req: Request, res: Response, next: NextFunction): void => {
  const token = process.env.SCRAPE_TOKEN;
  if (!token) {
    return next();
  }

  const header = req.headers.authorization;
  const provided =
    (req.query.token as string | undefined) ||
    (header?.startsWith("Bearer ") ? header.slice(7) : undefined);

  if (provided !== token) {
    res.status(401).send("Unauthorized");
    return;
  }

  next();
};

/**
 * Crea e inicializa la aplicación Express con todos los endpoints del comparador.
 */
export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");

  // Middleware CORS para permitir peticiones cross-origin desde la SPA (GitHub Pages y desarrollo local)
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // Endpoint de salud compatible con los health checks de Fly.io y monitoreo
  app.get("/health", (_req: Request, res: Response) => {
    if (!isMongoReady()) {
      return res.status(503).send("Mongo unavailable");
    }
    return res.status(200).send("OK");
  });

  // Endpoint visual principal: Dashboard SSR idéntico al legacy (sin React ni Vite)
  app.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = parseDays(req.query.days);
      const currency = parseCurrency(req.query.currency);
      const risk = parseRisk(req.query.risk);
      const chartData = await calculateTea({ days, currency, risk });
      const html = renderHtml({ days, currency, risk, chartData });
      res.status(200).type("html").send(html);
    } catch (err) {
      next(err);
    }
  });

  // Endpoint de datos analíticos crudos en formato JSON (compatible con Chart.js)
  app.get("/api/tea", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = parseDays(req.query.days);
      const currency = parseCurrency(req.query.currency);
      const risk = parseRisk(req.query.risk);
      const chartData = await calculateTea({ days, currency, risk });
      res.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      res.status(200).json(chartData);
    } catch (err) {
      next(err);
    }
  });

  // Endpoint de scraping ERNI (Inteligo)
  app.get("/api/erni", requireScrapeToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = parseDays(req.query.days);
      const result = await erniHandler({ days });
      res.status(result.statusCode).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Endpoint de scraping BBVA
  app.get("/api/bbva", requireScrapeToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const days = parseDays(req.query.days);
      const result = await bbvaHandler({ days });
      res.status(result.statusCode).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Endpoint de scraping Tyba (Credicorp Capital)
  app.get("/api/tyba", requireScrapeToken, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth =
        (req.headers.authorization as string | undefined) ||
        (req.query.apikey as string | undefined) ||
        (req.query.authorization as string | undefined) ||
        "";
      const appProof =
        (req.headers["x-app-proof"] as string | undefined) ||
        (req.query.appproof as string | undefined);
      const refreshToken =
        (req.headers["x-refresh-token"] as string | undefined) ||
        (req.query.refreshtoken as string | undefined) ||
        (req.query.refreshToken as string | undefined);
      const days = parseDays(req.query.days);
      const all = req.query.all === "true" || req.query.all === "1";

      const result = await tybaHandler({
        authorization: auth,
        xAppProof: appProof,
        refreshToken,
        days,
        all,
      });
      res.status(result.statusCode).json(result);
    } catch (err) {
      next(err);
    }
  });

  // Middleware de manejo de errores
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Error no capturado en servidor Express:", err);
    res.status(500).send("Error interno");
  });

  return app;
}

/**
 * Inicia la conexión a MongoDB y levanta el servidor HTTP Express.
 */
export async function startServer(port = Number(process.env.PORT) || 3000) {
  await connectToDatabase();
  const app = createApp();
  return app.listen(port, () => {
    console.info(`Servidor Express corriendo en http://localhost:${port}`);
  });
}

// Ejecución directa si se invoca como entrypoint principal
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js"));

if (isMainModule) {
  startServer().catch((error) => {
    console.error("Error al iniciar servidor Express:", error);
    process.exit(1);
  });
}
