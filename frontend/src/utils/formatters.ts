import type { Currency, FundSource } from '../types/funds.js';

export function formatPercent(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatCurrency(amount: number, currency: Currency): string {
  const symbol = currency === 'USD' ? '$' : 'S/';
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol} ${formatted}`;
}

export function getProviderBadge(source: FundSource): { label: string; className: string } {
  switch (source) {
    case 'bbva':
      return {
        label: 'BBVA',
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      };
    case 'erni':
      return {
        label: 'Inteligo',
        className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      };
    case 'tyba':
      return {
        label: 'Tyba',
        className: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      };
  }
}

export function getRiskBadge(risk: number): { label: string; className: string } {
  if (risk <= 2) {
    return { label: `${risk}/7 Bajo`, className: 'text-emerald-400' };
  }
  if (risk <= 4) {
    return { label: `${risk}/7 Moderado`, className: 'text-amber-400' };
  }
  if (risk <= 6) {
    return { label: `${risk}/7 Alto`, className: 'text-orange-400' };
  }
  return { label: `${risk}/7 Muy Alto`, className: 'text-rose-400' };
}
