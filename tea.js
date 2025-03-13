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

const capitalize = (str) => {
  return str.toLowerCase().replace(/(^|\s)\S/g, (char) => char.toUpperCase());
};

const normalizeValues = (values, firstValue) => {
  const normalizedValues = [];

  let previousValue = null;

  for (const value of values) {
    firstValue = firstValue ? firstValue : values[0];

    if (value === null) {
      normalizedValues.push(previousValue);
    } else {
      const normalizedValue = ((value - firstValue) / firstValue) * 100;
      previousValue = normalizedValue;
      normalizedValues.push(normalizedValue);
    }
  }

  return normalizedValues;
};

export const tea = async ({ PERIOD = 30, CURRENCY, RISK }) => {
  const allDates = new Set();
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

      if (RISK && risk > RISK) {
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
      allDates.add(dateStr);
      result[source][key][dateStr] = value;
    }
  }

  const sortedDates = Array.from(allDates).sort();

  const summary = [];
  for (const [source, fondos] of Object.entries(result)) {
    for (const [fondo, dates] of Object.entries(fondos)) {
      const array = Object.entries(dates).map(([date, value]) => ({
        date,
        value,
      }));
      const filter = array.filter(({ value }) => value);
      const sort = filter.sort((a, b) => new Date(a.date) - new Date(b.date));
      const firstValue = sort.at(0).value;
      const lastValue = sort.at(-1).value;

      const dateMap = new Map(sort.map((entry) => [entry.date, entry.value]));
      const values = sortedDates.map((date) =>
        dateMap.has(date) ? dateMap.get(date) : null
      );

      const { name, currency, risk, fee } = sources[source].FONDO[fondo];

      summary.push({
        id: name,
        source,
        values: values,
        firstValue,
        lastValue,
        value: +((lastValue / firstValue - 1) * (100 - fee)).toFixed(2),
        currency,
        risk,
      });
    }
  }

  const labels = sortedDates;
  const datasets = summary
    .sort((a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()))
    .map(
      (
        { id, source, values, firstValue, lastValue, value, currency, risk },
        index
      ) => {
        return {
          label: capitalize(id.replace(/_/g, " ")),
          data: normalizeValues(values, firstValue),
          backgroundColor: `rgba(${Math.floor(
            Math.random() * 255
          )}, ${Math.floor(Math.random() * 255)}, ${Math.floor(
            Math.random() * 255
          )}, 0.2)`,
          borderColor: `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(
            Math.random() * 255
          )}, ${Math.floor(Math.random() * 255)}, 1)`,
          borderWidth: 1,
          hidden: true,
          meta: {
            index,
            source,
            value,
            firstValue,
            lastValue,
            currency,
            risk,
          },
        };
      }
    );

  return { labels, datasets };
};
