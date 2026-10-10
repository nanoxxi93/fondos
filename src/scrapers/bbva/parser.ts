import type { BbvaWeightedAssetValue, BbvaFundDetailData } from "./types.js";
import type { BbvaFundConfig } from "./catalog.js";
import type { IQuota } from "../../shared/models/quota.model.js";
import type { IFund } from "../../shared/models/fund.model.js";
import { toUtcMidnight, toIsoDateString, normalizeFundName } from "../../shared/utils.js";

/**
 * Normaliza los valores cuota retornados por el endpoint /past-returns
 * al modelo canónico de base de datos con fecha truncada a UTC medianoche.
 */
export function normalizeBbvaQuotas(
  idFondo: string,
  weightedValues: readonly BbvaWeightedAssetValue[]
): IQuota[] {
  return weightedValues.map((item) => ({
    idFondo,
    idSerie: null,
    date: toUtcMidnight(item.valueDate),
    value: item.valueAmount.amount,
  }));
}

/**
 * Mapea la información del catálogo base combinada con el detalle oficial
 * retornado por la API al modelo de metadatos de la colección 'funds'.
 */
export function toBbvaFundMetadata(
  catalogFund: BbvaFundConfig,
  apiDetail?: BbvaFundDetailData
): IFund {
  const rawName = apiDetail?.name?.trim() || catalogFund.name;
  const name = normalizeFundName(rawName, "bbva");
  const currency = (apiDetail?.fundCurrency?.id === "USD" ? "USD" : "PEN") as "PEN" | "USD";

  const apiRisk = apiDetail?.fundGroup?.riskLevel?.id
    ? parseInt(apiDetail.fundGroup.riskLevel.id, 10)
    : undefined;
  const risk = Number.isFinite(apiRisk) ? (apiRisk as number) : catalogFund.risk;

  const managementFeeItem = apiDetail?.fees?.itemizeFees?.find(
    (f) => f.id === "MANAGEMENT" || f.itemizeFeeUnit?.percentage !== undefined
  );
  const apiFee = managementFeeItem?.itemizeFeeUnit?.percentage;
  const fee = typeof apiFee === "number" && Number.isFinite(apiFee) ? apiFee : catalogFund.fee;

  return {
    idFondo: catalogFund.id,
    source: "bbva",
    name,
    currency,
    risk,
    fee,
    serie: "-",
    updatedAt: new Date(),
  };
}

/**
 * Calcula el rango de fechas [fromDate, toDate] en formato YYYY-MM-DD
 * para la consulta de retornos pasados.
 */
export function calculateBbvaDateRange(
  days = 30,
  customFromDate?: string,
  customToDate?: string
): { fromDate: string; toDate: string } {
  if (customFromDate && customToDate) {
    return { fromDate: customFromDate, toDate: customToDate };
  }

  const to = new Date();
  const from = new Date(to);
  from.setDate(to.getDate() - days);

  return {
    fromDate: toIsoDateString(from),
    toDate: toIsoDateString(to),
  };
}
