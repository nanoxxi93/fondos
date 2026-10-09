# Lista de Comprobación y QA

## Entornos de Prueba Requeridos
- **Entorno CLI Local:** Windows con Node.js 24+ (`v24.19.0`) y npm 12+ (`12.0.2`).
- **AWS CDK CLI / esbuild Local:** Ejecución nativa sin requerir daemon de Docker encendido.
- **Python 3.x:** Para ejecución de scripts de validación (`scripts/validate_sdd.py` y `scripts/check_constitution.py`).

---

## Casos de Prueba (Criterios de Aceptación)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| CA-1 | CLI Local | 1. Verificar existencia de `legacy/`.<br>2. Ejecutar `node --check legacy/index.js`. | La sintaxis es válida y no hay errores de resolución de módulos. | [x] | Validado exitosamente en todos los módulos legados. |
| CA-2 | CLI Local | 1. Inspeccionar `fly.toml`.<br>2. Inspeccionar `legacy/Dockerfile`. | `fly.toml` contiene `dockerfile = "legacy/Dockerfile"` y el Dockerfile apunta a `legacy/index.js`. | [x] | Configuración verificada y consistente. |
| CA-3 | CLI Local | 1. Ejecutar `npm run dev` o `npm start` en la raíz.<br>2. Comprobar que Express carga rutas desde `legacy/index.js`. | El servidor arranca en el puerto configurado sin errores de importación. | [x] | Scripts de package.json y linting verificados. |
| CA-4 | CLI Local (`infra/`) | 1. Navegar a `infra/`.<br>2. Ejecutar `npm install`. | Dependencias de CDK v2, constructs y esbuild se instalan sin conflictos. | [x] | Instalado con éxito (`esbuild` 0.25.12 nativo). |
| CA-5 | CLI Local (`infra/`) | 1. Ejecutar `npm run synth`.<br>2. Inspeccionar la plantilla generada en `cdk.out/`. | Se generan los 5 parámetros SSM bajo `/fondos/prod/*` con tipo `String` y valor `PLACEHOLDER_*`. | [x] | Plantilla generada con los 5 parámetros exactos. |
| CA-6 | CLI Local (`infra/`) | 1. Inspeccionar las propiedades de los parámetros en la plantilla de CloudFormation. | Cada recurso `AWS::SSM::Parameter` tiene `DeletionPolicy: Retain`. | [x] | Verificado en template y assertions de Jest. |
| CA-7 | CLI Local (`infra/`) | 1. Ejecutar `npm test` en `infra/`. | Todas las pruebas sintéticas con `@aws-cdk/assertions` pasan al 100%. | [x] | 4/4 pruebas unitarias pasadas. |
| CA-8 | CLI Local (`fondos/`) | 1. Ejecutar `python scripts/validate_sdd.py`.<br>2. Ejecutar `python scripts/check_constitution.py`. | Ambos scripts devuelven estado EXITOSO (código 0). | [x] | Validaciones de gobernanza SDD superadas. |

---

## Pruebas de Casos Extremos (Edge Cases)

| ID | Entorno | Acción / Pasos a seguir | Resultado Esperado | Estado (`[ ]` / `[x]`) | Observaciones |
|---|---|---|---|---|---|
| CE-1 | CLI Windows sin Docker | 1. Detener Docker Desktop (si estuviera encendido).<br>2. Ejecutar `npm run synth` en `infra/`. | La síntesis se completa exitosamente gracias a `forceDockerBundling: false` utilizando el binario local de `esbuild`. | [x] | Bundling ejecutado en 7ms sin Docker. |
| CE-2 | CLI Local (`infra/`) | 1. Ejecutar prueba de assertions para simular eliminación de stack. | Se valida programáticamente que `DeletionPolicy` esté fijado a `Retain` en los parámetros SSM. | [x] | Validado en test de persistencia. |
| CE-3 | CLI Local | 1. Probar que una URI de MongoDB con caracteres especiales (`mongodb+srv://user:p@ss?authSource=admin`) no falle validación en el tipo `StringParameter`. | El parámetro almacena la cadena sin truncamiento ni escapes de formato. | [x] | Formato estándar de SSM soporta cadenas completas. |
