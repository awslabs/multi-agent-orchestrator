---
title: AWS Lambda NodeJs with Multi-Agent Orchestrator
description: How to set up the Multi-Agent Orchestrator System for AWS Lambda using JavaScript
---

The Multi-Agent Orchestrator framework can be used inside an AWS Lambda function like any other library. This guide outlines the process of setting up the Multi-Agent Orchestrator System for use with AWS Lambda using JavaScript.

## Prerequisites

- AWS account with appropriate permissions
- Node.js and npm installed
- Basic familiarity with AWS Lambda and JavaScript

## Installation and Setup

1. **Create a New Project Directory**

   ```bash
   mkdir multi-agent-lambda && cd multi-agent-lambda
   ```

2. **Initialize a New Node.js Project**

   ```bash
   npm init -y
   ```

3. **Install the Multi-Agent Orchestrator Framework**

   ```bash
   npm install multi-agent-orchestrator
   ```

## Lambda Function Structure

Create a new file named `lambda.js` in your project directory. Here's a high-level overview of what your Lambda function should include:

```javascript
const { MultiAgentOrchestrator, BedrockLLMAgent } = require("multi-agent-orchestrator");

// Initialize the orchestrator
const orchestrator = new MultiAgentOrchestrator({
  // Configuration options
});

// Add agents to the orchestrator
orchestrator.addAgent(new BedrockLLMAgent({
  // Agent configuration
}));

// Lambda handler function
exports.handler = async (event, context) => {
  try {
    const { query, userId, sessionId } = event;
    const response = await orchestrator.routeRequest(query, userId, sessionId);
    return response;
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" })
    };
  }
};
```

Customize the orchestrator configuration and agent setup according to your specific requirements.

## Deployment

Use your preferred method to deploy the Lambda function (e.g., AWS CDK, Terraform, Serverless Framework, AWS SAM, or manual deployment through AWS Console).

## IAM Permissions

Ensure your Lambda function's execution role has permissions to:
- Invoke Amazon Bedrock models
- Write to CloudWatch Logs

