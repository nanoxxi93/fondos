import type { FondosActivosItem, CuotaItem, TarifarioItem } from "./types.js";
import type { IQuota } from "../../shared/models/quota.model.js";
import type { IFund } from "../../shared/models/fund.model.js";
import { toUtcMidnight, normalizeFundName, toIsoDateString } from "../../shared/utils.js";

export interface ActiveSerieSelection {
  serie: string;
  fee: number;
  isDigital: boolean;
}

/**
 * Selecciona la serie activa de un fondo priorizando la alternativa digital
 * (Serie C con menor comisión en fondos 16, 17, 22 y 24), con fallback al primer
 * tarifario disponible (Serie A para fondos presenciales como el 56, o '-' para estándar).
 */
export function selectActiveSerie(fondo: FondosActivosItem): ActiveSerieSelection | null {
  const tarifarios = fondo.tarifarios;
  if (!tarifarios || tarifarios.length === 0) {
    return null;
  }

  // Prioridad 1: Buscar serie explícitamente digital
  const digitalTarifario = tarifarios.find(
    (t: TarifarioItem) => t.isDigital === true || t.serie?.isDigital === true
  );

  if (digitalTarifario && digitalTarifario.serie?.serie) {
    return {
      serie: digitalTarifario.serie.serie,
      fee: digitalTarifario.comisionUnificada ?? 0,
      isDigital: true,
    };
  }

  // Prioridad 2: Fallback al primer tarifario disponible
  const primerTarifario = tarifarios[0];
  if (primerTarifario?.serie?.serie) {
    return {
      serie: primerTarifario.serie.serie,
      fee: primerTarifario.comisionUnificada ?? 0,
      isDigital: false,
    };
  }

  return null;
}

/**
 * Filtra los fondos activos que cuentan con tarifarios y valor cuota operativo,
 * descartando fondos cerrados, en estructuración o inactivos (ej. fondo 41).
 */
export function filterActiveFunds(fondos: readonly FondosActivosItem[]): FondosActivosItem[] {
  return fondos.filter((fondo) => {
    // Si no tiene tarifarios o están vacíos, descartar
    if (!fondo.tarifarios || fondo.tarifarios.length === 0) {
      return false;
    }

    // Si el valor cuota es 0 o no tiene serie válida, descartar
    if (fondo.valorCuota !== undefined && fondo.valorCuota <= 0) {
      return false;
    }

    const serieSelection = selectActiveSerie(fondo);
    return serieSelection !== null;
  });
}

/**
 * Normaliza las cuotas crudas retornadas por el endpoint /invertir
 * al modelo canónico de base de datos con fecha truncada a UTC.
 */
export function normalizeQuotas(
  idFondo: string,
  idSerie: string,
  cuotas: readonly CuotaItem[]
): IQuota[] {
  return cuotas.map((cuota) => ({
    idFondo,
    idSerie,
    date: toUtcMidnight(cuota.fecha),
    value: cuota.numeroValorCuota,
  }));
}

/**
 * Mapea un fondo activo al modelo de metadatos de catálogo de la colección 'funds'.
 */
export function toFundMetadata(
  fondo: FondosActivosItem,
  serieInfo: ActiveSerieSelection
): IFund {
  const isUsd =
    fondo.moneda.idMoneda === "10" ||
    fondo.moneda.nombreMoneda?.toLowerCase().includes("dolar");

  return {
    idFondo: fondo.idFondo,
    source: "erni",
    name: normalizeFundName(fondo.nombreFondo, "erni"),
    currency: isUsd ? "USD" : "PEN",
    risk: fondo.riesgo.idRiesgo,
    fee: serieInfo.fee,
    serie: serieInfo.serie,
    updatedAt: new Date(),
  };
}

/**
 * Calcula el rango de fechas [fromDate, toDate] en formato YYYY-MM-DD
 * para la consulta de retornos pasados.
 */
export function calculateDateRange(
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
