# Plan de Implementación Técnico

## Información general sobre la arquitectura

Este plan define la estrategia técnica para:
1. **Encapsular el código legado:** Mover todo el monolito Node.js/Express, Docker y scrapers JS existentes al subdirectorio `legacy/`, dejando la raíz del repositorio limpia y modular sin romper su funcionamiento local ni su despliegue continuo en Fly.io.
2. **Construir la infraestructura base en AWS:** Implementar AWS CDK v2 en TypeScript bajo el subdirectorio `infra/`, aislando completamente sus dependencias y aprovisionando parámetros SSM y la fábrica de Lambdas `FondosFunction`.

### Estructura del Repositorio Tras la Implementación:
```text
fondos/
├── legacy/                     # Monolito Express / Fly.io autocontenido
│   ├── index.js                # Servidor Express legado
│   ├── load-env.js             # Loader de .env
│   ├── db.js                   # Conexión Mongoose y modelo legado
│   ├── utils.js                # Helpers comunes
│   ├── erni.js, bbva.js, tyba.js # Scrapers JS legados
│   ├── tea.js                  # Lógica matemática de variación
│   ├── html.js                 # Vista HTML con Chart.js
│   ├── Dockerfile              # Dockerfile legado
│   ├── docker-compose.yml      # Compose legado
│   └── run.sh                  # Script de ejecución
├── infra/                      # AWS CDK v2 en TypeScript
│   ├── bin/
│   │   └── fondos.ts           # Entrypoint de la aplicación CDK (instancia FondosStack)
│   ├── lib/
│   │   ├── constructs/
│   │   │   └── fondos-function.ts # Construct base FondosFunction (extiende NodejsFunction)
│   │   └── fondos-stack.ts     # Stack único: Parámetros SSM y configuración IAM
│   ├── test/
│   │   └── fondos-stack.test.ts # Tests sintéticos de infraestructura (@aws-cdk/assertions)
│   ├── cdk.json                # Configuración de CDK CLI (comando app: ts-node bin/fondos.ts)
│   ├── package.json            # Dependencias específicas de CDK (aws-cdk-lib, esbuild, etc.)
│   └── tsconfig.json           # Configuración estricta de TypeScript
├── specs/                      # Especificaciones SDD
├── scripts/                    # Validadores de gobernanza SDD
├── fly.toml                    # Configuración de Fly.io (apuntando a legacy/Dockerfile)
├── package.json                # Package raíz (scripts start/dev apuntando a legacy/index.js)
└── README.md                   # Documentación con arquitectura dual y diagrama Mermaid
```

---

## Pila tecnológica y decisiones clave

### 1. Reorganización a `legacy/` sin disrupción
- **Por qué:** Permite limpiar la raíz del repositorio de archivos JavaScript sueltos, logrando una presentación profesional de monorepo/multi-service para el portafolio.
- **Mapeo de archivos:**
  - `fly.toml`: Se añade `[build] dockerfile = "legacy/Dockerfile"`.
  - `legacy/Dockerfile`: Se ajusta `CMD ["node", "--max-old-space-size=180", "legacy/index.js"]`.
  - `package.json`: Se actualiza `"main": "legacy/index.js"`, `"start": "node legacy/index.js"` y `"dev": "node --watch legacy/index.js"`.

### 2. AWS CDK v2 (`aws-cdk-lib` y `constructs`)
- **Por qué:** Proporciona tipado estricto, L2 Constructs que autogeneran roles y políticas IAM siguiendo el principio de mínimo privilegio, y compatibilidad garantizada a largo plazo.
- **Alternativas descartadas:**
  - *CloudFormation / SAM puro (YAML):* Descartado por ser propenso a errores de indentación y carecer de tipado estricto.
  - *Terraform:* Descartado para este proyecto debido a que el empaquetado de Lambdas en TypeScript requiere mayor configuración y módulos de terceros.

### 3. Construct `FondosFunction` sobre `aws-cdk-lib/aws-lambda-nodejs` (`NodejsFunction`)
- **Por qué:** Permite escribir las Lambdas en TypeScript moderno y delegar el bundling a `esbuild` local. Esto elimina la necesidad de tener Docker Desktop corriendo en Windows y produce paquetes minificados con *tree-shaking* que reducen el tiempo de inicio en frío (*cold start*).
- **Configuración de bundling:**
  ```typescript
  bundling: {
    minify: true,
    sourceMap: false,
    target: 'node22',
    forceDockerBundling: false // Fuerza esbuild local nativo
  }
  ```

### 4. AWS SSM Parameter Store (`StringParameter`) con `RemovalPolicy.RETAIN`
- **Por qué:** Pertenece al tier **Always Free** de AWS (\$0 por almacenamiento de hasta 10,000 parámetros estándar y \$0 por llamadas API `GetParameter`). Usar `RemovalPolicy.RETAIN` garantiza que si se destruye el stack de CDK, los parámetros y sus valores reales no se eliminen de AWS.
- **Alternativas descartadas:**
  - *AWS Secrets Manager:* Descartado porque cobra \$0.40/mes por secreto tras 30 días, violando el presupuesto estricto de \$0.00.
  - *Amazon DynamoDB:* Descartado conforme a `IF-001` (saturación de RCU/WCU).

### 5. Entorno de Desarrollo y Motores
- **Local:** Node.js 24+ y npm 12+ (aprovechando la instalación de la máquina del desarrollador).
- **Compilador TypeScript:** `typescript` con `"strict": true`, `"target": "ES2022"`, `"moduleResolution": "node"`.

---

## Secuencia de implementación

La implementación se ejecutará en 6 pasos secuenciales y verificables:

### Paso 0: Encapsulación del Monolito Legado en `legacy/`
1. Crear el directorio `legacy/`.
2. Mover a `legacy/` los archivos: `index.js`, `load-env.js`, `db.js`, `utils.js`, `erni.js`, `bbva.js`, `tyba.js`, `tea.js`, `html.js`, `Dockerfile`, `docker-compose.yml` y `run.sh`.
3. Actualizar `fly.toml` con `dockerfile = "legacy/Dockerfile"`.
4. Actualizar `legacy/Dockerfile` con el comando `CMD ["node", "--max-old-space-size=180", "legacy/index.js"]`.
5. Actualizar `package.json` de la raíz con scripts `"start": "node legacy/index.js"` y `"dev": "node --watch legacy/index.js"`.
6. Validar que la sintaxis de `legacy/index.js` y módulos sea correcta con `node --check legacy/index.js`.

### Paso 1: Configuración del proyecto CDK en `infra/`
- Crear `infra/package.json` con dependencias:
  - `dependencies`: `aws-cdk-lib`, `constructs`
  - `devDependencies`: `typescript`, `ts-node`, `esbuild`, `@aws-cdk/assertions`, `@types/node`, `@types/jest`
- Crear `infra/tsconfig.json` con compilación estricta y generación de CommonJS/ES2022 para ts-node.
- Crear `infra/cdk.json` configurando el comando ejecutor (`ts-node --prefer-ts-exts bin/fondos.ts`).

### Paso 2: Creación del Stack Principal (`infra/lib/fondos-stack.ts`)
- Declarar la clase `FondosStack` que hereda de `Stack`.
- Aprovisionar los 5 parámetros SSM bajo el path `/fondos/prod/`:
  - `mongo_db_uri`
  - `erni_apikey`
  - `tyba_apikey`
  - `tyba_app_proof`
  - `bbva_apikey`
- Configurar cada parámetro con `tier: ParameterTier.STANDARD`, `stringValue: 'PLACEHOLDER_<NOMBRE>'` y `removalPolicy: RemovalPolicy.RETAIN`.

### Paso 3: Creación del Construct Reutilizable (`infra/lib/constructs/fondos-function.ts`)
- Implementar la clase `FondosFunction` que hereda de `NodejsFunction`.
- Aplicar defaults obligatorios:
  - `runtime: lambda.Runtime.NODEJS_22_X` (o el más reciente soportado por CDK).
  - `memorySize: 256` (óptimo balance CPU/costo dentro del Free Tier).
  - `timeout: Duration.seconds(30)`.
  - `logRetention: logs.RetentionDays.ONE_WEEK` (para no saturar los 5 GB gratuitos de CloudWatch).
  - `bundling.forceDockerBundling: false`.
- Conceder permisos de lectura a la función sobre el ARN del prefijo SSM: `arn:aws:ssm:${region}:${account}:parameter/fondos/prod/*`.

### Paso 4: Entrypoint de la Aplicación (`infra/bin/fondos.ts`)
- Instanciar la `cdk.App()`.
- Instanciar `FondosStack` asignando el entorno `env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION || 'us-east-1' }`.

### Paso 5: Pruebas Unitarias de Infraestructura y Síntesis
- Crear `infra/test/fondos-stack.test.ts`.
- Verificar mediante `Template.fromStack(stack)`:
  - Que existan exactamente 5 recursos de tipo `AWS::SSM::Parameter`.
  - Que la política de actualización de cada parámetro contenga `DeletionPolicy: Retain`.
  - Que una función de prueba instanciada con `FondosFunction` genere una política IAM con `Action: ["ssm:GetParameter", "ssm:GetParameters"]`.
- Ejecutar `npm run synth` para confirmar la generación de la plantilla CloudFormation en `cdk.out/`.

---

## Comprobación de la Constitución

| Principio de `specs/constitution.md` | Estado | Verificación en este Plan |
|---|---|---|
| **Presupuesto Estricto de \$0.00 (Always Free)** | ✅ **Cumple** | Solo se usan parámetros estándar de SSM y Lambdas dentro de las cuotas gratuitas permanentes. Quedan vetados DynamoDB, S3 hosting, API Gateway y Secrets Manager. |
| **Infraestructura como Código (AWS CDK TypeScript)** | ✅ **Cumple** | Implementado con AWS CDK v2 en TypeScript bajo `infra/`. |
| **Coexistencia con Código Legado (Fly.io)** | ✅ **Cumple** | El monolito legado es encapsulado en `legacy/` preservando `fly.toml` y scripts de arranque sin romper compatibilidad. |
| **Cero Secretos en el Repositorio** | ✅ **Cumple** | Los parámetros SSM se crean con valores placeholder (`PLACEHOLDER_*`). Los valores reales nunca se commitean. |
| **Mínimo Privilegio IAM** | ✅ **Cumple** | Las funciones solo tienen acceso de lectura a `/fondos/prod/*`, no a `*`. |
| **Retención de Logs Controlada** | ✅ **Cumple** | Configurada a 7 días en CloudWatch Logs para mantenerse dentro de los 5 GB gratuitos. |

---

## Suposiciones y preguntas abiertas

### Suposiciones:
1. **Entorno local de desarrollo:** Node.js 24+ y npm 12+ están instalados (confirmado: `v24.19.0` y `12.0.2` presentes en el sistema).
2. **Binario de `esbuild`:** `esbuild` se instalará localmente en `infra/node_modules`, lo que permitirá a AWS CDK empaquetar las funciones sin necesidad de Docker Desktop.
3. **Compatibilidad con Fly.io:** Fly.io soporta la directiva `[build] dockerfile = "legacy/Dockerfile"`.

### Preguntas abiertas:
- Ninguna pendiente.
