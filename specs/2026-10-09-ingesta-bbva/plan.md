# Plan de Implementación Técnico: Ingesta Serverless de BBVA

## Información general sobre la arquitectura

Este plan define la estrategia técnica para la migración del componente de ingesta de BBVA desde el script monolítico legado basado en Puppeteer (`legacy/bbva.js`) hacia un micro-scraper serverless en AWS Lambda con Node.js 24 y TypeScript estricto.

### Diagrama de Flujo y Arquitectura:
```text
 ┌────────────────────────────────────────────────────────────┐
 │  Amazon EventBridge Scheduler (Cron diario: 23:15 UTC)     │
 │  o Invocación Manual ({ days?: number })                   │
 └─────────────────────────────┬──────────────────────────────┘
                               │ (Evento)
                               ▼
 ┌────────────────────────────────────────────────────────────┐
 │           AWS Lambda: BbvaScraperFunction (TS)             │
 │                                                            │
 │   1. Inicializar conexión MongoDB (Singleton global)       │
 │   2. Obtener credenciales (Cache SSM / .env)               │
 │   3. Obtener/Renovar Token TSEC dinámico                   │
 │      - POST /ASO/TechArchitecture/grantingTickets/V02      │
 │      - Capturar cabecera 'tsec' en respuesta               │
 │   4. Sincronizar catálogo de 21 fondos en colección 'funds'│
 │      - Consultar /management-entities-funds/{id}           │
 │      - Validar con TypeBox y actualizar 'funds'            │
 │   5. Extraer valores cuota concurrentes con pMap (max 4)   │
 │      - POST /management-entities-funds/past-returns        │
 │      - Validar con TypeBox                                 │
 │      - Normalizar a medianoche UTC                         │
 │   6. Upsert masivo idempotente en colección 'bbva'         │
 │   7. Retornar resumen métrico estructurado                 │
 └──────────────┬───────────────────────────────┬─────────────┘
                │                               │
                ▼                               ▼
 ┌───────────────────────────┐   ┌────────────────────────────┐
 │     BBVA ASO Endpoints    │   │     MongoDB Atlas (M0)     │
 │                           │   │                            │
 │ - grantingTickets/V02     │   │ - Colección 'funds'        │
 │ - management-entities...  │   │ - Colección 'bbva' (cuotas)│
 │ - past-returns            │   │                            │
 └───────────────────────────┘   └────────────────────────────┘
```

### Estructura de Archivos a Crear / Modificar:
```text
fondos/
├── src/
│   ├── scrapers/
│   │   └── bbva/
│   │       ├── catalog.ts        # Catálogo base de 21 fondos (código, moneda, riesgo, comisiones)
│   │       ├── types.ts          # Contratos TypeBox y tipos estáticos TypeScript
│   │       ├── client.ts         # Cliente HTTP (gestión de tsec, headers, fetch nativo)
│   │       ├── parser.ts         # Normalización de cuotas y metadatos
│   │       ├── handler.ts        # Lambda Handler entrypoint
│   │       └── run-local.ts      # Script de prueba local
│   └── shared/
│       ├── config.ts             # Soporte para credenciales de autenticación BBVA
│       └── models/
│           └── quota.model.ts    # Export de BbvaQuotaModel
├── test/
│   └── scrapers/
│       └── bbva.test.ts          # Pruebas unitarias TDD (cliente, tsec, catalog, parser)
├── infra/
│   ├── lib/
│   │   └── fondos-stack.ts       # Definición de BbvaScraperFunction y EventBridge Rule
│   └── test/
│       └── fondos-stack.test.ts  # Pruebas sintéticas con @aws-cdk/assertions
└── specs/
    └── 2026-10-09-ingesta-bbva/
        ├── spec.md
        ├── plan.md
        ├── tasks.md
        └── checklist.md
```

## Contratos de Datos y Esquemas TypeBox

### 1. Autenticación (`grantingTickets/V02`):
```typescript
export const BbvaAuthRequestSchema = Type.Object({
  authentication: Type.Object({
    consumerID: Type.String(),
    userID: Type.String(),
    authenticationType: Type.String(),
    authenticationData: Type.Array(
      Type.Object({
        authenticationData: Type.Array(Type.String()),
        idAuthenticationData: Type.String(),
      })
    ),
  }),
});
```

### 2. Detalle de Fondos (`/management-entities-funds/{id}`):
```typescript
export const BbvaFundDetailResponseSchema = Type.Object(
  {
    data: Type.Object(
      {
        id: Type.String(),
        name: Type.String(),
        fundCurrency: Type.Object({
          id: Type.String(),
          name: Type.Optional(Type.String()),
        }),
        fundGroup: Type.Optional(
          Type.Object({
            riskLevel: Type.Optional(
              Type.Object({
                id: Type.String(),
                name: Type.Optional(Type.String()),
              })
            ),
          })
        ),
        fees: Type.Optional(
          Type.Object({
            itemizeFees: Type.Optional(
              Type.Array(
                Type.Object({
                  id: Type.String(),
                  itemizeFeeUnit: Type.Optional(
                    Type.Object({
                      percentage: Type.Number(),
                    })
                  ),
                })
              )
            ),
          })
        ),
      },
      { additionalProperties: true }
    ),
  },
  { additionalProperties: true }
);
```

### 3. Valores Cuota Históricos (`/past-returns`):
```typescript
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
    valueAmount: Type.Object({
      amount: Type.Number(),
      currency: Type.Optional(Type.String()),
    }),
  },
  { additionalProperties: true }
);

export const BbvaPastReturnsResponseSchema = Type.Object(
  {
    data: Type.Object(
      {
        weightedAverageAssetValues: Type.Array(BbvaWeightedAssetValueSchema),
      },
      { additionalProperties: true }
    ),
  },
  { additionalProperties: true }
);
```

### 4. Evento y Resultado de la Lambda:
```typescript
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
```

## Cruce y Mapeo Canónico del Catálogo (21 Fondos)

| Código | Moneda | Riesgo | Fee (%) | Nombre Canónico |
|---|---|---|---|---|
| `CASHSOL-PE` | PEN | 1 | 0.50 | BBVA Cash Soles FMIV |
| `CASHDOL-PE` | USD | 1 | 0.45 | BBVA Cash Dólares FMIV |
| `421` | PEN | 1 | 0.40 | BBVA Tesorería Soles FMIV |
| `BBVATSO-PE` | PEN | 2 | 0.60 | BBVA RENTA CORTO PLAZO SOLES FMIV |
| `SUPRDMNPEEQU` | USD | 2 | 0.55 | BBVA RENTA CORTO PLAZO DOLARES FMIV |
| `SUPRACCPEEQU` | PEN | 4 | 0.60 | Fondo de Fondos BBVA Conservador Global Soles FMIV |
| `SUPRVIP-PE` | USD | 3 | 0.60 | Fondo de Fondos BBVA Conservador Global Dólares FMIV |
| `SUPRSOL-PE` | PEN | 4 | 0.75 | BBVA RENTA MEDIANO PLAZO SOLES FMIV |
| `SUPRDOLPEEQU` | USD | 4 | 0.65 | BBVA RENTA MEDIANO PLAZO DOLARES FMIV |
| `382` | USD | 4 | 0.80 | Fondo de Fondos BBVA Distributivo Estratégico Global FMIV |
| `BBVAEM` | USD | 5 | 0.85 | Fondo de Fondos BBVA Renta Fija Mercados Emergentes FMIV |
| `MUTIIEQ-PE` | PEN | 6 | 0.70 | Fondo de Fondos BBVA Equilibrado Global Soles FMIV |
| `0452` | USD | 4 | 0.70 | Fondo de Fondos BBVA Equilibrado Global Dólares FMIV |
| `BBVABAL-PE` | USD | 6 | 0.80 | BBVA Deuda Financiera Global FMIV |
| `BBVAAGR-PE` | USD | 7 | 0.85 | BBVA Acciones Marcas Globales FMIV |
| `BBVARE-PE` | USD | 7 | 0.85 | Fondo de Fondos Acciones Globales Real Estate FMIV |
| `0372` | USD | 6 | 1.00 | Fondo de Fondos BBVA Deuda High Yield FMIV |
| `MUIIIAG-PE` | PEN | 7 | 1.00 | Fondo de Fondos BBVA Dinámico Global Soles FMIV |
| `BBVSEST-PE` | USD | 5 | 1.20 | BBVA Acciones Globales Tecnologicas FMIV |
| `BBVAANDI-PE` | USD | 7 | 0.80 | Fondo de Fondos BBVA Dinámico Global Dólares FMIV |
| `BBVAMIL-PE` | USD | 7 | 0.85 | Fondo de Fondos BBVA Acciones Globales Millennials FMIV |
