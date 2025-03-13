"use strict";

import mongoose, { Schema } from "mongoose";

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
  50: {
    name: "IF_ENFOQUE_LATAM_DOLARES",
    currency: "USD",
    risk: 7,
    fee: 1.2,
  },
  55: {
    name: "IF_PORTAFOLIO_DINAMICO_DOLARES",
    currency: "USD",
    risk: 4,
    fee: 1.5,
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

const ErniSchema = new Schema({
  idFondo: { type: String, trim: true },
  idSerie: { type: String, trim: true },
  date: { type: Date },
  value: { type: Number },
});
ErniSchema.index({ idFondo: 1, idSerie: 1, date: 1 }, { unique: true });

export const ErniModel = mongoose.model("erni", ErniSchema);

const getErniQuota = async ({
  idFondo,
  idSerie = null,
  dtSerieIni,
  dtSerieFin,
  days = 30,
}) => {
  const today = new Date();
  const prevDate = new Date(new Date().setDate(today.getDate() - days));

  if (!dtSerieIni) {
    dtSerieIni = prevDate.toISOString().slice(0, 10).replaceAll("-", "");
  }
  if (!dtSerieFin) {
    dtSerieFin = today.toISOString().slice(0, 10).replaceAll("-", "");
  }

  try {
    const res = await fetch(ERNI_URL, {
      method: "POST",
      headers: {
        "ocp-apim-subscription-key": process.env.ERNI_APIKEY,
      },
      body: JSON.stringify({
        idFondo,
        idSerie,
        dtSerieIni,
        dtSerieFin,
      }),
    });

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    if (json?.code !== "SUCCESS") {
      console.error(json?.errorDetail?.message);
      return undefined;
    }

    console.info(
      `${idFondo} ${idSerie} ${dtSerieIni} ${dtSerieFin} fetch success`
    );

    await Promise.all(
      json.data?.map(
        async ({ idFondo, idSerie, dtFecha, nuVcuota }) =>
          await ErniModel.updateOne(
            {
              idFondo,
              idSerie,
              date: new Date(dtFecha).toISOString().slice(0, 10),
            },
            {
              $set: {
                value: nuVcuota,
              },
            },
            {
              upsert: true,
            }
          )
      )
    );

    console.info(
      `${idFondo} ${idSerie} ${dtSerieIni} ${dtSerieFin} db updated`
    );
  } catch (error) {
    if (error.message.startsWith("4")) {
      throw error;
    }
    console.error(`${idFondo} ${idSerie} ${dtSerieIni} ${dtSerieFin} ${error}`);
    return undefined;
  }
};

export const run = async ({ days }) => {
  for (let [idFondo, { name }] of Object.entries(ERNI_FONDO)) {
    const idSerie = ERNI_SERIE[name];
    idFondo = idFondo.toString();
    await getErniQuota({
      idFondo,
      idSerie,
      days,
    });
  }
  // await Promise.all(
  //   Object.entries(ERNI_FONDO).map(async ([idFondo, { name }]) => {
  //     const idSerie = ERNI_SERIE[name];
  //     idFondo = idFondo.toString();
  //     await getErniQuota({
  //       idFondo,
  //       idSerie,
  //       days,
  //     });
  //   })
  // );
};
