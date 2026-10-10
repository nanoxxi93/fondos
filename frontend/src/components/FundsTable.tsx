import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import type { TeaDataset, SortField, SortDirection } from '../types/funds.js';
import { formatPercent, getProviderBadge, getRiskBadge } from '../utils/formatters.js';

interface FundsTableProps {
  funds: TeaDataset[];
  visibleDatasetIds: Set<string>;
  searchQuery: string;
  sortField: SortField;
  sortDirection: SortDirection;
  onSearchChange: (q: string) => void;
  onSortChange: (field: SortField) => void;
  onToggleVisibility: (fund: TeaDataset) => void;
  onSelectForSimulator?: (fundKey: string) => void;
}

export const FundsTable: React.FC<FundsTableProps> = ({
  funds,
  visibleDatasetIds,
  searchQuery,
  sortField,
  sortDirection,
  onSearchChange,
  onSortChange,
  onToggleVisibility,
  onSelectForSimulator,
}) => {
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-60" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-emerald-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-500" />
    );
  };

  return (
    <section className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 transition-colors shadow-xs">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Ranking de Fondos Mutuos ({funds.length})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Haz clic en los encabezados para ordenar o activa las casillas para agregar o quitar curvas en el gráfico.
          </p>
        </div>

        {/* Buscador en Vivo */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por fondo o SAF..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-xl py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>
      </div>

      {/* Contenedor de Tabla con Scroll y Sticky Header */}
      <div className="max-h-[480px] overflow-y-auto overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl scrollbar-thin">
        <table className="w-full text-left border-collapse text-xs min-w-[640px]">
          <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs">
            <tr className="text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <th className="p-3 w-12 text-center">Ver</th>
              <th
                onClick={() => onSortChange('name')}
                className="p-3 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Fondo Mutuo</span>
                  {renderSortIcon('name')}
                </div>
              </th>
              <th
                onClick={() => onSortChange('source')}
                className="p-3 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>SAF</span>
                  {renderSortIcon('source')}
                </div>
              </th>
              <th
                onClick={() => onSortChange('currency')}
                className="p-3 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Moneda</span>
                  {renderSortIcon('currency')}
                </div>
              </th>
              <th
                onClick={() => onSortChange('risk')}
                className="p-3 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Riesgo</span>
                  {renderSortIcon('risk')}
                </div>
              </th>
              <th
                onClick={() => onSortChange('fee')}
                className="p-3 cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition select-none"
              >
                <div className="flex items-center gap-1.5">
                  <span>Comisión</span>
                  {renderSortIcon('fee')}
                </div>
              </th>
              <th
                onClick={() => onSortChange('value')}
                className="p-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-slate-200 transition select-none"
              >
                <div className="flex items-center justify-end gap-1.5">
                  <span>Rendimiento</span>
                  {renderSortIcon('value')}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
            {funds.length > 0 ? (
              funds.map((fund) => {
                const key = `${fund.meta.source}:${fund.meta.idFondo}`;
                const isVisible = visibleDatasetIds.has(key);
                const badge = getProviderBadge(fund.meta.source);
                const riskBadge = getRiskBadge(fund.meta.risk);

                return (
                  <tr
                    key={key}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition group ${
                      isVisible ? 'bg-emerald-500/5 dark:bg-slate-800/15' : ''
                    }`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={() => onToggleVisibility(fund)}
                        aria-label={`Alternar visibilidad de ${fund.label}`}
                        className="accent-emerald-500 rounded cursor-pointer w-4 h-4"
                      />
                    </td>
                    <td className="p-3 font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: fund.borderColor }}
                        />
                        <button
                          type="button"
                          onClick={() => onSelectForSimulator?.(key)}
                          className="text-left hover:text-emerald-500 dark:hover:text-emerald-400 hover:underline transition truncate max-w-sm cursor-pointer"
                          title="Hacer clic para simular este fondo"
                        >
                          {fund.label}
                        </button>
                      </div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                        {fund.meta.currency}
                      </span>
                    </td>
                    <td className="p-3 font-medium">
                      <span className={riskBadge.className}>{riskBadge.label}</span>
                    </td>
                    <td className="p-3 text-slate-500 dark:text-slate-400 font-mono">{fund.meta.fee}%</td>
                    <td className="p-3 text-right font-bold text-sm">
                      <span
                        className={
                          fund.meta.value >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }
                      >
                        {formatPercent(fund.meta.value)}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                  No se encontraron fondos que coincidan con la búsqueda o los filtros activos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
