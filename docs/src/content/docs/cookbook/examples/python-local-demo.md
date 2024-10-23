---
title: Python Local Demo
description: How to run the Multi-Agent Orchestrator System locally using Python
---


## Prerequisites
- Python 3.12 or later
- AWS account with appropriate permissions
- Basic familiarity with Python async/await patterns

## Quick Setup

1. Create a new project:
```bash
mkdir test_multi_agent_orchestrator
cd test_multi_agent_orchestrator
python -m venv venv
source venv/bin/activate  # On Windows use `venv\Scripts\activate`
```

2. Install dependencies:
```bash
pip install multi-agent-orchestrator
```

## Implementation

1. Create a new file named `quickstart.py`:

2. Initialize the orchestrator:
```python
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator, OrchestratorConfig
from multi_agent_orchestrator.agents import (BedrockLLMAgent,
 BedrockLLMAgentOptions,
 AgentResponse,
 AgentCallbacks)
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole

orchestrator = MultiAgentOrchestrator(options=OrchestratorConfig(
  LOG_AGENT_CHAT=True,
  LOG_CLASSIFIER_CHAT=True,
  LOG_CLASSIFIER_RAW_OUTPUT=True,
  LOG_CLASSIFIER_OUTPUT=True,
  LOG_EXECUTION_TIMES=True,
  MAX_RETRIES=3,
  USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED=True,
  MAX_MESSAGE_PAIRS_PER_AGENT=10
))
```

3. Set up agent callbacks and add an agent:
```python
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
```

4. Implement the main logic:
```python
async def handle_request(_orchestrator: MultiAgentOrchestrator, _user_input: str, _user_id: str, _session_id: str):
    response: AgentResponse = await _orchestrator.route_request(_user_input, _user_id, _session_id)
    print("\nMetadata:")
    print(f"Selected Agent: {response.metadata.agent_name}")
    if response.streaming:
        print('Response:', response.output.content[0]['text'])
    else:
        print('Response:', response.output.content[0]['text'])

if __name__ == "__main__":
    USER_ID = "user123"
    SESSION_ID = str(uuid.uuid4())
    print("Welcome to the interactive Multi-Agent system. Type 'quit' to exit.")
    while True:
        user_input = input("\nYou: ").strip()
        if user_input.lower() == 'quit':
            print("Exiting the program. Goodbye!")
            sys.exit()
        asyncio.run(handle_request(orchestrator, user_input, USER_ID, SESSION_ID))
```

5. Run the application:
```bash
python quickstart.py
```

## Implementation Notes
- Implements streaming responses by default
- Uses default Bedrock Classifier with `anthropic.claude-3-5-sonnet-20240620-v1:0`
- Includes interactive command-line interface
- Handles session management with UUID generation

## Next Steps
- Add additional specialized agents
- Implement persistent storage
- Customize the classifier configuration
- Add error handling and retry logic


Ready to build your own multi-agent chat application? Check out the complete [source code](https://github.com/awslabs/multi-agent-orchestrator/tree/main/examples/python-demo) in our GitHub repository.
