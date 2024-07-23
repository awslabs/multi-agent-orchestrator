#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ChatDemoStack } from '../lib/chat-demo-app-stack'

const app = new cdk.App();
new ChatDemoStack(app, 'ChatDemoStack', {
  crossRegionReferences: true,
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT
  }
});