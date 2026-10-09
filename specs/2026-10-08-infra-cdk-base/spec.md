# Infraestructura Base con AWS CDK, Configuración Segura en SSM y Reorganización Legacy

## Resumen
Establece la infraestructura base del proyecto en AWS utilizando AWS CDK v2 con TypeScript bajo un stack unificado (`FondosStack`) desplegado por defecto en `us-east-1`, aprovisionando el almacenamiento seguro y persistente de parámetros de configuración y credenciales en AWS Systems Manager (SSM) Parameter Store con política de retención (`RemovalPolicy.RETAIN`), una fábrica tipada de funciones Lambda (`FondosFunction`) optimizada con `esbuild` local (desarrollada con Node.js 24+ y npm 12+ en local y orientada al runtime gestionado de AWS Lambda) garantizando un costo operativo de exactamente \$0.00 (AWS Always Free), y encapsula todo el código del servidor legado (Express, scrapers JS y Docker) dentro del subdirectorio `legacy/` para dejar la raíz del repositorio completamente limpia y modular sin romper Fly.io.

## Casos de usuario
1. **Como Desarrollador / Mantenedor**, quiero sintetizar y desplegar la infraestructura base del proyecto ejecutando comandos estándar de AWS CDK (`cdk synth`, `cdk deploy`), para tener un entorno reproducible y libre de pasos manuales en la consola web de AWS.
2. **Como Desarrollador / Mantenedor**, quiero contar con parámetros estándar en SSM Parameter Store con valores placeholder iniciales y política de retención (`RemovalPolicy.RETAIN`), para poder configurar la URI de conexión a MongoDB Atlas y las API Keys bancarias desde la CLI o consola sin exponerlas nunca en el repositorio y sin riesgo de que un `cdk destroy` las elimine accidentalmente.
3. **Como Desarrollador de Funciones Serverless**, quiero disponer de una fábrica o construct base de funciones Lambda en TypeScript (`FondosFunction`) que incluya empaquetado automático rápido con `esbuild` local (sin requerir Docker), asignación de permisos de mínimo privilegio para SSM y logs en CloudWatch, para que las siguientes fases de ingesta y analítica no dupliquen configuración de infraestructura.
4. **Como Arquitecto / Evaluador Técnico**, quiero que todo el monolito legado (Express, MongoDB, scrapers JavaScript y configuración Docker) esté autocontenido en el directorio `legacy/`, de modo que la raíz del proyecto esté organizada limpiamente por capas (`legacy/`, `infra/`, `specs/`, etc.) sin que se rompa el despliegue en Fly.io ni la ejecución local con `npm start`.

## Criterios de aceptación
- [ ] Todo el código del servidor Express, scrapers JavaScript y configuración Docker (`index.js`, `load-env.js`, `db.js`, `utils.js`, `erni.js`, `bbva.js`, `tyba.js`, `tea.js`, `html.js`, `Dockerfile`, `docker-compose.yml`, `run.sh`) es reubicado en el directorio `legacy/`.
- [ ] La configuración de Fly.io (`fly.toml`) especifica `[build] dockerfile = "legacy/Dockerfile"`.
- [ ] `legacy/Dockerfile` actualiza su comando de ejecución a `CMD ["node", "--max-old-space-size=180", "legacy/index.js"]`.
- [ ] El archivo `package.json` de la raíz actualiza sus scripts y entrada principal (`"main": "legacy/index.js"`, `"start": "node legacy/index.js"`, `"dev": "node --watch legacy/index.js"`) de modo que `npm start` continúe arrancando el servidor legado sin errores.
- [ ] Existe un proyecto de AWS CDK funcional en el subdirectorio `infra/` configurado con TypeScript y dependencias mínimas requeridas (`aws-cdk-lib`, `constructs`, `esbuild`, `ts-node`).
- [ ] La aplicación CDK define un stack único denominado `FondosStack` configurado para la región `us-east-1` (con fallback dinámico a `CDK_DEFAULT_REGION` o `AWS_REGION`).
- [ ] El stack aprovisiona los parámetros requeridos en SSM Parameter Store bajo el espacio de nombres `/fondos/prod/` con `RemovalPolicy.RETAIN`:
  - `/fondos/prod/mongo_db_uri` (String estándar con valor inicial `PLACEHOLDER_MONGO_DB_URI`)
  - `/fondos/prod/erni_apikey` (String estándar con valor inicial `PLACEHOLDER_ERNI_APIKEY`)
  - `/fondos/prod/tyba_apikey` (String estándar con valor inicial `PLACEHOLDER_TYBA_APIKEY`)
  - `/fondos/prod/tyba_app_proof` (String estándar con valor inicial `PLACEHOLDER_TYBA_APP_PROOF`)
  - `/fondos/prod/bbva_apikey` (String estándar con valor inicial `PLACEHOLDER_BBVA_APIKEY`)
- [x] Se implementa la clase reusable `FondosFunction` en `infra/lib/constructs/fondos-function.ts` que extiende `NodejsFunction` con:
  - Runtime gestionado de AWS Lambda Node.js 24.x (`nodejs24.x`) con paridad 100% frente a Node.js 24+ en desarrollo local.
  - Memoria asignada de 256 MB y timeout por defecto de 30 segundos.

  - Retención de logs en CloudWatch configurada a 7 días para no exceder la cuota gratuita de 5 GB.
  - Rol IAM con permisos exclusivos de lectura (`ssm:GetParameter`, `ssm:GetParameters`) sobre la ruta ARN `/fondos/prod/*`.
  - Empaquetado local mediante `esbuild` sin requerir daemon de Docker encendido en Windows (`forceDockerBundling: false`).
- [ ] El comando `npm run synth` (o `npx cdk synth`) dentro de `infra/` genera una plantilla CloudFormation válida sin errores.
- [ ] Existen pruebas unitarias de infraestructura con `@aws-cdk/assertions` en `infra/test/fondos-stack.test.ts` que validen la creación de los parámetros SSM, sus políticas de retención y las propiedades del construct base de Lambda.
- [ ] El costo estimado de los recursos declarados es de exactamente \$0.00 mensual bajo el AWS Always Free Tier.

## Requisitos funcionales
1. **Reorganización y encapsulación del monolito legado en `legacy/`:**
   - Crear el directorio `legacy/` y trasladar allí los 9 archivos JavaScript de la aplicación (`index.js`, `load-env.js`, `db.js`, `utils.js`, `erni.js`, `bbva.js`, `tyba.js`, `tea.js`, `html.js`).
   - Trasladar los archivos de contenedor `Dockerfile`, `docker-compose.yml` y `run.sh` a `legacy/`.
   - Modificar `legacy/Dockerfile` para ajustar el punto de entrada a `legacy/index.js`.
   - Modificar `fly.toml` en la raíz para indicar `[build] dockerfile = "legacy/Dockerfile"`.
   - Actualizar los scripts de ejecución en `package.json` para que `npm start` y `npm run dev` apunten a `legacy/index.js`.
2. **Inicialización del módulo de infraestructura:**
   - La raíz de infraestructura reside exclusivamente en `infra/`, manteniendo su propio `package.json`, `cdk.json` y `tsconfig.json` para aislar sus dependencias de CDK del código legado.
3. **Jerarquía y gestión persistente de parámetros SSM:**
   - Todos los parámetros se crean en el tier estándar de SSM Parameter Store (sin cobro por almacenamiento ni por llamadas API).
   - Se establece `removalPolicy: RemovalPolicy.RETAIN` en cada parámetro: si la infraestructura se destruye, los parámetros permanecen intactos en la cuenta de AWS para que el usuario conserve sus secretos o los elimine manualmente a discreción.
   - Los valores iniciales aprovisionados por CDK son marcadores de posición legibles (`PLACEHOLDER_*`), permitiendo al operador actualizar su valor mediante `aws ssm put-parameter --overwrite` sin que un posterior `cdk deploy` sobrescriba valores reales.
4. **Construct base de Lambda (`FondosFunction`):**
   - Acepta como entrada el punto de entrada del archivo TypeScript (`entry`), el nombre del handler y variables de entorno adicionales.
   - Inyecta por defecto la variable de entorno `STAGE=prod` y el prefijo de parámetros SSM `SSM_PREFIX=/fondos/prod`.
   - Compila mediante `esbuild` local en modo minificado con target ECMAScript moderno compatible con el runtime de Lambda.

## Requisitos no funcionales
1. **Presupuesto Estricto de \$0.00 (Constitution Compliance):**
   - Queda vetado el uso de Amazon S3 como hosting, Amazon API Gateway, AWS Secrets Manager y Amazon DynamoDB.
   - SSM Parameter Store usa parámetros estándar exclusivamente.
2. **Seguridad y Principio de Mínimo Privilegio:**
   - Las políticas IAM concedidas a las funciones Lambda restringen la lectura únicamente a los ARNs correspondientes a `arn:aws:ssm:*:*:parameter/fondos/prod/*`. No se permite `Resource: "*"`.
3. **Compatibilidad Multiplataforma en Windows:**
   - El bundling con `esbuild` se ejecuta localmente sin requerir Docker encendido en Windows (`bundling: { forceDockerBundling: false }`).
4. **Mantenibilidad y Tipado Estricto:**
   - Todo el código en `infra/` compila sin advertencias en modo TypeScript estricto (`"strict": true`).

## Casos extremos
1. **Ejecución de `cdk synth` en máquina sin Docker instalado:**
   - El empaquetado de `NodejsFunction` se resuelve utilizando el binario local de `esbuild` provisto por `npm`, fallando con un mensaje explícito si `esbuild` no está en las dependencias de desarrollo, pero nunca bloqueándose intentando conectar al daemon de Docker.
2. **Destrucción del stack (`cdk destroy`):**
   - Los parámetros de SSM Parameter Store NO se borran de la cuenta de AWS gracias a `RemovalPolicy.RETAIN`. El desarrollador mantiene sus credenciales reales seguras y puede eliminarlas manualmente cuando decida.
3. **Actualización externa de valores en SSM:**
   - Si el desarrollador modifica el valor de `/fondos/prod/mongo_db_uri` mediante la consola de AWS o AWS CLI, un despliegue subsecuente del stack no restablece el valor real a placeholder.
4. **Parámetro con caracteres especiales en connection strings de MongoDB:**
   - La cadena de conexión de MongoDB Atlas contiene caracteres como `@`, `:`, `/`, `?` y `+`. Los parámetros SSM tipo `String` preservan exactamente la cadena sin truncamiento ni escapes no deseados.
5. **Despliegue automático en Fly.io vía GitHub Actions tras la reubicación a `legacy/`:**
   - El workflow `.github/workflows/fly-deploy.yml` ejecuta `flyctl deploy --remote-only`. Al leer `fly.toml`, flyctl encontrará `[build] dockerfile = "legacy/Dockerfile"`, garantizando que el build remoto de Docker continúe construyendo y desplegando sin interrupción.
