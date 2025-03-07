"use strict";

import mongoose, { Schema } from "mongoose";

// https://fondos.bbva.pe/personas/productos/conservadores/bbva-tesoreria-soles.html

const BBVA_APIKEY = process.env.BBVA_APIKEY;
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

const BbvaSchema = new Schema({
  idFondo: { type: String, trim: true },
  idSerie: { type: String, trim: true },
  date: { type: Date },
  value: { type: Number },
});
BbvaSchema.index({ idFondo: 1, idSerie: 1, date: 1 }, { unique: true });

export const BbvaModel = mongoose.model("bbva", BbvaSchema);

const getBbvaQuota = async ({
  idFondo,
  idSerie = null,
  fromDate,
  toDate,
  currency = "PEN",
  days = 30,
  apikey,
}) => {
  const today = new Date();
  const prevDate = new Date(new Date().setDate(today.getDate() - days));

  if (!fromDate) {
    fromDate = prevDate.toISOString().slice(0, 10);
  }
  if (!toDate) {
    toDate = today.toISOString().slice(0, 10);
  }

  try {
    const res = await fetch(BBVA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Tsec: apikey || BBVA_APIKEY,
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

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    console.info(`${idFondo} ${idSerie} ${fromDate} ${toDate} fetch success`);

    await Promise.all(
      json.data?.weightedAverageAssetValues?.map(
        async ({ valueDate, valueAmount: { amount } }) =>
          await BbvaModel.updateOne(
            {
              idFondo,
              idSerie,
              date: valueDate,
            },
            {
              $set: {
                value: amount,
              },
            },
            {
              upsert: true,
            }
          )
      )
    );

    console.info(`${idFondo} ${idSerie} ${fromDate} ${toDate} db updated`);
  } catch (error) {
    if (error.message.startsWith("4")) {
      throw error;
    }
    console.error(`${idFondo} ${idSerie} ${fromDate} ${toDate} ${error}`);
    return undefined;
  }
};

export const run = async ({ days, apikey }) => {
  for (const [idSerie, { currency }] of Object.entries(BBVA_FONDO)) {
    await getBbvaQuota({ idSerie, currency, days, apikey });
  }
  // await Promise.all(
  //   Object.entries(BBVA_FONDO).map(async ([idFondo, { currency }]) => {
  //     await getBbvaQuota({
  //       idFondo,
  //       currency,
  //       days,
  //       apikey,
  //     });
  //   })
  // );
};
