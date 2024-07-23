---
title: AmazonBedrockAgent
description: Documentation for the AmazonBedrockAgent in the Multi-Agent Orchestrator
---

The `AmazonBedrockAgent` is a specialized agent class in the Multi-Agent Orchestrator that integrates directly with [Amazon Bedrock agents](https://aws.amazon.com/bedrock/agents/?nc1=h_ls).


## Creating an AmazonBedrockAgent

To create a new `AmazonBedrockAgent` with only the required parameters, use the following code:

```typescript
import { AmazonBedrockAgent } from 'multi-agent-orchestrator';


const agent = new AmazonBedrockAgent({
  name: 'My Bank Agent',
  description: 'You are a helpful and friendly agent that answers questions about loan-related inquiries',
  agentId: 'your-agent-id',
  agentAliasId: 'your-agent-alias-id'
});
```

In this basic example, we provide the four required parameters: `name`, `description`, `agentId`, and `agentAliasId`.

### Parameter Explanations

- `name`: (Required) Identifies the agent within your system.
- `description`: (Required) Describes the agent's purpose or capabilities.
- `agentId`: (Required) The ID of the Amazon Bedrock agent you want to use.
- `agentAliasId`: (Required) The alias ID of the Amazon Bedrock agent.

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

---

By leveraging the `AmazonBedrockAgent`, you can easily integrate **pre-built Amazon Bedrock agents** into your Multi-Agent Orchestrator.