import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

// --- Esquemas de Parámetros de Consulta (Query String) ---

export const TeaQueryParamsSchema = Type.Object({
  days: Type.Optional(Type.Integer({ minimum: 1, maximum: 3650 })),
  currency: Type.Optional(Type.Union([Type.Literal("PEN"), Type.Literal("USD")])),
  risk: Type.Optional(Type.Integer({ minimum: 1, maximum: 7 })),
});

export type TeaQueryParams = Static<typeof TeaQueryParamsSchema>;

export interface ParseQueryParamsResult {
  success: boolean;
  data?: TeaQueryParams;
  errors?: string[];
}

/**
 * Parsea y sanea los parámetros de consulta crudos provenientes del evento HTTP
 * y los valida rigurosamente contra TeaQueryParamsSchema usando TypeBox.
 */
export function parseTeaQueryParams(
  rawParams?: Record<string, string | undefined> | null
): ParseQueryParamsResult {
  const parsed: Record<string, unknown> = {};

  if (!rawParams) {
    return { success: true, data: {} };
  }

  // Parseo de 'days'
  const rawDays = rawParams.days?.trim();
  if (rawDays !== undefined && rawDays !== "") {
    const numDays = Number(rawDays);
    if (!Number.isInteger(numDays)) {
      return {
        success: false,
        errors: [`El parámetro 'days' debe ser un número entero válido: recibido '${rawDays}'`],
      };
    }
    parsed.days = numDays;
  }

  // Parseo de 'currency'
  const rawCurrency = rawParams.currency?.trim();
  if (rawCurrency !== undefined && rawCurrency !== "") {
    parsed.currency = rawCurrency.toUpperCase();
  }

  // Parseo de 'risk'
  const rawRisk = rawParams.risk?.trim();
  if (rawRisk !== undefined && rawRisk !== "") {
    const numRisk = Number(rawRisk);
    if (!Number.isInteger(numRisk)) {
      return {
        success: false,
        errors: [`El parámetro 'risk' debe ser un número entero válido: recibido '${rawRisk}'`],
      };
    }
    parsed.risk = numRisk;
  }

  if (Value.Check(TeaQueryParamsSchema, parsed)) {
    return { success: true, data: parsed as TeaQueryParams };
  }

  const errors = Array.from(Value.Errors(TeaQueryParamsSchema, parsed)).map(
    (err) => `Campo '${err.path.slice(1) || "root"}': ${err.message} (valor: ${JSON.stringify(err.value)})`
  );

  return { success: false, errors };
}

// --- Esquemas de Datasets y Metadatos para Chart.js ---

export const TeaDatasetMetaSchema = Type.Object({
  index: Type.Integer({ minimum: 0 }),
  idFondo: Type.String({ minLength: 1 }),
  source: Type.Union([Type.Literal("erni"), Type.Literal("bbva"), Type.Literal("tyba")]),
  value: Type.Number(),
  firstValue: Type.Number(),
  lastValue: Type.Number(),
  fee: Type.Number(),
  currency: Type.Union([Type.Literal("PEN"), Type.Literal("USD")]),
  risk: Type.Number(),
});

export type TeaDatasetMeta = Static<typeof TeaDatasetMetaSchema>;

export const TeaDatasetSchema = Type.Object({
  label: Type.String(),
  data: Type.Array(Type.Union([Type.Number(), Type.Null()])),
  backgroundColor: Type.String(),
  borderColor: Type.String(),
  borderWidth: Type.Literal(1),
  pointRadius: Type.Literal(1),
  hidden: Type.Literal(true),
  meta: TeaDatasetMetaSchema,
});

export type TeaDataset = Static<typeof TeaDatasetSchema>;

export const TeaChartDataSchema = Type.Object({
  labels: Type.Array(Type.String()),
  datasets: Type.Array(TeaDatasetSchema),
});

export type TeaChartData = Static<typeof TeaChartDataSchema>;

// --- Esquemas de Respuestas HTTP Operacionales ---

export const HealthResponseSchema = Type.Object({
  status: Type.Union([Type.Literal("OK"), Type.Literal("Mongo unavailable")]),
  timestamp: Type.String(),
});

export type HealthResponse = Static<typeof HealthResponseSchema>;

export const ApiErrorResponseSchema = Type.Object({
  error: Type.String(),
  timestamp: Type.String(),
  details: Type.Optional(Type.Array(Type.String())),
});

export type ApiErrorResponse = Static<typeof ApiErrorResponseSchema>;
