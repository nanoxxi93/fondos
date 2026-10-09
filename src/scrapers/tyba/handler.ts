import { Value } from '@sinclair/typebox/value';
import { connectToDatabase } from '../../shared/db.js';
import { getConfig } from '../../shared/config.js';
import { pMap } from '../../shared/utils.js';
import { TybaQuotaModel } from '../../shared/models/quota.model.js';
import { FundModel } from '../../shared/models/fund.model.js';
import { TYBA_FUNDS_CATALOG } from './catalog.js';
import {
  fetchPortfoliosCatalog,
  fetchHistoricPerformance,
  refreshAuthToken,
} from './client.js';
import {
  sanitizeAuthToken,
  resolveAppProof,
  resolveRefreshToken,
  mapPortfolioMetadata,
  normalizeHistoricQuotas,
} from './parser.js';
import {
  TybaLambdaEventSchema,
  type TybaLambdaEvent,
  type TybaLambdaResult,
} from './types.js';

/**
 * AWS Lambda Handler principal para la ingesta serverless de Tyba (Credicorp Capital).
 * Ejecutado manualmente pasando cabeceras de sesión de usuario en el evento.
 */
export async function handler(event?: TybaLambdaEvent): Promise<TybaLambdaResult> {
  // 1. Validar parámetros obligatorios de entrada
  const rawAuth = event?.authorization;
  const rawProof = resolveAppProof(event);
  const refreshToken = resolveRefreshToken(event);
  const authorization = sanitizeAuthToken(rawAuth);
  const appProof = rawProof && rawProof.length >= 20 ? rawProof : undefined;

  if (!authorization || authorization.length < 20) {
    const error = new Error(
      "Error de validación 400: Se requiere 'authorization' válido en el evento de invocación."
    );
    (error as any).statusCode = 400;
    throw error;
  }

  const days = event?.days ?? 30;
  const all = Boolean(event?.all);
  const syncCatalog = event?.syncCatalog !== false;

  // Estado mutable del token de autorización durante la ejecución
  let currentAuth = authorization;
  let refreshPromise: Promise<string> | null = null;

  async function getRefreshedToken(): Promise<string> {
    if (!refreshToken) {
      throw new Error(
        'Sesión de Tyba expirada (HTTP 401) y no se proveyó refreshToken en el evento de invocación.'
      );
    }
    if (!refreshPromise) {
      refreshPromise = refreshAuthToken(refreshToken)
        .then((newToken) => {
          console.info('Token de Tyba autorefrescado exitosamente.');
          currentAuth = newToken;
          refreshPromise = null;
          return newToken;
        })
        .catch((err) => {
          refreshPromise = null;
          throw err;
        });
    }
    return refreshPromise;
  }

  async function executeWithAuthRetry<T>(
    operationName: string,
    fn: (token: string) => Promise<T>
  ): Promise<T> {
    try {
      return await fn(currentAuth);
    } catch (err: any) {
      const isAuthError = err.status === 401 || err.statusCode === 401;
      if (isAuthError && refreshToken) {
        console.warn(
          `HTTP 401 detectado en '${operationName}'. Intentando autorefresco con refreshToken...`
        );
        const freshToken = await getRefreshedToken();
        return await fn(freshToken);
      }
      throw err;
    }
  }

  // 2. Conectar a base de datos y resolver configuración
  await getConfig();
  await connectToDatabase();

  const targetFundsMap = new Map(Object.entries(TYBA_FUNDS_CATALOG));

  // 3. Sincronización obligatoria de catálogo (abortar con 502 si falla)
  if (syncCatalog) {
    let catalogRes;
    try {
      catalogRes = await executeWithAuthRetry('catálogo', (token) =>
        fetchPortfoliosCatalog(token, appProof)
      );
    } catch (err) {
      const error = new Error(
        `Fallo al consultar catálogo de Tyba (HTTP 502 Bad Gateway): ${(err as Error).message}`
      );
      (error as any).statusCode = 502;
      throw error;
    }

    const allPortfolios = [...catalogRes.recommended, ...catalogRes.notRecommended];
    const fundUpdates = allPortfolios.map((portfolio) => {
      const fallback = targetFundsMap.get(portfolio.id);
      const metadata = mapPortfolioMetadata(portfolio, fallback);

      // Si el portafolio no estaba en el catálogo base, lo añadimos para extraer sus cuotas
      if (!targetFundsMap.has(portfolio.id)) {
        targetFundsMap.set(portfolio.id, {
          id: portfolio.id,
          name: metadata.name,
          currency: metadata.currency,
          risk: metadata.risk,
          fee: metadata.fee,
        });
      }

      return {
        updateOne: {
          filter: { idFondo: metadata.idFondo, source: metadata.source },
          update: { $set: metadata },
          upsert: true,
        },
      };
    });

    if (fundUpdates.length > 0) {
      await FundModel.bulkWrite(fundUpdates, { ordered: false });
    }
  }

  // 4. Descargar series temporales de valores cuota con concurrencia controlada
  const fundsToScrape = Array.from(targetFundsMap.values());
  console.info(
    `Iniciando ingesta de Tyba para ${fundsToScrape.length} fondos/portafolios (modo: ${
      all ? 'HISTORIAL COMPLETO' : `últimas ${days} observaciones`
    }).`
  );

  let successfulFunds = 0;
  let failedFunds = 0;
  let totalQuotasSynced = 0;

  await pMap(
    fundsToScrape,
    async (fund) => {
      try {
        const histRes = await executeWithAuthRetry(`fondo-${fund.id}`, (token) =>
          fetchHistoricPerformance(fund.id, token, appProof)
        );
        const quotas = normalizeHistoricQuotas(fund.id, histRes.graphData, days, all);

        if (quotas.length > 0) {
          await TybaQuotaModel.bulkWrite(
            quotas.map((q) => ({
              updateOne: {
                filter: { idFondo: q.idFondo, idSerie: q.idSerie, date: q.date },
                update: { $set: { value: q.value } },
                upsert: true,
              },
            })),
            { ordered: false }
          );
          totalQuotasSynced += quotas.length;
        } else {
          console.info(`Fondo ${fund.name} (${fund.id}) no retornó observaciones históricas.`);
        }
        successfulFunds++;
      } catch (err) {
        failedFunds++;
        console.error(
          `Error al descargar cuotas para fondo ${fund.name} (${fund.id}): ${(err as Error).message}`
        );
      }
    },
    4
  );

  // 5. Retornar resultado estructurado
  return {
    statusCode: 200,
    source: 'tyba',
    timestamp: new Date().toISOString(),
    summary: {
      totalFondos: fundsToScrape.length,
      procesados: successfulFunds,
      fallidos: failedFunds,
      cuotasSincronizadas: totalQuotasSynced,
    },
  };
}
