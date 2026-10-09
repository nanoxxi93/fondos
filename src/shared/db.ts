import mongoose from "mongoose";
import { getConfig } from "./config.js";

let cachedPromise: Promise<typeof mongoose> | null = null;

/**
 * Conecta a MongoDB Atlas reutilizando la conexión en el ámbito global del
 * contenedor de AWS Lambda para evitar la saturación de sockets en arranques calientes.
 */
export async function connectToDatabase(uri?: string): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (cachedPromise) {
    return cachedPromise;
  }

  const resolvedUri = uri || (await getConfig()).mongoDbUri;
  if (!resolvedUri) {
    throw new Error("No se ha configurado la URI de conexión a MongoDB Atlas.");
  }

  cachedPromise = mongoose
    .connect(resolvedUri, {
      serverApi: { version: "1", strict: true, deprecationErrors: true },
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 30000,
      maxPoolSize: 5,
    } as mongoose.ConnectOptions)
    .catch((err) => {
      cachedPromise = null;
      throw err;
    });

  return cachedPromise;
}

/**
 * Cierra la conexión activa a la base de datos (útil para tests unitarios).
 */
export async function disconnectDatabase(): Promise<void> {
  cachedPromise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/**
 * Indica si la conexión a la base de datos se encuentra abierta.
 */
export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
