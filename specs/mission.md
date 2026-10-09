# Misión del producto

> **Nombre del proyecto:** Fondos Mutuos Perú (`fondos`)
> **Estado:** Fase 0 (Migración a AWS Serverless con SDD)

## Pitch
Un comparador y visualizador analítico de fondos mutuos peruanos que calcula el rendimiento real del periodo neto de comisiones de administración, respaldado por una arquitectura Serverless desacoplada de costo \$0 en AWS y gobernado por Spec-Driven Development (SDD).

## Problema
1. **Falta de comparabilidad neta:** Las sociedades administradoras de fondos mutuos (SAF) publican valores cuota y rentabilidades brutas, dificultando conocer la ganancia neta real descontando la comisión anual de administración (`fee`).
2. **Dispersión de información:** Cada entidad (BBVA Asset Management, Inteligo/ERNI, Credicorp Capital/Tyba) tiene su propio portal cerrado o formatos incompatibles, imposibilitando un análisis unificado en un solo gráfico interactivo.
3. **Costo innecesario de servidores continuos:** Mantener un servidor tradicional 24/7 (como una máquina en Fly.io o Docker) para ejecutar un scraper una vez al día resulta ineficiente e innecesario cuando puede resolverse con arquitectura Serverless Event-Driven a costo \$0.

## Qué hace la app (y qué no)
- **Qué hace:**
  - Descarga y consolida diariamente los valores cuota históricos de los fondos mutuos más relevantes de Perú (en soles `PEN` y dólares `USD`).
  - Calcula la variación del periodo neta de comisión mediante la fórmula: `(último / primero - 1) * (100 - fee)`.
  - Permite filtrar por periodo de días (1 a 3650), moneda y nivel de riesgo (1 a 7).
  - Grafica las series temporales con colores consistentes mediante Chart.js.
  - Ofrece dos vías de consumo: API / Dashboard tradicional en Fly.io y nueva arquitectura Serverless en AWS con frontend estático en GitHub Pages.
- **Qué NO hace:**
  - No es una plataforma transaccional ni permite comprar/vender participaciones de fondos.
  - No requiere inicio de sesión ni almacena datos personales de usuarios (privacidad total).
  - No proporciona asesoría financiera regulatoria.

## Usuarios objetivo

| Perfil | Descripción | Necesidad principal |
|---|---|---|
| **Inversionista Minorista Peruano** | Ahorrista que busca maximizar el rendimiento de sus excedentes en PEN o USD. | Comparar en una sola pantalla si le conviene un fondo de BBVA, Inteligo o Tyba neto de comisiones. |
| **Ingeniero / Evaluador Técnico** | Reclutadores, líderes técnicos o revisores de portafolio. | Evaluar experiencia en arquitectura Serverless AWS, IaC con AWS CDK (TypeScript), optimización de costos (\$0 Always Free) y disciplina SDD. |

## Propuesta de valor
1. **Transparencia Financiera Real:** Muestra el rendimiento descontando la comisión oculta de la SAF.
2. **Excelencia de Ingeniería:** Demuestra cómo desacoplar un monolito hacia funciones Lambda orquestadas por EventBridge y expuestas con Lambda Function URLs, aplicando metodologías formales de ingeniería de software (SDD).

## Funcionalidades clave (visión)

### Núcleo
- Scrapers especializados e independientes para ERNI (Inteligo), BBVA (ASO Past-returns) y Tyba.
- Almacenamiento unificado de cuotas históricas en MongoDB Atlas M0.
- Cálculo de variación relativa neta y ranking por periodo seleccionado.
- Orquestación automática diaria mediante Amazon EventBridge Scheduler.

### Complementarias
- Dashboard estático servido en GitHub Pages con Chart.js.
- Exposición directa mediante AWS Lambda Function URL con CORS habilitado.

## Métricas de éxito

| Métrica | Objetivo MVP Serverless |
|---|---|
| **Costo mensual de infraestructura** | **Exactamente \$0.00** en AWS Always Free Tier y Mongo Atlas M0. |
| **Tiempo de respuesta de analítica** | < 800 ms para calcular el ranking de 60 fondos en 365 días. |
| **Confiabilidad de ingesta** | 99% de ejecuciones diarias exitosas post-cierre de mercado. |
| **Cobertura SDD** | 100% de especificaciones validadas por `scripts/validate_sdd.py`. |
