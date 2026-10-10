import { describe, it, expect } from 'vitest';
import {
  formatPercent,
  formatCurrency,
  getProviderBadge,
  getRiskBadge,
} from '../../frontend/src/utils/formatters.js';

describe('Frontend Formatters (frontend/src/utils/formatters.ts)', () => {
  it('debe formatear porcentajes con signo positivo para valores mayores a 0', () => {
    expect(formatPercent(12.345)).toBe('+12.35%');
    expect(formatPercent(0.01)).toBe('+0.01%');
  });

  it('debe formatear porcentajes negativos sin agregar doble signo', () => {
    expect(formatPercent(-4.56)).toBe('-4.56%');
  });

  it('debe formatear porcentajes en 0 con dos decimales', () => {
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('debe formatear montos en soles (PEN) con símbolo S/ y separador de miles', () => {
    expect(formatCurrency(10000, 'PEN')).toBe('S/ 10,000.00');
    expect(formatCurrency(1234.5, 'PEN')).toBe('S/ 1,234.50');
  });

  it('debe formatear montos en dólares (USD) con símbolo $', () => {
    expect(formatCurrency(2500, 'USD')).toBe('$ 2,500.00');
  });

  it('debe retornar badges correctos por administradora', () => {
    expect(getProviderBadge('bbva').label).toBe('BBVA');
    expect(getProviderBadge('bbva').className).toContain('text-blue-400');

    expect(getProviderBadge('erni').label).toBe('Inteligo');
    expect(getProviderBadge('erni').className).toContain('text-emerald-400');

    expect(getProviderBadge('tyba').label).toBe('Tyba');
    expect(getProviderBadge('tyba').className).toContain('text-orange-400');
  });

  it('debe retornar badges correctos de nivel de riesgo', () => {
    expect(getRiskBadge(1).label).toBe('1/7 Bajo');
    expect(getRiskBadge(3).label).toBe('3/7 Moderado');
    expect(getRiskBadge(5).label).toBe('5/7 Alto');
    expect(getRiskBadge(7).label).toBe('7/7 Muy Alto');
  });
});
