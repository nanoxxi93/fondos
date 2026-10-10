import React, { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Sparkles, Eye, EyeOff } from 'lucide-react';
import type { TeaDataset } from '../types/funds.js';
import type { Theme } from '../hooks/useTheme.js';
import type { ViewMode } from '../hooks/useFundsData.js';
import { formatPercent } from '../utils/formatters.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChartViewProps {
  labels: string[];
  datasets: TeaDataset[];
  visibleDatasetIds: Set<string>;
  viewMode: ViewMode;
  theme: Theme;
  onShowOnlyTop5: () => void;
  onShowAll: () => void;
  onHideAll: () => void;
}

export const ChartView: React.FC<ChartViewProps> = ({
  labels,
  datasets,
  visibleDatasetIds,
  viewMode,
  theme,
  onShowOnlyTop5,
  onShowAll,
  onHideAll,
}) => {
  const isDark = theme === 'dark';

  // Configuración de datasets adaptada al set de visibilidad
  const chartDatasets = useMemo(() => {
    return datasets.map((d) => {
      const isVisible = visibleDatasetIds.has(`${d.meta.source}:${d.meta.idFondo}`);
      return {
        ...d,
        hidden: !isVisible,
        borderWidth: isVisible ? 2.5 : 1,
        pointRadius: 0,
        pointHitRadius: 10,
        tension: 0.2,
      };
    });
  }, [datasets, visibleDatasetIds]);

  const chartData = useMemo(() => {
    return {
      labels,
      datasets: chartDatasets,
    };
  }, [labels, chartDatasets]);

  const options: ChartOptions<'line'> = useMemo(() => {
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? 'rgba(51, 65, 85, 0.3)' : 'rgba(226, 232, 240, 0.8)';
    const tooltipBg = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)';
    const tooltipText = isDark ? '#f8fafc' : '#0f172a';
    const tooltipBorder = isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(203, 213, 225, 0.9)';

    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: false, // Desactiva animación en actualizaciones para evitar saltos de layout
      spanGaps: true, // Crucial para puentear feriados y fines de semana
      interaction: {
        mode: 'nearest',
        axis: 'xy', // Solo selecciona la curva más cercana al puntero, no todas las coincidentes en X
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: 'nearest',
          axis: 'xy', // Muestra exclusivamente el fondo sobre el cual se pasa el mouse
          intersect: false,
          backgroundColor: tooltipBg,
          titleColor: tooltipText,
          bodyColor: tooltipText,
          borderColor: tooltipBorder,
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: {
            label: (context) => {
              const dataset = datasets[context.datasetIndex];
              const val = context.parsed.y;
              if (val === null || val === undefined) return '';
              const fee = dataset?.meta?.fee ? ` (Fee: ${dataset.meta.fee}%)` : '';
              return ` ${context.dataset.label}: ${formatPercent(val)}${fee}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            color: gridColor,
          },
          ticks: {
            color: textColor,
            font: { size: 10 },
            maxTicksLimit: 12,
          },
        },
        y: {
          beginAtZero: false,
          grace: '5%', // Padding dinámico para evitar cortes en valores extremos
          grid: {
            color: gridColor,
          },
          ticks: {
            color: textColor,
            font: { size: 11 },
            callback: (val) => `${val}%`,
          },
          title: {
            display: true,
            text: 'Variación Neta (%)',
            color: textColor,
            font: { size: 11, weight: 'bold' },
          },
        },
      },
    };
  }, [isDark, datasets]);

  return (
    <section className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800/80">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-2">
            Curva de Variación Relativa Neta (%)
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              · Normalizado al día inicial
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Compara la evolución histórica real descontando la comisión anual de cada SAF.
          </p>
        </div>

        {/* Atajos Rápidos: en fila independiente en <1024px, alineados a la derecha en >=1024px */}
        <div className="flex items-center flex-wrap gap-2 shrink-0 pt-1 lg:pt-0">
          <button
            type="button"
            onClick={onShowOnlyTop5}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shadow-xs ${
              viewMode === 'top5'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Ver Solo Top 5</span>
          </button>
          <button
            type="button"
            onClick={onShowAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shadow-xs ${
              viewMode === 'all'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Mostrar Todos</span>
          </button>
          <button
            type="button"
            onClick={onHideAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer shadow-xs ${
              viewMode === 'none'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm shadow-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>Ocultar Todos</span>
          </button>
        </div>
      </div>

      {/* Canvas Wrapper */}
      <div className="relative w-full h-[360px] md:h-[430px] rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800/80 p-3 flex items-center justify-center">
        {labels.length > 0 ? (
          <Line data={chartData} options={options} />
        ) : (
          <div className="text-center text-xs text-slate-500 dark:text-slate-400">
            No hay observaciones temporales para graficar en este periodo.
          </div>
        )}
      </div>
    </section>
  );
};
