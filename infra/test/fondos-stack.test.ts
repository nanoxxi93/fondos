import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as path from 'path';
import { FondosStack } from '../lib/fondos-stack';
import { FondosFunction } from '../lib/constructs/fondos-function';

describe('FondosStack - Infraestructura Base', () => {
  let app: cdk.App;
  let stack: FondosStack;
  let template: Template;

  beforeAll(() => {
    app = new cdk.App();
    stack = new FondosStack(app, 'TestFondosStack', {
      stage: 'prod',
    });
    template = Template.fromStack(stack);
  });

  test('Debe aprovisionar exactamente 5 parametros en AWS SSM Parameter Store', () => {
    template.resourceCountIs('AWS::SSM::Parameter', 5);
  });

  test('Debe configurar los nombres y valores placeholder correctos en SSM', () => {
    const expectedParams = [
      { name: '/fondos/prod/mongo_db_uri', value: 'PLACEHOLDER_MONGO_DB_URI' },
      { name: '/fondos/prod/erni_apikey', value: 'PLACEHOLDER_ERNI_APIKEY' },
      { name: '/fondos/prod/tyba_apikey', value: 'PLACEHOLDER_TYBA_APIKEY' },
      { name: '/fondos/prod/tyba_app_proof', value: 'PLACEHOLDER_TYBA_APP_PROOF' },
      { name: '/fondos/prod/bbva_apikey', value: 'PLACEHOLDER_BBVA_APIKEY' },
    ];

    for (const { name, value } of expectedParams) {
      template.hasResourceProperties('AWS::SSM::Parameter', {
        Name: name,
        Value: value,
        Type: 'String',
      });
    }
  });

  test('Todos los parametros SSM deben tener DeletionPolicy Retain para persistir credenciales', () => {
    const rawTemplate = template.toJSON();
    const resources = rawTemplate.Resources;

    let ssmCount = 0;
    for (const key of Object.keys(resources)) {
      if (resources[key].Type === 'AWS::SSM::Parameter') {
        ssmCount++;
        expect(resources[key].DeletionPolicy).toEqual('Retain');
      }
    }

    expect(ssmCount).toBe(5);
  });

  test('Debe aprovisionar la funcion Lambda ErniScraperFunction con 256MB y timeout de 60s', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      MemorySize: 256,
      Timeout: 60,
      Description: 'Scraper serverless diario de fondos mutuos ERNI (Inteligo)',
    });
  });

  test('Debe configurar la regla de EventBridge Scheduler para disparo diario a las 23:00 UTC', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'cron(0 23 * * ? *)',
      Description: 'Disparo diario del scraper de ERNI post-cierre de mercado (18:00 PET / 23:00 UTC)',
      State: 'ENABLED',
    });
  });

  test('Debe aprovisionar la funcion Lambda BbvaScraperFunction con 256MB y timeout de 60s', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      MemorySize: 256,
      Timeout: 60,
      Description: 'Scraper serverless diario de fondos mutuos BBVA',
    });
  });

  test('Debe configurar la regla de EventBridge Scheduler para disparo diario a las 23:15 UTC', () => {
    template.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'cron(15 23 * * ? *)',
      Description: 'Disparo diario del scraper de BBVA post-cierre de mercado (18:15 PET / 23:15 UTC)',
      State: 'ENABLED',
    });
  });

  test('Debe aprovisionar la funcion Lambda TybaScraperFunction con 256MB y timeout de 60s', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      MemorySize: 256,
      Timeout: 60,
      Description: 'Scraper serverless bajo demanda de fondos mutuos Tyba (Credicorp Capital)',
    });
  });

  test('Debe aprovisionar la funcion Lambda ApiFunction con 256MB y timeout de 15s', () => {
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      MemorySize: 256,
      Timeout: 15,
      Description: 'API Serverless y motor de analitica TEA de fondos mutuos',
    });
  });

  test('Debe crear la AWS Lambda Function URL publica con CORS para ApiFunction', () => {
    template.resourceCountIs('AWS::Lambda::Url', 1);

    template.hasResourceProperties('AWS::Lambda::Url', {
      AuthType: 'NONE',
      Cors: {
        AllowOrigins: ['*'],
        AllowMethods: ['*'],
        AllowHeaders: ['*'],
        MaxAge: 86400,
      },
    });

    // Permiso público de invocación Function URL
    template.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunctionUrl',
      Principal: '*',
      FunctionUrlAuthType: 'NONE',
    });
  });

  test('Debe verificar exactamente 4 funciones Lambda en el stack (Erni, Bbva, Tyba y Api)', () => {
    template.resourceCountIs('AWS::Lambda::Function', 4);
  });

  test('Debe verificar exactamente 2 reglas de EventBridge Scheduler (solo ERNI y BBVA, ninguna para Tyba ni Api)', () => {
    template.resourceCountIs('AWS::Events::Rule', 2);
  });
});

describe('FondosFunction Construct', () => {
  test('Debe configurar runtime, memoria, timeout, LogGroup y politicas IAM de minimo privilegio', () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, 'TestFunctionStack', {
      env: { account: '123456789012', region: 'us-east-1' },
    });

    new FondosFunction(stack, 'TestFunction', {
      entry: path.join(__dirname, 'fixtures', 'sample-handler.ts'),
      handler: 'handler',
    });

    const template = Template.fromStack(stack);

    // Verificar propiedades de Lambda
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      MemorySize: 256,
      Timeout: 30,

      Environment: {
        Variables: Match.objectLike({
          STAGE: 'prod',
          SSM_PREFIX: '/fondos/prod',
        }),
      },
    });

    // Verificar LogGroup con retención a 7 días
    template.hasResourceProperties('AWS::Logs::LogGroup', {
      RetentionInDays: 7,
    });

    // Verificar permisos IAM hacia /fondos/prod/*
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:GetParametersByPath'],
            Effect: 'Allow',
          }),
        ]),
      },
    });
  });
});
