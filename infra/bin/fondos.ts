#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { FondosStack } from '../lib/fondos-stack';

const app = new cdk.App();

new FondosStack(app, 'FondosStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1',
  },
  stage: 'prod',
  description: 'Stack principal de Fondos Mutuos Peru (AWS Always Free)',
});
