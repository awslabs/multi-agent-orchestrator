---
title: Orchestrator overview
description: An introduction to the Orchestrator
---

The Multi-Agent Orchestrator is the central component of the framework, responsible for managing agents, routing requests, and handling conversations. This page provides an overview of how to initialize the Orchestrator and details all available configuration options.

### Initializing the Orchestrator

To create a new Orchestrator instance, you can use the `MultiAgentOrchestrator` class:

```typescript
import { MultiAgentOrchestrator } from "@aws/multi-agent-orchestrator";

const orchestrator = new MultiAgentOrchestrator(options);
```

The `options` parameter is optional and allows you to customize various aspects of the Orchestrator's behavior.

### Configuration options

The Orchestrator accepts an `OrchestratorOptions` object during initialization. All options are optional and will use default values if not specified. Here's a complete list of available options:

1. `storage`: Specifies the storage mechanism for chat history. Default is `InMemoryChatStorage`.
2. `config`: An object containing various configuration flags and values:
   - `LOG_AGENT_CHAT`: Boolean flag to log agent chat interactions.
   - `LOG_CLASSIFIER_CHAT`: Boolean flag to log classifier chat interactions.
   - `LOG_CLASSIFIER_RAW_OUTPUT`: Boolean flag to log raw classifier output.
   - `LOG_CLASSIFIER_OUTPUT`: Boolean flag to log processed classifier output.
   - `LOG_EXECUTION_TIMES`: Boolean flag to log execution times of various operations.
   - `MAX_RETRIES`: Number of maximum retry attempts for the classifier.
   - `MAX_MESSAGE_PAIRS_PER_AGENT`: Maximum number of message pairs to retain per agent.
   - `USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED`: Boolean flag to use the default agent when no specific agent is identified.
   - `CLASSIFICATION_ERROR_MESSAGE`: Custom error message for classification errors.
3. `logger`: Custom logger instance. If not provided, a default logger will be used.
4. `classifier`: Custom classifier instance. If not provided, a `BedrockClassifier` will be used.

### Example with all options

Here's an example that demonstrates how to initialize the Orchestrator with all available options:

```typescript
import { MultiAgentOrchestrator } from "@aws/multi-agent-orchestrator";
import { DynamoDBChatStorage } from "@aws/multi-agent-orchestrator/storage";
import { CustomClassifier } from "./custom-classifier";
import { CustomLogger } from "./custom-logger";

const orchestrator = new MultiAgentOrchestrator({
  storage: new DynamoDBChatStorage(),
  config: {
    LOG_AGENT_CHAT: true,
    LOG_CLASSIFIER_CHAT: true,
    LOG_CLASSIFIER_RAW_OUTPUT: false,
    LOG_CLASSIFIER_OUTPUT: true,
    LOG_EXECUTION_TIMES: true,
    MAX_RETRIES: 3,
    MAX_MESSAGE_PAIRS_PER_AGENT: 50,
    USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED: true,
    CLASSIFICATION_ERROR_MESSAGE: "Oops! We couldn't process your request. Please try again.",
    NO_SELECTED_AGENT_MESSAGE: "I'm sorry, I couldn't determine how to handle your request. Could you please rephrase it?",
    GENERAL_ROUTING_ERROR_MSG_MESSAGE: "An error occurred while processing your request. Please try again later.",
  },
  logger: new CustomLogger(),
  classifier: new CustomClassifier(),
});
```

Remember, all these options are optional. If you don't specify an option, the Orchestrator will use its default value.

### Default values

Here are the default values for each configuration option:

```typescript
export const DEFAULT_CONFIG: OrchestratorConfig = {
  LOG_AGENT_CHAT: false,
  LOG_CLASSIFIER_CHAT: false,
  LOG_CLASSIFIER_RAW_OUTPUT: false,
  LOG_CLASSIFIER_OUTPUT: false,
  LOG_EXECUTION_TIMES: false,
  MAX_RETRIES: 3,
  USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED: true,
  CLASSIFICATION_ERROR_MESSAGE: "I'm sorry, an error occurred while processing your request. Please try again later.",
  NO_SELECTED_AGENT_MESSAGE: "I'm sorry, I couldn't determine how to handle your request. Could you please rephrase it?",
  GENERAL_ROUTING_ERROR_MSG_MESSAGE: "An error occurred while processing your request. Please try again later.",
  MAX_MESSAGE_PAIRS_PER_AGENT: 100,
};
```

### Available Functions

The MultiAgentOrchestrator provides several functions to manage agents, process requests, and analyze agent configurations. Here's an overview of the key functions:

1. `addAgent(agent: Agent)`: Adds a new agent to the orchestrator.

2. `getDefaultAgent()`: Returns the current default agent.

3. `setDefaultAgent(agent: Agent)`: Sets a new default agent.

4. `setClassifier(intentClassifier: Classifier)`: Sets a new classifier for intent classification.

5. `getAllAgents()`: Returns an object containing all registered agents with their names and descriptions.

6. `analyzeAgentOverlap()`: Analyzes and reports on any overlap in capabilities between agents.

7. `routeRequest(userInput: string, userId: string, sessionId: string, additionalParams: Record<string, string> = {})`: 
   Processes a user request, classifies the intent, selects an appropriate agent, and returns the agent's response.


These functions allow you to configure the orchestrator, manage agents, and process user requests. For more detailed information on each function, please refer to the [API Reference](/multi-agent-orchestrator/api-reference) section.

### Additional notes

- The `storage` option allows you to specify a custom storage mechanism. By default, it uses in-memory storage, but you can implement your own storage solution or use built-in options like DynamoDB storage. For more information, see the [Storage section](/multi-agent-orchestrator/storage/overview).

- The `logger` option lets you provide a custom logger. If not specified, a default logger will be used. To learn how to implement a custom logger, check out [the logging section](/multi-agent-orchestrator/advanced-features/custom-logging).

- The `classifier` option allows you to use a custom classifier for intent classification. If not provided, a [Bedrock Classifier](/multi-agent-orchestrator/classifiers/built-in/bedrock-classifier) will be used by default. For details on implementing a custom classifier, see the [Custom Classifiers](/multi-agent-orchestrator/classifiers/custom-classifier) documentation.

- The default agent is a [Bedrock LLM Agent](/multi-agent-orchestrator/agents/built-in/bedrock-llm-agent) configured as a generalist, capable of handling a wide range of topics. Learn more about the default agent and how to customize 
it in the Default Agent Configuration section.

By customizing these options, you can tailor the Orchestrator's behavior to suit your specific use case and requirements.