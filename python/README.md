<h2 align="center">Multi-Agent Orchestrator&nbsp;<img alt="Static Badge" src="https://img.shields.io/badge/Beta-4e9bcd"></h2>

<p align="center">Flexible and powerful framework for managing multiple AI agents and handling complex conversations.</p>

<p align="center">
<a href="https://github.com/awslabs/multi-agent-orchestrator"><img alt="GitHub Repo" src="https://img.shields.io/badge/GitHub-Repo-green.svg" /></a>
</p>

## 🔖 Features

- 🧠 **Intelligent intent classification** — Dynamically route queries to the most suitable agent based on context and content.
- 🌊 **Flexible agent responses** — Support for both streaming and non-streaming responses from different agents.
- 📚 **Context management** — Maintain and utilize conversation context across multiple agents for coherent interactions.
- 🔧 **Extensible architecture** — Easily integrate new agents or customize existing ones to fit your specific needs.
- 🌐 **Universal deployment** — Run anywhere - from AWS Lambda to your local environment or any cloud platform.
- 📦 **Pre-built agents and classifiers** — A variety of ready-to-use agents and multiple classifier implementations available.
- 🔤 **TypeScript support** — Native TypeScript implementation available.

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


## 💬 Demo App

To quickly get a feel for the Multi-Agent Orchestrator, we've provided a Demo App with a few basic agents. This interactive demo showcases the orchestrator's capabilities in a user-friendly interface. To learn more about setting up and running the demo app, please refer to our [Demo App](https://awslabs.github.io/multi-agent-orchestrator/deployment/demo-web-app/) section.

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

Click on the image below to see a screen recording of the demo app on the GitHub repository of the project:
<a href="https://github.com/awslabs/multi-agent-orchestrator" target="_blank">
  <img src="https://raw.githubusercontent.com/awslabs/multi-agent-orchestrator/main/img/demo-app.jpg" alt="Demo App Screen Recording" style="max-width: 100%; height: auto;">
</a>



## 🚀 Getting Started

Check out our [documentation](https://awslabs.github.io/multi-agent-orchestrator/) for comprehensive guides on setting up and using the Multi-Agent Orchestrator!



### Installation

```bash
# Optional: Set up a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
pip install multi-agent-orchestrator
```

### Usage

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

The following example demonstrates how to use the Multi-Agent Orchestrator with two different types of agents: a Bedrock LLM Agent with Converse API support and a Lex Bot Agent. This showcases the flexibility of the system in integrating various AI services.

```python

```

This example showcases:
1. The use of a Bedrock LLM Agent with Converse API support, allowing for multi-turn conversations.
2. Integration of a Lex Bot Agent for specialized tasks (in this case, travel-related queries).
3. The orchestrator's ability to route requests to the most appropriate agent based on the input.
4. Handling of both streaming and non-streaming responses from different types of agents.


## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](https://raw.githubusercontent.com/awslabs/multi-agent-orchestrator/main/CONTRIBUTING.md) for more details.

## 📄 LICENSE

This project is licensed under the Apache 2.0 licence - see the [LICENSE](https://raw.githubusercontent.com/awslabs/multi-agent-orchestrator/main/LICENSE) file for details.

## 📄 Font License
This project uses the JetBrainsMono NF font, licensed under the SIL Open Font License 1.1.
For full license details, see [FONT-LICENSE.md](https://github.com/JetBrains/JetBrainsMono/blob/master/OFL.txt).
