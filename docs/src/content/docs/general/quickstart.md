---
title: Quickstart
---

To help you kickstart  with the Multi-Agent Orchestrator framework, we'll walk you through the step-by-step process of setting up and running your first multi-agent conversation.

</br>

> 💁 Ensure you have Node.js and npm installed on your development environment before proceeding.

---


<br>

### 🚀 Get Started!

1. Install the Multi-Agent Orchestrator framework in your nodejs project.

```bash
npm install @aws/multi-agent-orchestrator
```


<br>

2. Create a new file named `quickstart.ts` and add the following code:


3. Create an Orchestrator

```typescript
import { MultiAgentOrchestrator } from "@aws/multi-agent-orchestrator";
const orchestrator = new MultiAgentOrchestrator({
  config: {
    logAgentConversation: true,
    logIntentClassifierConversation: true,
    logIntentClassifierOutput: true,
  },
});
```

2. Add Agents

```typescript

import { BedrockLLMAgent } from "@aws/multi-agent-orchestrator";


orchestrator.addAgent(
  new BedrockLLMAgent({
    name: "Tech Agent",
    description:
      "Specializes in technology areas including software development, hardware, AI, cybersecurity, blockchain, cloud computing, emerging tech innovations, and pricing/costs related to technology products and services.",
  })
);

orchestrator.addAgent(
  new BedrockLLMAgent({
    name: "Health Agent",
    description:
      "Focuses on health and medical topics such as general wellness, nutrition, diseases, treatments, mental health, fitness, healthcare systems, and medical terminology or concepts.",
  })
);
```

3. Send a Query

```typescript
const userId = "quickstart-user";
const sessionId = "quickstart-session";

const query = "What are the latest trends in AI?";

console.log(`\nUser Query: ${query}`);
const response = await orchestrator.routeRequest(query, userId, sessionId);
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


```

<br>

---

<br>

Now, let's run the quickstart script:

```bash
npx ts-node quickstart.ts
```

<br>

Congratulations! 

You've successfully set up and run your first multi-agent conversation using the Multi-Agent Orchestrator System. 🎉

<br>

---

<br>

### 👨‍💻 Next Steps

Now that you've seen the basic functionality, here are some next steps to explore:

1. Try adding other agents from those built-in in the framwork ([Bedrock LLM Agent](/agents/built-in/bedrock-llm-agent), [Amazon Lex Bot](/agents/built-in/lex-bot-agent), [Amazon Bedrock Agent](/agents/built-in/amazon-bedrock-agent), [Lambda Agent](/agents/built-in/lambda-agent), [OpenAI Agent](/agents/built-in/openai-agent)).
2. Experiment with different storage options, such as [Amazon DynamoDB](/storage/dynamodb) for persistent storage.
3. Explore the [Agent Overlap Analysis](/advanced-features/agent-overlap) feature to optimize your agent configurations.
4. Integrate the system into a web application or deploy it as an [AWS Lambda function](/deployment/aws-lambda).
5. Try adding your own [custom agents](/agents/custom-agents) by extending the `Agent` class.


For more detailed information on these advanced features, check out our full documentation.

<br>

---

<br>

### 🧹 Cleanup

As this quickstart uses in-memory storage and local resources, there's no cleanup required. Simply stop the script when you're done experimenting.