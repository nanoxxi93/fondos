import React from 'react';
import { Trophy, ShieldCheck, BarChart3, Layers } from 'lucide-react';
import type { TeaDataset } from '../types/funds.js';
import { formatPercent, getProviderBadge } from '../utils/formatters.js';

interface KpiBentoGridProps {
  top1: TeaDataset | null;
  mostStable: TeaDataset | null;
  avgTea: number;
  totalFunds: number;
  days: number;
}

export const KpiBentoGrid: React.FC<KpiBentoGridProps> = ({
  top1,
  mostStable,
  avgTea,
  totalFunds,
  days,
}) => {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* KPI 1: Top Rendimiento */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-emerald-500/40 transition shadow-xs">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition pointer-events-none" />
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 font-medium">
            <Trophy className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            Top 1 Rendimiento ({days}D)
          </span>
          {top1 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                getProviderBadge(top1.meta.source).className
              }`}
            >
              {getProviderBadge(top1.meta.source).label}
            </span>
          )}
        </div>
        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 flex items-baseline gap-1">
          {top1 ? formatPercent(top1.meta.value) : '--'}
          <span className="text-xs font-normal text-slate-400">neto</span>
        </div>
        <p className="text-xs text-slate-800 dark:text-slate-300 font-medium truncate mt-1">
          {top1 ? top1.label : 'Sin datos disponibles'}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {top1
            ? `${top1.meta.currency} · Riesgo ${top1.meta.risk}/7 · Fee ${top1.meta.fee}%`
            : 'Ajuste los filtros'}
        </p>
      </div>

      {/* KPI 2: Fondo Más Conservador */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-blue-500/40 transition shadow-xs">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition pointer-events-none" />
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            Menor Riesgo / Estable
          </span>
          {mostStable && (
            <span
              className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                getProviderBadge(mostStable.meta.source).className
              }`}
            >
              {getProviderBadge(mostStable.meta.source).label}
            </span>
          )}
        </div>
        <div className="text-2xl font-bold text-sky-600 dark:text-sky-400 flex items-baseline gap-1">
          {mostStable ? formatPercent(mostStable.meta.value) : '--'}
          <span className="text-xs font-normal text-slate-400">neto</span>
        </div>
        <p className="text-xs text-slate-800 dark:text-slate-300 font-medium truncate mt-1">
          {mostStable ? mostStable.label : 'Sin datos disponibles'}
        </p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {mostStable
            ? `${mostStable.meta.currency} · Riesgo ${mostStable.meta.risk}/7 · Fee ${mostStable.meta.fee}%`
            : 'Ajuste los filtros'}
        </p>
      </div>

      {/* KPI 3: Promedio General */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-teal-500/40 transition shadow-xs">
        <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-teal-500/10 rounded-full blur-xl group-hover:bg-teal-500/20 transition pointer-events-none" />
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 font-medium">
            <BarChart3 className="w-3.5 h-3.5 text-teal-500 dark:text-teal-400" />
            Promedio de Mercado
          </span>
          <span className="text-slate-400 text-[11px]">Visible</span>
        </div>
        <div
          className={`text-2xl font-bold flex items-baseline gap-1 ${
            avgTea >= 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {formatPercent(avgTea)}
          <span className="text-xs font-normal text-slate-400">TEA media</span>
        </div>
        <p className="text-xs text-slate-800 dark:text-slate-300 mt-1">Calculado sobre fondos filtrados</p>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Ventana de {days} días calendario</p>
      </div>

      {/* KPI 4: Universo de Fondos */}
      <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 relative overflow-hidden group hover:border-purple-500/40 transition shadow-xs">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
          <span className="flex items-center gap-1.5 font-medium">
            <Layers className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
            Fondos Monitoreados
          </span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            3 SAFs
          </span>
        </div>
        <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{totalFunds} Fondos</div>
        <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> BBVA
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Inteligo
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" /> Tyba
          </span>
        </div>
      </div>
    </section>
  );
};
