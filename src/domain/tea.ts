import { connectToDatabase } from "../shared/db.js";
import { FundModel, type IFund } from "../shared/models/fund.model.js";
import {
  ErniQuotaModel,
  BbvaQuotaModel,
  TybaQuotaModel,
} from "../shared/models/quota.model.js";
import {
  capitalize,
  colorFromKey,
  normalizeFundName,
  toIsoDateString,
  toUtcMidnight,
} from "../shared/utils.js";
import { BBVA_FUNDS_CATALOG } from "../scrapers/bbva/catalog.js";
import { TYBA_FUNDS_CATALOG } from "../scrapers/tyba/catalog.js";
import type { TeaChartData, TeaDataset } from "../api/types.js";
export type { TeaChartData, TeaDataset };

export interface TeaOptions {
  days?: number;
  currency?: "PEN" | "USD";
  risk?: number;
  now?: Date;
}

interface FundMeta {
  idFondo: string;
  source: "erni" | "bbva" | "tyba";
  name: string;
  currency: "PEN" | "USD";
  risk: number;
  fee: number;
}

/**
 * Catálogo estático de respaldo para fondos de ERNI (Inteligo) en caso de que
 * no hayan completado aún su sincronización en la colección 'funds'.
 */
const ERNI_FUNDS_FALLBACK: Record<string, Omit<FundMeta, "idFondo" | "source">> = {
  "01": { name: "IF_MIXTO_BALANCEADO_DOLARES", currency: "USD", risk: 7, fee: 2.0 },
  "02": { name: "IF_MEDIANO_PLAZO_DOLARES", currency: "USD", risk: 4, fee: 1.35 },
  "04": { name: "IF_MEDIANO_PLAZO_SOLES", currency: "PEN", risk: 4, fee: 1.35 },
  "10": { name: "IF_ACCIONES_SOLES", currency: "PEN", risk: 7, fee: 3.0 },
  "12": { name: "IF_INVERSION_FLEXIBLE_SOLES", currency: "PEN", risk: 2, fee: 1.0 },
  "16": { name: "IF_OPORTUNIDAD_SOLES", currency: "PEN", risk: 1, fee: 1.05 },
  "17": { name: "IF_OPORTUNIDAD_DOLARES", currency: "USD", risk: 1, fee: 0.8 },
  "20": { name: "IF_INVERSION_GLOBAL_DOLARES", currency: "USD", risk: 7, fee: 1.5 },
  "22": { name: "IF_LIBRE_DISPONIBILIDAD_SOLES", currency: "PEN", risk: 1, fee: 0.5 },
  "24": { name: "IF_LIBRE_DISPONIBILIDAD_DOLARES", currency: "USD", risk: 1, fee: 0.45 },
  "26": { name: "IF_CORTO_PLAZO_SOLES", currency: "PEN", risk: 2, fee: 0.9 },
  "28": { name: "IF_CORTO_PLAZO_DOLARES", currency: "USD", risk: 2, fee: 0.9 },
  "30": { name: "IF_ESTRUCTURADO_I", currency: "USD", risk: 3, fee: 1.0 },
  "32": { name: "IF_ESTRUCTURADO_II", currency: "USD", risk: 3, fee: 1.0 },
  "34": { name: "IF_ESTRUCTURADO_III", currency: "USD", risk: 3, fee: 1.0 },
  "36": { name: "IF_ESTRUCTURADO_IV", currency: "USD", risk: 3, fee: 1.0 },
  "38": { name: "IF_ESTRUCTURADO_V", currency: "USD", risk: 3, fee: 1.0 },
  "40": { name: "IF_ESTRUCTURADO_VI", currency: "USD", risk: 3, fee: 1.0 },
  "56": { name: "IF_ACCIONES_FMIV", currency: "PEN", risk: 7, fee: 2.2 },
};

/**
 * Resuelve los metadatos de un fondo consultando el mapa de base de datos
 * y recurriendo a los catálogos estáticos canónicos en caso de fondos no sincronizados.
 */
function resolveFundMetadata(
  source: "erni" | "bbva" | "tyba",
  idFondo: string,
  dbFundMap: Map<string, IFund>
): FundMeta | null {
  const dbKey = `${source}:${idFondo}`;
  const fromDb = dbFundMap.get(dbKey);
  if (fromDb) {
    let fee = fromDb.fee;
    // Si la fuente es Tyba y la comisión en BD provino en ratio decimal (<= 0.20), normalizar a porcentaje
    if (source === "tyba" && fee <= 0.2 && fee > 0) {
      fee = Number(+(fee * 100).toFixed(4));
    }
    return {
      idFondo,
      source,
      name: normalizeFundName(fromDb.name, source),
      currency: fromDb.currency,
      risk: fromDb.risk,
      fee,
    };
  }

  // Fallback a catálogos estáticos
  if (source === "bbva") {
    const bbvaConfig = BBVA_FUNDS_CATALOG[idFondo];
    if (bbvaConfig) {
      return {
        idFondo,
        source: "bbva",
        name: normalizeFundName(bbvaConfig.name, "bbva"),
        currency: bbvaConfig.currency,
        risk: bbvaConfig.risk,
        fee: bbvaConfig.fee,
      };
    }
  } else if (source === "tyba") {
    const tybaConfig = TYBA_FUNDS_CATALOG[idFondo];
    if (tybaConfig) {
      return {
        idFondo,
        source: "tyba",
        name: normalizeFundName(tybaConfig.name, "tyba"),
        currency: tybaConfig.currency,
        risk: tybaConfig.risk,
        fee: tybaConfig.fee,
      };
    }
  } else if (source === "erni") {
    const erniConfig = ERNI_FUNDS_FALLBACK[idFondo];
    if (erniConfig) {
      return {
        idFondo,
        source: "erni",
        name: normalizeFundName(erniConfig.name, "erni"),
        currency: erniConfig.currency,
        risk: erniConfig.risk,
        fee: erniConfig.fee,
      };
    }
  }

  return null;
}

/**
 * Calcula la variación neta de comisión (TEA) y genera los datasets
 * estructurados compatibles con Chart.js para el periodo seleccionado.
 */
export async function calculateTea(options: TeaOptions = {}): Promise<TeaChartData> {
  const days = options.days ?? 30;
  const nowUtc = toUtcMidnight(options.now ?? new Date());
  const since = new Date(nowUtc.getTime() - days * 86_400_000);

  await connectToDatabase();

  const [erniDocs, bbvaDocs, tybaDocs, dbFunds] = await Promise.all([
    ErniQuotaModel.find({ date: { $gte: since } }).sort({ date: 1 }).lean(),
    BbvaQuotaModel.find({ date: { $gte: since } }).sort({ date: 1 }).lean(),
    TybaQuotaModel.find({ date: { $gte: since } }).sort({ date: 1 }).lean(),
    FundModel.find().lean(),
  ]);

  const dbFundMap = new Map<string, IFund>();
  for (const fund of dbFunds) {
    dbFundMap.set(`${fund.source.toLowerCase()}:${fund.idFondo}`, fund);
  }

  const allDates = new Set<string>();
  const fundSeriesMap = new Map<
    string,
    {
      meta: FundMeta;
      quotes: Map<string, number>;
    }
  >();

  const sourcesData: Array<{
    source: "erni" | "bbva" | "tyba";
    docs: Array<{ idFondo: string; date: Date; value: number }>;
  }> = [
    { source: "erni", docs: erniDocs },
    { source: "bbva", docs: bbvaDocs },
    { source: "tyba", docs: tybaDocs },
  ];

  for (const { source, docs } of sourcesData) {
    for (const { idFondo, date, value } of docs) {
      if (!value || value === 0) {
        continue;
      }

      const meta = resolveFundMetadata(source, idFondo, dbFundMap);
      if (!meta) {
        continue;
      }

      if (options.currency && meta.currency !== options.currency) {
        continue;
      }
      if (options.risk !== undefined && meta.risk > options.risk) {
        continue;
      }

      const seriesKey = `${source}:${idFondo}`;
      let series = fundSeriesMap.get(seriesKey);
      if (!series) {
        series = { meta, quotes: new Map<string, number>() };
        fundSeriesMap.set(seriesKey, series);
      }

      const dateStr = toIsoDateString(date);
      allDates.add(dateStr);
      series.quotes.set(dateStr, value);
    }
  }

  const sortedDates = Array.from(allDates).sort();
  const datasets: TeaDataset[] = [];

  for (const { meta, quotes } of fundSeriesMap.values()) {
    const sortedQuotes = Array.from(quotes.entries()).sort(([a], [b]) => a.localeCompare(b));
    if (sortedQuotes.length === 0) {
      continue;
    }

    const firstValue = sortedQuotes[0][1];
    const lastValue = sortedQuotes[sortedQuotes.length - 1][1];
    if (firstValue === 0) {
      continue;
    }

    const netValue = Number(+((lastValue / firstValue - 1) * (100 - meta.fee)).toFixed(2));

    const values: (number | null)[] = sortedDates.map((date) => {
      const val = quotes.get(date);
      if (val === undefined || val === null) {
        return null;
      }
      return Number((((val - firstValue) / firstValue) * 100).toFixed(4));
    });

    const normalizedName = normalizeFundName(meta.name, meta.source);
    const colors = colorFromKey(`${meta.source}:${normalizedName}`);
    const label = capitalize(normalizedName.replace(/_/g, " "));

    datasets.push({
      label,
      data: values,
      backgroundColor: colors.backgroundColor,
      borderColor: colors.borderColor,
      borderWidth: 1,
      pointRadius: 1,
      hidden: true,
      meta: {
        index: 0,
        idFondo: meta.idFondo,
        source: meta.source,
        value: netValue,
        firstValue,
        lastValue,
        fee: meta.fee,
        currency: meta.currency,
        risk: meta.risk,
      },
    });
  }

  // Ordenar datasets alfabéticamente por etiqueta
  datasets.sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
  datasets.forEach((ds, index) => {
    ds.meta.index = index;
  });

  return { labels: sortedDates, datasets };
}
