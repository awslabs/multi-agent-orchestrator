---
title: Chat Chainlit App with Multi-Agent Orchestrator
description: How to set up a Chainlit App using Multi-Agent Orchestrator
---

This example demonstrates how to build a chat application using Chainlit and the Multi-Agent Orchestrator. It showcases a system with three specialized agents (Tech, Travel, and Health) working together through a streaming-enabled chat interface.

## Key Features
- Streaming responses using Chainlit's real-time capabilities
- Integration with multiple agent types (Bedrock and Ollama)
- Custom classifier configuration using Claude 3 Haiku
- Session management for user interactions
- Complete chat history handling

## Quick Start
```bash
# Clone the repository
git clone https://github.com/awslabs/multi-agent-orchestrator.git
cd multi-agent-orchestrator/examples/chat-chainlit-app

# Install dependencies
pip install -r requirements.txt

# Run the application
python app.py
```

## Implementation Details

### Components
1. **Main Application** (`app.py`)
   - Orchestrator setup with custom Bedrock classifier
   - Chainlit event handlers for chat management
   - Streaming response handling

2. **Agent Configuration** (`agents.py`)
   - Tech Agent: Uses Claude 3 Sonnet via Bedrock
   - Travel Agent: Uses Claude 3 Sonnet via Bedrock
   - Health Agent: Uses Ollama with Llama 3.1

3. **Custom Integration** (`ollamaAgent.py`)
   - Custom implementation for Ollama integration
   - Streaming support for real-time responses

## Usage Notes
- The application creates unique user and session IDs for each chat session
- Responses are streamed in real-time using Chainlit's streaming capabilities
- The system automatically routes queries to the most appropriate agent
- Complete chat history is maintained throughout the session

## Example Interaction
```plaintext
User: "What are the latest trends in AI?"
→ Routed to Tech Agent

User: "Plan a trip to Paris"
→ Routed to Travel Agent

User: "Recommend a workout routine"
→ Routed to Health Agent
```

Ready to build your own multi-agent chat application? Check out the complete [source code](https://github.com/awslabs/multi-agent-orchestrator/tree/main/examples/chat-chainlit-app) in our GitHub repository.
