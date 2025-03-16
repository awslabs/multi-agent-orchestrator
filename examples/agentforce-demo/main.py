import os
from dotenv import load_dotenv
load_dotenv()

import uuid
import asyncio
from typing import Optional, List, Dict, Any
import json
import sys
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator, OrchestratorConfig
from multi_agent_orchestrator.agents import (
    BedrockLLMAgent,
    BedrockLLMAgentOptions,
    AgentResponse,
    AgentCallbacks,
    SalesforceAgentforceAgent,
    SalesforceAgentforceAgentOptions
)
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole

orchestrator = MultiAgentOrchestrator(options=OrchestratorConfig(
    LOG_AGENT_CHAT=False,
    LOG_CLASSIFIER_CHAT=False,
    LOG_CLASSIFIER_RAW_OUTPUT=False,
    LOG_CLASSIFIER_OUTPUT=False,
    LOG_EXECUTION_TIMES=False,
    MAX_RETRIES=3,
    USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED=True,
    MAX_MESSAGE_PAIRS_PER_AGENT=10
))

class BedrockLLMAgentCallbacks(AgentCallbacks):
    def on_llm_new_token(self, token: str) -> None:
        # handle response streaming here
        print(token, end='', flush=True)

tech_agent = BedrockLLMAgent(BedrockLLMAgentOptions(
    model_id="anthropic.claude-3-haiku-20240307-v1:0",
    region="us-east-1",
    name="ShoppingAssistant",
    streaming=True,
    description="A sales consultant to help customers find product which suitable for their needs",
    callbacks=BedrockLLMAgentCallbacks()
))
orchestrator.add_agent(tech_agent)

salesforce_agent = SalesforceAgentforceAgent(SalesforceAgentforceAgentOptions(
    name="Salesforce Assistant",
    description="Helping our guests make reservations, update bookings, and navigate all that Coral Cloud Resorts has to offer.",
    client_id=os.environ.get('SALESFORCE_CLIENT_ID'),
    client_secret=os.environ.get('SALESFORCE_CLIENT_SECRET'),
    domain_url=os.environ.get('SALESFORCE_DOMAIN_URL'),
    agent_id=os.environ.get('SALESFORCE_AGENT_ID'),
    locale_id="en_US",
    streaming=True
))
orchestrator.add_agent(salesforce_agent)

async def handle_request(_orchestrator: MultiAgentOrchestrator, _user_input: str, _user_id: str, _session_id: str):
    response: AgentResponse = await _orchestrator.route_request(_user_input, _user_id, _session_id)
    # Print metadata
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
        # Get user input
        user_input = input("\nYou: ").strip()
        if user_input.lower() == 'quit':
            print("Exiting the program. Goodbye!")
            sys.exit()
        # Run the async function
        asyncio.run(handle_request(orchestrator, user_input, USER_ID, SESSION_ID))