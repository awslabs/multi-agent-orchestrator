#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ChatDemoStack } from '../lib/chat-demo-app-stack'
import { UserInterfaceStack } from '../lib/user-interface-stack';

const app = new cdk.App();

const chatDemoStack = new ChatDemoStack(app, 'ChatDemoStack', {
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT
  },
  crossRegionReferences: true,
  description: "Multi Agent Orchestrator Chat Demo Application (uksb-2mz8io1d9k)"
});

new UserInterfaceStack(app, 'UserInterfaceStack', {
  env: {
    region: 'us-east-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  crossRegionReferences: true,
  description: "Multi Agent Orchestrator User Interface (uksb-2mz8io1d9k)",
  multiAgentLambdaFunctionUrl: chatDemoStack.multiAgentLambdaFunctionUrl,
});