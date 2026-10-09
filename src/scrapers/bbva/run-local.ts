import "dotenv/config";
import { handler } from "./handler.js";
import { disconnectDatabase } from "../../shared/db.js";
import { getBbvaTsec, fetchFundDetail, fetchPastReturns } from "./client.js";
import { calculateBbvaDateRange } from "./parser.js";

async function main(): Promise<void> {
  console.info("Iniciando ejecución local para ingesta BBVA...");
  const days = process.env.DAYS ? parseInt(process.env.DAYS, 10) : 30;

  // Si no hay base de datos configurada en .env, ejecutamos en modo prueba (dry-run)
  if (!process.env.MONGO_DB_URI) {
    console.info(
      "MONGO_DB_URI no detectado en .env. Ejecutando en modo DRY-RUN (prueba de APIs en vivo sin persistencia en MongoDB)..."
    );

    const tsec = await getBbvaTsec();
    console.info(`Token TSEC adquirido exitosamente: ${tsec.substring(0, 25)}...`);

    const { fromDate, toDate } = calculateBbvaDateRange(days);
    const sampleFunds = ["CASHSOL-PE", "421", "BBVAEM"];

    for (const idFondo of sampleFunds) {
      const detail = await fetchFundDetail(idFondo, tsec);
      console.info(
        `Detalle verificado para [${idFondo}]: "${detail.data.name}" (${detail.data.fundCurrency.id})`
      );

      const returns = await fetchPastReturns(
        {
          idFondo,
          currency: detail.data.fundCurrency.id as "PEN" | "USD",
          fromDate,
          toDate,
        },
        tsec
      );

      const count = returns.data?.weightedAverageAssetValues?.length || 0;
      console.info(
        `Retornos verificados para [${idFondo}]: ${count} cuotas encontradas entre ${fromDate} y ${toDate}.`
      );
    }

    console.info(
      "Prueba de APIs de BBVA finalizada con éxito. Para persistir en MongoDB Atlas, configura MONGO_DB_URI en tu archivo .env."
    );
    return;
  }

  // Si MONGO_DB_URI está configurado, ejecutamos el ciclo completo de la Lambda
  const result = await handler({ days });
  console.info("Resultado de ejecución completa BBVA:", JSON.stringify(result, null, 2));
  await disconnectDatabase();
}

// Ejecutar únicamente si es invocado directamente
if (process.argv[1]?.includes("run-local")) {
  main().catch((err) => {
    console.error("Error en ejecución local de BBVA:", err);
    process.exit(1);
  });
}
