import { Value } from "@sinclair/typebox/value";
import {
  BbvaFundDetailResponseSchema,
  BbvaPastReturnsResponseSchema,
  type BbvaFundDetailResponse,
  type BbvaPastReturnsResponse,
  type BbvaAuthBody,
} from "./types.js";

const BBVA_AUTH_URL =
  process.env.BBVA_AUTH_URL ||
  "https://www.bbva.es/ASO/TechArchitecture/grantingTickets/V02";

const BBVA_FUNDS_BASE_URL =
  process.env.BBVA_FUNDS_BASE_URL ||
  "https://www.bbva.es/ASO/management-entity-funds/v1/management-entities-funds";

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

interface CachedToken {
  token: string;
  expiresAt: number;
}

let cachedTsec: CachedToken | null = null;

export interface BbvaAuthCredentials {
  consumerID?: string;
  userID?: string;
  password?: string;
}

/**
 * Invalida el token TSEC almacenado en memoria.
 */
export function invalidateBbvaTsec(): void {
  cachedTsec = null;
}

/**
 * Obtiene el cuerpo de autenticación JSON para solicitar tickets ASO.
 */
function buildAuthBody(credentials?: BbvaAuthCredentials): BbvaAuthBody {
  return {
    authentication: {
      consumerID: credentials?.consumerID || process.env.BBVA_CONSUMER_ID || "30000032",
      userID: credentials?.userID || process.env.BBVA_USER_ID || "IMMH032",
      authenticationType: "04",
      authenticationData: [
        {
          authenticationData: [
            credentials?.password || process.env.BBVA_PASSWORD || "qMT78Y63",
          ],
          idAuthenticationData: "password",
        },
      ],
    },
  };
}

/**
 * Obtiene un token TSEC válido desde el endpoint grantingTickets/V02.
 * Si ya existe uno en caché no expirado (TTL de 4 minutos), lo reutiliza.
 */
export async function getBbvaTsec(credentials?: BbvaAuthCredentials): Promise<string> {
  const now = Date.now();
  if (cachedTsec && cachedTsec.expiresAt > now) {
    return cachedTsec.token;
  }

  const authBody = buildAuthBody(credentials);

  const response = await fetch(BBVA_AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": DEFAULT_USER_AGENT,
    },
    body: JSON.stringify(authBody),
  });

  if (!response.ok) {
    throw new Error(
      `Error al obtener TSEC de BBVA: HTTP ${response.status} ${response.statusText}`
    );
  }

  const tsec = response.headers.get("tsec");
  if (!tsec) {
    throw new Error("La respuesta de grantingTickets no contiene la cabecera 'tsec'");
  }

  // Token válido por 4 minutos (240 segundos) para margen de seguridad
  cachedTsec = {
    token: tsec,
    expiresAt: now + 240 * 1000,
  };

  return tsec;
}

/**
 * Genera las cabeceras HTTP estándar requeridas por la API ASO de BBVA.
 */
function getBbvaHeaders(tsec: string): Record<string, string> {
  return {
    Accept: "application/json, text/plain, */*; q=0.01",
    "Accept-Language": "es-ES,es;q=0.9",
    "Content-Type": "application/json",
    tsec,
    Referer: "https://producto.bbvaassetmanagement.com/",
    Origin: "https://producto.bbvaassetmanagement.com",
    "User-Agent": DEFAULT_USER_AGENT,
  };
}

/**
 * Consulta los metadatos oficiales de un fondo desde el endpoint de gestión de fondos.
 */
export async function fetchFundDetail(
  idFondo: string,
  explicitTsec?: string
): Promise<BbvaFundDetailResponse> {
  let tsec = explicitTsec || (await getBbvaTsec());
  const url = `${BBVA_FUNDS_BASE_URL}/${encodeURIComponent(idFondo)}`;

  let response = await fetch(url, {
    method: "GET",
    headers: getBbvaHeaders(tsec),
  });

  // Reintento automático ante expiración o rechazo de ticket (HTTP 401 / 403)
  if ((response.status === 401 || response.status === 403) && !explicitTsec) {
    invalidateBbvaTsec();
    tsec = await getBbvaTsec();
    response = await fetch(url, {
      method: "GET",
      headers: getBbvaHeaders(tsec),
    });
  }

  if (!response.ok) {
    throw new Error(
      `Error al consultar detalle del fondo BBVA ${idFondo}: HTTP ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();

  if (!Value.Check(BbvaFundDetailResponseSchema, json)) {
    const errors = [...Value.Errors(BbvaFundDetailResponseSchema, json)]
      .map((e) => `${e.path}: ${e.message}`)
      .join(", ");
    throw new Error(
      `La respuesta de detalle del fondo BBVA ${idFondo} no cumple con el esquema: ${errors}`
    );
  }

  return json;
}

export interface FetchPastReturnsParams {
  idFondo: string;
  currency: "PEN" | "USD";
  fromDate: string;
  toDate: string;
}

/**
 * Consulta la serie histórica de valores cuota diarios para un fondo mutuo de BBVA.
 */
export async function fetchPastReturns(
  params: FetchPastReturnsParams,
  explicitTsec?: string
): Promise<BbvaPastReturnsResponse> {
  const { idFondo, currency, fromDate, toDate } = params;
  let tsec = explicitTsec || (await getBbvaTsec());
  const url = `${BBVA_FUNDS_BASE_URL}/past-returns`;

  const body = {
    funds: [{ id: idFondo, weight: 100 }],
    period: { fromDate, toDate },
    assetValuesCurrency: { id: currency },
  };

  let response = await fetch(url, {
    method: "POST",
    headers: getBbvaHeaders(tsec),
    body: JSON.stringify(body),
  });

  // Reintento automático ante expiración o rechazo de ticket (HTTP 401 / 403)
  if ((response.status === 401 || response.status === 403) && !explicitTsec) {
    invalidateBbvaTsec();
    tsec = await getBbvaTsec();
    response = await fetch(url, {
      method: "POST",
      headers: getBbvaHeaders(tsec),
      body: JSON.stringify(body),
    });
  }

  if (!response.ok) {
    throw new Error(
      `Error al consultar retornos pasados del fondo BBVA ${idFondo} (${currency}): HTTP ${response.status} ${response.statusText}`
    );
  }

  const json = await response.json();

  if (!Value.Check(BbvaPastReturnsResponseSchema, json)) {
    const errors = [...Value.Errors(BbvaPastReturnsResponseSchema, json)]
      .map((e) => `${e.path}: ${e.message}`)
      .join(", ");
    throw new Error(
      `La respuesta de /past-returns para fondo BBVA ${idFondo} no cumple con el esquema: ${errors}`
    );
  }

  return json;
}
