---
title: FAQ
---

##### What is the Multi-Agent Orchestrator framework?

The Multi-Agent Orchestrator System is a flexible and powerful framework designed for managing multiple AI agents, intelligently routing user queries, and handling complexconversations. It allows developers to create scalable AI systems that can maintain coherent dialogues across multiple domains, efficiently delegating tasks to specialized agents while preserving context throughout the interaction.

<br />

---

##### Who is the Multi-Agent Orchestrator framework for?

The Multi-Agent Orchestrator System is primarily designed to build advanced, scalable AI conversation systems. It's particularly useful for those working on projects that require handling complex, multi-domain conversations or integrating multiple specialized AI agents into a cohesive system.

<br />

---

##### What types of agents are supported?

The framework is designed to accommodate essentially any type of agent you can envision. It comes with several built-in agents, including:
- [Bedrock LLM Agent](/multi-agent-orchestrator/agents/built-in/bedrock-llm-agent): Leverages Amazon Bedrock's API.
- [Amazon Bedrock Agent](/multi-agent-orchestrator/agents/built-in/amazon-bedrock-agent): Leverages existing Amazon Bedrock Agents.
- [Amazon Lex Bot](/multi-agent-orchestrator/agents/built-in/lex-bot-agent): Implements logic to call Amazon Lex chatbots.
- [Lambda Agent](/multi-agent-orchestrator/agents/built-in/lambda-agent): Implements logic to invoke an AWS Lambda function.
- [OpenAI Agent](/multi-agent-orchestrator/agents/built-in/openai-agent):  Leverages OpenAI's language models, such as GPT-3.5 and GPT-4

Additionally, you have the flexibility to easily create your own [custom agents](/multi-agent-orchestrator/agents/custom-agents) or customize existing ones to suit your specific needs.


<br />

---

##### How does the framework handle conversation context?

The Multi-Agent Orchestrator framework uses a flexible storage mechanism to save and retrieve conversations. 

Each conversation is associated with a unique combination of `userId`, `sessionId`, and `agentId`. This allows the system to maintain separate conversation threads for each agent within a user's session, ensuring coherent and contextually relevant interactions over time.

<br />

---

##### Is DynamoDB supported for conversation storage?

Yes, the framework includes a built-in DynamoDB storage option. For detailed instructions on how to implement and configure this storage solution, please refer to the [DynamoDB storage](/multi-agent-orchestrator/storage/dynamodb) section in the documentation.
<br />

---


##### Can I deploy the Multi-Agent Orchestrator on AWS Lambda?

Yes, the system is designed for seamless deployment as an AWS Lambda function. For step-by-step guidance on integrating the orchestrator with Lambda, processing incoming requests, and handling responses, please consult the [AWS Lambda Integration](/multi-agent-orchestrator/deployment/aws-lambda) section in our documentation.

<br />

---

##### What storage options are available for conversation history?

The Multi-Agent Orchestrator framework supports multiple storage options:
- [In-Memory storage](/multi-agent-orchestrator/storage/in-memory): Default option, great for development and testing.
- [DynamoDB storage](/multi-agent-orchestrator/storage/dynamodb): For persistent storage in production environments.
- [Custom storage](/multi-agent-orchestrator/storage/custom): Developers can implement their own storage solutions by extending the `ChatStorage` class.

<br />

---

##### Is there a way to check if the agents I've added to the orchestrator don't overlap?

Agent overlapping can be an issue which may lead to incorrect routing. The framework provides a tool called [Agent Overlap Analysis](/multi-agent-orchestrator/cookbook/monitoring/agent-overlap) that allows you to gain insights about potential overlapping between agents.

It's important to understand that routing to agents is done using a combination of user input, agent descriptions, and the conversation history of all agents. Therefore, crafting precise and distinct agent descriptions is crucial for optimal performance.

The Agent Overlap Analysis tool helps you understand the similarities and differences between your agents' descriptions. It performs pairwise overlap analysis and calculates uniqueness scores for each agent. This analysis is vital for optimizing your agent setup and ensuring clear separation of responsibilities, ultimately leading to more accurate query routing.

<br />

---

##### Is the Multi-Agent Orchestrator framework open for contributions?

Yes, contributions are warmly welcomed! You can contribute by creating a Pull Request to add new agents or features to the repository. Alternatively, you can clone the project and utilize the source files directly in your project, customizing them according to your specific requirements.

<br />

---

##### I have an Agent written in Python in AWS Lambda. How can I integrate it with the multi-agent orchestrator?
You can achieve this integration by using a [Lambda Agent](/multi-agent-orchestrator/agents/built-in/lambda-agent) within the orchestrator. This Lambda Agent is able to invoke AWS Lambda functions, including your Python-based Agent.

This approach allows you to incorporate your Python-based Lambda function into the multi-agent system without needing to rewrite it in TypeScript.
<br />

---

##### I have a vector store in OpenSearch. How can I use it as a retriever?

Today there is a [built-in retriever available](/multi-agent-orchestrator/retrievers/built-in/bedrock-kb-retriever) that is able to query an Amazon Knowledge Base. This retriever extends the generic `Retriever` class. 

You can easily [build your own retriever](/multi-agent-orchestrator/retrievers/custom-retriever) to work with OpenSearch and pass it to the agent in the initialization phase.

<br />

---

##### Can I use Tools with agents?

Yes, [Bedrock LLM Agent](/multi-agent-orchestrator/agents/built-in/bedrock-llm-agent) supports the use of custom tools, allowing you to extend your agents' capabilities. Tools enable agents to perform specific tasks or access external data sources, enhancing their functionality for specialized applications.

For practical examples of implementing tools with agents, refer to our documentation on:

- [Creating a Weather Agent with Custom Tools](/multi-agent-orchestrator/advanced-features/weather-tool-use)
- [Building a Math Agent using Tools](/multi-agent-orchestrator/advanced-features/math-tool-use)

These guides demonstrate how to define tool specifications, implement handlers, and integrate tools into BedrockLLMAgent instances, helping you create powerful, domain-specific AI assistants.

<br />

---

##### Is the multi-agent orchestrator framework using any frameworks for the underlying process?

No, the orchestrator is not using any external frameworks for its underlying process. It is built using only the code specifically created for the orchestrator.

This custom implementation was chosen because we wanted to have complete control over the orchestrator's processes and optimize its performance. By avoiding external frameworks, we can minimize additional latency and ensure that every component of the orchestrator is tailored to the unique requirements of managing and coordinating multiple AI agents efficiently.

<br />

---


##### Can logging be customized in the Multi-Agent Orchestrator?

Yes, logging can be fully customized. While the orchestrator uses `console.log` by default, you can provide your own logger when initializing the orchestrator. 

For detailed instructions on customizing logging, see our [Logging documentation](/multi-agent-orchestrator/advanced-features/logging).


##### For a user intent, is there the possibility to execute multiple processing (so like multiple agents)?

The current built-in agents are designed to execute a single task. However, you can easily create your own agent that handles multiple processing steps. 

To do this:

- [Create a custom agent](/multi-agent-orchestrator/agents/custom-agents) by following our guide on creating custom agents.
- In the `processRequest` method of your custom agent, implement your desired logic for multiple processing steps.
- Add your new agent to the orchestrator.

This approach allows you to create complex agents that can handle multiple tasks or processing steps in response to a single user intent, giving you full control over the agent's behavior and capabilities.
