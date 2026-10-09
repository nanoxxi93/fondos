# Lista de Tareas: Ingesta Serverless de ERNI (Inteligo)

## Fase 1: Configuración de Dependencias y Entorno TypeScript (`src/`)
- [x] 1.1 Configurar dependencias en `package.json` de la raíz: instalar `@sinclair/typebox`, `@aws-sdk/client-ssm`, `@types/aws-lambda`, `@types/node` y framework de testing (`vitest` o `jest`).
- [x] 1.2 Configurar `tsconfig.json` en la raíz para compilar de forma estricta los módulos de `src/` (`target: "ES2022"`, `moduleResolution: "node"`, `strict: true`).
- [x] 1.3 Verificar que el compilador TypeScript resuelva los tipos sin conflictos con `infra/` ni `legacy/`.

*(No hay dependencias. Desbloquea la construcción de código fuente en TypeScript).*

---

## Fase 2: Capa Compartida y Persistencia en MongoDB (`src/shared/`)
- [x] 2.1 Implementar `src/shared/utils.ts` con la función de concurrencia controlada `pMap` (lotes de 3 a 4 peticiones en paralelo) y formateo de fechas a medianoche UTC.
- [x] 2.2 Implementar `src/shared/config.ts` para resolución segura de secretos (`ERNI_APIKEY`, `MONGO_DB_URI`) con caché en memoria (vía `@aws-sdk/client-ssm` en AWS Lambda y fallback `process.env` en local).
- [x] 2.3 Implementar `src/shared/models/quota.model.ts` con el esquema Mongoose e índice único compuesto `{ idFondo: 1, idSerie: 1, date: 1 }` apuntando a la colección `erni`.
- [x] 2.4 Implementar `src/shared/models/fund.model.ts` con el esquema Mongoose e índice único `{ idFondo: 1, source: 1 }` apuntando a la colección `funds` para el catálogo dinámico de metadatos.
- [x] 2.5 Implementar `src/shared/db.ts` con el patrón singleton reutilizable en ámbito global para la conexión a MongoDB Atlas M0.

*(Depende de la Fase 1. Desbloquea el acceso a datos y la configuración compartida).*

---

## Fase 3: Contratos TypeBox, Parser y Cliente HTTP de ERNI (`src/scrapers/erni/`)
- [x] 3.1 Implementar `src/scrapers/erni/types.ts` definiendo los esquemas `@sinclair/typebox` para `/fondos-activos`, `/invertir`, el evento de Lambda (`{ months?: number }`) y el resumen métrico de salida, exportando sus tipos estáticos.
- [x] 3.2 Implementar `src/scrapers/erni/parser.ts`:
  - `selectActiveSerie()`: prioriza Serie C digital (`isDigital: true`), fallback a Serie A en presenciales sin digital (fondo 56) o `-` en fondos estándar.
  - `filterActiveFunds()`: descarta fondos inactivos o sin tarifarios (fondo 41).
  - `normalizeQuotas()`: convierte cuotas a formato canónico `{ idFondo, idSerie, date, value }` con fechas truncadas a UTC.
- [x] 3.3 Implementar `src/scrapers/erni/client.ts` con `fetch` nativo de Node.js 24:
  - `fetchFondosActivos(apiKey)`: valida la respuesta de fondos activos con TypeBox.
  - `fetchFondoInvertir(apiKey, params)`: valida la respuesta de cuotas históricas con TypeBox.
- [x] 3.4 Implementar pruebas unitarias en `test/scrapers/erni.test.ts` con mocks para validar:
  - Selección de serie digital (C vs A vs -).
  - Filtrado de fondos sin historial (fondo 96) o sin tarifarios (fondo 41).
  - Validación de esquemas TypeBox ante payloads válidos e inválidos.
  - Concurrencia controlada de `pMap`.

*(Depende de la Fase 2. Desbloquea la orquestación en el Lambda handler).*

---

## Fase 4: Lambda Handler de ERNI y Orquestación Serverless
- [x] 4.1 Implementar `src/scrapers/erni/handler.ts`:
  - Inicializar conexión a MongoDB Atlas y resolver parámetros de SSM.
  - Validar payload de evento de entrada con TypeBox (usar `months = 1` por defecto si no se especifica).
  - Obtener fondos activos de Inteligo y sincronizar metadatos en la colección `funds`.
  - Descargar cuotas de fondos operativos en lotes concurrentes (máximo 4 simultáneos) usando `pMap`.
  - Capturar y aislar errores individuales por fondo (`console.error`) sin abortar el procesamiento global.
  - Ejecutar operaciones masivas idempotentes `bulkWrite` (`upsert: true`) en la colección `erni`.
  - Retornar objeto JSON con resumen de métricas para CloudWatch Logs (`totalFondos`, `procesados`, `omitidos`, `fallidos`, `cuotasSincronizadas`).
- [x] 4.2 Crear script de ejecución local para validar el ciclo de ingesta completo contra variables de entorno `.env`.

*(Depende de la Fase 3. Desbloquea la infraestructura en CDK).*

---

## Fase 5: Infraestructura CDK y Automatización EventBridge (`infra/`)
- [x] 5.1 En `infra/lib/fondos-stack.ts`, instanciar la función Lambda `ErniScraperFunction` utilizando el construct `FondosFunction` con entrypoint en `src/scrapers/erni/handler.ts` (memoria 256 MB, timeout 60s).
- [x] 5.2 Añadir regla de Amazon EventBridge Scheduler en `infra/lib/fondos-stack.ts` con cron diario a las 23:00 UTC (`cron(0 23 * * ? *)`) para invocar automáticamente `ErniScraperFunction`.
- [x] 5.3 Actualizar `infra/test/fondos-stack.test.ts` con pruebas sintéticas de `@aws-cdk/assertions`:
  - Verificar la existencia del recurso Lambda `ErniScraperFunction` con sus configuraciones de timeout, memoria y permisos IAM.
  - Verificar la regla de EventBridge Scheduler apuntando a la función Lambda.
- [x] 5.4 Ejecutar suite de pruebas de infraestructura (`npm test` en `infra/`) y síntesis de CloudFormation (`npm run synth`).

*(Depende de la Fase 4).*

---

## Fase 6: Verificación de Calidad y Gobernanza SDD
- [x] 6.1 Ejecutar `python scripts/validate_sdd.py` y verificar que la estructura de specs pase al 100%.
- [x] 6.2 Ejecutar `python scripts/check_constitution.py` y verificar que no existan infracciones a la constitución (fetch nativo, sin console.log, cero secretos quemados).
- [x] 6.3 Ejecutar el linter del proyecto (`npm run lint`) y verificar que no existan errores de estilo ni tipado.
- [x] 6.4 Actualizar `CHANGELOG.md` registrando la finalización de las tareas de la Fase 2.1.

*(Depende de la Fase 5).*
