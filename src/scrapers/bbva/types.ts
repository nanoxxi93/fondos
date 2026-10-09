import { Type, type Static } from "@sinclair/typebox";

// --- Esquemas de Autenticación (/grantingTickets/V02) ---

export const BbvaAuthDataSchema = Type.Object({
  authenticationData: Type.Array(Type.String()),
  idAuthenticationData: Type.String(),
});

export const BbvaAuthBodySchema = Type.Object({
  authentication: Type.Object({
    consumerID: Type.String(),
    userID: Type.String(),
    authenticationType: Type.String(),
    authenticationData: Type.Array(BbvaAuthDataSchema),
  }),
});

export type BbvaAuthBody = Static<typeof BbvaAuthBodySchema>;

// --- Esquemas de Detalle de Fondo (/management-entities-funds/{id}) ---

export const BbvaFundDetailDataSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    fundCurrency: Type.Object(
      {
        id: Type.String(),
        name: Type.Optional(Type.String()),
      },
      { additionalProperties: true }
    ),
    fundGroup: Type.Optional(
      Type.Object(
        {
          riskLevel: Type.Optional(
            Type.Object(
              {
                id: Type.String(),
                name: Type.Optional(Type.String()),
              },
              { additionalProperties: true }
            )
          ),
        },
        { additionalProperties: true }
      )
    ),
    fees: Type.Optional(
      Type.Object(
        {
          itemizeFees: Type.Optional(
            Type.Array(
              Type.Object(
                {
                  id: Type.String(),
                  description: Type.Optional(Type.String()),
                  itemizeFeeUnit: Type.Optional(
                    Type.Object(
                      {
                        percentage: Type.Number(),
                      },
                      { additionalProperties: true }
                    )
                  ),
                },
                { additionalProperties: true }
              )
            )
          ),
        },
        { additionalProperties: true }
      )
    ),
  },
  { additionalProperties: true }
);

export const BbvaFundDetailResponseSchema = Type.Object(
  {
    data: BbvaFundDetailDataSchema,
  },
  { additionalProperties: true }
);

export type BbvaFundDetailData = Static<typeof BbvaFundDetailDataSchema>;
export type BbvaFundDetailResponse = Static<typeof BbvaFundDetailResponseSchema>;

// --- Esquemas de Retornos Pasados (/past-returns) ---

export const BbvaPastReturnsRequestSchema = Type.Object({
  funds: Type.Array(
    Type.Object({
      id: Type.String(),
      weight: Type.Number(),
    })
  ),
  period: Type.Object({
    fromDate: Type.String(),
    toDate: Type.String(),
  }),
  assetValuesCurrency: Type.Object({
    id: Type.String(),
  }),
});

export const BbvaWeightedAssetValueSchema = Type.Object(
  {
    valueDate: Type.String(),
    valueAmount: Type.Object(
      {
        amount: Type.Number(),
        currency: Type.Optional(Type.String()),
      },
      { additionalProperties: true }
    ),
  },
  { additionalProperties: true }
);

export const BbvaPastReturnsResponseSchema = Type.Object(
  {
    data: Type.Optional(
      Type.Object(
        {
          weightedAverageAssetValues: Type.Optional(
            Type.Array(BbvaWeightedAssetValueSchema)
          ),
        },
        { additionalProperties: true }
      )
    ),
  },
  { additionalProperties: true }
);

export type BbvaPastReturnsRequest = Static<typeof BbvaPastReturnsRequestSchema>;
export type BbvaWeightedAssetValue = Static<typeof BbvaWeightedAssetValueSchema>;
export type BbvaPastReturnsResponse = Static<typeof BbvaPastReturnsResponseSchema>;

// --- Esquemas de Invocación y Resumen de AWS Lambda ---

export const BbvaLambdaEventSchema = Type.Object({
  days: Type.Optional(Type.Integer({ minimum: 1, maximum: 3650 })),
  fromDate: Type.Optional(Type.String()),
  toDate: Type.Optional(Type.String()),
});

export const BbvaExecutionSummarySchema = Type.Object({
  totalFondos: Type.Number(),
  procesados: Type.Number(),
  fallidos: Type.Number(),
  cuotasSincronizadas: Type.Number(),
});

export const BbvaLambdaResultSchema = Type.Object({
  statusCode: Type.Literal(200),
  source: Type.Literal("bbva"),
  timestamp: Type.String(),
  summary: BbvaExecutionSummarySchema,
});

export type BbvaLambdaEvent = Static<typeof BbvaLambdaEventSchema>;
export type BbvaExecutionSummary = Static<typeof BbvaExecutionSummarySchema>;
export type BbvaLambdaResult = Static<typeof BbvaLambdaResultSchema>;
