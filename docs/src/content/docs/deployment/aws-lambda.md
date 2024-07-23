---
title: AWS Lambda Deployment
description: How to deploy the Multi-Agent Orchestrator System to AWS Lambda with streaming support
---

## Overview

Deploying the Multi-Agent Orchestrator System to AWS Lambda allows you to run your multi-agent setup in a serverless environment. This guide will walk you through the process of setting up and deploying your orchestrator to Lambda, including support for streaming responses.

## Prerequisites

- AWS account with appropriate permissions
- AWS CLI installed and configured
- Node.js and npm installed
- Basic familiarity with AWS Lambda, API Gateway, and AWS SDK for JavaScript v3

## Deployment Steps

1. **Prepare Your Code**

   Create a new file, e.g., `lambda.ts`, and add the following code:

   ```typescript
   import { Logger } from "@aws-lambda-powertools/logger";
   import { OrchestratorConfig, MultiAgentOrchestrator, BedrockLLMAgent } from "@aws/multi-agent-orchestrator";
   import { APIGatewayProxyEventV2, Context } from "aws-lambda";

   const logger = new Logger();

   declare global {
     namespace awslambda {
       function streamifyResponse(
         f: (
           event: APIGatewayProxyEventV2,
           responseStream: NodeJS.WritableStream,
           context: Context
         ) => Promise<void>
       ): (event: APIGatewayProxyEventV2, context: Context) => Promise<any>;
     }
   }


   const orchestrator = new MultiAgentOrchestrator({
     config: {
       LOG_AGENT_CHAT: true,
       LOG_CLASSIFIER_CHAT: true,
       LOG_CLASSIFIER_RAW_OUTPUT: true,
       LOG_CLASSIFIER_OUTPUT: true,
       LOG_EXECUTION_TIMES: true
     }
   });

   orchestrator.addAgent(new BedrockLLMAgent({
     name: 'Tech Agent',
     description: 'Specializes in technology areas including software development, hardware, AI, cybersecurity, blockchain, cloud computing, emerging tech innovations, and pricing/costs related to technology products and services.',
     streaming: true,
     inferenceConfig: {
       temperature: 0.1
     }
   }));

   orchestrator.addAgent(new BedrockLLMAgent({
     name: 'Health Agent',
     description: 'Focuses on health and medical topics such as general wellness, nutrition, diseases, treatments, mental health, fitness, healthcare systems, and medical terminology or concepts.'
   }));


   async function eventHandler(
     event: APIGatewayProxyEventV2,
     responseStream: NodeJS.WritableStream,
     context: Context
   ) {
     try {
       const body = JSON.parse(event.body || '{}');
       const { query, userId, sessionId } = body;

       const response = await orchestrator.routeRequest(query, userId, sessionId);

       responseStream.write(JSON.stringify({
         type: "metadata",
         data: response.metadata,
       }) + "\n");

       if (response.streaming) {
         for await (const chunk of response.output) {
           if (typeof chunk === "string") {
             responseStream.write(JSON.stringify({
               type: "chunk",
               data: chunk,
             }) + "\n");
           }
         }
       } else {
         responseStream.write(JSON.stringify({
           type: "complete",
           data: response.output,
         }) + "\n");
       }
     } catch (error) {
       logger.error('Error:', error);
       responseStream.write(JSON.stringify({
         type: "error",
         data: "Internal Server Error",
       }) + "\n");
     } finally {
       responseStream.end();
     }
   }

   export const handler = awslambda.streamifyResponse(eventHandler);
   ```

2. **Deploy Your Code**

   - Zip your `lambda.ts` file and any dependencies.
   - Upload the zip file to your Lambda function.

3. **Configure IAM Permissions**

   Ensure your Lambda function's execution role has permissions to:
    - Invoke Amazon Bedrock models
   - Write to CloudWatch Logs

4. **Test Your Deployment**

   Use the AWS CLI to invoke your Lambda function:

   ```bash
   aws lambda invoke --function-url https://your-lambda-function-url --payload '{"query": "What is artificial intelligence?", "userId": "user123", "sessionId": "session456"}' --cli-binary-format raw-in-base64-out output.json
   ```

   Check the `output.json` file for the streamed response.

## Handling Streaming Responses

To handle streaming responses in your client application:

1. Make a request to the Lambda function URL.
2. Parse the response as a stream of JSON objects.
3. Handle different types of messages:
   - `metadata`: Contains information about the selected agent and other metadata.
   - `chunk`: Contains a part of the streaming response.
   - `complete`: Contains the full response for non-streaming agents.
   - `error`: Indicates an error occurred.

Example client-side code (using fetch API):

```javascript
async function getStreamingResponse(query, userId, sessionId) {
  const response = await fetch('https://your-lambda-function-url', {
    method: 'POST',
    body: JSON.stringify({ query, userId, sessionId }),
    headers: {
      'Content-Type': 'application/json',
      // Include AWS IAM authentication headers here
    },
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const chunk = decoder.decode(value);
    const messages = chunk.split('\n').filter(Boolean).map(JSON.parse);
    
    for (const message of messages) {
      switch (message.type) {
        case 'metadata':
          console.log('Metadata:', message.data);
          break;
        case 'chunk':
          console.log('Chunk:', message.data);
          break;
        case 'complete':
          console.log('Complete response:', message.data);
          break;
        case 'error':
          console.error('Error:', message.data);
          break;
      }
    }
  }
}
```

## Considerations

- Ensure your client can handle streaming responses appropriately.
- Be aware of Lambda execution time limits for long-running conversations.
- Monitor your Lambda function's performance and adjust the timeout and memory settings as needed.
- Consider implementing error handling and retry logic in your client application.

By following these steps, you'll have your Multi-Agent Orchestrator System running in AWS Lambda with streaming support, ready to handle complex, multi-turn conversations through a serverless architecture.