import React, { useState, useId } from 'react';
import { Calculator, ArrowRight, Info, Calendar } from 'lucide-react';
import type { TeaDataset, TimeHorizon } from '../types/funds.js';
import { formatCurrency, formatPercent } from '../utils/formatters.js';

interface SimulatorProps {
  funds: TeaDataset[];
  selectedFundKey?: string;
  horizon: TimeHorizon | 'custom';
  days: number;
  onHorizonChange: (h: TimeHorizon) => void;
  onSelectFundKey?: (key: string) => void;
}

const HORIZONS: { label: string; value: TimeHorizon }[] = [
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: '180D', value: 180 },
  { label: '1 Año', value: 365 },
  { label: '3 Años', value: 1095 },
  { label: 'YTD', value: 'YTD' },
];

export const Simulator: React.FC<SimulatorProps> = ({
  funds,
  selectedFundKey,
  horizon,
  days,
  onHorizonChange,
  onSelectFundKey,
}) => {
  const [amount, setAmount] = useState<number>(10000);
  const amountInputId = useId();
  const fundSelectId = useId();

  // Fondo activo para la simulación
  const activeFund =
    funds.find((f) => `${f.meta.source}:${f.meta.idFondo}` === selectedFundKey) ||
    funds[0] ||
    null;

  const validAmount = isNaN(amount) || amount <= 0 ? 0 : amount;
  const returnRate = activeFund ? activeFund.meta.value : 0;
  const profit = validAmount * (returnRate / 100);
  const finalBalance = validAmount + profit;
  const currency = activeFund ? activeFund.meta.currency : 'PEN';

  return (
    <section className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 transition-colors shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Calculator className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Simulador de Inversión Proyectada
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Calcula cuánto habrías ganado o perdido en este periodo ({days} días) con un capital determinado.
          </p>
        </div>

        {/* Selector de horizonte temporal: en fila propia en <1024px, a la derecha en >=1024px */}
        <div className="flex items-center flex-wrap gap-2 shrink-0 pt-1 lg:pt-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            <span>Horizonte:</span>
          </div>
          <div className="inline-flex flex-wrap p-1 rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 gap-1 items-center">
            {HORIZONS.map((h) => {
              const isActive = horizon === h.value;
              return (
                <button
                  key={String(h.value)}
                  type="button"
                  onClick={() => onHorizonChange(h.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {h.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controles de Inversión (2 columnas en desktop) */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Input de Capital Inicial */}
          <div>
            <label htmlFor={amountInputId} className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Capital Inicial ({currency === 'USD' ? '$' : 'S/'})
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-400 dark:text-slate-500 font-semibold text-xs">
                {currency === 'USD' ? '$' : 'S/'}
              </span>
              <input
                id={amountInputId}
                type="number"
                min="1"
                step="500"
                value={amount || ''}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                placeholder="10000"
                className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-xl py-2 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 font-bold focus:outline-none focus:border-emerald-500 font-mono transition"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Ingresa el monto que deseas evaluar.</p>
          </div>

          {/* Selector de Fondo */}
          <div>
            <label htmlFor={fundSelectId} className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Fondo Mutuo de Referencia
            </label>
            <select
              id={fundSelectId}
              value={activeFund ? `${activeFund.meta.source}:${activeFund.meta.idFondo}` : ''}
              onChange={(e) => onSelectFundKey?.(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer truncate"
            >
              {funds.map((f) => {
                const key = `${f.meta.source}:${f.meta.idFondo}`;
                return (
                  <option key={key} value={key}>
                    {f.label} ({formatPercent(f.meta.value)})
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">También puedes hacer clic en cualquier fondo de la tabla arriba.</p>
          </div>
        </div>

        {/* Resultados Calculados (1 columna en desktop) */}
        <div className="lg:col-span-1 bg-emerald-500/5 dark:bg-gradient-to-br dark:from-emerald-500/10 dark:via-teal-500/5 dark:to-transparent border border-emerald-500/20 rounded-xl p-4 space-y-2.5">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>Saldo Estimado al Cierre:</span>
            {activeFund && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                TEA Neta: {formatPercent(activeFund.meta.value)}
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
            {formatCurrency(finalBalance, currency)}
          </div>

          <div className="flex items-center justify-between text-xs pt-2.5 border-t border-emerald-500/15">
            <span className="text-slate-500 dark:text-slate-400">Ganancia / Pérdida Neta:</span>
            <span
              className={`font-bold flex items-center gap-1 ${
                profit >= 0
                  ? 'text-emerald-600 dark:text-emerald-300'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              <ArrowRight className="w-3 h-3" />
              {formatCurrency(profit, currency)}
            </span>
          </div>

          <div className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1 leading-tight">
            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
            <span>
              {activeFund
                ? `Comisión de administración de ${activeFund.meta.fee}% anual ya descontada del resultado.`
                : 'Seleccione un fondo para simular.'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
