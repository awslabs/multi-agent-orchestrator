---
title: Local Execution
description: How to run the Multi-Agent Orchestrator System locally
---

## Overview

Running the Multi-Agent Orchestrator System locally is useful for development, testing, and debugging. This guide will walk you through setting up and running the orchestrator on your local machine.

## Prerequisites

- Node.js and npm installed
- AWS credentials configured locally (for services like Amazon Bedrock and Amazon Lex)

## Setup Steps

1. **Install Dependencies**

  In your project directory, install the necessary packages:

   ```bash
   npm install
   ```

2. **Locate the Local Script**

   A script for local execution is available at `examples/local-demo/local-orchestrator.ts`. This script sets up the orchestrator with various agents and provides a simple command-line interface for interaction.

5. **Run the Script**

   Execute the script using ts-node:

   ```bash
   npx ts-node examples/local-demo/local-orchestrator.ts
   ```

## Using the Local Orchestrator

- The script will prompt you to enter questions.
- Type your question and press Enter.
- The orchestrator will process your query and display the response.
- Type 'exit' to quit the program.

## Code Snippets

These code snippets show how to set up the orchestrator and add agents to it. 

The code includes placeholders that you should replace with the appropriate values and agents that you want to use.


1. Setting up the orchestrator:

```typescript
const orchestrator = new MultiAgentOrchestrator({
  storage: storage,
  config: {
    LOG_AGENT_CHAT: true,
    LOG_CLASSIFIER_CHAT: true,
    LOG_CLASSIFIER_RAW_OUTPUT: true,
    LOG_CLASSIFIER_OUTPUT: true,
    LOG_EXECUTION_TIMES: true
  }
});
```

2. Adding agents 

```typescript
  // Add a Tech Agent to the orchestrator
  orchestrator.addAgent(
    new BedrockLLMAgent({
      name: "Tech Agent",
      description:
        "Specializes in technology areas including software development, hardware, AI, cybersecurity, blockchain, cloud computing, emerging tech innovations, and pricing/costs related to technology products and services.",
      streaming: true,
      inferenceConfig: {
        temperature: 0.1,
      },
    })
  );

    // Add a Lex-based  Agent to the orchestrator
  orchestrator.addAgent(
    new LexBotAgent({
      name: "{{REPLACE_WITH_YOUR_AGENT_NAME}}",
      description: "{{REPLACE_WITH_YOUR_CUSTOM_AGENT_DESCRIPTION}}",
      botId: "{{LEX_BOT_ID}}",
      botAliasId: "{{LEX_BOT_ALIAS_ID}}",
      localeId: "{{LEX_BOT_LOCALE_ID}}",
    })
  );

  // Add an Amazon Bedrock Agent to the orchestrator
  orchestrator.addAgent(
    new AmazonBedrockAgent({
      name: "{{AGENT_NAME}}",
      description: "{{REPLACE_WITH_YOUR_CUSTOM_AGENT_DESCRIPTION}}",
      agentId: "{{BEDROCK_AGENT_ID}}",
      agentAliasId: "{{BEDROCK_AGENT_ALIAS_ID}}",
    })
  );

```

3. Sending a query to the orchestrator

```typescript
const userId = "quickstart-user";
const sessionId = "quickstart-session";

const query = "What are the latest trends in AI?";

console.log(`\nUser Query: ${query}`);
const response = await orchestrator.routeRequest(query, userId, sessionId);
if (response.streaming == true) {
  console.log("\n** RESPONSE STREAMING ** \n");
  // Send metadata immediately
  console.log(`> Agent ID: ${response.metadata.agentId}`);
  console.log(`> Agent Name: ${response.metadata.agentName}`);
  console.log(`> User Input: ${response.metadata.userInput}`);
  console.log(`> User ID: ${response.metadata.userId}`);
  console.log(`> Session ID: ${response.metadata.sessionId}`);
  console.log(
    `> Additional Parameters:`,
    response.metadata.additionalParams
  );
  console.log(`\n> Response: `);

  // Stream the content
  for await (const chunk of response.output) {
    if (typeof chunk === "string") {
      process.stdout.write(chunk);
    } else {
      console.error("Received unexpected chunk type:", typeof chunk);
    }
  }
  
} else {
  // Handle non-streaming response (AgentProcessingResult)
  console.log("\n** RESPONSE ** \n");
  console.log(`> Agent ID: ${response.metadata.agentId}`);
  console.log(`> Agent Name: ${response.metadata.agentName}`);
  console.log(`> User Input: ${response.metadata.userInput}`);
  console.log(`> User ID: ${response.metadata.userId}`);
  console.log(`> Session ID: ${response.metadata.sessionId}`);
  console.log(
    `> Additional Parameters:`,
    response.metadata.additionalParams
  );
  console.log(`\n> Response: ${response.output}`);
}
```

## Debugging and Testing

- Use console.log statements to print out intermediate results or debug information.
- Modify the agent configurations or add new agents to test different scenarios.
- Experiment with different queries to see how the orchestrator routes them to different agents.

## Considerations

- The local version uses in-memory storage. For persistent storage, you might want to set up a local DynamoDB instance or use a file-based storage solution.
- Ensure your AWS credentials are correctly set up if you're using services like Amazon Bedrock and Amazon Lex.
- This local setup is great for development but may not reflect the exact behavior of a deployed Lambda function, especially regarding things like execution context and cold starts.
- Make sure all required environment variables are set in your `.env` file. The script checks for their existence before initializing each agent.

By following these steps, you'll have a local version of your Multi-Agent Orchestrator System running, allowing for quick development and testing cycles. Remember, by setting the appropriate environment variables, you can control which agents are active in your local orchestrator instance. This is useful for testing different configurations or focusing on specific agent types during development.