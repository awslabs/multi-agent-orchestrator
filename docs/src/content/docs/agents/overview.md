---
title: Agents overview
description: An overview of agents
---

In the Multi-Agent Orchestrator, an agent is a fundamental building block designed to process user requests and generate a response. The `Agent` abstract class serves as the foundation for all specific agent implementations, providing a common structure and interface.

## The Agent Abstract Class

The `Agent` class is an abstract base class that defines the essential properties and methods that all agents in the system must have. It's designed to be flexible, allowing for a wide range of implementations from simple API callers to complex LLM-powered conversational agents.

### Key Properties

- `name`: A string representing the name of the agent.
- `id`: A unique identifier for the agent, automatically generated from the name.
- `description`: A string describing the agent's capabilities and expertise.

### Abstract Method: processRequest

The core functionality of any agent is encapsulated in the `processRequest` method. This method must be implemented by all concrete agent classes:

```typescript
abstract processRequest(
  inputText: string,
  userId: string,
  sessionId: string,
  chatHistory: Message[],
  additionalParams?: Record<string, any>
): Promise<Message | AsyncIterable<any>>;
```

- `inputText`: The user's input or query.
- `userId`: A unique identifier for the user.
- `sessionId`: An identifier for the current conversation session.
- `chatHistory`: An array of previous messages in the conversation.
- `additionalParams`: Optional parameters for additional context or configuration. This is a powerful feature that allows for dynamic customization of agent behavior
  - It's an optional object of key-value pairs that can be passed when calling `routeRequest` on the orchestrator.
  - These parameters are then forwarded to the appropriate agent's `processRequest` method.
  - Custom agents can use these parameters to adjust their behavior or provide additional context for processing the request.


The method returns either a `Promise<Message>` for single responses or `Promise<AsyncIterable<any>>` for streaming responses.



Example usage:

```typescript
// When calling routeRequest
const response = await orchestrator.routeRequest(
  userInput,
  userId,
  sessionId,
  { location: "New York", units: "metric" }
);

// In a custom agent's processRequest method
class WeatherAgent extends Agent {
  async processRequest(
    inputText: string,
    userId: string,
    sessionId: string,
    chatHistory: Message[],
    additionalParams?: Record<string, any>
  ): Promise<Message> {
    const location = additionalParams?.location || "default location";
    const units = additionalParams?.units || "metric";
    // Use location and units to fetch weather data
    // ...
  }
}
```
