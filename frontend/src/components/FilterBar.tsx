import React from 'react';
import { Calendar, DollarSign, ShieldAlert, Building2 } from 'lucide-react';
import type { TimeHorizon, CurrencyFilter, ProviderFilter } from '../types/funds.js';
import { getRiskBadge } from '../utils/formatters.js';

interface FilterBarProps {
  days: number;
  horizon: TimeHorizon | 'custom';
  currency: CurrencyFilter;
  maxRisk: number;
  provider: ProviderFilter;
  onHorizonChange: (h: TimeHorizon) => void;
  onCustomDaysChange: (d: number) => void;
  onCurrencyChange: (c: CurrencyFilter) => void;
  onRiskChange: (r: number) => void;
  onProviderChange: (p: ProviderFilter) => void;
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

export const FilterBar: React.FC<FilterBarProps> = ({
  days,
  horizon,
  currency,
  maxRisk,
  provider,
  onHorizonChange,
  onCustomDaysChange,
  onCurrencyChange,
  onRiskChange,
  onProviderChange,
}) => {
  return (
    <section className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 md:p-5 space-y-4 transition-colors shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Selector de Horizontes en Píldoras */}
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            <span>Horizonte Temporal ({days} días)</span>
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
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
                  }`}
                >
                  {h.label}
                </button>
              );
            })}

            {/* Input para días personalizados */}
            <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Días:</span>
              <input
                type="number"
                min="1"
                max="3650"
                value={days}
                onChange={(e) => onCustomDaysChange(Number(e.target.value))}
                className="w-16 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Filtros de Moneda, Administradora y Riesgo */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Selector de Moneda */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
              <span>Moneda</span>
            </div>
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 gap-1">
              <button
                onClick={() => onCurrencyChange('ALL')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  currency === 'ALL'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => onCurrencyChange('PEN')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  currency === 'PEN'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                PEN (S/)
              </button>
              <button
                onClick={() => onCurrencyChange('USD')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  currency === 'USD'
                    ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                USD ($)
              </button>
            </div>
          </div>

          {/* Selector de Administradora */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <Building2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>SAF</span>
            </div>
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 gap-1">
              <button
                onClick={() => onProviderChange('ALL')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  provider === 'ALL'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => onProviderChange('bbva')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  provider === 'bbva'
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                BBVA
              </button>
              <button
                onClick={() => onProviderChange('erni')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  provider === 'erni'
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Inteligo
              </button>
              <button
                onClick={() => onProviderChange('tyba')}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer ${
                  provider === 'tyba'
                    ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Tyba
              </button>
            </div>
          </div>

          {/* Slider de Riesgo */}
          <div className="w-full sm:w-56">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Riesgo Máx.</span>
              </span>
              <span className={`text-xs font-bold whitespace-nowrap ml-2 ${getRiskBadge(maxRisk).className}`}>
                {getRiskBadge(maxRisk).label}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="7"
              value={maxRisk}
              onChange={(e) => onRiskChange(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
