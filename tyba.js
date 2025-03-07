"use strict";

import mongoose, { Schema } from "mongoose";

const TYBA_APIKEY = process.env.TYBA_APIKEY;

const TYBA_URL = (id) =>
  `https://tyba.io/api-master/robo-advisor/portfolios/${id}/historic-performance`;

export const TYBA_FONDO = {
  "c3a4ac8b-e33a-5b61-ba4c-75eae3ec035b": {
    name: "CC Acciones Global",
    currency: "USD",
    risk: 7,
    fee: 1.75,
  },
  "ea4305df-ff68-5707-9482-0a0e121c6b63": {
    name: "CC Acciones Asia",
    currency: "USD",
    risk: 5,
    fee: 1,
  },
  "8c2f0120-5156-53ca-b9e7-7fb7059a3a6b": {
    name: "CC Visión III",
    currency: "USD",
    risk: 6,
    fee: 1.6,
  },
  "1c28975a-60d2-5eb9-a20b-c73519208ef4": {
    name: "CC Visión II",
    currency: "USD",
    risk: 6,
    fee: 1.3,
  },
  "e004b6e4-a93f-56a4-9611-540b8c29c9b8": {
    name: "CC Activos Preferentes",
    currency: "USD",
    risk: 5,
    fee: 1,
  },
  "1da207ad-9565-5c76-a7c6-b737bef8ed91": {
    name: "CC Tendencias Globales",
    currency: "USD",
    risk: 5,
    fee: 1,
  },
  "c3be60ae-96f8-57e7-adc1-cb1aba33bbc6": {
    name: "CC Deuda High Yield Global",
    currency: "USD",
    risk: 5,
    fee: 0.8,
  },
  "bbf51aa8-0bf4-5559-8688-93b31b207b59": {
    name: "CC Acciones Innovación",
    currency: "USD",
    risk: 5,
    fee: 1,
  },
  "e0a2b151-a1f6-5593-9fe6-e74881088152": {
    name: "CC Mediano Plazo Dólares",
    currency: "USD",
    risk: 3,
    fee: 1.35,
  },
  "f917fe6f-c8b4-5ef2-bcb7-68b2007db0c0": {
    name: "CC Visión I",
    currency: "USD",
    risk: 6,
    fee: 1,
  },
  "09abc36a-3d6b-5427-9aca-c6a0e35017cd": {
    name: "CC Deuda Global",
    currency: "USD",
    risk: 5,
    fee: 0.95,
  },
  "20711166-937a-5665-9430-c08e0872da48": {
    name: "CC Visión II Soles",
    currency: "PEN",
    risk: 4,
    fee: 1.3,
  },
  "1ed5d0bb-f31f-506e-93f4-2d05025a08cd": {
    name: "CC Acciones Sector Seguridad",
    currency: "USD",
    risk: 5,
    fee: 1,
  },
  "375a7a9c-e76f-5718-b437-b6a0e25706bd": {
    name: "CC Consumo Global",
    currency: "USD",
    risk: 5,
    fee: 1,
  },
  "1730784c-4e44-5c91-88cc-d493e65bcea6": {
    name: "CC Acciones Estados Unidos",
    currency: "USD",
    risk: 5,
    fee: 1,
  },
  "daac03ec-1ba3-52b4-a285-7f194dd42680": {
    name: "CC Acciones (Perú)",
    currency: "USD",
    risk: 7,
    fee: 3.5,
  },
  "bd2445cd-a8b1-5d84-9e32-5838e19d78e1": {
    name: "CC Liquidez Soles",
    currency: "PEN",
    risk: 1,
    fee: 0.55,
  },
  "da592a0c-c3a8-57b8-9acc-9eda4334f9ab": {
    name: "CC Conservador Corto Plazo Soles",
    currency: "PEN",
    risk: 2,
    fee: 0.85,
  },
  "edb6dd05-47c6-575d-86c1-bce019804635": {
    name: "CC Acciones Europa",
    currency: "USD",
    risk: 5,
    fee: 1,
  },
  "50d70f0c-8e7e-5077-9eaf-53df7ad82e0f": {
    name: "CC Conservador Corto Plazo Dólares",
    currency: "USD",
    risk: 2,
    fee: 0.55,
  },
  "b90e05f6-8b3f-5448-81cb-0f7a9eaad358": {
    name: "CC Liquidez Dólares",
    currency: "USD",
    risk: 1,
    fee: 0.4,
  },
  "d32bf791-d171-587d-93f9-b00744fedf59": {
    name: "CC Crecimiento VCS",
    currency: "PEN",
    risk: 4,
    fee: 3.25,
  },
  "e18b3494-ddf6-5edc-886a-7d2805d91a43": {
    name: "CC Mediano Plazo Soles",
    currency: "PEN",
    risk: 3,
    fee: 1.35,
  },
  "a07f3416-7f92-40a5-97c7-c3f74199f79a": {
    name: "CC Duración Objetivo Latam",
    currency: "USD",
    risk: 5,
    fee: 1.15,
  },
  "161059a2-5cfa-5524-81a6-882c8e050476": {
    name: "CC Deuda Flotante",
    currency: "USD",
    risk: 5,
    fee: 1,
  },
  "3cad7d53-9f01-504f-b6fb-0eccf5d9bb4d": {
    name: "CC Acciones LATAM",
    currency: "USD",
    risk: 7,
    fee: 1.5,
  },
};

const TybaSchema = new Schema({
  idFondo: { type: String, trim: true },
  idSerie: { type: String, trim: true },
  date: { type: Date },
  value: { type: Number },
});
TybaSchema.index({ idFondo: 1, idSerie: 1, date: 1 }, { unique: true });

export const TybaModel = mongoose.model("tyba", TybaSchema);

const getTybaQuota = async ({
  idFondo,
  idSerie = null,
  fromDate,
  toDate,
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
    const res = await fetch(TYBA_URL(idFondo), {
      method: "GET",
      headers: {
        authorization: apikey || TYBA_APIKEY,
      },
    });

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    console.info(`${idFondo} ${idSerie} ${fromDate} ${toDate} fetch success`);

    await Promise.all(
      json.graphData?.map(
        async ({ interval, value }) =>
          await TybaModel.updateOne(
            {
              idFondo,
              idSerie,
              date: interval,
            },
            {
              $set: {
                value,
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
  for (const [idSerie, { currency }] of Object.entries(TYBA_FONDO)) {
    await getTybaQuota({ idSerie, currency, days, apikey });
  }
  // await Promise.all(
  //   Object.entries(TYBA_FONDO).map(async ([idFondo]) => {
  //     await getTybaQuota({ idFondo, days, apikey });
  //   })
  // );
};
