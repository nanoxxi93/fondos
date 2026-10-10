import React from 'react';
import { AlertCircle, RefreshCw, FilterX } from 'lucide-react';

export const LoadingSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Skeletons para las 4 tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-200/60 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 rounded-2xl p-4 h-28" />
        ))}
      </div>

      {/* Skeleton para la barra de filtros */}
      <div className="bg-slate-200/60 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 h-24" />

      {/* Skeleton para el gráfico */}
      <div className="bg-slate-200/60 dark:bg-slate-900/60 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 h-[380px]" />
    </div>
  );
};

interface ErrorCardProps {
  message: string;
  onRetry: () => void;
}

export const ErrorCard: React.FC<ErrorCardProps> = ({ message, onRetry }) => {
  return (
    <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 text-center space-y-4 max-w-lg mx-auto my-12">
      <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-500 dark:text-rose-400 flex items-center justify-center mx-auto">
        <AlertCircle className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Error al cargar datos analíticos</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500 text-slate-950 font-bold text-xs hover:bg-rose-400 transition cursor-pointer shadow-lg shadow-rose-500/20"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Reintentar Conexión</span>
      </button>
    </div>
  );
};

interface EmptyStateProps {
  onResetFilters: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onResetFilters }) => {
  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4 max-w-md mx-auto my-8 shadow-xs">
      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto">
        <FilterX className="w-6 h-6" />
      </div>
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Sin fondos coincidentes</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Ningún fondo cumple con los criterios de moneda, riesgo o administradora seleccionados.
        </p>
      </div>
      <button
        onClick={onResetFilters}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium transition cursor-pointer"
      >
        <span>Restablecer Filtros</span>
      </button>
    </div>
  );
};
