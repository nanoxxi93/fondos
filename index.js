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
    const { period = 30, currency, risk } = req.query;
    const result = await tea({
      PERIOD: +period,
      CURRENCY: currency,
      RISK: risk ? +risk : undefined,
    });
    let html = `
      <!DOCTYPE html>
      <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Fondos Mutuos</title>
        </head>
        <body style="width: fit-content; margin: auto;">
          <h1>Fondos Mutuos - últimos ${period} días</h1>
          <table style="border-collapse: collapse;">
            <tr>
              <th style="border: 1px solid black; padding: 2px;">Nombre</th>
              <th style="border: 1px solid black; padding: 2px;">Moneda</th>
              <th style="border: 1px solid black; padding: 2px;">Riesgo</th>
              <th style="border: 1px solid black; padding: 2px;">Valor</th>
            </tr>
    `;
    Object.values(result).forEach(({ name, currency, risk, value }) => {
      html += `
        <tr>
          <td style="border: 1px solid black; padding: 2px;">${name}</td>
          <td style="border: 1px solid black; padding: 2px; text-align: center;">${currency}</td>
          <td style="border: 1px solid black; padding: 2px; text-align: center;">${risk}</td>
          <td style="border: 1px solid black; padding: 2px; text-align: center;">${value}</td>
        </tr>
      `;
    });
    html += `
          </table>
        </body>
      </html>
    `;

    res.status(200).send(html);
  });

  app.listen(PORT, () => {
    console.info(`Server is running at http://localhost:${PORT}`);
  });
});
