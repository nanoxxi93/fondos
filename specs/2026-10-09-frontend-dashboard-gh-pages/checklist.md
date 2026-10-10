# Lista de Comprobación y QA: Dashboard SPA en GitHub Pages (Fase 4)

## Entornos de Prueba Requeridos
- **Navegador Web de Escritorio:** Google Chrome / Edge / Firefox (Resoluciones 1920x1080, 1440x900, 1280x720).
- **Navegador Móvil / Emulador Responsive:** Chrome DevTools modo responsivo (iPhone 14/15 390x844, Galaxy S20 360x800 y pantallas ultra estrechas 320x568).
- **Entorno CLI de Desarrollo:** Node.js 24.x, Vite dev server (`http://localhost:5173`), API server local (`http://localhost:3000`).

## Casos de Prueba (Criterios de Aceptación)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| CA-1 | CLI | Inspeccionar `package.json` raíz y Dockerfile multi-stage. | No contienen paquetes de React, Vite ni Tailwind; el bundle de Fly.io permanece inalterado. | [x] | Verificado: `.dockerignore` y `tsconfig.json` aíslan `frontend/`. |
| CA-2 | Navegador | Abrir la SPA y alternar el botón de tema (Sol / Luna). Recargar la página. | La interfaz conmuta entre modo oscuro y modo claro con contraste adecuado; la preferencia se mantiene tras recargar (`localStorage`). | [x] | Implementado con hook `useTheme` y clases semánticas en `Header.tsx`. |
| CA-3 | Navegador | Cargar la SPA con datos de 90 días. Verificar las 4 tarjetas Bento en la cabecera. | Se muestran: 1) Top 1 rentabilidad con su SAF, 2) Fondo más conservador, 3) Rendimiento promedio de mercado, 4) Total de fondos activos. | [x] | Implementado en `KpiBentoGrid.tsx` con badges de color y brillo dinámico. |
| CA-4 | Navegador | Hacer clic en las píldoras de periodo: `7D`, `30D`, `90D`, `180D`, `1A`, `3A`, `YTD`. | La API consulta el nuevo periodo, los datos del gráfico y la tabla se recalculan automáticamente sin recargar la página completa. | [x] | Implementado en `FilterBar.tsx` y sincronizado en `useFundsData.ts`. |
| CA-5 | Navegador | Seleccionar el filtro de moneda `PEN` y luego `USD`. | Se muestran exclusivamente fondos en la moneda seleccionada, actualizando KPIs y datasets. | [x] | Filtro reactivo en `useFundsData.ts`. |
| CA-6 | Navegador | Mover el slider de riesgo a `3`. | Se excluyen todos los fondos con riesgo superior a 3 (solo riesgos 1, 2 y 3 visibles). | [x] | Slider interactivo con actualización en tiempo real del label y datos. |
| CA-7 | Navegador | En el gráfico, hacer clic en el botón *"Ver solo Top 5"*. | Únicamente las 5 curvas con mayor rendimiento permanecen activas; las casillas de la tabla reflejan el cambio. | [x] | Sincronizado mediante `visibleDatasetIds` entre `ChartView` y `FundsTable`. |
| CA-8 | Navegador | En el gráfico, hacer clic en *"Ocultar todos"* y luego en *"Mostrar todos"*. | Todas las líneas desaparecen del canvas y luego vuelven a aparecer sincronizadas con los checkboxes. | [x] | Implementado con botones dedicados en `ChartView.tsx`. |
| CA-9 | Navegador | Posicionar el cursor sobre una serie en el gráfico. | El tooltip muestra la fecha exacta, el nombre del fondo, el rendimiento acumulado % y la comisión anual de la SAF. | [x] | Callbacks personalizados en el plugin de Tooltip de Chart.js. |
| CA-10 | Navegador | Escribir "bbva" en el buscador de la tabla de fondos. | La tabla filtra en tiempo real mostrando únicamente los fondos que contienen "bbva" en su nombre o SAF. | [x] | Búsqueda insensible a mayúsculas implementada en `FundsTable.tsx`. |
| CA-11 | Navegador | Hacer clic en el encabezado de columna "Rendimiento" de la tabla. | Los fondos se ordenan alternadamente en orden ascendente y descendente de rentabilidad neta. | [x] | Implementado con iconos de flecha en `FundsTable.tsx`. |
| CA-12 | Navegador | En el simulador de inversión, ingresar `10000` y seleccionar un fondo con +15% de rendimiento. | El simulador calcula un monto final de S/ 11,500.00 y una ganancia neta de +S/ 1,500.00. | [x] | Calculadora en tiempo real en `Simulator.tsx` con moneda dinámica. |
| CA-13 | Navegador / CLI | Ejecutar `npm run build` en `frontend/` y verificar la carpeta `frontend/dist`. | La compilación genera una SPA estática optimizada con rutas relativas a `/fondos/`. | [x] | Verificado: bundle estático compilado en 4.75s (~145 kB gzip total). |
| CA-14 | GitHub Actions | Inspeccionar el archivo `.github/workflows/deploy-gh-pages.yml`. | El workflow compila `frontend/` y publica en GitHub Pages mediante `actions/deploy-pages@v4`. | [x] | Creado y validado sintácticamente en `.github/workflows/`. |

## Pruebas de Casos Extremos (Edge Cases)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| CE-1 | Navegador | Detener la API backend o bloquear la red en DevTools (Offline) y hacer clic en consultar. | La interfaz muestra una tarjeta de error amigable ("No se pudo conectar con el motor de analítica") y un botón para reintentar. | [x] | Implementado con `ErrorCard` y `refetch` en `Feedback.tsx`. |
| CE-2 | Navegador | Consultar una serie con fondos que no registran cotización en feriados o fines de semana. | Chart.js dibuja trazos continuos gracias a `spanGaps: true`, sin líneas cortadas ni errores en consola. | [x] | Verificado: `spanGaps: true` activo en opciones de `ChartView.tsx`. |
| CE-3 | Navegador | Seleccionar una combinación de filtros inexistente (ej. Riesgo 1 en USD si no hubiera fondos). | Se visualiza un estado vacío amigable ("No se encontraron fondos mutuos para los filtros seleccionados") con botón de reinicio. | [x] | Mensaje de tabla vacía y `EmptyState` disponibles. |
| CE-4 | Navegador | Ingresar valores negativos (`-5000`) o caracteres alfanuméricos en la calculadora de capital. | El simulador no calcula ganancias negativas espurias; alerta o normaliza a valor cero/positivo. | [x] | Saneamiento `isNaN(amount) || amount <= 0 ? 0 : amount` en `Simulator.tsx`. |
| CE-5 | Navegador | Cargar un periodo con fondos de rendimiento extremo (+120% vs -25%). | La escala del eje Y de Chart.js incluye margen superior e inferior (*grace padding*) sin cortar las curvas. | [x] | Verificado: `grace: '5%'` activo en escala Y de Chart.js. |
| CE-6 | Emulador Móvil | Abrir el dashboard en una resolución de 320px de ancho. | La tabla adapta su contenido con scroll horizontal suave o vista apilada sin desbordar el viewport horizontal. | [x] | Contenedor con `overflow-x-auto min-w-[640px]` y layout flex/grid responsivo. |
