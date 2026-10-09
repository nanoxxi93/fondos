import { Value } from '@sinclair/typebox/value';
import {
  TybaPortfoliosResponseSchema,
  TybaHistoricPerformanceResponseSchema,
  TybaRefreshTokenResponseSchema,
  type TybaPortfoliosResponse,
  type TybaHistoricPerformanceResponse,
} from './types.js';
import { sanitizeAuthToken } from './parser.js';
import { generateAppProof } from './crypto.js';

const TYBA_PORTFOLIOS_URL =
  process.env.TYBA_PORTFOLIOS_URL ||
  'https://tyba.io/api-master/robo-advisor/v2/portfolios/sqi?product=PARKER&orderByProfitability=true';

const TYBA_HISTORIC_URL = (id: string) =>
  process.env.TYBA_HISTORIC_BASE_URL
    ? `${process.env.TYBA_HISTORIC_BASE_URL}/${id}/historic-performance`
    : `https://tyba.io/api-master/robo-advisor/portfolios/${id}/historic-performance`;

const TYBA_REFRESH_TOKEN_URL =
  process.env.TYBA_REFRESH_TOKEN_URL ||
  'https://tyba.io/api-master/auth/refresh-token';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export interface TybaApiHeadersOptions {
  authorization: string;
  appProof?: string;
  method?: string;
  route?: string;
}

/**
 * Genera las cabeceras requeridas para interactuar con los endpoints privados de Tyba.
 * Si no se provee 'appProof', se genera criptográficamente al vuelo con la clave RSA de Tyba.
 */
export function buildTybaHeaders({
  authorization,
  appProof,
  method = 'GET',
  route = '/robo-advisor/v2/portfolios/sqi',
}: TybaApiHeadersOptions): Record<string, string> {
  const finalProof =
    appProof && appProof.trim().length > 0
      ? appProof.trim()
      : generateAppProof(method, route);

  return {
    accept: 'application/json',
    'content-type': 'application/json',
    authorization: sanitizeAuthToken(authorization),
    'x-app-proof': finalProof,
    referrer: 'https://web.tyba.pe/',
    'user-agent': DEFAULT_USER_AGENT,
  };
}

/**
 * Consulta el endpoint de catálogo de portafolios de Tyba (/v2/portfolios/sqi).
 * Valida la estructura mediante TypeBox y arroja error si la API responde con fallo.
 */
export async function fetchPortfoliosCatalog(
  authorization: string,
  appProof?: string
): Promise<TybaPortfoliosResponse> {
  const headers = buildTybaHeaders({
    authorization,
    appProof,
    method: 'GET',
    route: '/robo-advisor/v2/portfolios/sqi',
  });

  const res = await fetch(TYBA_PORTFOLIOS_URL, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    const err = new Error(
      `Fallo en catálogo de Tyba HTTP ${res.status} ${res.statusText}: ${errorText}`
    );
    (err as any).status = res.status;
    throw err;
  }

  const json = await res.json();

  if (!Value.Check(TybaPortfoliosResponseSchema, json)) {
    const errors = [...Value.Errors(TybaPortfoliosResponseSchema, json)]
      .map((e) => `${e.path}: ${e.message}`)
      .join(', ');
    throw new Error(`Respuesta de catálogo de Tyba no cumple el contrato esperado: ${errors}`);
  }

  return json as TybaPortfoliosResponse;
}

/**
 * Consulta el historial de rendimiento de un fondo en Tyba (/portfolios/{id}/historic-performance).
 * Valida la presencia de graphData mediante TypeBox.
 */
export async function fetchHistoricPerformance(
  idFondo: string,
  authorization: string,
  appProof?: string
): Promise<TybaHistoricPerformanceResponse> {
  const url = TYBA_HISTORIC_URL(idFondo);
  const route = `/robo-advisor/portfolios/${idFondo}/historic-performance`;
  const headers = buildTybaHeaders({
    authorization,
    appProof,
    method: 'GET',
    route,
  });

  const res = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    const err = new Error(
      `Fallo en histórico de Tyba para fondo ${idFondo} HTTP ${res.status} ${res.statusText}: ${errorText}`
    );
    (err as any).status = res.status;
    throw err;
  }

  const json = await res.json();

  if (!Value.Check(TybaHistoricPerformanceResponseSchema, json)) {
    const errors = [...Value.Errors(TybaHistoricPerformanceResponseSchema, json)]
      .map((e) => `${e.path}: ${e.message}`)
      .join(', ');
    throw new Error(
      `Respuesta de histórico de Tyba para fondo ${idFondo} no cumple el contrato esperado: ${errors}`
    );
  }

  return json as TybaHistoricPerformanceResponse;
}

/**
 * Solicita un nuevo token de acceso a la API de Tyba utilizando el refreshToken.
 * Valida la respuesta con TypeBox y retorna el nuevo token de autorización saneado.
 */
export async function refreshAuthToken(refreshToken: string): Promise<string> {
  const cleanRefreshToken = refreshToken.trim();
  const res = await fetch(TYBA_REFRESH_TOKEN_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'accept-language': 'es;q=0.6',
      'content-type': 'application/json',
      referrer: 'https://web.tyba.pe/',
      'user-agent': DEFAULT_USER_AGENT,
    },
    body: JSON.stringify({ refreshToken: cleanRefreshToken }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    const err = new Error(
      `Fallo al refrescar token de Tyba HTTP ${res.status} ${res.statusText}: ${errorText}`
    );
    (err as any).status = res.status;
    throw err;
  }

  const json = await res.json();

  if (!Value.Check(TybaRefreshTokenResponseSchema, json)) {
    const errors = [...Value.Errors(TybaRefreshTokenResponseSchema, json)]
      .map((e) => `${e.path}: ${e.message}`)
      .join(', ');
    throw new Error(`Respuesta de refresh-token de Tyba no cumple el contrato esperado: ${errors}`);
  }

  return sanitizeAuthToken(json.token);
}
