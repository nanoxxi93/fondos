"use strict";

import { createQuotaModel } from "./db.js";
import { dateRange, fetchJson, isClientError, upsertQuotas } from "./utils.js";

const ERNI_URL =
  "https://api.inteligogroup.com/investorbackend-prod/valorcuota";

export const ERNI_FONDO = {
  "01": {
    name: "IF_MIXTO_BALANCEADO_DOLARES",
    currency: "USD",
    risk: 7,
    fee: 2,
  },
  "02": {
    name: "IF_MEDIANO_PLAZO_DOLARES",
    currency: "USD",
    risk: 4,
    fee: 1.35,
  },
  "04": {
    name: "IF_MEDIANO_PLAZO_SOLES",
    currency: "PEN",
    risk: 4,
    fee: 1.35,
  },
  10: {
    name: "IF_ACCIONES_SOLES",
    currency: "PEN",
    risk: 7,
    fee: 3,
  },
  12: {
    name: "IF_INVERSION_FLEXIBLE_SOLES",
    currency: "PEN",
    risk: 2,
    fee: 1,
  },
  16: {
    name: "IF_OPORTUNIDAD_SOLES",
    currency: "PEN",
    risk: 1,
    fee: 1.05,
  },
  17: {
    name: "IF_OPORTUNIDAD_DOLARES",
    currency: "USD",
    risk: 1,
    fee: 0.8,
  },
  20: {
    name: "IF_INVERSION_GLOBAL_DOLARES",
    currency: "USD",
    risk: 7,
    fee: 1.5,
  },
  22: {
    name: "IF_LIBRE_DISPONIBILIDAD_SOLES",
    currency: "PEN",
    risk: 1,
    fee: 0.8,
  },
  24: {
    name: "IF_LIBRE_DISPONIBILIDAD_DOLARES",
    currency: "USD",
    risk: 1,
    fee: 0.6,
  },
  31: {
    name: "IF_INVERSION_EEUU_DOLARES",
    currency: "USD",
    risk: 7,
    fee: 1.5,
  },
  40: {
    name: "IF_GLOBAL_THEMATICS_DOLARES",
    currency: "USD",
    risk: 7,
    fee: 1,
  },
  49: {
    name: "IF_FUTURO_SEGURO_SOLES",
    currency: "PEN",
    risk: 2,
    fee: 1.25,
  },
  50: {
    name: "IF_ENFOQUE_LATAM_DOLARES",
    currency: "USD",
    risk: 7,
    fee: 1.2,
  },
  51: {
    name: "IF_INVERSION_INDIA_DOLARES",
    currency: "USD",
    risk: 3,
    fee: 1,
  },
  52: {
    name: "IF_ENFOQUE_MERCADOS_FRONTERAS_DOLARES",
    currency: "USD",
    risk: 3,
    fee: 1,
  },
  55: {
    name: "IF_PORTAFOLIO_DINAMICO_DOLARES",
    currency: "USD",
    risk: 4,
    fee: 1.5,
  },
  56: {
    name: "IF_PORTAFOLIO_DINAMICO_SOLES",
    currency: "PEN",
    risk: 1,
    fee: 0.7,
  },
  64: {
    name: "IF_FUTURO_SEGURO_DOLARES",
    currency: "USD",
    risk: 4,
    fee: 1.25,
  },
  84: {
    name: "IF_ENFOQUE_GLOBAL_DOLARES",
    currency: "USD",
    risk: 4,
    fee: 1,
  },
};

const ERNI_SERIE = {
  IF_OPORTUNIDAD_SOLES: "C",
  IF_OPORTUNIDAD_DOLARES: "C",
  IF_LIBRE_DISPONIBILIDAD_SOLES: "C",
  IF_LIBRE_DISPONIBILIDAD_DOLARES: "C",
};

export const ErniModel = createQuotaModel("erni");

const getErniQuota = async ({
  idFondo,
  idSerie = null,
  dtSerieIni,
  dtSerieFin,
  days = 30,
}) => {
  const range = dateRange(days);
  dtSerieIni ??= range.fromCompact;
  dtSerieFin ??= range.toCompact;

  try {
    const json = await fetchJson(ERNI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ocp-apim-subscription-key": process.env.ERNI_APIKEY,
      },
      body: JSON.stringify({
        idFondo,
        idSerie,
        dtSerieIni,
        dtSerieFin,
      }),
    });

    if (json?.code !== "SUCCESS") {
      console.error(json?.errorDetail?.message);
      return;
    }

    console.info(
      `${idFondo} ${idSerie} ${dtSerieIni} ${dtSerieFin} fetch success`
    );

    await upsertQuotas(
      ErniModel,
      json.data?.map(({ idFondo, idSerie, dtFecha, nuVcuota }) => ({
        idFondo,
        idSerie,
        date: new Date(dtFecha).toISOString().slice(0, 10),
        value: nuVcuota,
      }))
    );

    console.info(
      `${idFondo} ${idSerie} ${dtSerieIni} ${dtSerieFin} db updated`
    );
  } catch (error) {
    if (isClientError(error)) {
      throw error;
    }
    console.error(`${idFondo} ${idSerie} ${dtSerieIni} ${dtSerieFin} ${error}`);
  }
};

export const run = async ({ days }) => {
  for (const [idFondo, { name }] of Object.entries(ERNI_FONDO)) {
    await getErniQuota({
      idFondo,
      idSerie: ERNI_SERIE[name],
      days,
    });
  }
};
