---
title: Custom storage
description: Extending the ChatStorage class to create custom storage options in the Multi-Agent Orchestrator System
---

The Multi-Agent Orchestrator System provides flexibility in how conversation data is stored through its abstract `ChatStorage` class. This guide will walk you through the process of creating a custom storage solution by extending this class.

## Understanding the ChatStorage Abstract Class

The `ChatStorage` class defines the interface for all storage solutions in the system. It includes three main methods:

1. `saveChatMessage`: Saves a new message to the storage.
2. `fetchChat`: Retrieves messages for a specific conversation.
3. `fetchAllChats`: Retrieves all messages for a user's session.

Here's the abstract class definition:

```typescript
import { Message } from "@aws-sdk/client-bedrock-runtime";

export abstract class ChatStorage {
  abstract saveChatMessage(
    userId: string,
    sessionId: string,
    agentId: string,
    message: Message
  ): Promise<Message[]>;

  abstract fetchChat(
    userId: string,
    sessionId: string,
    agentId?: string | null
  ): Promise<Message[]>;

  abstract fetchAllChats(
    userId: string,
    sessionId: string
  ): Promise<Message[]>;
}
```

## Creating a Custom Storage Solution

To create a custom storage solution, follow these steps:

1. Create a new class that extends `ChatStorage`.
2. Implement all the abstract methods.
3. Add any additional methods or properties specific to your storage solution.


## Using Your Custom Storage

To use your custom storage with the Multi-Agent Orchestrator:

```typescript

const customStorage = new CustomStorage();
const orchestrator = new MultiAgentOrchestrator({
  storage: customStorage
});
```

By extending the `ChatStorage` class, you can create custom storage solutions tailored to your specific needs, whether it's integrating with a particular database system, implementing caching mechanisms, or adapting to unique architectural requirements.