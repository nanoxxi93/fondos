import * as cdk from 'aws-cdk-lib';
import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface FondosStackProps extends StackProps {
  stage?: string;
}

export class FondosStack extends Stack {
  public readonly ssmParameters: Record<string, ssm.StringParameter>;
  public readonly ssmPrefix: string;

  constructor(scope: Construct, id: string, props?: FondosStackProps) {
    super(scope, id, props);

    const stage = props?.stage || 'prod';
    this.ssmPrefix = `/fondos/${stage}`;

    const paramConfigs = [
      { id: 'MongoDbUriParam', name: 'mongo_db_uri', placeholder: 'PLACEHOLDER_MONGO_DB_URI' },
      { id: 'ErniApiKeyParam', name: 'erni_apikey', placeholder: 'PLACEHOLDER_ERNI_APIKEY' },
      { id: 'TybaApiKeyParam', name: 'tyba_apikey', placeholder: 'PLACEHOLDER_TYBA_APIKEY' },
      { id: 'TybaAppProofParam', name: 'tyba_app_proof', placeholder: 'PLACEHOLDER_TYBA_APP_PROOF' },
      { id: 'BbvaApiKeyParam', name: 'bbva_apikey', placeholder: 'PLACEHOLDER_BBVA_APIKEY' },
    ];

    this.ssmParameters = {};

    for (const config of paramConfigs) {
      this.ssmParameters[config.name] = new ssm.StringParameter(this, config.id, {
        parameterName: `${this.ssmPrefix}/${config.name}`,
        stringValue: config.placeholder,
        tier: ssm.ParameterTier.STANDARD,
        description: `Parametro de configuracion de Fondos Mutuos (${config.name})`,
      });

      this.ssmParameters[config.name].applyRemovalPolicy(RemovalPolicy.RETAIN);
    }
  }
}
