# Lista de Tareas: Infraestructura Base con AWS CDK y Reorganización Legacy

## Fase 1: Reorganización y Encapsulación del Monolito Legado (`legacy/`)
- [x] 1.1 Crear el directorio `legacy/` en la raíz del repositorio.
- [x] 1.2 Mover los 9 archivos JavaScript de la aplicación existente (`index.js`, `load-env.js`, `db.js`, `utils.js`, `erni.js`, `bbva.js`, `tyba.js`, `tea.js`, `html.js`) dentro de `legacy/`.
- [x] 1.3 Mover los archivos de contenedor y arranque (`Dockerfile`, `docker-compose.yml`, `run.sh`) a `legacy/`.
- [x] 1.4 Actualizar `legacy/Dockerfile` con el comando de ejecución `CMD ["node", "--max-old-space-size=180", "legacy/index.js"]`.
- [x] 1.5 Actualizar `fly.toml` en la raíz añadiendo `[build] dockerfile = "legacy/Dockerfile"`.
- [x] 1.6 Actualizar `package.json` de la raíz ajustando `"main": "legacy/index.js"`, `"start": "node legacy/index.js"` y `"dev": "node --watch legacy/index.js"`.
- [x] 1.7 Verificar la integridad sintáctica de los módulos legados ejecutando `node --check legacy/index.js`.

*(No hay dependencias. Limpia la raíz del proyecto y asegura la continuidad de Fly.io).*

---

## Fase 2: Configuración del Proyecto AWS CDK (`infra/`)
- [x] 2.1 Crear el subdirectorio `infra/` y su archivo `infra/package.json` con dependencias (`aws-cdk-lib`, `constructs`), devDependencies (`typescript`, `ts-node`, `esbuild`, `@aws-cdk/assertions`, `@types/node`, `@types/jest`, `jest`) y scripts (`build`, `synth`, `test`).
- [x] 2.2 Crear `infra/tsconfig.json` con `"strict": true`, target `"ES2022"` y moduleResolution `"node"`.
- [x] 2.3 Crear `infra/cdk.json` configurando el ejecutor `ts-node --prefer-ts-exts bin/fondos.ts`.
- [x] 2.4 Instalar dependencias dentro de `infra/` ejecutando `npm install`.

*(Depende de la Fase 1. Desbloquea la declaración de infraestructura).*

---

## Fase 3: Parámetros SSM y Stack Principal (`FondosStack`)
- [x] 3.1 Crear `infra/lib/fondos-stack.ts` definiendo la clase `FondosStack` que hereda de `Stack`.
- [x] 3.2 Aprovisionar los 5 parámetros estándar en SSM Parameter Store bajo `/fondos/prod/` con `removalPolicy: RemovalPolicy.RETAIN` y valores placeholder:
  - `/fondos/prod/mongo_db_uri` (`PLACEHOLDER_MONGO_DB_URI`)
  - `/fondos/prod/erni_apikey` (`PLACEHOLDER_ERNI_APIKEY`)
  - `/fondos/prod/tyba_apikey` (`PLACEHOLDER_TYBA_APIKEY`)
  - `/fondos/prod/tyba_app_proof` (`PLACEHOLDER_TYBA_APP_PROOF`)
  - `/fondos/prod/bbva_apikey` (`PLACEHOLDER_BBVA_APIKEY`)
- [x] 3.3 Crear el entrypoint `infra/bin/fondos.ts` que instancie la aplicación CDK y `FondosStack` en `us-east-1` (respetando variables de entorno dinámicas).

*(Depende de la Fase 2).*

---

## Fase 4: Construct Reutilizable de Lambdas (`FondosFunction`)
- [x] 4.1 Crear `infra/lib/constructs/fondos-function.ts` exportando la clase `FondosFunction` que extiende `NodejsFunction`.
- [x] 4.2 Configurar bundling local con `esbuild` sin requerir Docker (`bundling: { forceDockerBundling: false, minify: true, target: 'node22' }`).
- [x] 4.3 Establecer propiedades estándar: memoria 256 MB, timeout 30 segundos, retención de logs en CloudWatch a 7 días e inyección de `SSM_PREFIX=/fondos/prod`.
- [x] 4.4 Adjuntar política IAM de mínimo privilegio con permisos de lectura exclusivos a `arn:aws:ssm:*:*:parameter/fondos/prod/*`.

*(Depende de la Fase 3).*

---

## Fase 5: Pruebas Unitarias de Infraestructura, Síntesis y Validación
- [x] 5.1 Crear `infra/test/fondos-stack.test.ts` con pruebas sintéticas usando `@aws-cdk/assertions`:
  - Verificar que existan exactamente 5 recursos `AWS::SSM::Parameter`.
  - Verificar que todos los parámetros tengan `DeletionPolicy: Retain`.
  - Verificar que una función instanciada con `FondosFunction` contenga las configuraciones de runtime, timeout, memoria y permisos IAM hacia SSM.
- [x] 5.2 Ejecutar suite de pruebas unitarias dentro de `infra/` (`npm test`) y verificar que el 100% pase.
- [x] 5.3 Ejecutar `npm run synth` para sintetizar la plantilla CloudFormation en `cdk.out/` y validar que no existan advertencias ni errores.
- [x] 5.4 Ejecutar los scripts de gobernanza del proyecto (`python scripts/validate_sdd.py` y `python scripts/check_constitution.py`).

*(Depende de las Fases 3 y 4).*
