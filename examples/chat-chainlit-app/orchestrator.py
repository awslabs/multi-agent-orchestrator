import uuid
import asyncio
from typing import Optional, List, Dict, Any
import json
import sys
from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator, OrchestratorConfig
from multi_agent_orchestrator.agents import (BedrockLLMAgent,
 BedrockLLMAgentOptions,
 AgentResponse,
 AgentCallbacks)
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.classifiers import BedrockClassifier, BedrockClassifierOptions

custom_bedrock_classifier = BedrockClassifier(BedrockClassifierOptions(
    model_id='anthropic.claude-3-haiku-20240307-v1:0',
    inference_config={
        'maxTokens': 500,
        'temperature': 0.7,
        'topP': 0.9
    }
))

orchestrator = MultiAgentOrchestrator(options=OrchestratorConfig(
  LOG_AGENT_CHAT=True,
  LOG_CLASSIFIER_CHAT=True,
  LOG_CLASSIFIER_RAW_OUTPUT=True,
  LOG_CLASSIFIER_OUTPUT=True,
  LOG_EXECUTION_TIMES=True,
  MAX_RETRIES=3,
  USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED=True,
  MAX_MESSAGE_PAIRS_PER_AGENT=10
), classifier=custom_bedrock_classifier)

class BedrockLLMAgentCallbacks(AgentCallbacks):
    def on_llm_new_token(self, token: str) -> None:
        # handle response streaming here
        print(token, end='', flush=True)


async def handle_request(_orchestrator: MultiAgentOrchestrator, _user_input: str, _user_id: str, _session_id: str):
    response: AgentResponse = await _orchestrator.route_request(_user_input, _user_id, _session_id)
    return response  # Return the response object instead of printing