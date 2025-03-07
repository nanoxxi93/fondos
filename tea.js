import { BBVA_FONDO, BbvaModel } from "./bbva.js";
import { ERNI_FONDO, ErniModel } from "./erni.js";
import { TYBA_FONDO, TybaModel } from "./tyba.js";

const sources = {
  ERNI: {
    model: ErniModel,
    FONDO: ERNI_FONDO,
  },
  BBVA: {
    model: BbvaModel,
    FONDO: BBVA_FONDO,
  },
  TYBA: {
    model: TybaModel,
    FONDO: TYBA_FONDO,
  },
};

export const tea = async ({ PERIOD = 365, CURRENCY = "USD", RISK = 4 }) => {
  const result = {};

  const query = {
    date: {
      $gte: new Date(new Date().setDate(new Date().getDate() - PERIOD)),
    },
  };

  for (const [source, { model }] of Object.entries(sources)) {
    /* Get data */
    const data = await model.find(query).sort({ date: 1 }).lean();

    /* Append data to result */
    for (const { idFondo, date, value } of data) {
      const { currency, risk } = sources[source].FONDO[idFondo];

      if (CURRENCY && currency !== CURRENCY) {
        continue;
      }

      if (risk > RISK) {
        continue;
      }

      if (value === 0) {
        continue;
      }

      const key = idFondo;

      if (!result[source]) {
        result[source] = {};
      }

      if (!result[source][key]) {
        result[source][key] = {};
      }

      const dateStr = date.toISOString().slice(0, 10);
      result[source][key][dateStr] = value;
    }
  }

  const summary = {};
  for (const [source, fondos] of Object.entries(result)) {
    for (const [fondo, dates] of Object.entries(fondos)) {
      const array = Object.entries(dates).map(([date, value]) => ({
        date,
        value,
      }));
      const filter = array.filter(({ value }) => value);
      const sort = filter.sort((a, b) => new Date(a.date) - new Date(b.date));
      const start = sort.at(0).date;
      const end = sort.at(-1).date;

      const { name, currency, risk, fee } = sources[source].FONDO[fondo];

      summary[name] = {
        var: +((dates[end] / dates[start] - 1) * (100 - fee)).toFixed(2),
        currency,
        risk,
      };
    }
  }

  return Object.entries(summary)
    .sort((a, b) => (b[1].var > a[1].var ? 1 : -1))
    .reduce(
      (acc, [name, value], index) => ({ ...acc, [index]: { ...value, name } }),
      {}
    );
};
