import "./load-env.js";

import express from "express";
import { isMongoReady, mongoInit } from "./db.js";
import { run as runErni } from "./erni.js";
import { run as runBbva } from "./bbva.js";
import { run as runTyba } from "./tyba.js";
import { tea } from "./tea.js";
import { getHTML } from "./html.js";
import { parseCurrency, parseDays, parseRisk } from "./utils.js";

const { PORT = 3000 } = process.env;

const scrapers = {
  erni: runErni,
  bbva: runBbva,
  tyba: runTyba,
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const requireScrapeToken = (req, res, next) => {
  const token = process.env.SCRAPE_TOKEN;
  if (!token) {
    return next();
  }

  const header = req.headers.authorization;
  const provided =
    req.query.token ||
    (header?.startsWith("Bearer ") ? header.slice(7) : undefined);

  if (provided !== token) {
    return res.status(401).send("Unauthorized");
  }

  next();
};

const start = () => {
  const app = express();
  app.disable("x-powered-by");

  app.get("/health", (_req, res) => {
    if (!isMongoReady()) {
      return res.status(503).send("Mongo unavailable");
    }
    res.status(200).send("OK");
  });

  for (const [source, run] of Object.entries(scrapers)) {
    app.get(
      `/api/${source}`,
      requireScrapeToken,
      asyncHandler(async (req, res) => {
        await run({
          days: parseDays(req.query.days),
          apikey: req.query.apikey,
          appproof: req.query.appproof,
        });
        res.status(200).send("OK");
      })
    );
  }

  app.get(
    "/",
    asyncHandler(async (req, res) => {
      const days = parseDays(req.query.days);
      const currency = parseCurrency(req.query.currency);
      const risk = parseRisk(req.query.risk);
      const chartData = await tea({
        DAYS: days,
        CURRENCY: currency,
        RISK: risk,
      });

      res.status(200).send(getHTML({ days, currency, risk, chartData }));
    })
  );

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).send("Error interno");
  });

  app.listen(PORT, () => {
    console.info(`Server is running at http://localhost:${PORT}`);
  });
};

mongoInit()
  .then(start)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
