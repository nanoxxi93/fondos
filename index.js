import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: `.env.${process.env.NODE_ENV}`, override: true });

import express from "express";
import { mongoInit } from "./db.js";
import { run as runErni } from "./erni.js";
import { run as runBbva } from "./bbva.js";
import { run as runTyba } from "./tyba.js";
import { tea } from "./tea.js";
import { getHTML } from "./html.js";

const { PORT = 3000 } = process.env;

mongoInit().then(() => {
  const app = express();
  app.get("/api/erni", async (req, res) => {
    try {
      await runErni(req.query);
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/bbva", async (req, res) => {
    try {
      await runBbva(req.query);
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  app.get("/api/tyba", async (req, res) => {
    try {
      await runTyba(req.query);
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  app.get("/", async (req, res) => {
    const { days = 30, currency, risk } = req.query;
    const chartData = await tea({
      DAYS: +days,
      CURRENCY: currency,
      RISK: risk ? +risk : undefined,
    });

    const html = getHTML({ days, chartData });

    res.status(200).send(html);
  });

  app.listen(PORT, () => {
    console.info(`Server is running at http://localhost:${PORT}`);
  });
});
