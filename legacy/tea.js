import { BBVA_FONDO, BbvaModel } from "./bbva.js";
import { ERNI_FONDO, ErniModel } from "./erni.js";
import { TYBA_FONDO, TybaModel } from "./tyba.js";
import { capitalize, colorFromKey } from "./utils.js";

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

const normalizeValues = (values, firstValue) =>
  values.map((value) =>
    value === null ? null : ((value - firstValue) / firstValue) * 100
  );

export const tea = async ({ DAYS = 30, CURRENCY, RISK }) => {
  const allDates = new Set();
  const result = {};
  const since = new Date();
  since.setDate(since.getDate() - DAYS);

  const query = {
    date: { $gte: since },
  };

  for (const [source, { model, FONDO }] of Object.entries(sources)) {
    const data = await model.find(query).sort({ date: 1 }).lean();

    for (const { idFondo, date, value } of data) {
      const fondo = FONDO[idFondo];
      if (!fondo || value === 0) {
        continue;
      }

      const { currency, risk } = fondo;
      if (CURRENCY && currency !== CURRENCY) {
        continue;
      }
      if (RISK !== undefined && risk > RISK) {
        continue;
      }

      result[source] ??= {};
      result[source][idFondo] ??= {};

      const dateStr = date.toISOString().slice(0, 10);
      allDates.add(dateStr);
      result[source][idFondo][dateStr] = value;
    }
  }

  const sortedDates = Array.from(allDates).sort();
  const summary = [];

  for (const [source, fondos] of Object.entries(result)) {
    for (const [fondo, dates] of Object.entries(fondos)) {
      const series = Object.entries(dates)
        .filter(([, value]) => value)
        .sort(([a], [b]) => a.localeCompare(b));

      if (series.length === 0) {
        continue;
      }

      const firstValue = series[0][1];
      const lastValue = series.at(-1)[1];
      const dateMap = new Map(series);
      const values = sortedDates.map((date) =>
        dateMap.has(date) ? dateMap.get(date) : null
      );

      const { name, currency, risk, fee } = sources[source].FONDO[fondo];

      summary.push({
        id: name,
        source,
        values,
        firstValue,
        lastValue,
        value: +((lastValue / firstValue - 1) * (100 - fee)).toFixed(2),
        currency,
        risk,
      });
    }
  }

  const datasets = summary
    .sort((a, b) => a.id.toLowerCase().localeCompare(b.id.toLowerCase()))
    .map(
      (
        { id, source, values, firstValue, lastValue, value, currency, risk },
        index
      ) => {
        const colors = colorFromKey(`${source}:${id}`);
        return {
          label: capitalize(id.replace(/_/g, " ")),
          data: normalizeValues(values, firstValue),
          backgroundColor: colors.backgroundColor,
          borderColor: colors.borderColor,
          borderWidth: 1,
          pointRadius: 1,
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

  return { labels: sortedDates, datasets };
};
