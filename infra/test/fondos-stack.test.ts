import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as path from 'path';
import { FondosStack } from '../lib/fondos-stack';
import { FondosFunction } from '../lib/constructs/fondos-function';

describe('FondosStack - Infraestructura Base', () => {
  let app: cdk.App;
  let stack: FondosStack;
  let template: Template;

  beforeEach(() => {
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
