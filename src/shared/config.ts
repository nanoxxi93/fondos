import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

export interface AppConfig {
  mongoDbUri: string;
  erniApiKey?: string;
  bbvaApiKey?: string;
}

let cachedConfig: AppConfig | null = null;

/**
 * Resuelve la configuración requerida para la ejecución de los scrapers.
 * En local utiliza variables de entorno (.env). En AWS Lambda obtiene los
 * parámetros desde AWS SSM Parameter Store y los mantiene en caché en memoria.
 */
export async function getConfig(): Promise<AppConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Si las variables ya están en process.env (desarrollo local o test), usarlas directamente
  const envMongoUri = process.env.MONGO_DB_URI;
  const envErniApiKey = process.env.ERNI_APIKEY;
  const envBbvaApiKey = process.env.BBVA_APIKEY;

  if (envMongoUri) {
    cachedConfig = {
      mongoDbUri: envMongoUri,
      erniApiKey: envErniApiKey,
      bbvaApiKey: envBbvaApiKey,
    };
    return cachedConfig;
  }

  // Si estamos en AWS Lambda o falta alguna variable, consultar SSM Parameter Store
  const ssmPrefix = process.env.SSM_PREFIX || "/fondos/prod";
  const mongoParam = `${ssmPrefix}/mongo_db_uri`;
  const erniParam = `${ssmPrefix}/erni_apikey`;
  const bbvaParam = `${ssmPrefix}/bbva_apikey`;

  const ssmClient = new SSMClient({
    region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
  });
  const command = new GetParametersCommand({
    Names: [mongoParam, erniParam, bbvaParam],
    WithDecryption: true,
  });

  const response = await ssmClient.send(command);
  const parameters = response.Parameters || [];

  const foundMongo = parameters.find((p) => p.Name === mongoParam);
  const foundErni = parameters.find((p) => p.Name === erniParam);
  const foundBbva = parameters.find((p) => p.Name === bbvaParam);

  const resolvedMongoUri = foundMongo?.Value || envMongoUri;
  const resolvedErniKey = foundErni?.Value || envErniApiKey;
  const resolvedBbvaKey = foundBbva?.Value || envBbvaApiKey;

  if (!resolvedMongoUri) {
    throw new Error(
      `No se pudo resolver MONGO_DB_URI (parámetro SSM: ${mongoParam} o variable de entorno)`
    );
  }

  cachedConfig = {
    mongoDbUri: resolvedMongoUri,
    erniApiKey: resolvedErniKey,
    bbvaApiKey: resolvedBbvaKey,
  };

  return cachedConfig;
}

/**
 * Permite reiniciar la caché de configuración (útil para pruebas unitarias).
 */
export function resetConfigCache(): void {
  cachedConfig = null;
}
