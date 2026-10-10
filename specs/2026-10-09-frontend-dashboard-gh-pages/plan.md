# Plan de Implementación Técnico: Dashboard SPA en GitHub Pages (Fase 4)

## Información general sobre la arquitectura

Este plan define la estrategia técnica para la construcción y despliegue del nuevo dashboard estático interactivo en GitHub Pages para Fondos Mutuos Perú. La solución se materializa como una Single Page Application (SPA) modular alojada en la subcarpeta autónoma `frontend/`, desacoplada por completo del servidor Express y del contenedor Docker en Fly.io.

### Diagrama de Arquitectura y Flujo de Datos:
```text
┌────────────────────────────────────────────────────────────────────────┐
│                        GITHUB PAGES (HOSTING $0)                       │
│                                                                        │
│   [ SPA React + Vite + Tailwind CSS ]                                  │
│   ├── ThemeProvider (Dark / Light mode persistente)                    │
│   ├── useFundsData Hook (fetch a Lambda URL + estado reactivo)         │
│   ├── Bento Grid (KPIs de alto impacto: Top 1, Seguro, Promedio)       │
│   ├── FilterBar (Píldoras 7D-3A, selector PEN/USD, slider riesgo)      │
│   ├── ChartContainer (Chart.js interactivo + atajos Top 5 / Reset)     │
│   ├── InvestmentSimulator (Calculadora de ganancia neta en S/ o $)     │
│   └── FundsTable (Tabla responsiva, buscador en vivo, ordenamiento)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ window.fetch(HTTPS)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              AWS LAMBDA FUNCTION URL (CORS: *, $0 ALWAYS FREE)         │
│                                                                        │
│   - GET /health ────────► Estado de conexión a MongoDB Atlas           │
│   - GET /api/tea ───────► Motor TEA (src/domain/tea.ts)                │
│                           Responde JSON { labels, datasets } con       │
│                           Cache-Control: public, max-age=3600          │
└────────────────────────────────────────────────────────────────────────┘
```

### Estructura de Módulos en `frontend/`:
```text
fondos/
├── frontend/                     # Aplicación SPA autónoma
│   ├── public/                   # Favicon, assets estáticos y manifiesto
│   ├── src/
│   │   ├── components/           # Componentes UI especializados
│   │   │   ├── Header.tsx        # Cabecera, estado de backend y selector de tema
│   │   │   ├── KpiBentoGrid.tsx  # 4 tarjetas de métricas financieras clave
│   │   │   ├── FilterBar.tsx     # Selector en píldoras, monedas, SAF y riesgo
│   │   │   ├── ChartView.tsx     # Canvas reactivo de Chart.js y atajos rápidos
│   │   │   ├── Simulator.tsx     # Calculadora de retorno proyectado
│   │   │   ├── FundsTable.tsx    # Tabla responsiva con buscador y ordenamiento
│   │   │   └── Feedback.tsx      # Skeletons de carga, tarjeta de error y empty state
│   │   ├── hooks/
│   │   │   ├── useFundsData.ts   # Hook para fetch de datos, caché y sincronización
│   │   │   └── useTheme.ts       # Hook para gestión de tema claro/oscuro
│   │   ├── services/
│   │   │   └── api.ts            # Cliente fetch nativo tipado hacia Lambda URL
│   │   ├── types/
│   │   │   └── funds.ts          # Tipos compartidos e interfaces de datos
│   │   ├── utils/
│   │   │   └── formatters.ts     # Formateo de moneda, porcentajes y fechas
│   │   ├── App.tsx               # Orquestador principal de la vista
│   │   ├── main.tsx              # Entrypoint de React
│   │   └── index.css             # Directivas de Tailwind CSS y variables de tema
│   ├── index.html                # Plantilla HTML con meta tags y viewport
│   ├── package.json              # Dependencias específicas de la SPA
│   ├── tsconfig.json             # Compilación TypeScript estricta para frontend
│   ├── vite.config.ts            # Configuración de Vite con base path para GH Pages
│   └── tailwind.config.js        # Configuración de Tailwind CSS v3 / tema
├── .github/workflows/
│   └── deploy-gh-pages.yml       # Flujo de CI/CD para compilación y despliegue a GH Pages
```

## Pila tecnológica y decisiones clave

- **React 18 / 19 + TypeScript:**
  - *Por qué:* Estándar de la industria para SPAs declarativas de alto rendimiento, permitiendo componentización limpia del gráfico, la tabla y los filtros.
  - *Alternativas consideradas:* Vanilla JS (más difícil de mantener para tablas con ordenamiento y sincronización bidireccional de estados) o Vue/Svelte (requerirían añadir un stack heterogéneo al proyecto).
- **Vite:**
  - *Por qué:* Bundler ultrarrápido con soporte nativo de ESM, recarga en caliente instantánea y optimización de assets con Rollup para compilación a producción estática.
  - *Configuración base:* `base: process.env.VITE_BASE_PATH || '/fondos/'` para soportar despliegues bajo subdominios o subrutas de repositorios GitHub.
- **Tailwind CSS:**
  - *Por qué:* Estilos utilitarios purgados en compilación que eliminan CSS redundante, permitiendo construir un diseño Fintech oscuro/claro profesional con peso mínimo en el bundle final.
- **Chart.js + react-chartjs-2:**
  - *Por qué:* Máxima compatibilidad con los datasets precalculados por el backend (`src/domain/tea.ts`). Soporta trazos de línea suaves, `spanGaps: true`, adaptabilidad dinámica de temas y tooltips avanzados.
- **Lucide React:**
  - *Por qué:* Iconografía minimalista SVG de peso ligero y estilo Fintech moderno.
- **Despliegue en GitHub Pages vía GitHub Actions:**
  - *Por qué:* Costo perpetuo de $0.00, integración nativa con el repositorio y cero cuotas de AWS consumidas para almacenamiento web estático (`tech-stack.md`).

## Secuencia de implementación

1. **Fase 1: Inicialización de la SPA en `frontend/` y Configuración Base**
   - Crear la subcarpeta `frontend/` con `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js` y `index.html`.
   - Configurar variables de entorno (`.env.example`, `.env`) con `VITE_API_BASE_URL` apuntando por defecto a `http://localhost:3000` en local y a la Lambda Function URL en producción.
   - Definir los tipos de datos en `frontend/src/types/funds.ts` en concordancia con `TeaChartData` y `TeaDataset`.
2. **Fase 2: Capa de Servicio y Hook de Datos (`useFundsData`)**
   - Implementar `frontend/src/services/api.ts` con `window.fetch` nativo para consultar `/api/tea` y `/health`.
   - Implementar `frontend/src/hooks/useFundsData.ts` gestionando estados de carga (`isLoading`), error (`error`), datos (`data`) y reintentos manuales (`refetch`).
   - Sincronizar filtros de periodo (`days`), moneda (`currency`) y riesgo (`risk`) con los parámetros de la URL para permitir enlaces directos.
3. **Fase 3: Header, Bento Grid y Barra de Filtros**
   - Construir `Header.tsx` con logo, estado de backend en vivo y selector de tema claro/oscuro persistente en `localStorage`.
   - Construir `KpiBentoGrid.tsx` calculando de forma reactiva: Top 1 rentabilidad, fondo más conservador (menor riesgo con retorno positivo), promedio simple de mercado y conteo de fondos.
   - Construir `FilterBar.tsx` con píldoras de acceso rápido (`7D`, `30D`, `90D`, `180D`, `1A`, `3A`, `YTD`), switches de moneda (`Todas`, `PEN`, `USD`) y slider interactivo de riesgo (1 a 7).
4. **Fase 4: Visualización Gráfica y Atajos Rápidos (`ChartView`)**
   - Integrar Chart.js en `ChartView.tsx` adaptando paletas de colores determinísticas HSL provistas por la API.
   - Implementar controles de acción rápida: *"Ver solo Top 5"*, *"Mostrar todos"*, *"Ocultar todos"*.
   - Adaptar colores de ejes, leyendas y tooltips al alternar entre modo oscuro y modo claro.
5. **Fase 5: Tabla de Fondos y Calculadora de Retorno**
   - Construir `FundsTable.tsx` con contenedor responsive y encabezado sticky, buscador en tiempo real, ordenamiento por columnas, badges de SAF y sincronización de checkboxes con el gráfico.
   - Construir `Simulator.tsx` permitiendo simular ganancias netas en moneda real a partir de un capital ingresado.
6. **Fase 6: CI/CD y Despliegue en GitHub Pages**
   - Crear el workflow `.github/workflows/deploy-gh-pages.yml` configurado para compilar `frontend/` y publicar en GitHub Pages.
   - Verificar que `fly.toml` y el Dockerfile raíz no incluyan `frontend/`, preservando la ligereza del despliegue en Fly.io.

## Comprobación de la Constitución

- [x] **Regla de $0.00 (Always Free Tier):** GitHub Pages es gratuito de por vida y no utiliza buckets de S3 ni CloudFront de AWS (`constitution.md`).
- [x] **Preservación del legado Fly.io:** La vista HTML SSR en `src/views/html.ts` y las rutas Express no se modifican. El empaquetado del frontend vive estrictamente en `frontend/` y no se agrega al bundle de producción en Fly.io (`constitution.md`).
- [x] **Fetch Nativo:** Todas las peticiones HTTP del frontend utilizan la API nativa de `fetch` de JavaScript. Queda prohibido `axios` (`constitution.md`).
- [x] **TypeScript Estricto:** La SPA se compila con TypeScript en modo estricto (`strict: true`).
- [x] **Cero Secretos:** La SPA solo se comunica con la Lambda Function URL pública; no expone ni requiere credenciales bancarias o contraseñas en el frontend.

## Suposiciones y preguntas abiertas

1. **Lambda Function URL Pública:** Se asume que la URL pública de la Lambda `ApiFunction` configurada en la Fase 3 (`infra/lib/fondos-stack.ts`) admite CORS con `allowOrigins: ['*']` para recibir solicitudes desde cualquier dominio de GitHub Pages (`github.io`).
2. **Subruta en GitHub Pages:** Se asume que el sitio se desplegará bajo la subruta del repositorio `https://<usuario>.github.io/fondos/`, por lo que Vite debe configurarse con `base: '/fondos/'` o tomarla dinámicamente mediante `VITE_BASE_PATH`.
3. **Persistencia de Filtros:** Se asume que los usuarios valoran poder compartir enlaces prefiltrados (ej. `?days=365&currency=USD`), por lo que los filtros sincronizarán el query string en el navegador.
