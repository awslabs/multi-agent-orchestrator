<h2 align="center">Multi-Agent Orchestrator&nbsp;</h2>
<p align="center">Flexible and powerful framework for managing multiple AI agents and handling complex conversations.</p>
<p align="center">
  <a href="https://github.com/awslabs/multi-agent-orchestrator"><img alt="GitHub Repo" src="https://img.shields.io/badge/GitHub-Repo-green.svg" /></a>
  <a href="https://www.npmjs.com/package/multi-agent-orchestrator"><img alt="npm" src="https://img.shields.io/npm/v/multi-agent-orchestrator.svg?style=flat-square"></a>
  <a href="https://pypi.org/project/multi-agent-orchestrator/"><img alt="PyPI" src="https://img.shields.io/pypi/v/multi-agent-orchestrator.svg?style=flat-square"></a>
  <a href="https://awslabs.github.io/multi-agent-orchestrator/"><img alt="Documentation" src="https://img.shields.io/badge/docs-book-blue.svg?style=flat-square"></a>
</p>




## 🔖 Features

- 🧠 **Intelligent intent classification** — Dynamically route queries to the most suitable agent based on context and content.
- 🔤 **Dual language support** — Fully implemented in both **Python** and **TypeScript**.
- 🌊 **Flexible agent responses** — Support for both streaming and non-streaming responses from different agents.
- 📚 **Context management** — Maintain and utilize conversation context across multiple agents for coherent interactions.
- 🔧 **Extensible architecture** — Easily integrate new agents or customize existing ones to fit your specific needs.
- 🌐 **Universal deployment** — Run anywhere - from AWS Lambda to your local environment or any cloud platform.
- 📦 **Pre-built agents and classifiers** — A variety of ready-to-use agents and multiple classifier implementations available.

## What's the Multi-Agent Orchestrator ❓

The Multi-Agent Orchestrator is a flexible framework for managing multiple AI agents and handling complex conversations. It intelligently routes queries and maintains context across interactions.

The system offers pre-built components for quick deployment, while also allowing easy integration of custom agents and conversation messages storage solutions.

This adaptability makes it suitable for a wide range of applications, from simple chatbots to sophisticated AI systems, accommodating diverse requirements and scaling efficiently.

## 🏗️ High-level architecture flow diagram

<br /><br />

![High-level architecture flow diagram](https://raw.githubusercontent.com/awslabs/multi-agent-orchestrator/main/img/flow.jpg)

<br /><br />

1. The process begins with user input, which is analyzed by a Classifier.
2. The Classifier leverages both Agents' Characteristics and Agents' Conversation history to select the most appropriate agent for the task.
3. Once an agent is selected, it processes the user input.
4. The orchestrator then saves the conversation, updating the Agents' Conversation history, before delivering the response back to the user.


✨✨✨

**Looking for details on Amazon Bedrock’s multi-agent collaboration capability announced during Matt Garman's keynote at re:Invent 2024?**

Visit the [Amazon Bedrock Agents](https://aws.amazon.com/bedrock/agents/) page to explore how multi-agent collaboration enables developers to build, deploy, and manage specialized agents designed for tackling complex workflows efficiently and accurately.

✨✨✨

## 💬 Demo App

To quickly get a feel for the Multi-Agent Orchestrator, we've provided a Demo App with a few basic agents. This interactive demo showcases the orchestrator's capabilities in a user-friendly interface. To learn more about setting up and running the demo app, please refer to our [Demo App](https://awslabs.github.io/multi-agent-orchestrator/cookbook/examples/chat-demo-app/) section.

<br>

In the screen recording below, we demonstrate an extended version of the demo app that uses 6 specialized agents:
- **Travel Agent**: Powered by an Amazon Lex Bot
- **Weather Agent**: Utilizes a Bedrock LLM Agent with a tool to query the open-meteo API
- **Restaurant Agent**: Implemented as an Amazon Bedrock Agent
- **Math Agent**: Utilizes a Bedrock LLM Agent with two tools for executing mathematical operations
- **Tech Agent**: A Bedrock LLM Agent designed to answer questions on technical topics
- **Health Agent**: A Bedrock LLM Agent focused on addressing health-related queries

Watch as the system seamlessly switches context between diverse topics, from booking flights to checking weather, solving math problems, and providing health information.
Notice how the appropriate agent is selected for each query, maintaining coherence even with brief follow-up inputs.

The demo highlights the system's ability to handle complex, multi-turn conversations while preserving context and leveraging specialized agents across various domains.

![](https://raw.githubusercontent.com/awslabs/multi-agent-orchestrator/main/img/demo-app.gif?raw=true)

To quickly get a feel for the Multi-Agent Orchestrator, check out our [Demo App](https://awslabs.github.io/multi-agent-orchestrator/cookbook/examples/chat-demo-app/). Additional code examples are available in both the documentation and the `examples` folder.

## 🎯 Examples & Quick Start

Get hands-on experience with the Multi-Agent Orchestrator through our diverse set of examples:

- **Ready-to-run Scripts**: Start locally with our collection of standalone scripts in both Python and TypeScript.
- **Demo Applications**:
  - [Chat Demo App](https://awslabs.github.io/multi-agent-orchestrator/cookbook/examples/chat-demo-app/):
    - Explore multiple specialized agents handling various domains like travel, weather, math, and health
  - [E-commerce Support Simulator](https://awslabs.github.io/multi-agent-orchestrator/cookbook/examples/ecommerce-support-simulator/): Experience AI-powered customer support with:
    - Automated response generation for common queries
    - Intelligent routing of complex issues to human support
    - Real-time chat and email-style communication
    - Human-in-the-loop interactions for complex cases
- **Sample Projects**: Explore our example implementations in the `examples` folder:
  - [`chat-demo-app`](https://github.com/awslabs/multi-agent-orchestrator/tree/main/examples/chat-demo-app): Web-based chat interface with multiple specialized agents
  - [`ecommerce-support-simulator`](https://github.com/awslabs/multi-agent-orchestrator/tree/main/examples/ecommerce-support-simulator): AI-powered customer support system
  - [`chat-chainlit-app`](https://github.com/awslabs/multi-agent-orchestrator/tree/main/examples/chat-chainlit-app): Chat application built with Chainlit
  - [`fast-api-streaming`](https://github.com/awslabs/multi-agent-orchestrator/tree/main/examples/fast-api-streaming): FastAPI implementation with streaming support
  - [`text-2-structured-output`](https://github.com/awslabs/multi-agent-orchestrator/tree/main/examples/text-2-structured-output): Natural Language to Structured Data
  - [`bedrock-inline-agents`](https://github.com/awslabs/multi-agent-orchestrator/tree/main/examples/bedrock-inline-agents): Bedrock Inline Agents sample


All examples are available in both Python and TypeScript implementations. Check out our [documentation](https://awslabs.github.io/multi-agent-orchestrator/) for comprehensive guides on setting up and using the Multi-Agent Orchestrator!


## 🌟 Use cases and implementations

Discover creative implementations and diverse applications of the Multi-Agent Orchestrator:

- **[From 'Bonjour' to 'Boarding Pass': Multilingual AI Chatbot for Flight Reservations](https://community.aws/content/2lCi8jEKydhDm8eE8QFIQ5K23pF/from-bonjour-to-boarding-pass-multilingual-ai-chatbot-for-flight-reservations)**

  This article demonstrates how to build a multilingual chatbot using the Multi-Agent Orchestrator framework. The article explains how to use an **Amazon Lex** bot as an agent, along with 2 other new agents to make it work in many languages with just a few lines of code.

- **[Beyond Auto-Replies: Building an AI-Powered E-commerce Support system](https://community.aws/content/2lq6cYYwTYGc7S3Zmz28xZoQNQj/beyond-auto-replies-building-an-ai-powered-e-commerce-support-system)**

  This article demonstrates how to build an AI-driven multi-agent system for automated e-commerce customer email support. It covers the architecture and setup of specialized AI agents using the Multi-Agent Orchestrator framework, integrating automated processing with human-in-the-loop oversight. The guide explores email ingestion, intelligent routing, automated response generation, and human verification, providing a comprehensive approach to balancing AI efficiency with human expertise in customer support.


- **[Speak Up, AI: Voicing Your Agents with Amazon Connect, Lex, and Bedrock](https://community.aws/content/2mt7CFG7xg4yw6GRHwH9akhg0oD/speak-up-ai-voicing-your-agents-with-amazon-connect-lex-and-bedrock)**

  This article demonstrates how to build an AI customer call center. It covers the architecture and setup of specialized AI agents using the Multi-Agent Orchestrator framework interacting with voice via **Amazon Connect** and **Amazon Lex**.

### TypeScript Version

#### Installation

```bash
npm install multi-agent-orchestrator
```

#### Usage

The following example demonstrates how to use the Multi-Agent Orchestrator with two different types of agents: a Bedrock LLM Agent with Converse API support and a Lex Bot Agent. This showcases the flexibility of the system in integrating various AI services.

```typescript
import { MultiAgentOrchestrator, BedrockLLMAgent, LexBotAgent } from "multi-agent-orchestrator";

const orchestrator = new MultiAgentOrchestrator();

// Add a Bedrock LLM Agent with Converse API support
orchestrator.addAgent(
  new BedrockLLMAgent({
      name: "Tech Agent",
      description:
        "Specializes in technology areas including software development, hardware, AI, cybersecurity, blockchain, cloud computing, emerging tech innovations, and pricing/costs related to technology products and services.",
      streaming: true
  })
);

// Add a Lex Bot Agent for handling travel-related queries
orchestrator.addAgent(
  new LexBotAgent({
    name: "Travel Agent",
    description: "Helps users book and manage their flight reservations",
    botId: process.env.LEX_BOT_ID,
    botAliasId: process.env.LEX_BOT_ALIAS_ID,
    localeId: "en_US",
  })
);

// Example usage
const response = await orchestrator.routeRequest(
  "I want to book a flight",
  'user123',
  'session456'
);

// Handle the response (streaming or non-streaming)
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

### Python Version

#### Core Installation

```bash
# Optional: Set up a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install multi-agent-orchestrator
```

#### Default Usage

Here's an equivalent Python example demonstrating the use of the Multi-Agent Orchestrator with a Bedrock LLM Agent and a Lex Bot Agent:

```python
import os
import asyncio
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator
from multi_agent_orchestrator.agents import BedrockLLMAgent, LexBotAgent, BedrockLLMAgentOptions, LexBotAgentOptions, AgentCallbacks

orchestrator = MultiAgentOrchestrator()

class BedrockLLMAgentCallbacks(AgentCallbacks):
    def on_llm_new_token(self, token: str) -> None:
        # handle response streaming here
        print(token, end='', flush=True)

tech_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
  name="Tech Agent",
  streaming=True,
  description="Specializes in technology areas including software development, hardware, AI, \
  cybersecurity, blockchain, cloud computing, emerging tech innovations, and pricing/costs \
  related to technology products and services.",
  model_id="anthropic.claude-3-sonnet-20240229-v1:0",
  callbacks=BedrockLLMAgentCallbacks()
))
orchestrator.add_agent(tech_agent)


# Add a Lex Bot Agent for handling travel-related queries
orchestrator.add_agent(
    LexBotAgent(LexBotAgentOptions(
        name="Travel Agent",
        description="Helps users book and manage their flight reservations",
        bot_id=os.environ.get('LEX_BOT_ID'),
        bot_alias_id=os.environ.get('LEX_BOT_ALIAS_ID'),
        locale_id="en_US",
    ))
)

async def main():
    # Example usage
    response = await orchestrator.route_request(
        "I want to book a flight",
        'user123',
        'session456'
    )

    # Handle the response (streaming or non-streaming)
    if response.streaming:
        print("\n** RESPONSE STREAMING ** \n")
        # Send metadata immediately
        print(f"> Agent ID: {response.metadata.agent_id}")
        print(f"> Agent Name: {response.metadata.agent_name}")
        print(f"> User Input: {response.metadata.user_input}")
        print(f"> User ID: {response.metadata.user_id}")
        print(f"> Session ID: {response.metadata.session_id}")
        print(f"> Additional Parameters: {response.metadata.additional_params}")
        print("\n> Response: ")

        # Stream the content
        async for chunk in response.output:
            if isinstance(chunk, str):
                print(chunk, end='', flush=True)
            else:
                print(f"Received unexpected chunk type: {type(chunk)}", file=sys.stderr)

    else:
        # Handle non-streaming response (AgentProcessingResult)
        print("\n** RESPONSE ** \n")
        print(f"> Agent ID: {response.metadata.agent_id}")
        print(f"> Agent Name: {response.metadata.agent_name}")
        print(f"> User Input: {response.metadata.user_input}")
        print(f"> User ID: {response.metadata.user_id}")
        print(f"> Session ID: {response.metadata.session_id}")
        print(f"> Additional Parameters: {response.metadata.additional_params}")
        print(f"\n> Response: {response.output.content}")

if __name__ == "__main__":
    asyncio.run(main())
```

These examples showcase:
1. The use of a Bedrock LLM Agent with Converse API support, allowing for multi-turn conversations.
2. Integration of a Lex Bot Agent for specialized tasks (in this case, travel-related queries).
3. The orchestrator's ability to route requests to the most appropriate agent based on the input.
4. Handling of both streaming and non-streaming responses from different types of agents.

### Working with Anthropic or OpenAI
If you want to use Anthropic or OpenAI for classifier and/or agents, make sure to install the multi-agent-orchestrator with the relevant extra feature.
```bash
pip install "multi-agent-orchestrator[anthropic]"
pip install "multi-agent-orchestrator[openai]"
```

### Full package installation
For a complete installation (including Anthropic and OpenAi):
```bash
pip install "multi-agent-orchestrator[all]"
```


## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](https://raw.githubusercontent.com/awslabs/multi-agent-orchestrator/main/CONTRIBUTING.md) for more details.

# Authors

- [Corneliu Croitoru](https://www.linkedin.com/in/corneliucroitoru/)
- [Anthony Bernabeu](https://www.linkedin.com/in/anthonybernabeu/)

# 👥 Contributors

Big shout out to our awesome contributors! Thank you for making this project better! 🌟 ⭐ 🚀

[![contributors](https://contrib.rocks/image?repo=awslabs/multi-agent-orchestrator&max=2000)](https://github.com/awslabs/multi-agent-orchestrator/graphs/contributors)


Please see our [contributing guide](./CONTRIBUTING.md) for guidelines on how to propose bugfixes and improvements.


## 📄 LICENSE

This project is licensed under the Apache 2.0 licence - see the [LICENSE](https://raw.githubusercontent.com/awslabs/multi-agent-orchestrator/main/LICENSE) file for details.

## 📄 Font License
This project uses the JetBrainsMono NF font, licensed under the SIL Open Font License 1.1.
For full license details, see [FONT-LICENSE.md](https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt).
