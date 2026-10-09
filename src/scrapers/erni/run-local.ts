import "dotenv/config";
import { handler } from "./handler.js";
import { disconnectDatabase } from "../../shared/db.js";

async function main(): Promise<void> {
  console.info("Iniciando ejecución local de prueba para ingesta ERNI...");
  const months = process.env.MONTHS ? parseInt(process.env.MONTHS, 10) : 1;
  const result = await handler({ months });
  console.info("Resultado de ejecución local:", JSON.stringify(result, null, 2));
  await disconnectDatabase();
}

// Ejecutar únicamente si es invocado directamente
if (process.argv[1]?.includes("run-local")) {
  main().catch((err) => {
    console.error("Error en ejecución local de ERNI:", err);
    process.exit(1);
  });
}
