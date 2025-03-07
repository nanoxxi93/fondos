import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: `.env.${process.env.NODE_ENV}`, override: true });

import express from "express";
import { mongoInit } from "./db.js";
import { run as runErni } from "./erni.js";
import { run as runBbva } from "./bbva.js";
import { run as runTyba } from "./tyba.js";
import { tea } from "./tea.js";

const { PORT = 3000 } = process.env;

mongoInit().then(() => {
  const app = express();
  app.get("/erni", async (req, res) => {
    try {
      await runErni(req.query);
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  app.get("/bbva", async (req, res) => {
    try {
      await runBbva(req.query);
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  app.get("/tyba", async (req, res) => {
    try {
      await runTyba(req.query);
      res.status(200).send("OK");
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  app.get("/", async (req, res) => {
    const { period, currency, risk } = req.query;
    const result = await tea({
      PERIOD: period ? +period : 30,
      CURRENCY: currency,
      RISK: risk ? +risk : 7,
    });
    res.status(200).json(result);
  });

  app.listen(PORT, () => {
    console.info(`Server is running at http://localhost:${PORT}`);
  });
});
