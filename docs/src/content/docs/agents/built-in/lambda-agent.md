---
title: LambdaAgent
description: Documentation for the LambdaAgent in the Multi-Agent Orchestrator System
---


The `LambdaAgent` is a versatile agent class in the Multi-Agent Orchestrator System that allows integration with existing AWS Lambda functions. This agent will invoke your existing Lambda function written in any language (e.g., Python, Node.js, Java), providing a seamless way to utilize your existing serverless logic within the orchestrator.

## Key Features

- Integration with any AWS Lambda function runtime
- Custom payload encoder/decoder methods to match your payload format
- Support for cross-region Lambda invocation
- Default payload encoding/decoding for quick setup

## Creating a LambdaAgent


```typescript
import { LambdaAgent } from 'multi-agent-orchestrator';

const myCustomInputPayloadEncoder = (input, chatHistory, userId, sessionId, additionalParams) => {
  return JSON.stringify({
    userQuestion: input,
    myCustomField: "Hello world!",
    history: chatHistory,
    user: userId,
    session: sessionId,
    ...additionalParams
  });
};

const myCustomOutputPayloadDecoder = (input) => {
  const decodedResponse = JSON.parse(new TextDecoder("utf-8").decode(input.Payload)).body;
  return {
    role: "assistant",
    content: [{ text: `Response: ${decodedResponse}` }]
  };
};

const options: LambdaAgentOptions = {
  name: 'My Advanced Lambda Agent',
  description: 'A versatile agent that calls a custom Lambda function',
  functionName: 'my-advanced-lambda-function',
  functionRegion: 'us-west-2',
  inputPayloadEncoder: myCustomInputPayloadEncoder,
  outputPayloadDecoder: myCustomOutputPayloadDecoder
};

const agent = new LambdaAgent(options);
```

### Parameter Explanations

- `name`: (Required) Identifies the agent within your system.
- `description`: (Required) Describes the agent's purpose or capabilities.
- `functionName`: (Required) The name or ARN of the Lambda function to invoke.
- `functionRegion`: (Required) The AWS region where the Lambda function is deployed.
- `inputPayloadEncoder`: (Optional) A custom function to encode the input payload.
- `outputPayloadDecoder`: (Optional) A custom function to decode the Lambda function's response.

## Adding the Agent to the Orchestrator

To integrate the LambdaAgent into your Multi-Agent Orchestrator System, follow these steps:

1. First, ensure you have created an instance of the orchestrator:

```typescript
import { MultiAgentOrchestrator } from "multi-agent-orchestrator";

const orchestrator = new MultiAgentOrchestrator();
```

2. Then, add the LambdaAgent to the orchestrator:

```typescript
orchestrator.addAgent(agent);
```

3. Now you can use the orchestrator to route requests to the appropriate agent, including your Lambda function:

```typescript
const response = await orchestrator.routeRequest(
  "I need help with my order",
  "user123",
  "session456"
);
```

If you don't provide custom encoder/decoder functions, the LambdaAgent uses default methods:

Default Input Payload

```json
{
  "query": "inputText",
  "chatHistory": [...],
  "additionalParams": {...},
  "userId": "userId",
  "sessionId": "sessionId"
}
```

Expected Default Output Payload

```json
{
  "body": "{\"response\":\"this is the response\"}"
}
```

<br>

---

By leveraging the `LambdaAgent`, you can easily incorporate ***existing AWS Lambda functions*** into your Multi-Agent Orchestrator System, combining serverless compute with your custom orchestration logic.
