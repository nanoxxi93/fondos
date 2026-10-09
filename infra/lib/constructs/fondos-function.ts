import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, NodejsFunctionProps } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { Construct } from 'constructs';

export interface FondosFunctionProps extends NodejsFunctionProps {
  /**
   * Prefijo de parámetros SSM que la función puede leer.
   * Por defecto: '/fondos/prod'
   */
  readonly ssmPrefix?: string;
}

/**
 * Construct base reutilizable para funciones AWS Lambda de Fondos Mutuos Perú.
 * Configurado con empaquetado nativo mediante esbuild local (sin requerir Docker),
 * LogGroup nativo con retención a 7 días y política de mínimo privilegio para SSM.
 */
export class FondosFunction extends NodejsFunction {
  public readonly ssmPrefix: string;

  constructor(scope: Construct, id: string, props: FondosFunctionProps) {
    const ssmPrefix = props.ssmPrefix || '/fondos/prod';
    const repoRoot = path.resolve(__dirname, '../../../');
    const projectRoot = props.projectRoot || repoRoot;
    const depsLockFilePath = props.depsLockFilePath || path.join(repoRoot, 'package-lock.json');

    const logGroup = props.logGroup || new logs.LogGroup(scope, `${id}LogGroup`, {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    super(scope, id, {
      projectRoot,
      depsLockFilePath,
      runtime: lambda.Runtime.NODEJS_24_X,
      memorySize: props.memorySize || 256,
      timeout: props.timeout || Duration.seconds(30),
      logGroup,
      environment: {
        STAGE: 'prod',
        SSM_PREFIX: ssmPrefix,
        NODE_OPTIONS: '--enable-source-maps',
        ...props.environment,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node24',
        forceDockerBundling: false, // Compila localmente con esbuild sin Docker
        ...props.bundling,
      },
      ...props,
    });


    this.ssmPrefix = ssmPrefix;

    // Conceder política IAM de mínimo privilegio sobre /fondos/prod/*
    const stack = cdk.Stack.of(this);
    const ssmArnPattern = stack.formatArn({
      service: 'ssm',
      resource: 'parameter',
      resourceName: `${ssmPrefix.replace(/^\//, '')}/*`,
    });

    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
        resources: [ssmArnPattern],
      })
    );
  }
}
