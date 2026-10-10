export type FundSource = 'erni' | 'bbva' | 'tyba';
export type Currency = 'PEN' | 'USD';

export interface TeaDatasetMeta {
  index: number;
  idFondo: string;
  source: FundSource;
  value: number;       // Rendimiento neto (%) en el periodo
  firstValue: number;  // Valor cuota al inicio
  lastValue: number;   // Valor cuota al cierre
  fee: number;         // Comisión anual (%)
  currency: Currency;  // PEN o USD
  risk: number;        // Nivel de riesgo 1 al 7
}

export interface TeaDataset {
  label: string;
  data: (number | null)[];
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  pointRadius: number;
  hidden: boolean;
  meta: TeaDatasetMeta;
}

export interface TeaChartData {
  labels: string[];
  datasets: TeaDataset[];
}

export interface HealthResponse {
  status: 'OK' | 'Mongo unavailable';
  timestamp: string;
}

export type TimeHorizon = 7 | 30 | 90 | 180 | 365 | 1095 | 'YTD';
export type CurrencyFilter = 'ALL' | 'PEN' | 'USD';
export type ProviderFilter = 'ALL' | 'bbva' | 'erni' | 'tyba';

export interface FilterState {
  days: number;
  horizon: TimeHorizon | 'custom';
  currency: CurrencyFilter;
  maxRisk: number;
  provider: ProviderFilter;
  searchQuery: string;
}

export type SortField = 'name' | 'source' | 'currency' | 'risk' | 'fee' | 'value';
export type SortDirection = 'asc' | 'desc';
