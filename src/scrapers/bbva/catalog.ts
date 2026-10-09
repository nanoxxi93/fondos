export interface BbvaFundConfig {
  id: string;
  name: string;
  currency: "PEN" | "USD";
  risk: number;
  fee: number;
}

/**
 * Catálogo canónico de los 21 fondos mutuos de BBVA Asset Management (Perú)
 * verificados contra los endpoints ASO y cruzados con las definiciones legacy.
 */
export const BBVA_FUNDS_CATALOG: Record<string, BbvaFundConfig> = {
  "CASHSOL-PE": {
    id: "CASHSOL-PE",
    name: "BBVA Cash Soles FMIV",
    currency: "PEN",
    risk: 1,
    fee: 0.5,
  },
  "CASHDOL-PE": {
    id: "CASHDOL-PE",
    name: "BBVA Cash Dólares FMIV",
    currency: "USD",
    risk: 1,
    fee: 0.45,
  },
  "421": {
    id: "421",
    name: "BBVA Tesorería Soles FMIV",
    currency: "PEN",
    risk: 1,
    fee: 0.4,
  },
  "BBVATSO-PE": {
    id: "BBVATSO-PE",
    name: "BBVA RENTA CORTO PLAZO SOLES FMIV",
    currency: "PEN",
    risk: 2,
    fee: 0.6,
  },
  SUPRDMNPEEQU: {
    id: "SUPRDMNPEEQU",
    name: "BBVA RENTA CORTO PLAZO DOLARES FMIV",
    currency: "USD",
    risk: 2,
    fee: 0.55,
  },
  SUPRACCPEEQU: {
    id: "SUPRACCPEEQU",
    name: "Fondo de Fondos BBVA Conservador Global Soles FMIV",
    currency: "PEN",
    risk: 4,
    fee: 0.6,
  },
  "SUPRVIP-PE": {
    id: "SUPRVIP-PE",
    name: "Fondo de Fondos BBVA Conservador Global Dólares FMIV",
    currency: "USD",
    risk: 3,
    fee: 0.6,
  },
  "SUPRSOL-PE": {
    id: "SUPRSOL-PE",
    name: "BBVA RENTA MEDIANO PLAZO SOLES FMIV",
    currency: "PEN",
    risk: 4,
    fee: 0.75,
  },
  SUPRDOLPEEQU: {
    id: "SUPRDOLPEEQU",
    name: "BBVA RENTA MEDIANO PLAZO DOLARES FMIV",
    currency: "USD",
    risk: 4,
    fee: 0.65,
  },
  "382": {
    id: "382",
    name: "Fondo de Fondos BBVA Distributivo Estratégico Global FMIV",
    currency: "USD",
    risk: 4,
    fee: 0.8,
  },
  BBVAEM: {
    id: "BBVAEM",
    name: "Fondo de Fondos BBVA Renta Fija Mercados Emergentes FMIV",
    currency: "USD",
    risk: 5,
    fee: 0.85,
  },
  "MUTIIEQ-PE": {
    id: "MUTIIEQ-PE",
    name: "Fondo de Fondos BBVA Equilibrado Global Soles FMIV",
    currency: "PEN",
    risk: 6,
    fee: 0.7,
  },
  "0452": {
    id: "0452",
    name: "Fondo de Fondos BBVA Equilibrado Global Dólares FMIV",
    currency: "USD",
    risk: 4,
    fee: 0.7,
  },
  "BBVABAL-PE": {
    id: "BBVABAL-PE",
    name: "BBVA Deuda Financiera Global FMIV",
    currency: "USD",
    risk: 6,
    fee: 0.8,
  },
  "BBVAAGR-PE": {
    id: "BBVAAGR-PE",
    name: "BBVA Acciones Marcas Globales FMIV",
    currency: "USD",
    risk: 7,
    fee: 0.85,
  },
  "BBVARE-PE": {
    id: "BBVARE-PE",
    name: "Fondo de Fondos Acciones Globales Real Estate FMIV",
    currency: "USD",
    risk: 7,
    fee: 0.85,
  },
  "0372": {
    id: "0372",
    name: "Fondo de Fondos BBVA Deuda High Yield FMIV",
    currency: "USD",
    risk: 6,
    fee: 1.0,
  },
  "MUIIIAG-PE": {
    id: "MUIIIAG-PE",
    name: "Fondo de Fondos BBVA Dinámico Global Soles FMIV",
    currency: "PEN",
    risk: 7,
    fee: 1.0,
  },
  "BBVSEST-PE": {
    id: "BBVSEST-PE",
    name: "BBVA Acciones Globales Tecnologicas FMIV",
    currency: "USD",
    risk: 5,
    fee: 1.2,
  },
  "BBVAANDI-PE": {
    id: "BBVAANDI-PE",
    name: "Fondo de Fondos BBVA Dinámico Global Dólares FMIV",
    currency: "USD",
    risk: 7,
    fee: 0.8,
  },
  "BBVAMIL-PE": {
    id: "BBVAMIL-PE",
    name: "Fondo de Fondos BBVA Acciones Globales Millennials FMIV",
    currency: "USD",
    risk: 7,
    fee: 0.85,
  },
};
