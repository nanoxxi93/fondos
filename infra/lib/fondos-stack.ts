import * as cdk from 'aws-cdk-lib';
import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as path from 'path';
import { Construct } from 'constructs';
import { FondosFunction } from './constructs/fondos-function';

export interface FondosStackProps extends StackProps {
  stage?: string;
}

export class FondosStack extends Stack {
  public readonly ssmParameters: Record<string, ssm.StringParameter>;
  public readonly ssmPrefix: string;
  public readonly erniScraperFunction: FondosFunction;
  public readonly erniScraperScheduleRule: events.Rule;
  public readonly bbvaScraperFunction: FondosFunction;
  public readonly bbvaScraperScheduleRule: events.Rule;
  public readonly tybaScraperFunction: FondosFunction;

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

    // --- Scraper Serverless de ERNI (Inteligo) ---
    this.erniScraperFunction = new FondosFunction(this, 'ErniScraperFunction', {
      entry: path.join(__dirname, '../../src/scrapers/erni/handler.ts'),
      handler: 'handler',
      timeout: Duration.seconds(60),
      memorySize: 256,
      ssmPrefix: this.ssmPrefix,
      description: 'Scraper serverless diario de fondos mutuos ERNI (Inteligo)',
    });

    // Regla de EventBridge Scheduler para disparo diario a las 23:00 UTC (18:00 hora de Lima)
    this.erniScraperScheduleRule = new events.Rule(this, 'ErniScraperScheduleRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '23' }),
      description: 'Disparo diario del scraper de ERNI post-cierre de mercado (18:00 PET / 23:00 UTC)',
    });

    this.erniScraperScheduleRule.addTarget(
      new targets.LambdaFunction(this.erniScraperFunction)
    );

    // --- Scraper Serverless de BBVA Asset Management ---
    this.bbvaScraperFunction = new FondosFunction(this, 'BbvaScraperFunction', {
      entry: path.join(__dirname, '../../src/scrapers/bbva/handler.ts'),
      handler: 'handler',
      timeout: Duration.seconds(60),
      memorySize: 256,
      ssmPrefix: this.ssmPrefix,
      description: 'Scraper serverless diario de fondos mutuos BBVA',
    });

    // Regla de EventBridge Scheduler para disparo diario a las 23:15 UTC (18:15 hora de Lima)
    this.bbvaScraperScheduleRule = new events.Rule(this, 'BbvaScraperScheduleRule', {
      schedule: events.Schedule.cron({ minute: '15', hour: '23' }),
      description: 'Disparo diario del scraper de BBVA post-cierre de mercado (18:15 PET / 23:15 UTC)',
    });

    this.bbvaScraperScheduleRule.addTarget(
      new targets.LambdaFunction(this.bbvaScraperFunction)
    );

    // --- Scraper Serverless de Tyba (Credicorp Capital) ---
    // Invocación manual bajo demanda sin regla de EventBridge Scheduler
    this.tybaScraperFunction = new FondosFunction(this, 'TybaScraperFunction', {
      entry: path.join(__dirname, '../../src/scrapers/tyba/handler.ts'),
      handler: 'handler',
      timeout: Duration.seconds(60),
      memorySize: 256,
      ssmPrefix: this.ssmPrefix,
      description: 'Scraper serverless bajo demanda de fondos mutuos Tyba (Credicorp Capital)',
    });
  }
}
