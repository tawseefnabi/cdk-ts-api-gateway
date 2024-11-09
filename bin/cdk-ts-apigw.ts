#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CdkTsApigwStack } from '../lib/cdk-ts-apigw-stack';
import environmentConfig from './stack.config';

const app = new cdk.App();
new CdkTsApigwStack(app, 'CdkTsApigwStack', environmentConfig);