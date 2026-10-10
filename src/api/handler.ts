import { connectToDatabase, isMongoReady } from "../shared/db.js";
import { calculateTea } from "../domain/tea.js";
import {
  parseTeaQueryParams,
  type ApiErrorResponse,
  type HealthResponse,
} from "./types.js";

export interface LambdaFunctionUrlEvent {
  rawPath?: string;
  requestContext?: {
    http?: {
      method?: string;
      path?: string;
    };
  };
  queryStringParameters?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
}

export interface LambdaFunctionUrlResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const NO_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
};

const SUCCESS_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
  "X-Content-Type-Options": "nosniff",
};

function jsonResponse(
  statusCode: number,
  body: unknown,
  extraHeaders: Record<string, string> = {}
): LambdaFunctionUrlResult {
  // En AWS Lambda Function URL, la infraestructura de AWS ya inyecta los encabezados CORS.
  // Evitar duplicar Access-Control-Allow-Origin en el cuerpo para no provocar fallo de CORS en navegadores.
  const isLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(isLambda ? {} : CORS_HEADERS),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

/**
 * Entrypoint de AWS Lambda para la Function URL pública (formato de evento API Gateway v2).
 */
export async function handler(
  event?: LambdaFunctionUrlEvent
): Promise<LambdaFunctionUrlResult> {
  const method = (
    event?.requestContext?.http?.method || "GET"
  ).toUpperCase();
  const rawPath = (
    event?.rawPath ||
    event?.requestContext?.http?.path ||
    "/"
  ).toLowerCase();

  // 1. Manejo de Preflight CORS (OPTIONS)
  if (method === "OPTIONS") {
    const isLambda = Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
    return {
      statusCode: 204,
      headers: {
        ...(isLambda ? {} : CORS_HEADERS),
        "X-Content-Type-Options": "nosniff",
      },
      body: "",
    };
  }

  // 2. Restricción de métodos HTTP: Solo se permite GET y OPTIONS
  if (method !== "GET") {
    const errorBody: ApiErrorResponse = {
      error: `Método ${method} no permitido`,
      timestamp: new Date().toISOString(),
    };
    return jsonResponse(405, errorBody, {
      ...NO_CACHE_HEADERS,
      Allow: "GET, OPTIONS",
    });
  }

  // 3. Endpoint de salud: GET /health
  if (rawPath === "/health") {
    let ready = isMongoReady();
    if (!ready) {
      try {
        await connectToDatabase();
        ready = isMongoReady();
      } catch {
        ready = false;
      }
    }

    if (!ready) {
      const downBody: HealthResponse = {
        status: "Mongo unavailable",
        timestamp: new Date().toISOString(),
      };
      return jsonResponse(503, downBody, NO_CACHE_HEADERS);
    }

    const okBody: HealthResponse = {
      status: "OK",
      timestamp: new Date().toISOString(),
    };
    return jsonResponse(200, okBody, NO_CACHE_HEADERS);
  }

  // 4. Endpoint principal de analítica: GET / y GET /api/tea
  if (rawPath === "/" || rawPath === "/api/tea") {
    try {
      const parseResult = parseTeaQueryParams(event?.queryStringParameters);
      if (!parseResult.success) {
        const errorBody: ApiErrorResponse = {
          error: "Parámetros de consulta inválidos",
          timestamp: new Date().toISOString(),
          details: parseResult.errors,
        };
        return jsonResponse(400, errorBody, NO_CACHE_HEADERS);
      }

      const chartData = await calculateTea(parseResult.data);
      return jsonResponse(200, chartData, SUCCESS_CACHE_HEADERS);
    } catch (err: unknown) {
      console.error("Error en ApiFunction calculando TEA:", err);
      const errorBody: ApiErrorResponse = {
        error: "Error interno del servidor",
        timestamp: new Date().toISOString(),
      };
      return jsonResponse(500, errorBody, NO_CACHE_HEADERS);
    }
  }

  // 5. Ruta no encontrada: HTTP 404
  const notFoundBody: ApiErrorResponse = {
    error: `Ruta '${rawPath}' no encontrada`,
    timestamp: new Date().toISOString(),
  };
  return jsonResponse(404, notFoundBody, NO_CACHE_HEADERS);
}
