---
title: Bedrock LLM Agent
description: Documentation for the BedrockLLMAgent in the Multi-Agent Orchestrator
---
## Overview

The `BedrockLLMAgent` is a powerful and flexible agent class in the Multi-Agent Orchestrator System. It leverages [Amazon Bedrock's Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference.html) to interact with various LLMs supported by Amazon Bedrock. 

This agent can handle a wide range of processing tasks, making it suitable for diverse applications such as conversational AI, question-answering systems, and more.

## Key Features

- Integration with Amazon Bedrock's Converse API
- Support for multiple LLM models available on Amazon Bedrock
- Streaming and non-streaming response options
- Customizable inference configuration
- Ability to set and update custom system prompts
- Optional integration with [retrieval systems](/multi-agent-orchestrator/retrievers/overview) for enhanced context
- Support for [Tool use](https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use.html) within the conversation flow

## Creating a BedrockLLMAgent

<br>

By default, the Bedrock LLM Agent uses the `anthropic.claude-3-haiku-20240307-v1:0` model.


### Basic Example


To create a new `BedrockLLMAgent` with only the required parameters, use the following code:

```typescript
import { BedrockLLMAgent } from 'multi-agent-orchestrator';


const agent = new BedrockLLMAgent({
  name: 'Tech Agent',
  description: 'Specializes in technology areas including software development, hardware, AI, cybersecurity, blockchain, cloud computing, emerging tech innovations, and pricing/costs related to technology products and services.'
});
```

In this basic example, only the `name` and `description` are provided, which are the only required parameters for creating a BedrockLLMAgent.

### Advanced Example

For more complex use cases, you can create a BedrockLLMAgent with all available options. All parameters except `name` and `description` are optional:


To create a new `BedrockLLMAgent` with all optional parameters, use the following code:

```typescript
import { BedrockLLMAgent, BedrockLLMAgentOptions } from 'multi-agent-orchestrator';
import { Retriever } from '../retrievers/retriever';

const options: BedrockLLMAgentOptions = {
  name: 'My Advanced Bedrock Agent',
  description: 'A versatile agent for complex NLP tasks',
  modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
  region: 'us-west-2',
  streaming: true,
  inferenceConfig: {
    maxTokens: 1000,
    temperature: 0.7,
    topP: 0.9,
    stopSequences: ['Human:', 'AI:']
  },
  guardrailConfig: {
    guardrailIdentifier: 'my-guardrail',
    guardrailVersion: '1.0'
  },
  retriever: new Retriever(), // Assuming you have a Retriever class implemented
  toolConfig: {
    tool: [
      {
        type: 'function',
        function: {
          name: 'get_current_weather',
          description: 'Get the current weather in a given location',
          parameters: {
            type: 'object',
            properties: {
              location: {
                type: 'string',
                description: 'The city and state, e.g. San Francisco, CA'
              },
              unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
            },
            required: ['location']
          }
        }
      }
    ],
    toolCallback: (response) => {
      // Process tool response
      return { continueWithTools: false, message: response };
    }
  }
};

const agent = new BedrockLLMAgent(options);
```

### Option Explanations

- `name` and `description`: Identify and describe the agent's purpose.
- `modelId`: Specifies the LLM model to use (e.g., Claude 3 Sonnet).
- `region`: AWS region for the Bedrock service.
- `streaming`: Enables streaming responses for real-time output.
- `inferenceConfig`: Fine-tunes the model's output characteristics.
- `guardrailConfig`: Applies predefined guardrails to the model's responses.
- `retriever`: Integrates a retrieval system for enhanced context.
- `toolConfig`: Defines tools the agent can use and how to handle their responses.

## Setting a New Prompt

You can update the agent's system prompt at any time using the `setSystemPrompt` method:

```typescript
agent.setSystemPrompt(
  `You are an AI assistant specialized in {{DOMAIN}}.
   Your main goal is to {{GOAL}}.
   Always maintain a {{TONE}} tone in your responses.`,
  {
    DOMAIN: "cybersecurity",
    GOAL: "help users understand and mitigate potential security threats",
    TONE: "professional and reassuring"
  }
);
```

This method allows you to dynamically change the agent's behavior and focus without creating a new instance.

## Adding the Agent to the Orchestrator

To integrate the LexBotAgent into your Multi-Agent Orchestrator, follow these steps:

1. First, ensure you have created an instance of the orchestrator:

```typescript
import { MultiAgentOrchestrator } from "multi-agent-orchestrator";

const orchestrator = new MultiAgentOrchestrator();
```

2. Then, add the agent to the orchestrator:

```typescript

orchestrator.addAgent(agent);
```

3. Now you can use the orchestrator to route requests to the appropriate agent, including your Lex bot:

```typescript
const response = await orchestrator.routeRequest(
  "What is the base rate interest for 30 years?",
  "user123",
  "session456"
);
```
```

By leveraging the `BedrockLLMAgent`, you can create sophisticated, context-aware AI agents capable of handling a wide range of tasks and interactions, all powered by the latest LLM models available through Amazon Bedrock.