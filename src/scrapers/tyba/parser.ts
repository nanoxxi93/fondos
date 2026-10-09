import type { TybaHistoricPoint, TybaPortfolioItem } from './types.js';
import type { ITybaCatalogEntry } from './catalog.js';
import type { IQuota } from '../../shared/models/quota.model.js';
import type { IFund } from '../../shared/models/fund.model.js';
import { toUtcMidnight } from '../../shared/utils.js';

/**
 * Normaliza y sanea el token de autorización eliminando el prefijo 'Bearer '
 * si estuviese presente y espacios en blanco al inicio o final.
 */
export function sanitizeAuthToken(raw?: string): string {
  if (!raw) {
    return '';
  }
  return raw.replace(/^Bearer\s+/i, '').trim();
}

/**
 * Resuelve la cabecera criptográfica de la app desde xAppProof o x-app-proof.
 */
export function resolveAppProof(event?: Record<string, any>): string {
  if (!event) {
    return '';
  }
  const proof = event.xAppProof ?? event['x-app-proof'] ?? '';
  return typeof proof === 'string' ? proof.trim() : '';
}

/**
 * Resuelve el token de actualización opcional desde refreshToken o refresh-token.
 */
export function resolveRefreshToken(event?: Record<string, any>): string | undefined {
  if (!event) {
    return undefined;
  }
  const token = event.refreshToken ?? event['refresh-token'];
  if (typeof token === 'string' && token.trim().length > 0) {
    return token.trim();
  }
  return undefined;
}

/**
 * Mapea el nivel de riesgo textual ('LOW', 'MEDIUM', 'HIGH', 'Bajo', 'Medio', 'Alto')
 * a la escala numérica 1 a 7 estándar del proyecto.
 */
export function mapRiskLevel(risk?: string, riskLevel?: string, fallback = 4): number {
  const normalized = (riskLevel ?? risk ?? '').toUpperCase().trim();
  if (normalized === 'LOW' || normalized === 'BAJO') {
    return 1;
  }
  if (normalized === 'MEDIUM' || normalized === 'MEDIO') {
    return 4;
  }
  if (normalized === 'HIGH' || normalized === 'ALTO') {
    return 7;
  }
  return fallback;
}

/**
 * Mapea los metadatos de un portafolio retornado por /v2/portfolios/sqi al modelo IFund
 * de la colección 'funds' de MongoDB Atlas.
 */
export function mapPortfolioMetadata(
  item: TybaPortfolioItem,
  catalogFallback?: ITybaCatalogEntry
): IFund {
  const name = item.name?.trim() || catalogFallback?.name || item.id;
  const currency = item.currency === 'PEN' ? 'PEN' : 'USD';
  const risk = mapRiskLevel(item.risk, item.riskLevel, catalogFallback?.risk ?? 4);
  const fee =
    typeof item.comission === 'number' && Number.isFinite(item.comission)
      ? item.comission
      : catalogFallback?.fee ?? 0;

  return {
    idFondo: item.id,
    source: 'tyba',
    name,
    currency,
    risk,
    fee,
    serie: '-',
    updatedAt: new Date(),
  };
}

/**
 * Normaliza las observaciones de rendimiento histórico al modelo canónico IQuota.
 * Aplica recorte `.slice(-days)` (por defecto 30 elementos) replicando fielmente
 * el comportamiento del código legado, o conserva todo el arreglo si all === true.
 */
export function normalizeHistoricQuotas(
  idFondo: string,
  points: readonly TybaHistoricPoint[],
  days = 30,
  all = false
): IQuota[] {
  if (!points || points.length === 0) {
    return [];
  }

  const selectedPoints = all ? points : points.slice(-days);

  return selectedPoints.map((point) => ({
    idFondo,
    idSerie: null,
    date: toUtcMidnight(point.interval),
    value: Number(point.value),
  }));
}
