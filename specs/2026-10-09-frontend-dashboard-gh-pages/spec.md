# Dashboard Analítico Moderno (React + Vite + Tailwind) y Despliegue en GitHub Pages

## Resumen
Define la especificación del dashboard web interactivo de alto rendimiento para Fondos Mutuos Perú, construido como una Single Page Application (SPA) estática desacoplada en `frontend/` mediante React, Vite y Tailwind CSS, y desplegada en GitHub Pages a costo $0. La interfaz ofrece un diseño Fintech moderno con tema dual (claro/oscuro), tarjetas KPI en cuadrícula bento, selector de horizontes temporales en píldoras, visualización avanzada de series temporales con Chart.js, tabla responsiva con ordenamiento y búsqueda en tiempo real, y una calculadora de retorno financiero proyectado. La SPA consume la AWS Lambda Function URL (`/api/tea`) preservando intacta la vista legacy SSR de Fly.io sin sobrecargar su contenedor ni su presupuesto de memoria.

## Casos de usuario
1. **Como Inversionista Minorista**, quiero acceder al dashboard público en GitHub Pages para visualizar de inmediato el ranking y la curva histórica de rentabilidad neta de comisiones de todos los fondos mutuos de Perú (BBVA, Inteligo/ERNI, Tyba/Credicorp) con una experiencia visual fluida y moderna.
2. **Como Usuario Analítico**, quiero filtrar la comparación por horizonte temporal mediante botones de acceso rápido (7D, 30D, 90D, 180D, 1A, 3A, YTD) o días exactos, discriminar por moneda (`PEN`, `USD`) y nivel de riesgo (1 a 7), y aislar administradoras específicas con un solo clic.
3. **Como Usuario de Gráficos**, quiero contar con atajos interactivos para "Ocultar todos", "Ver Top 5" o prender/apagar fondos individuales directamente desde la leyenda o la tabla, explorando valores exactos mediante tooltips contextuales enriquecidos.
4. **Como Planificador Financiero**, quiero simular una inversión hipotética ingresando un monto de capital (ej. S/ 10,000 o $ 2,500) para calcular la ganancia o pérdida neta monetaria generada por cualquier fondo en el periodo analizado.
5. **Como Usuario Móvil o Nocturno**, quiero alternar fluidamente entre modo oscuro y claro según mi preferencia o la de mi sistema operativo, manteniendo legibilidad óptima y navegación táctil en pantallas de cualquier tamaño.
6. **Como Ingeniero de Infraestructura**, quiero que el nuevo frontend viva de forma autónoma en `frontend/` y se publique automáticamente mediante GitHub Actions en GitHub Pages, garantizando que el build de Docker y el servidor Express en Fly.io se mantengan ligeros y sin modificaciones en su bundle.

## Criterios de aceptación
- [x] La SPA se inicializa en una carpeta autónoma `frontend/` con React, TypeScript, Vite y Tailwind CSS, sin alterar las dependencias de raíz ni el Dockerfile de Fly.io.
- [x] La interfaz implementa un diseño visual Fintech profesional con tema dual (Dark / Light mode) con selector persistente en `localStorage` y detección automática de `prefers-color-scheme`.
- [x] La cabecera del dashboard presenta 4 tarjetas KPI esenciales:
  - Top 1 Fondo más rentable (nombre, administradora y % neto).
  - Fondo más conservador/estable (menor riesgo con retorno positivo).
  - Rendimiento promedio del mercado en el periodo seleccionado.
  - Total de fondos activos comparados en la vista.
- [x] La barra de filtros permite:
  - Selección rápida de horizontes temporales en botones tipo píldora: `7D`, `30D`, `90D`, `180D`, `1A`, `3A`, `YTD` y campo numérico manual (1 a 3650 días).
  - Selector de moneda: `Todas`, `PEN` (Soles) y `USD` (Dólares).
  - Filtro o slider de riesgo máximo (1 a 7).
  - Selector por administradora: `Todas`, `BBVA`, `Inteligo`, `Tyba`.
- [x] El gráfico interactivo de líneas (Chart.js) renderiza las series temporales con:
  - Colores consistentes y determinísticos provistos por los metadatos de la API (`borderColor`, `backgroundColor`).
  - Botones de acción rápida: "Ocultar todos", "Mostrar Top 5", y filtrado rápido por administradora.
  - Tooltips interactivos formateados que exhiben la fecha, el nombre del fondo, el rendimiento acumulado %, el valor cuota y la comisión anual.
  - Comportamiento responsivo fluido adaptado a contenedores móviles y de escritorio.
- [x] La tabla de datos muestra el listado completo de fondos ordenado por rentabilidad descendente por defecto, e incluye:
  - Casilla de verificación (checkbox) vinculada bidireccionalmente a la visibilidad de la serie en el gráfico.
  - Badges visuales coloreados por administradora (`BBVA`, `ERNI/Inteligo`, `Tyba`) y por nivel de riesgo (1 al 7).
  - Buscador textual en vivo para filtrar por nombre de fondo.
  - Ordenamiento interactivo por encabezado de columna (Nombre, SAF, Moneda, Riesgo, Comisión %, Rendimiento %).
  - Diseño responsivo con encabezados visibles y desplazamiento horizontal o vista apilada en pantallas menores a 640px.
- [x] Se incluye una calculadora / simulador de inversión que permite ingresar un capital numérico y calcula la ganancia o pérdida neta proyectada en moneda local para el fondo seleccionado.
- [x] La SPA consume la AWS Lambda Function URL mediante `fetch` nativo utilizando la variable de entorno `VITE_API_BASE_URL`, con fallback automático y soporte para desarrollo local contra `http://localhost:3000`.
- [x] Los estados de carga (skeletons / spinners) y los estados de error de red o timeout muestran retroalimentación visual amigable con botón de reintento manual.
- [x] Se define el flujo de CI/CD en `.github/workflows/deploy-gh-pages.yml` para compilar la SPA y desplegarla en GitHub Pages en cada push a la rama `main` que afecte a `frontend/`.
- [x] La vista legacy SSR existente en `src/views/html.ts` y las rutas Express de `src/server.ts` permanecen 100% intactas y operativas en Fly.io.

## Requisitos funcionales
1. **Consumo de Datos y Capa de Servicio:**
   - La aplicación consulta la API pública Serverless invocando `GET /api/tea?days={days}&currency={curr}&risk={risk}`.
   - Procesa la estructura JSON `{ labels: string[], datasets: TeaDataset[] }` y la expone mediante un contexto o hook de estado reactivo (`useFundsData`).
   - Verifica el estado del backend mediante `GET /health` mostrando un indicador sutil de estado del sistema (en línea / degradado).
2. **Control de Visualización y Gráfico (Chart.js):**
   - Configuración desacoplada del canvas de Chart.js con soporte dinámico para temas claro (fondos claros, grillas grises tenues) y oscuro (fondos oscuros, grillas de bajo contraste).
   - Sincronización en tiempo real del estado de visibilidad (`dataset.hidden`) entre las interacciones del gráfico, los botones de acción rápida y los checkboxes de la tabla.
   - Formateo estricto de porcentajes a 2 decimales (`+X.XX%` o `-X.XX%`).
3. **Exploración y Filtrado Dinámico:**
   - Al pulsar una píldora de periodo (ej. `90D`), se recalcula la consulta inmediatamente actualizando la URL de consulta y los datasets.
   - El selector de moneda y riesgo aplica filtrado de forma reactiva en la API o localmente según la respuesta cacheada.
   - Búsqueda en vivo en la tabla de fondos insensible a mayúsculas y acentos.
4. **Calculadora Financiera:**
   - Entrada numérica de capital inicial con formato de separador de miles y símbolo monetario (`S/` o `$`).
   - Selección de un fondo de referencia (por defecto el Top 1 del periodo).
   - Cálculo instantáneo del valor final: $\text{Monto Final} = \text{Capital} \times (1 + \frac{\text{Rendimiento \%}}{100})$.
   - Desglose de ganancia/pérdida neta monetaria y porcentaje de comisión anual aplicada.

## Requisitos no funcionales
- **Presupuesto Estricto de $0.00:** El hosting en GitHub Pages es gratuito de por vida y no consume cuota de almacenamiento de AWS (`constitution.md`).
- **Rendimiento de Carga (LCP < 1.5s):** El paquete estático compilado con Vite debe optimizarse mediante code-splitting y compresión gzip/brotli para descargar en menos de 1.5 segundos en conexiones 4G estándar.
- **Sin Impacto en Fly.io:** No se instalan paquetes de React, Tailwind ni dependencias de Vite en el `package.json` raíz del backend ni en la imagen Docker de producción (`constitution.md`).
- **Fetch Nativo:** Todas las peticiones HTTP del cliente utilizan `window.fetch` nativo sin librerías externas como `axios` (`constitution.md`).
- **Accesibilidad y Semántica:** Elementos interactivos con etiquetas accesibles (`aria-label`, roles de tabla y contraste WCAG AA en temas claro y oscuro).
- **Compatibilidad con Rutas Base en GitHub Pages:** Vite configurado con `base: '/fondos/'` (o variable `VITE_BASE_PATH`) para soportar despliegues bajo subrutas de repositorios de GitHub.

## Casos extremos
1. **Fallo de Conexión o Timeout con la Lambda Function URL:**
   - Si la petición a la Lambda falla (error de red, CORS, timeout de 15s o HTTP 500), la UI no se rompe en blanco. Muestra una tarjeta de alerta con icono informativo, mensaje claro ("No se pudo conectar con el motor de analítica") y un botón para reintentar la consulta.
2. **Periodos sin datos para fondos específicos (Valores `null` en series):**
   - Cuando un fondo no tiene observaciones en ciertas fechas (feriados peruanos, fines de semana o fondos recién creados), Chart.js utiliza `spanGaps: true` para continuar el trazo de línea sin quebrar la curva.
3. **Filtro de Moneda o Riesgo devuelve cero fondos:**
   - Si una combinación de filtros no produce resultados coincidentes (ej. riesgo 1 en USD si no hubiera ninguno), se muestra un estado vacío amigable ("No se encontraron fondos mutuos para los filtros seleccionados") con un botón de reinicio rápido de filtros.
4. **Entrada de Capital no numérico o negativo en la Calculadora:**
   - Si el usuario ingresa valores inválidos (ej. `-500`, texto o cero), el simulador bloquea la computación negativa y presenta un valor informativo neutro indicando el requerimiento de un monto válido positivo.
5. **Diferencias extremas de escala porcentual en el gráfico:**
   - Si un fondo rinde +150% y otro -30%, la escala del eje Y de Chart.js se ajusta con márgenes dinámicos (*grace padding*) para evitar que las líneas toquen los límites superior e inferior del canvas.
6. **Resoluciones móviles muy estrechas (< 360px):**
   - La tabla de fondos conmuta dinámicamente a visualización de tarjetas apiladas o desplazamiento horizontal fluido con columna de nombre fija para evitar cortes horizontales antiestéticos.
