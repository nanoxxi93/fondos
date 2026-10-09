import { Value } from "@sinclair/typebox/value";
import { connectToDatabase } from "../../shared/db.js";
import { getConfig } from "../../shared/config.js";
import { pMap } from "../../shared/utils.js";
import { ErniQuotaModel } from "../../shared/models/quota.model.js";
import { FundModel } from "../../shared/models/fund.model.js";
import { fetchFondosActivos, fetchFondoInvertir } from "./client.js";
import {
  selectActiveSerie,
  filterActiveFunds,
  normalizeQuotas,
  toFundMetadata,
} from "./parser.js";
import {
  LambdaEventSchema,
  type LambdaEvent,
  type LambdaResult,
} from "./types.js";

/**
 * AWS Lambda Handler principal para la ingesta serverless de fondos mutuos de ERNI (Inteligo).
 * Invocado por EventBridge Scheduler de forma diaria o manualmente con { months: number }.
 */
export async function handler(event?: LambdaEvent): Promise<LambdaResult> {
  // 1. Validar parámetros de entrada
  const validEvent = event && Value.Check(LambdaEventSchema, event) ? event : {};
  const months = validEvent.months ?? 1;

  // 2. Conectar a base de datos y resolver credenciales
  const { erniApiKey } = await getConfig();
  if (!erniApiKey) {
    throw new Error("ERNI_APIKEY no encontrada en la configuración");
  }
  await connectToDatabase();

  // 3. Descubrimiento dinámico de fondos activos
  const responseFondos = await fetchFondosActivos(erniApiKey);
  const allFondos = responseFondos.data;
  const activeFondos = filterActiveFunds(allFondos);
  const omittedCount = allFondos.length - activeFondos.length;

  console.info(
    `Descubrimiento ERNI: ${allFondos.length} fondos totales encontrados, ${activeFondos.length} operativos, ${omittedCount} omitidos.`
  );

  // 4. Sincronizar catálogo dinámico de metadatos en colección 'funds'
  const fundUpdates = activeFondos.map((fondo) => {
    const serieInfo = selectActiveSerie(fondo)!;
    const metadata = toFundMetadata(fondo, serieInfo);
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

  // 5. Descargar serie temporal de cuotas con concurrencia controlada (máximo 4 simultáneas)
  let successfulFunds = 0;
  let failedFunds = 0;
  let totalQuotasSynced = 0;

  await pMap(
    activeFondos,
    async (fondo) => {
      const serieInfo = selectActiveSerie(fondo);
      if (!serieInfo) {
        return;
      }

      try {
        const invertirData = await fetchFondoInvertir(erniApiKey, {
          idFondo: fondo.idFondo,
          serieCodigo: serieInfo.serie,
          tiempoMeses: months,
        });

        const rawCuotas = invertirData.data?.listaValorCuota || [];
        if (rawCuotas.length === 0) {
          console.info(
            `Fondo ${fondo.idFondo} (${fondo.nombreFondo.trim()}): 0 cuotas históricas disponibles (fondo nuevo o sin datos).`
          );
          successfulFunds++;
          return;
        }

        const normalizedQuotas = normalizeQuotas(
          fondo.idFondo,
          serieInfo.serie,
          rawCuotas
        );

        const quotaOps = normalizedQuotas.map((q) => ({
          updateOne: {
            filter: { idFondo: q.idFondo, idSerie: q.idSerie, date: q.date },
            update: { $set: { value: q.value } },
            upsert: true,
          },
        }));

        await ErniQuotaModel.bulkWrite(quotaOps, { ordered: false });

        successfulFunds++;
        totalQuotasSynced += normalizedQuotas.length;
      } catch (error) {
        failedFunds++;
        console.error(
          `Error al sincronizar fondo ${fondo.idFondo} (${fondo.nombreFondo.trim()}): ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    },
    4
  );

  const result: LambdaResult = {
    statusCode: 200,
    source: "erni",
    timestamp: new Date().toISOString(),
    summary: {
      totalFondos: allFondos.length,
      procesados: successfulFunds,
      omitidos: omittedCount,
      fallidos: failedFunds,
      cuotasSincronizadas: totalQuotasSynced,
    },
  };

  console.info(
    `Ingesta ERNI finalizada exitosamente: ${result.summary.procesados} procesados, ${result.summary.fallidos} fallidos, ${result.summary.cuotasSincronizadas} cuotas guardadas.`
  );

  return result;
}
