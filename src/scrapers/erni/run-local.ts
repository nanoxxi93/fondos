import "dotenv/config";
import { handler } from "./handler.js";
import { disconnectDatabase } from "../../shared/db.js";
import { fetchFondosActivos, fetchFondoInvertir } from "./client.js";
import { filterActiveFunds, selectActiveSerie } from "./parser.js";
import { getConfig } from "../../shared/config.js";

async function main(): Promise<void> {
  console.info("Iniciando ejecución local para ingesta ERNI...");
  const months = process.env.MONTHS ? parseInt(process.env.MONTHS, 10) : 1;

  // Si no hay base de datos configurada en .env, ejecutamos en modo prueba (dry-run)
  if (!process.env.MONGO_DB_URI) {
    console.info(
      "MONGO_DB_URI no detectado en .env. Ejecutando en modo DRY-RUN (prueba de APIs en vivo sin persistencia en MongoDB)..."
    );

    let apiKey = process.env.ERNI_APIKEY;
    if (!apiKey) {
      try {
        const config = await getConfig();
        apiKey = config.erniApiKey;
      } catch {
        // Fallback si no está disponible SSM
      }
    }

    if (!apiKey) {
      throw new Error(
        "ERNI_APIKEY no encontrada en .env ni en SSM Parameter Store para ejecutar el modo DRY-RUN."
      );
    }

    const responseFondos = await fetchFondosActivos(apiKey);
    const allFondos = responseFondos.data;
    const activeFondos = filterActiveFunds(allFondos);
    const omittedCount = allFondos.length - activeFondos.length;

    console.info(
      `Descubrimiento ERNI: ${allFondos.length} fondos totales encontrados, ${activeFondos.length} operativos, ${omittedCount} omitidos.`
    );

    // Fondos muestra representativos con distintas series: 01 (estándar '-'), 16 (digital 'C'), 56 (serie 'A')
    const sampleIds = ["01", "16", "56"];
    const sampleFunds = activeFondos.filter((f) => sampleIds.includes(f.idFondo));
    const fundsToTest = sampleFunds.length > 0 ? sampleFunds : activeFondos.slice(0, 3);

    for (const fondo of fundsToTest) {
      const serieInfo = selectActiveSerie(fondo);
      const serieCodigo = serieInfo ? serieInfo.serie : "-";

      console.info(
        `Detalle verificado para [${fondo.idFondo}]: "${fondo.nombreFondo.trim()}" (${fondo.moneda.nombreMoneda}) - Serie: ${serieCodigo}`
      );

      const invertirData = await fetchFondoInvertir(apiKey, {
        idFondo: fondo.idFondo,
        serieCodigo,
        tiempoMeses: months,
      });

      const count = invertirData.data?.listaValorCuota?.length || 0;
      console.info(
        `Cuotas verificadas para [${fondo.idFondo}]: ${count} cuotas encontradas para un periodo de ${months} mes(es).`
      );
    }

    console.info(
      "Prueba de APIs de ERNI finalizada con éxito. Para persistir en MongoDB Atlas, configura MONGO_DB_URI en tu archivo .env."
    );
    return;
  }

  // Si MONGO_DB_URI está configurado, ejecutamos el ciclo completo de la Lambda
  const result = await handler({ months });
  console.info("Resultado de ejecución completa ERNI:", JSON.stringify(result, null, 2));
  await disconnectDatabase();
}

// Ejecutar únicamente si es invocado directamente
if (process.argv[1]?.includes("run-local")) {
  main().catch((err) => {
    console.error("Error en ejecución local de ERNI:", err);
    process.exit(1);
  });
}
