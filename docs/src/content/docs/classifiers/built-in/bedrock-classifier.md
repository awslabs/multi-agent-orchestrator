---
title: Bedrock Classifier
description: How to configure the Bedrock classifier
---

The Bedrock Classifier is the default classifier used in the Multi-Agent Orchestrator. 

It leverages Amazon Bedrock's  models through Converse API providing powerful and flexible classification capabilities.

## Overview

The BedrockClassifier extends the abstract `Classifier` class and uses Amazon Bedrock's runtime client to process requests and classify user intents. It's designed to analyze user input, consider conversation history, and determine the most appropriate agent to handle the query.

## Features

- Utilizes Amazon Bedrock's models through Converse API 
- Configurable model selection and inference parameters
- Supports custom system prompts and variables
- Handles conversation history for context-aware classification


### Basic Usage

By default, the Multi-Agent Orchestrator uses the BedrockClassifier. You don't need to do anything special to use it:

```typescript
import { MultiAgentOrchestrator } from "multi-agent-orchestrator";

const orchestrator = new MultiAgentOrchestrator();
```

### Custom Configuration

You can customize the BedrockClassifier by creating an instance with specific options:

```typescript
import { BedrockClassifier, MultiAgentOrchestrator } from "multi-agent-orchestrator";

const customBedrockClassifier = new BedrockClassifier({
  modelId: 'anthropic.claude-v2',
  inferenceConfig: {
    maxTokens: 500,
    temperature: 0.7,
    topP: 0.9
  }
});

const orchestrator = new MultiAgentOrchestrator({ classifier: customBedrockClassifier });
```

The BedrockClassifier accepts the following configuration options:

- `modelId` (optional): The ID of the Bedrock model to use. Defaults to Claude 3 Sonnet.
- `inferenceConfig` (optional): An object containing inference configuration parameters:
  - `maxTokens` (optional): The maximum number of tokens to generate.
  - `temperature` (optional): Controls randomness in output generation.
  - `topP` (optional): Controls diversity of output generation.
  - `stopSequences` (optional): An array of sequences that, when generated, will stop the generation process.

## Customizing the System Prompt

You can customize the system prompt used by the BedrockClassifier:

```typescript
orchestrator.classifier.setSystemPrompt(
  `
  Custom prompt template with placeholders:
  {{AGENT_DESCRIPTIONS}}
  {{HISTORY}}
  {{CUSTOM_PLACEHOLDER}}
  `,
  {
    CUSTOM_PLACEHOLDER: "Value for custom placeholder"
  }
);
```

## Processing Requests

The BedrockClassifier processes requests using the `processRequest` method, which is called internally by the orchestrator. This method:

1. Prepares the user's message and conversation history.
2. Constructs a command for the Bedrock API, including the system prompt and tool configurations.
3. Sends the request to the Bedrock API and processes the response.
4. Returns a `ClassifierResult` containing the selected agent and confidence score.

## Error Handling

The BedrockClassifier includes error handling to manage potential issues during the classification process. If an error occurs, it will log the error and return a default `ClassifierResult` with a null selected agent and zero confidence.

## Best Practices

1. **Model Selection**: Choose an appropriate model based on your use case and performance requirements.
2. **Inference Configuration**: Experiment with different inference parameters to find the best balance between response quality and speed.
3. **System Prompt**: Craft a clear and comprehensive system prompt to guide the model's classification process effectively.

## Limitations

- Requires an active AWS account with access to Amazon Bedrock.
- Classification quality depends on the chosen model and the quality of your system prompt and agent descriptions.

For more information on using and customizing the Multi-Agent Orchestrator, refer to the [Classifier Overview](/multi-agent-orchestrator/classifier/overview) and [Agents](/multi-agent-orchestrator/agents/overview) documentation.
