"use strict";

import { createQuotaModel } from "./db.js";
import { dateRange, fetchJson, isClientError, upsertQuotas } from "./utils.js";

const TYBA_URL = (id) =>
  `https://tyba.io/api-master/robo-advisor/portfolios/${id}/historic-performance`;

export const TYBA_FONDO = {
  "4f28ebf4-6d3c-53f0-9a48-8e415e83f323": {
    name: "CC Acciones China",
    currency: "USD",
    risk: 7,
    fee: 0.010252,
  },
  "3cad7d53-9f01-504f-b6fb-0eccf5d9bb4d": {
    name: "CC Acciones LATAM",
    currency: "USD",
    risk: 7,
    fee: 0.0152,
  },
  "a07f3416-7f92-40a5-97c7-c3f74199f79a": {
    name: "CC Duración Objetivo Latam",
    currency: "USD",
    risk: 4,
    fee: 0.0072,
  },
  "bbf51aa8-0bf4-5559-8688-93b31b207b59": {
    name: "CC Acciones Innovación",
    currency: "USD",
    risk: 7,
    fee: 0.01,
  },
  "daac03ec-1ba3-52b4-a285-7f194dd42680": {
    name: "CC Acciones (Perú)",
    currency: "USD",
    risk: 7,
    fee: 0.035,
  },
  "1730784c-4e44-5c91-88cc-d493e65bcea6": {
    name: "CC Acciones Estados Unidos",
    currency: "USD",
    risk: 7,
    fee: 0.01,
  },
  "d32bf791-d171-587d-93f9-b00744fedf59": {
    name: "CC Crecimiento VCS",
    currency: "PEN",
    risk: 7,
    fee: 0.0325,
  },
  "1da207ad-9565-5c76-a7c6-b737bef8ed91": {
    name: "CC Tendencias Globales",
    currency: "USD",
    risk: 7,
    fee: 0.0102,
  },
  "1ed5d0bb-f31f-506e-93f4-2d05025a08cd": {
    name: "CC Acciones Sector Seguridad",
    currency: "USD",
    risk: 7,
    fee: 0.01,
  },
  "c3a4ac8b-e33a-5b61-ba4c-75eae3ec035b": {
    name: "CC Acciones Global",
    currency: "USD",
    risk: 7,
    fee: 0.0175,
  },
  "c15ba775-320a-579a-88bf-535e5d3e1ae8": {
    name: "CC Equilibrado",
    currency: "USD",
    risk: 4,
    fee: 0.03,
  },
  "edb6dd05-47c6-575d-86c1-bce019804635": {
    name: "CC Acciones Europa",
    currency: "USD",
    risk: 7,
    fee: 0.01,
  },
  "20711166-937a-5665-9430-c08e0872da48": {
    name: "CC Renta Futura II Soles",
    currency: "PEN",
    risk: 7,
    fee: 0.013252,
  },
  "8c2f0120-5156-53ca-b9e7-7fb7059a3a6b": {
    name: "CC Renta Futura III",
    currency: "USD",
    risk: 7,
    fee: 0.016,
  },
  "ddff9d87-4c36-5926-af27-b0af189c1cc9": {
    name: "CC Moderado VCS",
    currency: "PEN",
    risk: 4,
    fee: 0.0275,
  },
  "1c28975a-60d2-5eb9-a20b-c73519208ef4": {
    name: "CC Renta Futura II",
    currency: "USD",
    risk: 7,
    fee: 0.013,
  },
  "161059a2-5cfa-5524-81a6-882c8e050476": {
    name: "CC Deuda Flotante",
    currency: "USD",
    risk: 4,
    fee: 0.01,
  },
  "375a7a9c-e76f-5718-b437-b6a0e25706bd": {
    name: "CC Consumo Global",
    currency: "USD",
    risk: 7,
    fee: 0.01,
  },
  "311d3341-e64e-5a1b-b7bf-23f43f33fcac": {
    name: "CC Moderado",
    currency: "USD",
    risk: 4,
    fee: 0.0275,
  },
  "e004b6e4-a93f-56a4-9611-540b8c29c9b8": {
    name: "CC Activos Preferentes",
    currency: "USD",
    risk: 4,
    fee: 0.01,
  },
  "e18b3494-ddf6-5edc-886a-7d2805d91a43": {
    name: "CC Mediano Plazo Soles",
    currency: "PEN",
    risk: 1,
    fee: 0.014,
  },
  "c3be60ae-96f8-57e7-adc1-cb1aba33bbc6": {
    name: "CC Deuda High Yield Global",
    currency: "USD",
    risk: 4,
    fee: 0.01,
  },
  "da592a0c-c3a8-57b8-9acc-9eda4334f9ab": {
    name: "CC Conservador Corto Plazo Soles",
    currency: "PEN",
    risk: 1,
    fee: 0.0105,
  },
  "e0a2b151-a1f6-5593-9fe6-e74881088152": {
    name: "CC Mediano Plazo Dólares",
    currency: "USD",
    risk: 1,
    fee: 0.014,
  },
  "bd2445cd-a8b1-5d84-9e32-5838e19d78e1": {
    name: "CC Liquidez Soles",
    currency: "PEN",
    risk: 1,
    fee: 0.0077,
  },
  "f917fe6f-c8b4-5ef2-bcb7-68b2007db0c0": {
    name: "CC Renta Futura I",
    currency: "USD",
    risk: 4,
    fee: 0.01,
  },
  "50d70f0c-8e7e-5077-9eaf-53df7ad82e0f": {
    name: "CC Conservador Corto Plazo Dólares",
    currency: "USD",
    risk: 1,
    fee: 0.0076,
  },
  "b90e05f6-8b3f-5448-81cb-0f7a9eaad358": {
    name: "CC Liquidez Dólares",
    currency: "USD",
    risk: 1,
    fee: 0.0054,
  },
  "09abc36a-3d6b-5427-9aca-c6a0e35017cd": {
    name: "CC Deuda Global",
    currency: "USD",
    risk: 4,
    fee: 0.0095,
  },
  "ea4305df-ff68-5707-9482-0a0e121c6b63": {
    name: "CC Acciones Asia",
    currency: "USD",
    risk: 7,
    fee: 0.01,
  },
};

export const TybaModel = createQuotaModel("tyba");

const getTybaQuota = async ({
  idFondo,
  idSerie = null,
  fromDate,
  toDate,
  days = 30,
  apikey,
  appproof,
}) => {
  const range = dateRange(days);
  fromDate ??= range.fromISO;
  toDate ??= range.toISO;

  try {
    const json = await fetchJson(TYBA_URL(idFondo), {
      method: "GET",
      headers: {
        authorization: apikey || process.env.TYBA_APIKEY,
        "X-App-Proof": appproof || process.env.TYBA_APP_PROOF,
      },
    });

    console.info(`${idFondo} ${idSerie} ${fromDate} ${toDate} fetch success`);

    await upsertQuotas(
      TybaModel,
      json.graphData?.slice(-days)?.map(({ interval, value }) => ({
        idFondo,
        idSerie,
        date: interval,
        value,
      }))
    );

    console.info(`${idFondo} ${idSerie} ${fromDate} ${toDate} db updated`);
  } catch (error) {
    if (isClientError(error)) {
      throw error;
    }
    console.error(`${idFondo} ${idSerie} ${fromDate} ${toDate} ${error}`);
  }
};

export const run = async ({ days, apikey, appproof }) => {
  for (const [idFondo] of Object.entries(TYBA_FONDO)) {
    await getTybaQuota({ idFondo, days, apikey, appproof });
  }
};
