import { Value } from "@sinclair/typebox/value";
import { connectToDatabase } from "../../shared/db.js";
import { getConfig } from "../../shared/config.js";
import { pMap } from "../../shared/utils.js";
import { BbvaQuotaModel } from "../../shared/models/quota.model.js";
import { FundModel } from "../../shared/models/fund.model.js";
import { BBVA_FUNDS_CATALOG } from "./catalog.js";
import { getBbvaTsec, fetchFundDetail, fetchPastReturns } from "./client.js";
import {
  normalizeBbvaQuotas,
  toBbvaFundMetadata,
  calculateBbvaDateRange,
} from "./parser.js";
import {
  BbvaLambdaEventSchema,
  type BbvaLambdaEvent,
  type BbvaLambdaResult,
} from "./types.js";

/**
 * AWS Lambda Handler principal para la ingesta serverless de fondos mutuos de BBVA.
 * Invocado por EventBridge Scheduler diariamente o manualmente con { days?: number }.
 */
export async function handler(event?: BbvaLambdaEvent): Promise<BbvaLambdaResult> {
  // 1. Validar parámetros de entrada
  const validEvent = event && Value.Check(BbvaLambdaEventSchema, event) ? event : {};
  const days = validEvent.days ?? 30;
  const { fromDate, toDate } = calculateBbvaDateRange(
    days,
    validEvent.fromDate,
    validEvent.toDate
  );

  // 2. Conectar a base de datos y resolver configuración
  await getConfig();
  await connectToDatabase();

  // 3. Adquirir o verificar token de sesión TSEC
  const tsec = await getBbvaTsec();
  const catalogList = Object.values(BBVA_FUNDS_CATALOG);

  console.info(
    `Iniciando ingesta BBVA: ${catalogList.length} fondos configurados. Periodo: ${fromDate} a ${toDate}.`
  );

  // 4. Sincronizar catálogo de metadatos en la colección 'funds'
  const fundUpdates = await pMap(
    catalogList,
    async (catalogFund) => {
      let apiDetail;
      try {
        const detailRes = await fetchFundDetail(catalogFund.id, tsec);
        apiDetail = detailRes.data;
      } catch (err) {
        console.warn(
          `No se pudo enriquecer detalle para fondo ${catalogFund.id}: ${(err as Error).message}. Usando catálogo base.`
        );
      }

      const metadata = toBbvaFundMetadata(catalogFund, apiDetail);
      return {
        updateOne: {
          filter: { idFondo: metadata.idFondo, source: metadata.source },
          update: { $set: metadata },
          upsert: true,
        },
      };
    },
    4
  );

  if (fundUpdates.length > 0) {
    await FundModel.bulkWrite(fundUpdates, { ordered: false });
  }

  // 5. Descargar serie temporal de cuotas con concurrencia controlada (máximo 4 simultáneas)
  let successfulFunds = 0;
  let failedFunds = 0;
  let totalQuotasSynced = 0;

  await pMap(
    catalogList,
    async (fund) => {
      try {
        const pastReturnsRes = await fetchPastReturns(
          {
            idFondo: fund.id,
            currency: fund.currency,
            fromDate,
            toDate,
          },
          tsec
        );

        const rawValues = pastReturnsRes.data?.weightedAverageAssetValues || [];
        if (rawValues.length === 0) {
          console.info(
            `Fondo BBVA ${fund.id} (${fund.name}): 0 valores cuota retornados en el periodo ${fromDate} - ${toDate}.`
          );
          successfulFunds++;
          return;
        }

        const normalizedQuotas = normalizeBbvaQuotas(fund.id, rawValues);

        const quotaOps = normalizedQuotas.map((q) => ({
          updateOne: {
            filter: { idFondo: q.idFondo, idSerie: q.idSerie, date: q.date },
            update: { $set: { value: q.value } },
            upsert: true,
          },
        }));

        await BbvaQuotaModel.bulkWrite(quotaOps, { ordered: false });

        successfulFunds++;
        totalQuotasSynced += normalizedQuotas.length;
      } catch (err) {
        failedFunds++;
        console.error(
          `Error al procesar cuotas para fondo BBVA ${fund.id} (${fund.name}):`,
          err
        );
      }
    },
    4
  );

  console.info(
    `Ingesta BBVA finalizada: ${successfulFunds} fondos procesados, ${failedFunds} fallidos, ${totalQuotasSynced} cuotas sincronizadas.`
  );

  return {
    statusCode: 200,
    source: "bbva",
    timestamp: new Date().toISOString(),
    summary: {
      totalFondos: catalogList.length,
      procesados: successfulFunds,
      fallidos: failedFunds,
      cuotasSincronizadas: totalQuotasSynced,
    },
  };
}
