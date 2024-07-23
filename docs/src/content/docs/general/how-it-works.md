---
title: How it works
---

The Multi-Agent Orchestrator framework is a powerful tool for implementing sophisticated AI systems comprising multiple specialized agents. Its primary purpose is to intelligently route user queries to the most appropriate agents while maintaining contextual awareness throughout interactions.

<br>

<br>
<br>
<p align="center">
  [](../../../assets/flow.jpg)
</p>
<br>

## Orchestrator Logic

The Multi-Agent Orchestrator follows a specific process for each user request:

1. **Request Initiation**: The user sends a request to the orchestrator.

2. **Context Gathering**: The orchestrator fetches all conversations from all agents and their descriptions.

3. **Classification**: Using an LLM, [the Classifier](/multi-agent-orchestrator/classifiers/overview) analyzes the user's request, agent descriptions, and conversation history to determine the most appropriate agent. This could be:
   - A new query requiring a specific agent (e.g., "I want to book a flight" or "What is the base rate interest for a 20-year loan?")
   - A follow-up to a previous interaction, where the user might provide a short answer like "Tell me more", "Again", or "12". In this case, the LLM identifies the last agent that responded and is waiting for this answer.

4. **Agent Selection**: The Classifier responds with the name of the selected agent.

5. **Request Routing**: The user's input is sent to the chosen agent.

6. **Agent Processing**: The selected [agent](/multi-agent-orchestrator/agents/overview) processes the request using its entire history for that user's session ID (if the same user has already interacted with that agent in the current session).

7. **Response Generation**: The agent generates a response, which may be sent in a standard response mode or via streaming, depending on the agent's capabilities and initialization settings.

8. **Conversation Storage**: The user's input and the agent's response are saved into the [storage](/multi-agent-orchestrator/storage/overview) for that specific user ID and session ID. This step is crucial for maintaining context and enabling coherent multi-turn conversations.

9. **Response Delivery**: The orchestrator delivers the agent's response back to the user.

This process ensures that each request is handled by the most appropriate agent while maintaining context across the entire conversation and preserving the interaction history for future reference.



---


The Multi-Agent Orchestrator framework empowers you to leverage multiple agents for handling diverse tasks. 

In the framework context, an agent can be any of the following (or a combination of one or more):

- LLMs (through Amazon Bedrock or any other cloud-hosted or on-premises LLM)
- API calls
- AWS Lambda functions
- Local processing
- Amazon Lex Bot
- Amazon Bedrock Agent
- Any other specific task or process

This flexible architecture allows you to incorporate as many agents as your application requires, and combine them in ways that best suit your needs.

Each agent needs a name and a description (plus other properties specific to the type of agent you use). 

<u>The agent description plays a crucial role</u> in the orchestration process. 

It should be detailed and comprehensive, as the orchestrator relies on this description, along with the current user input and the conversation history of all agents, to determine the most appropriate routing for each request.

While the framework's flexibility is a strength, it's important to be mindful of potential overlaps between agents, which could lead to incorrect routing. To help you analyze and prevent such overlaps, we recommend reviewing our [agent overlap analysis](/multi-agent-orchestrator/advanced-features/agent-overlap) section for a deeper understanding.

### Agent abstraction: unified processing across platforms

One of the key strengths of the Multi-Agent Orchestrator framework lies in its **agents' standard implementation**.  This standardization allows for remarkable flexibility and consistency across diverse environments. Whether you're working with different cloud providers, various LLM models, or a mix of cloud-based and local solutions, agents provide a uniform interface for task execution. 

This means you can seamlessly switch between, for example, an [Amazon Lex Bot Agent](/multi-agent-orchestrator/agents/built-in/lex-bot-agent) and a [Amazon Bedrock Agent](/multi-agent-orchestrator/agents/built-in/amazon-bedrock-agent) with tools, or transition from a cloud-hosted LLM to a locally running one, all while maintaining the same code structure. 

Also, if your application needs to use different models with a [Bedrock LLM Agent](/multi-agent-orchestrator/agents/built-in/bedrock-llm-agent) and/or a [Amazon Lex Bot Agent](/multi-agent-orchestrator/agents/built-in/lex-bot-agent) in sequence or in parallel, you can easily do so as the code implementation is already in place. This standardized approach means you don't need to write new code for each model; instead, you can simply use the agents as they are. 

To leverage this flexibility, simply install the framework and import the needed agents. You can then call them directly using the `processRequest` method, regardless of the underlying technology. This standardization not only simplifies development and maintenance but also facilitates easy experimentation and optimization across multiple platforms and technologies without the need for extensive code refactoring.

This standardization empowers you to experiment with various agent types and configurations while maintaining the integrity of their core application code. 

### Main Components of the Orchestrator

The main components that are composing the orchestrator:
- [Orchestrator](/multi-agent-orchestrator/orchestrator/overview)
   - Acts as the central coordinator for all other components
   - Manages the flow of information between Classifier, Agents, Storage, and Retrievers
   - Processes user input and orchestrates the generation of appropriate responses
   - Handles error scenarios and fallback mechanisms

- [Classifier](/multi-agent-orchestrator/classifiers/overview)
   - Examines user input, agent descriptions, and conversation history
   - Identifies the most appropriate agent for each request
   - Custom Classifiers: Create entirely new classifiers for specific tasks or domains


- [Agents](/multi-agent-orchestrator/agents/overview)
   - Prebuilt Agents: Ready-to-use agents for common tasks
   - Customizable Agents: Extend or override prebuilt agents to tailor functionality
   - Custom Agents: Create entirely new agents for specific tasks or domains

- [Conversation Storage](/multi-agent-orchestrator/storage/overview)
   - Maintains conversation history
   - Supports flexible storage options (in-memory and DynamoDB)
   - Custom storage solutions
   - Operates on two levels: Classifier context and Agent context

- [Retrievers](/multi-agent-orchestrator/retrievers/overview)
   - Enhance LLM-based agents performance by providing context and relevant information
   - Improve efficiency by pulling necessary information on-demand, rather than relying solely on the model's training data
   - Prebuilt Retrievers: Ready-to-use retrievers for common data sources
   - Custom Retrievers: Create specialized retrievers for specific data stores or formats

---

Each component of the orchestrator can be customized or replaced with custom implementations, providing unparalleled flexibility and making the framework adaptable to a wide variety of scenarios and specific requirements.