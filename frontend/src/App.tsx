import { useState } from 'react';
import { useTheme } from './hooks/useTheme.js';
import { useFundsData } from './hooks/useFundsData.js';
import { Header } from './components/Header.js';
import { KpiBentoGrid } from './components/KpiBentoGrid.js';
import { FilterBar } from './components/FilterBar.js';
import { ChartView } from './components/ChartView.js';
import { FundsTable } from './components/FundsTable.js';
import { Simulator } from './components/Simulator.js';
import { LoadingSkeleton, ErrorCard } from './components/Feedback.js';

export function App() {
  const { theme, toggleTheme } = useTheme();
  const {
    days,
    horizon,
    currency,
    maxRisk,
    provider,
    searchQuery,
    sortField,
    sortDirection,
    data,
    filteredDatasets,
    sortedTableDatasets,
    visibleDatasetIds,
    viewMode,
    isLoading,
    error,
    kpis,
    setCurrency,
    setMaxRisk,
    setProvider,
    setSearchQuery,
    changeHorizon,
    changeCustomDays,
    handleSort,
    toggleVisibility,
    showOnlyTop5,
    showAllVisible,
    hideAllVisible,
    refetch,
  } = useFundsData();

  const [selectedFundKey, setSelectedFundKey] = useState<string | undefined>(undefined);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 p-4 md:p-8 antialiased selection:bg-emerald-500 selection:text-slate-950 transition-colors">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Cabecera y Navegación */}
        <Header theme={theme} onToggleTheme={toggleTheme} />

        {/* Manejo de Carga y Error */}
        {isLoading && !data && <LoadingSkeleton />}

        {error && !data && <ErrorCard message={error} onRetry={refetch} />}

        {data && (
          <>
            {/* 1. Bento Grid con Métricas de Alto Impacto */}
            <KpiBentoGrid
              top1={kpis.top1}
              mostStable={kpis.mostStable}
              avgTea={kpis.avgTea}
              totalFunds={kpis.total}
              days={days}
            />

            {/* 2. Barra de Filtros Interactiva */}
            <FilterBar
              days={days}
              horizon={horizon}
              currency={currency}
              maxRisk={maxRisk}
              provider={provider}
              onHorizonChange={changeHorizon}
              onCustomDaysChange={changeCustomDays}
              onCurrencyChange={setCurrency}
              onRiskChange={setMaxRisk}
              onProviderChange={setProvider}
            />

            {/* 3. Visualización Gráfica Interactiva con Chart.js */}
            <ChartView
              labels={data.labels}
              datasets={filteredDatasets}
              visibleDatasetIds={visibleDatasetIds}
              viewMode={viewMode}
              theme={theme}
              onShowOnlyTop5={showOnlyTop5}
              onShowAll={showAllVisible}
              onHideAll={hideAllVisible}
            />

            {/* 4. Tabla de Ranking de Fondos (Justo debajo de la gráfica para interacción directa) */}
            <FundsTable
              funds={sortedTableDatasets}
              visibleDatasetIds={visibleDatasetIds}
              searchQuery={searchQuery}
              sortField={sortField}
              sortDirection={sortDirection}
              onSearchChange={setSearchQuery}
              onSortChange={handleSort}
              onToggleVisibility={toggleVisibility}
              onSelectForSimulator={setSelectedFundKey}
            />

            {/* 5. Simulador de Inversión al final, con su propio selector de horizonte */}
            <Simulator
              funds={filteredDatasets}
              selectedFundKey={selectedFundKey}
              horizon={horizon}
              days={days}
              onHorizonChange={changeHorizon}
              onSelectFundKey={setSelectedFundKey}
            />
          </>
        )}

        {/* Pie de Página Minimalista */}
        <footer className="pt-8 pb-4 border-t border-slate-200 dark:border-slate-800/80 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1">
          <p className="font-medium text-slate-600 dark:text-slate-400">Fondos Mutuos Perú · 2026</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
