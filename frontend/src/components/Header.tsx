import React, { useEffect, useState } from 'react';
import { Sun, Moon, TrendingUp } from 'lucide-react';
import type { Theme } from '../hooks/useTheme.js';
import { fetchHealth } from '../services/api.js';

interface HeaderProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({ theme, onToggleTheme }) => {
  const [isServerHealthy, setIsServerHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchHealth()
      .then((res) => {
        if (isMounted) setIsServerHealthy(res.status === 'OK');
      })
      .catch(() => {
        if (isMounted) setIsServerHealthy(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800/80 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-bold shrink-0">
          <TrendingUp className="w-6 h-6 stroke-[2.5]" />
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Fondos Mutuos Perú
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                isServerHealthy === true
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : isServerHealthy === false
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                  : 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isServerHealthy === true
                    ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse'
                    : isServerHealthy === false
                    ? 'bg-rose-500 dark:bg-rose-400'
                    : 'bg-slate-400'
                }`}
              />
              {isServerHealthy === true
                ? 'Online'
                : isServerHealthy === false
                ? 'Offline'
                : 'Conectando...'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Comparador analítico de rendimiento neto de comisiones (BBVA · Inteligo · Tyba)
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        <button
          onClick={onToggleTheme}
          aria-label="Alternar tema claro y oscuro"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 transition-all text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>Modo Claro</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-indigo-500" />
              <span>Modo Oscuro</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
