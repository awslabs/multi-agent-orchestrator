import streamlit as st

st.title("AWS Multi-Agent Orchestrator Demos")

st.markdown("""
Welcome to our comprehensive demo application showcasing real-world applications of the AWS Multi-Agent Orchestrator framework.
This app demonstrates how multiple specialized AI agents can collaborate to solve complex tasks using Amazon Bedrock and Anthropic's Claude.

Each demo highlights different aspects of multi-agent collaboration, from creative tasks to practical planning,
showing how the framework can be applied to various business scenarios. 🤖✨

## 🎮 Featured Demos

### 🎬 AI Movie Production Studio
**Requirements**: AWS Account with Amazon Bedrock access (Claude models enabled)

Transform your movie ideas into detailed scripts and cast lists! Our AI agents collaborate:
- **ScriptWriter** ([BedrockLLMAgent](https://awslabs.github.io/multi-agent-orchestrator/agents/built-in/bedrock-llm-agent) with Claude 3 Sonnet): Creates compelling story outlines
- **CastingDirector** ([BedrockLLMAgent](https://awslabs.github.io/multi-agent-orchestrator/agents/built-in/bedrock-llm-agent) with Claude 3 Haiku): Researches and suggests perfect casting choices
- **MovieProducer** ([BedrockLLMAgent](https://awslabs.github.io/multi-agent-orchestrator/agents/built-in/bedrock-llm-agent) with Claude 3.5 Sonnet): Coordinates the entire creative process
- All coordinated by a [**SupervisorAgent**](https://awslabs.github.io/multi-agent-orchestrator/agents/built-in/supervisor-agent)

### ✈️ AI Travel Planner
**Requirements**: Anthropic API Key

Your personal travel assistant powered by AI! Experience collaboration between:
- **ResearcherAgent** ([AnthropicAgent](https://awslabs.github.io/multi-agent-orchestrator/agents/built-in/anthropic-agent) with Claude 3 Haiku): Performs real-time destination research
- **PlannerAgent** ([AnthropicAgent](https://awslabs.github.io/multi-agent-orchestrator/agents/built-in/anthropic-agent) with Claude 3 Sonnet): Creates personalized day-by-day itineraries
- Coordinated by a [**SupervisorMode**](https://awslabs.github.io/multi-agent-orchestrator/agents/built-in/supervisor-agent) using the Planner as supervisor
""")