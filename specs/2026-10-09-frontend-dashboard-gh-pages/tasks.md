# Lista de Tareas: Dashboard SPA en GitHub Pages (Fase 4)

## Fase 1: Inicialización y Configuración Base del Frontend
- [x] 1.1 Crear la estructura de la subcarpeta `frontend/` e inicializar el proyecto con Vite, React 19 / 18 y TypeScript (`package.json`, `tsconfig.json`, `vite.config.ts`).
- [x] 1.2 Configurar Tailwind CSS v3 / PostCSS y definir tokens de diseño semánticos para el tema dual Claro / Oscuro en `frontend/src/index.css`.
- [x] 1.3 Instalar dependencias esenciales de UI: `chart.js`, `react-chartjs-2` y `lucide-react`.
- [x] 1.4 Crear interfaces y contratos TypeScript en `frontend/src/types/funds.ts` reflejando la estructura de `TeaChartData`, `TeaDataset` y metadatos financieros.
- [x] 1.5 Configurar soporte de variables de entorno con `VITE_API_BASE_URL` y fallback a `http://localhost:3000` en `.env.example`.

## Fase 2: Capa de Servicio y Gestión de Estado Reactivo
- [x] 2.1 Implementar el cliente de API con `window.fetch` nativo en `frontend/src/services/api.ts` para invocar `GET /api/tea` y `GET /health`.
- [x] 2.2 Implementar el hook `useFundsData.ts` administrando estados de carga (`isLoading`), error (`isError`), datos (`data`) y función de reintento (`refetch`).
- [x] 2.3 Implementar sincronización bidireccional entre los filtros de periodo/moneda/riesgo y la URL del navegador (`window.history.replaceState` o `URLSearchParams`).
- [x] 2.4 Implementar el hook `useTheme.ts` para alternar y persistir el tema Claro/Oscuro en `localStorage` con detección inicial de `prefers-color-scheme`.

## Fase 3: Componentes de Cabecera, Métricas Bento y Filtros
- [x] 3.1 Construir `Header.tsx` con logo de Fondos Mutuos Perú, badge interactivo de estado de salud del backend y botón de alternancia de tema.
- [x] 3.2 Construir `KpiBentoGrid.tsx` calculando reactivamente las 4 tarjetas KPI: Top 1 rentabilidad, fondo más conservador (menor riesgo con retorno positivo), promedio general de mercado y conteo total de fondos activos.
- [x] 3.3 Construir `FilterBar.tsx` con botones píldora para horizontes rápidos (`7D`, `30D`, `90D`, `180D`, `1A`, `3A`, `YTD`), switches de moneda (`Todas`, `PEN`, `USD`), slider de riesgo (1 a 7) y pestañas por administradora (`Todas`, `BBVA`, `Inteligo`, `Tyba`).

## Fase 4: Gráfico Interactivo y Atajos de Visualización
- [x] 4.1 Implementar `ChartView.tsx` integrando Chart.js con configuración dinámica de colores de rejilla y texto adaptados al tema activo (claro/oscuro).
- [x] 4.2 Configurar tooltips avanzados con formato financiero exacto (fecha, nombre del fondo, rentabilidad neta acumulada %, comisión de SAF).
- [x] 4.3 Implementar botones de atajo rápido: *"Ver solo Top 5"*, *"Mostrar todos"* y *"Ocultar todos"*, sincronizados en tiempo real con las series del gráfico.
- [x] 4.4 Configurar propiedad `spanGaps: true` y padding dinámico en el eje Y para evitar rupturas de trazos y cortes visuales en valores extremos.

## Fase 5: Tabla Responsiva de Fondos y Calculadora de Retorno
- [x] 5.1 Construir `FundsTable.tsx` con encabezados sticky, buscador en vivo, ordenamiento por columnas (nombre, SAF, moneda, riesgo, comisión, rendimiento) y badges visuales por administradora y nivel de riesgo.
- [x] 5.2 Vincular los checkboxes de cada fondo en la tabla con la visibilidad de su serie respectiva en el gráfico de manera bidireccional.
- [x] 5.3 Implementar diseño responsivo para la tabla con scroll horizontal suave o visualización adaptada en pantallas móviles (< 640px).
- [x] 5.4 Construir `Simulator.tsx` permitiendo al usuario ingresar un monto de capital inicial y proyectar la ganancia o pérdida neta real en soles o dólares para cualquier fondo seleccionado.
- [x] 5.5 Construir `Feedback.tsx` con componentes de estado: skeletons animados durante la carga, tarjeta de error con botón de reintento y estado vacío ante combinaciones de filtros sin resultados.

## Fase 6: Flujo de CI/CD, Despliegue en GitHub Pages y Validación
- [x] 6.1 Crear el flujo de trabajo en `.github/workflows/deploy-gh-pages.yml` para compilar la aplicación en `frontend/` y publicarla en GitHub Pages con `actions/deploy-pages@v4`.
- [x] 6.2 Configurar `base: '/fondos/'` en `vite.config.ts` para asegurar la resolución correcta de rutas y assets en GitHub Pages.
- [x] 6.3 Ejecutar verificación estricta de tipos (`tsc --noEmit`), linting y build estático (`npm run build` en `frontend/`) comprobando que el paquete estático pese menos de 350 KB comprimido.
- [x] 6.4 Validar que el servidor Express y el archivo Dockerfile para Fly.io permanezcan intactos y libres de dependencias de frontend.
