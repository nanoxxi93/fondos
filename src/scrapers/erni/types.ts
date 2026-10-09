import { Type, type Static } from "@sinclair/typebox";

// --- Esquemas de Fondos Activos (/onboarding-corp/v1/fondos/fondos-activos) ---

export const TarifarioItemSchema = Type.Object(
  {
    comisionUnificada: Type.Optional(Type.Number()),
    isDigital: Type.Optional(Type.Boolean()),
    serie: Type.Object({
      serie: Type.String(),
      isDigital: Type.Optional(Type.Boolean()),
    }),
  },
  { additionalProperties: true }
);

export const FondosActivosItemSchema = Type.Object(
  {
    idFondo: Type.String(),
    nombreFondo: Type.String(),
    moneda: Type.Object(
      {
        idMoneda: Type.String(),
        nombreMoneda: Type.String(),
      },
      { additionalProperties: true }
    ),
    riesgo: Type.Object(
      {
        idRiesgo: Type.Number(),
        riesgo: Type.String(),
      },
      { additionalProperties: true }
    ),
    valorCuota: Type.Optional(Type.Number()),
    valorCuotaFecha: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    tarifarios: Type.Optional(Type.Array(TarifarioItemSchema)),
  },
  { additionalProperties: true }
);

export const FondosActivosResponseSchema = Type.Object(
  {
    code: Type.String(),
    data: Type.Array(FondosActivosItemSchema),
    message: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  },
  { additionalProperties: true }
);

export type TarifarioItem = Static<typeof TarifarioItemSchema>;
export type FondosActivosItem = Static<typeof FondosActivosItemSchema>;
export type FondosActivosResponse = Static<typeof FondosActivosResponseSchema>;

// --- Esquemas de Inversión y Valores Cuota (/erni-api/v1/fondo/{id}/invertir) ---

export const CuotaItemSchema = Type.Object(
  {
    fecha: Type.String(),
    numeroValorCuota: Type.Number(),
  },
  { additionalProperties: true }
);

export const InvertirDataSchema = Type.Object(
  {
    listaValorCuota: Type.Array(CuotaItemSchema),
    montoProbableGanancia: Type.Optional(Type.Number()),
    montoSaldoEsperado: Type.Optional(Type.Number()),
  },
  { additionalProperties: true }
);

export const InvertirResponseSchema = Type.Object(
  {
    code: Type.String(),
    data: InvertirDataSchema,
    message: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  },
  { additionalProperties: true }
);

export type CuotaItem = Static<typeof CuotaItemSchema>;
export type InvertirResponse = Static<typeof InvertirResponseSchema>;

// --- Esquemas de Invocación y Resultado de AWS Lambda ---

export const LambdaEventSchema = Type.Object({
  months: Type.Optional(Type.Integer({ minimum: 1, maximum: 60 })),
});

export const ExecutionSummarySchema = Type.Object({
  totalFondos: Type.Number(),
  procesados: Type.Number(),
  omitidos: Type.Number(),
  fallidos: Type.Number(),
  cuotasSincronizadas: Type.Number(),
});

export const LambdaResultSchema = Type.Object({
  statusCode: Type.Number(),
  source: Type.Literal("erni"),
  timestamp: Type.String(),
  summary: ExecutionSummarySchema,
});

export type LambdaEvent = Static<typeof LambdaEventSchema>;
export type ExecutionSummary = Static<typeof ExecutionSummarySchema>;
export type LambdaResult = Static<typeof LambdaResultSchema>;
