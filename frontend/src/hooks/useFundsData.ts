import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
  TeaChartData,
  TeaDataset,
  TimeHorizon,
  CurrencyFilter,
  ProviderFilter,
  SortField,
  SortDirection,
} from '../types/funds.js';
import { fetchTeaData } from '../services/api.js';

export type ViewMode = 'top5' | 'all' | 'none' | 'custom';

export function calculateYtdDays(): number {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const diffTime = Math.abs(now.getTime() - startOfYear.getTime());
  return Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

export function useFundsData() {
  // Inicialización de filtros desde los parámetros de la URL
  const initialParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const daysParam = parseInt(params.get('days') || '90', 10);
    const currParam = (params.get('currency')?.toUpperCase() || 'ALL') as CurrencyFilter;
    const riskParam = parseInt(params.get('risk') || '7', 10);
    return {
      days: isNaN(daysParam) || daysParam < 1 ? 90 : Math.min(daysParam, 3650),
      currency: (currParam === 'PEN' || currParam === 'USD' ? currParam : 'ALL') as CurrencyFilter,
      maxRisk: isNaN(riskParam) || riskParam < 1 || riskParam > 7 ? 7 : riskParam,
    };
  }, []);

  const [days, setDays] = useState<number>(initialParams.days);
  const [horizon, setHorizon] = useState<TimeHorizon | 'custom'>(
    initialParams.days === 90 ? 90 : 'custom'
  );
  const [currency, setCurrency] = useState<CurrencyFilter>(initialParams.currency);
  const [maxRisk, setMaxRisk] = useState<number>(initialParams.maxRisk);
  const [provider, setProvider] = useState<ProviderFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modo de visualización de los atajos rápidos
  const [viewMode, setViewMode] = useState<ViewMode>('top5');

  // Ordenamiento de tabla
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Estado del servicio
  const [data, setData] = useState<TeaChartData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Visibilidad individual de series en el gráfico (set de IDs `${source}:${idFondo}`)
  const [visibleDatasetIds, setVisibleDatasetIds] = useState<Set<string>>(new Set());

  // Sincronización con la URL del navegador
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('days', String(days));
    if (currency !== 'ALL') params.set('currency', currency);
    if (maxRisk < 7) params.set('risk', String(maxRisk));

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [days, currency, maxRisk]);

  // Carga de datos desde la API
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchTeaData({
        days,
        currency: currency === 'ALL' ? undefined : currency,
        risk: maxRisk,
      });
      setData(response);

      // Actualizar visibilidad según el viewMode activo
      setVisibleDatasetIds((prev) => {
        // Filtrar candidatos por el proveedor seleccionado actual
        const matching = response.datasets.filter(
          (d) => provider === 'ALL' || d.meta.source === provider
        );

        if (viewMode === 'top5') {
          const top5 = [...matching]
            .sort((a, b) => b.meta.value - a.meta.value)
            .slice(0, 5)
            .map((d) => `${d.meta.source}:${d.meta.idFondo}`);
          return new Set(top5);
        }

        if (viewMode === 'all') {
          return new Set(matching.map((d) => `${d.meta.source}:${d.meta.idFondo}`));
        }

        if (viewMode === 'none') {
          return new Set();
        }

        // Si era 'custom', preservar las selecciones del usuario que sigan existiendo en los nuevos datos
        const allNewKeys = new Set(
          response.datasets.map((d) => `${d.meta.source}:${d.meta.idFondo}`)
        );
        const preserved = new Set<string>();
        prev.forEach((key) => {
          if (allNewKeys.has(key)) preserved.add(key);
        });

        // Si por alguna razón ninguna selección previa existe, hacer fallback a top 5
        if (preserved.size === 0 && matching.length > 0) {
          const top5 = [...matching]
            .sort((a, b) => b.meta.value - a.meta.value)
            .slice(0, 5)
            .map((d) => `${d.meta.source}:${d.meta.idFondo}`);
          return new Set(top5);
        }

        return preserved;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido al conectar con la API';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [days, currency, maxRisk, provider, viewMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Manejo de cambio de horizonte rápido
  const changeHorizon = (newHorizon: TimeHorizon) => {
    setHorizon(newHorizon);
    if (newHorizon === 'YTD') {
      setDays(calculateYtdDays());
    } else {
      setDays(newHorizon);
    }
  };

  const changeCustomDays = (customDays: number) => {
    const clamped = Math.min(3650, Math.max(1, customDays));
    setHorizon('custom');
    setDays(clamped);
  };

  // Filtrado de datasets en memoria (por proveedor y búsqueda textual)
  const filteredDatasets = useMemo(() => {
    if (!data) return [];
    return data.datasets.filter((dataset) => {
      // Filtro por proveedor SAF
      if (provider !== 'ALL' && dataset.meta.source !== provider) {
        return false;
      }
      // Filtro por búsqueda textual
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = dataset.label.toLowerCase().includes(query);
        const matchesSource = dataset.meta.source.toLowerCase().includes(query);
        if (!matchesName && !matchesSource) return false;
      }
      return true;
    });
  }, [data, provider, searchQuery]);

  // Manejo de cambio de proveedor con actualización de Top 5 para esa fuente
  const changeProvider = (newProvider: ProviderFilter) => {
    setProvider(newProvider);
    if (!data) return;

    const matching = data.datasets.filter(
      (d) => newProvider === 'ALL' || d.meta.source === newProvider
    );

    if (viewMode === 'top5') {
      const top5 = [...matching]
        .sort((a, b) => b.meta.value - a.meta.value)
        .slice(0, 5)
        .map((d) => `${d.meta.source}:${d.meta.idFondo}`);
      setVisibleDatasetIds(new Set(top5));
    } else if (viewMode === 'all') {
      setVisibleDatasetIds(new Set(matching.map((d) => `${d.meta.source}:${d.meta.idFondo}`)));
    }
  };

  // Datasets ordenados para la tabla
  const sortedTableDatasets = useMemo(() => {
    return [...filteredDatasets].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.label.localeCompare(b.label);
          break;
        case 'source':
          comparison = a.meta.source.localeCompare(b.meta.source);
          break;
        case 'currency':
          comparison = a.meta.currency.localeCompare(b.meta.currency);
          break;
        case 'risk':
          comparison = a.meta.risk - b.meta.risk;
          break;
        case 'fee':
          comparison = a.meta.fee - b.meta.fee;
          break;
        case 'value':
        default:
          comparison = a.meta.value - b.meta.value;
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredDatasets, sortField, sortDirection]);

  // Cambiar ordenamiento de columna
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'name' ? 'asc' : 'desc');
    }
  };

  // KPIs calculados
  const kpis = useMemo(() => {
    if (!filteredDatasets.length) {
      return { top1: null, mostStable: null, avgTea: 0, total: 0 };
    }

    // Top 1 por mayor rentabilidad
    const sortedByValue = [...filteredDatasets].sort((a, b) => b.meta.value - a.meta.value);
    const top1 = sortedByValue[0] || null;

    // Más estable: menor riesgo (1..7) desempatando por mayor rentabilidad
    const sortedByRisk = [...filteredDatasets].sort((a, b) => {
      if (a.meta.risk !== b.meta.risk) return a.meta.risk - b.meta.risk;
      return b.meta.value - a.meta.value;
    });
    const mostStable = sortedByRisk[0] || null;

    // Promedio de rentabilidad neta
    const sum = filteredDatasets.reduce((acc, curr) => acc + curr.meta.value, 0);
    const avgTea = +(sum / filteredDatasets.length).toFixed(2);

    return {
      top1,
      mostStable,
      avgTea,
      total: data?.datasets.length ?? 0,
    };
  }, [filteredDatasets, data]);

  // Control de visibilidad de series en Chart.js
  const toggleVisibility = (dataset: TeaDataset) => {
    const key = `${dataset.meta.source}:${dataset.meta.idFondo}`;
    setViewMode('custom');
    setVisibleDatasetIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const showOnlyTop5 = () => {
    setViewMode('top5');
    const top5 = [...filteredDatasets]
      .sort((a, b) => b.meta.value - a.meta.value)
      .slice(0, 5)
      .map((d) => `${d.meta.source}:${d.meta.idFondo}`);
    setVisibleDatasetIds(new Set(top5));
  };

  const showAllVisible = () => {
    setViewMode('all');
    const all = filteredDatasets.map((d) => `${d.meta.source}:${d.meta.idFondo}`);
    setVisibleDatasetIds(new Set(all));
  };

  const hideAllVisible = () => {
    setViewMode('none');
    setVisibleDatasetIds(new Set());
  };

  return {
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
    setProvider: changeProvider,
    setSearchQuery,
    changeHorizon,
    changeCustomDays,
    handleSort,
    toggleVisibility,
    showOnlyTop5,
    showAllVisible,
    hideAllVisible,
    refetch: loadData,
  };
}
