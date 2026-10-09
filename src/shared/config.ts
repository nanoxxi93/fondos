import { SSMClient, GetParametersCommand } from "@aws-sdk/client-ssm";

export interface AppConfig {
  mongoDbUri: string;
  erniApiKey: string;
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

  if (envMongoUri && envErniApiKey) {
    cachedConfig = {
      mongoDbUri: envMongoUri,
      erniApiKey: envErniApiKey,
    };
    return cachedConfig;
  }

  // Si estamos en AWS Lambda o falta alguna variable, consultar SSM Parameter Store
  const ssmPrefix = process.env.SSM_PREFIX || "/fondos/prod";
  const mongoParamName = `${ssmPrefix}/mongo_db_uri`;
  const erniParamName = `${ssmPrefix}/erni_apikey`;

  const ssmClient = new SSMClient({});
  const command = new GetParametersCommand({
    Names: [mongoParamName, erniParamName],
    WithDecryption: true,
  });

  const response = await ssmClient.send(command);
  const parameters = response.Parameters || [];

  const mongoParam = parameters.find((p) => p.Name === mongoParamName);
  const erniParam = parameters.find((p) => p.Name === erniParamName);

  const resolvedMongoUri = mongoParam?.Value || envMongoUri;
  const resolvedErniApiKey = erniParam?.Value || envErniApiKey;

  if (!resolvedMongoUri) {
    throw new Error(
      `No se pudo resolver MONGO_DB_URI (parámetro SSM: ${mongoParamName} o variable de entorno)`
    );
  }

  if (!resolvedErniApiKey) {
    throw new Error(
      `No se pudo resolver ERNI_APIKEY (parámetro SSM: ${erniParamName} o variable de entorno)`
    );
  }

  cachedConfig = {
    mongoDbUri: resolvedMongoUri,
    erniApiKey: resolvedErniApiKey,
  };

  return cachedConfig;
}

/**
 * Permite reiniciar la caché de configuración (útil para pruebas unitarias).
 */
export function resetConfigCache(): void {
  cachedConfig = null;
}
