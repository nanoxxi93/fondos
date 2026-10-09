"use strict";

import { createQuotaModel } from "./db.js";
import { dateRange, fetchJson, isClientError, upsertQuotas } from "./utils.js";

const BBVA_URL =
  "https://www.bbva.es/ASO/management-entity-funds/v1/management-entities-funds/past-returns";

export const BBVA_FONDO = {
  "BBVAAGR-PE": {
    name: "BBVA Acciones Marcas Globales FMIV",
    currency: "USD",
    risk: 7,
    fee: 0.85,
  },
  "CASHDOL-PE": {
    name: "BBVA Cash Dólares FMIV",
    currency: "USD",
    risk: 1,
    fee: 0.45,
  },
  "CASHSOL-PE": {
    name: "BBVA Cash Soles FMIV",
    currency: "PEN",
    risk: 1,
    fee: 0.5,
  },
  "SUPRVIP-PE": {
    name: "BBVA Conservador Global Dólares FMIV",
    currency: "USD",
    risk: 3,
    fee: 0.6,
  },
  SUPRACCPEEQU: {
    name: "BBVA Conservador Global Soles FMIV",
    currency: "PEN",
    risk: 4,
    fee: 0.6,
  },
  382: {
    name: "BBVA Distributivo Estratégico Global FMIV",
    currency: "USD",
    risk: 4,
    fee: 0.8,
  },
  "0372": {
    name: "BBVA Distributivo High Yield EE.UU. FMIV",
    currency: "USD",
    risk: 6,
    fee: 1,
  },
  "0452": {
    name: "BBVA Equilibrado Global Dólares FMIV",
    currency: "USD",
    risk: 4,
    fee: 0.7,
  },
  "MUTIIEQ-PE": {
    name: "BBVA Equilibrado Global Soles FMIV",
    currency: "PEN",
    risk: 6,
    fee: 0.7,
  },
  "BBVAANDI-PE": {
    name: "BBVA Dinámico Global Dólares FMIV",
    currency: "USD",
    risk: 7,
    fee: 0.8,
  },
  "MUIIIAG-PE": {
    name: "BBVA Dinámico Global Soles FMIV",
    currency: "PEN",
    risk: 7,
    fee: 1,
  },
  "BBVSEST-PE": {
    name: "FOES Apreciación de Capital FMIV",
    currency: "USD",
    risk: 5,
    fee: 1.2,
  },
  "BBVABAL-PE": {
    name: "FOES Generación de Flujo",
    currency: "USD",
    risk: 6,
    fee: 0.8,
  },
  SUPRDMNPEEQU: {
    name: "BBVA RENTA CORTO PLAZO DOLARES FMIV",
    currency: "USD",
    risk: 2,
    fee: 0.55,
  },
  "BBVATSO-PE": {
    name: "BBVA RENTA CORTO PLAZO SOLES FMIV",
    currency: "PEN",
    risk: 2,
    fee: 0.6,
  },
  SUPRDOLPEEQU: {
    name: "BBVA RENTA MEDIANO PLAZO DOLARES FMIV",
    currency: "USD",
    risk: 4,
    fee: 0.65,
  },
  "SUPRSOL-PE": {
    name: "BBVA RENTA MEDIANO PLAZO SOLES FMIV",
    currency: "PEN",
    risk: 4,
    fee: 0.75,
  },
  "BBVARE-PE": {
    name: "BBVA Acciones Globales Real Estate FMIV",
    currency: "USD",
    risk: 7,
    fee: 0.85,
  },
  "BBVAMIL-PE": {
    name: "BBVA Acciones Globales Millennials FMIV",
    currency: "USD",
    risk: 7,
    fee: 0.85,
  },
};

export const BbvaModel = createQuotaModel("bbva");

const captureBbvaTsec = async () => {
  let puppeteer;
  try {
    puppeteer = (await import("puppeteer")).default;
  } catch {
    throw new Error("BBVA_APIKEY requerido (puppeteer no disponible)");
  }

  let tsec;
  const browser = await puppeteer.launch({
    headless: process.env.BBVA_HEADLESS !== "false",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    page.on("response", (response) => {
      const header = response.headers()["tsec"];
      if (response.request().resourceType() === "xhr" && header) {
        tsec = header;
      }
    });

    await page.goto(
      "https://fondos.bbva.pe/personas/productos/conservadores/bbva-tesoreria-soles.html",
      { waitUntil: "networkidle0", timeout: 30000 }
    );
  } finally {
    await browser.close();
  }

  if (!tsec) {
    throw new Error("No se pudo capturar tsec de BBVA");
  }

  return tsec;
};

const getBbvaQuota = async ({
  idFondo,
  idSerie = null,
  fromDate,
  toDate,
  currency = "PEN",
  days = 30,
  apikey,
}) => {
  const range = dateRange(days);
  fromDate ??= range.fromISO;
  toDate ??= range.toISO;

  try {
    const json = await fetchJson(BBVA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Tsec: apikey || process.env.BBVA_APIKEY,
      },
      body: JSON.stringify({
        funds: [
          {
            id: idFondo,
            weight: 100,
          },
        ],
        period: {
          fromDate,
          toDate,
        },
        assetValuesCurrency: {
          id: currency,
        },
      }),
    });

    console.info(`${idFondo} ${idSerie} ${fromDate} ${toDate} fetch success`);

    await upsertQuotas(
      BbvaModel,
      json.data?.weightedAverageAssetValues?.map(
        ({ valueDate, valueAmount: { amount } }) => ({
          idFondo,
          idSerie,
          date: valueDate,
          value: amount,
        })
      )
    );

    console.info(`${idFondo} ${idSerie} ${fromDate} ${toDate} db updated`);
  } catch (error) {
    if (isClientError(error)) {
      throw error;
    }
    console.error(`${idFondo} ${idSerie} ${fromDate} ${toDate} ${error}`);
  }
};

export const run = async ({ days, apikey }) => {
  if (!apikey) {
    apikey = process.env.BBVA_APIKEY || (await captureBbvaTsec());
  }

  for (const [idFondo, { currency }] of Object.entries(BBVA_FONDO)) {
    await getBbvaQuota({ idFondo, currency, days, apikey });
  }
};
