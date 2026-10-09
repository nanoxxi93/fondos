import { Value } from "@sinclair/typebox/value";
import {
  FondosActivosResponseSchema,
  InvertirResponseSchema,
  type FondosActivosResponse,
  type InvertirResponse,
} from "./types.js";

const BASE_URL_ONBOARDING =
  process.env.INTELIGO_ONBOARDING_URL ||
  "https://apiv2.inteligogroup.com/onboarding-corp/v1/fondos/fondos-activos";

const BASE_URL_ERNI =
  process.env.INTELIGO_ERNI_URL ||
  "https://apiv2.inteligogroup.com/erni-api/v1/fondo";

export interface FetchInvertirParams {
  idFondo: string;
  serieCodigo: string;
  montoInversion?: number;
  tiempoMeses?: number;
}

/**
 * Consulta la API de Inteligo para obtener el catálogo completo de fondos mutuos activos.
 */
export async function fetchFondosActivos(apiKey: string): Promise<FondosActivosResponse> {
  const response = await fetch(BASE_URL_ONBOARDING, {
    method: "GET",
    headers: {
      "ocp-apim-subscription-key": apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Error al consultar fondos activos de Inteligo: HTTP ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();

  if (!Value.Check(FondosActivosResponseSchema, json)) {
    const errors = [...Value.Errors(FondosActivosResponseSchema, json)]
      .map((e) => `${e.path}: ${e.message}`)
      .join(", ");
    throw new Error(
      `La respuesta de fondos-activos no coincide con el esquema esperado: ${errors}`
    );
  }

  return json;
}

/**
 * Consulta la serie histórica diaria de valores cuota para un fondo específico de ERNI.
 */
export async function fetchFondoInvertir(
  apiKey: string,
  params: FetchInvertirParams
): Promise<InvertirResponse> {
  const { idFondo, serieCodigo, montoInversion = 500, tiempoMeses = 1 } = params;

  const url = `${BASE_URL_ERNI}/${encodeURIComponent(
    idFondo
  )}/invertir?SerieCodigo=${encodeURIComponent(
    serieCodigo
  )}&MontoInversion=${montoInversion}&TiempoMeses=${tiempoMeses}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "ocp-apim-subscription-key": apiKey,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Error al consultar cuotas de inversión para fondo ${idFondo} (Serie ${serieCodigo}): HTTP ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();

  if (!Value.Check(InvertirResponseSchema, json)) {
    const errors = [...Value.Errors(InvertirResponseSchema, json)]
      .map((e) => `${e.path}: ${e.message}`)
      .join(", ");
    throw new Error(
      `La respuesta de /invertir para fondo ${idFondo} no coincide con el esquema: ${errors}`
    );
  }

  return json;
}
