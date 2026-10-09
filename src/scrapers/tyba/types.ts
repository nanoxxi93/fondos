import { Type, type Static } from '@sinclair/typebox';

/**
 * Esquema de validación del payload de entrada de la función Lambda de Tyba.
 */
export const TybaLambdaEventSchema = Type.Object({
  authorization: Type.String({ minLength: 20 }),
  xAppProof: Type.Optional(Type.String({ minLength: 20 })),
  'x-app-proof': Type.Optional(Type.String({ minLength: 20 })),
  refreshToken: Type.Optional(Type.String({ minLength: 20 })),
  'refresh-token': Type.Optional(Type.String({ minLength: 20 })),
  days: Type.Optional(Type.Integer({ minimum: 1, maximum: 3650 })),
  all: Type.Optional(Type.Boolean()),
  syncCatalog: Type.Optional(Type.Boolean()),
});

export type TybaLambdaEvent = Static<typeof TybaLambdaEventSchema>;

/**
 * Esquema de respuesta para el refresco de token en /api-master/auth/refresh-token.
 */
export const TybaRefreshTokenResponseSchema = Type.Object(
  {
    token: Type.String({ minLength: 20 }),
  },
  { additionalProperties: true }
);

export type TybaRefreshTokenResponse = Static<typeof TybaRefreshTokenResponseSchema>;

/**
 * Esquema de un ítem de portafolio retornado por /v2/portfolios/sqi.
 */
export const TybaPortfolioItemSchema = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    currency: Type.Union([Type.Literal('PEN'), Type.Literal('USD')]),
    assetType: Type.Optional(Type.String()),
    risk: Type.Optional(Type.String()),
    riskLevel: Type.Optional(Type.String()),
    comission: Type.Optional(Type.Number()),
  },
  { additionalProperties: true }
);

export type TybaPortfolioItem = Static<typeof TybaPortfolioItemSchema>;

/**
 * Esquema de respuesta del catálogo de portafolios /v2/portfolios/sqi.
 */
export const TybaPortfoliosResponseSchema = Type.Object(
  {
    recommended: Type.Array(TybaPortfolioItemSchema),
    notRecommended: Type.Array(TybaPortfolioItemSchema),
  },
  { additionalProperties: true }
);

export type TybaPortfoliosResponse = Static<typeof TybaPortfoliosResponseSchema>;

/**
 * Esquema de una observación en el historial de rendimiento.
 */
export const TybaHistoricPointSchema = Type.Object({
  interval: Type.String(),
  value: Type.Number(),
});

export type TybaHistoricPoint = Static<typeof TybaHistoricPointSchema>;

/**
 * Esquema de respuesta de /portfolios/{id}/historic-performance.
 */
export const TybaHistoricPerformanceResponseSchema = Type.Object(
  {
    graphData: Type.Array(TybaHistoricPointSchema),
  },
  { additionalProperties: true }
);

export type TybaHistoricPerformanceResponse = Static<typeof TybaHistoricPerformanceResponseSchema>;

/**
 * Resumen métrico de la ejecución del scraper.
 */
export const TybaExecutionSummarySchema = Type.Object({
  totalFondos: Type.Number(),
  procesados: Type.Number(),
  fallidos: Type.Number(),
  cuotasSincronizadas: Type.Number(),
});

export type TybaExecutionSummary = Static<typeof TybaExecutionSummarySchema>;

/**
 * Resultado exitoso retornado por el Lambda handler de Tyba.
 */
export const TybaLambdaResultSchema = Type.Object({
  statusCode: Type.Literal(200),
  source: Type.Literal('tyba'),
  timestamp: Type.String(),
  summary: TybaExecutionSummarySchema,
});

export type TybaLambdaResult = Static<typeof TybaLambdaResultSchema>;
