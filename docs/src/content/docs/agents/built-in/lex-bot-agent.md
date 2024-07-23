---
title: LexBotAgent
description: Documentation for the LexBotAgent in the Multi-Agent Orchestrator System
---

The `LexBotAgent` is a specialized agent class in the Multi-Agent Orchestrator System that integrates [Amazon Lex bots](https://aws.amazon.com/lex/). 

## Key Features

- Seamless integration with Amazon Lex V2 bots
- Support for multiple locales
- Easy configuration with bot ID and alias

## Creating a LexBotAgent

To create a new `LexBotAgent` with the required parameters, use the following code:

```typescript
import { LexBotAgent } from './path-to-lexBotAgent';

const agent = new LexBotAgent({
  name: 'My Basic Lex Bot Agent',
  description: 'An agent specialized in flight booking',
  botId: 'your-bot-id',
  botAliasId: 'your-bot-alias-id',
  localeId: 'en_US',
  region: 'us-east-1'
});
```


### Parameter Explanations

- `name`: (Required) Identifies the agent within your system.
- `description`: (Required) Describes the agent's purpose or capabilities.
- `botId`: (Required) The ID of the Amazon Lex bot you want to use.
- `botAliasId`: (Required) The alias ID of the Amazon Lex bot.
- `localeId`: (Required) The locale ID for the bot (e.g., 'en_US').
- `region`: (Required) The AWS region where the Lex bot is deployed.

## Adding the Agent to the Orchestrator

To integrate the LexBotAgent into your Multi-Agent Orchestrator, follow these steps:

1. First, ensure you have created an instance of the orchestrator:

```typescript
import { MultiAgentOrchestrator } from 'multi-agent-orchestrator';

const orchestrator = new MultiAgentOrchestrator();
```

2. Then, add the LexBotAgent to the orchestrator:

```typescript

orchestrator.addAgent(agent);
```

3. Now you can use the orchestrator to route requests to the appropriate agent, including your Lex bot:

```typescript
const response = await orchestrator.routeRequest(
  "I would like to book a flight",
  "user123",
  "session456"
);
```

---

By leveraging the `LexBotAgent`, you can easily integrate **pre-built Amazon Lex Bots** into your Multi-Agent Orchestrator.