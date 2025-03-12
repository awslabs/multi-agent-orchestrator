import os
import requests
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from multi_agent_orchestrator.agents import Agent, AgentOptions
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.utils import Logger


@dataclass
class SalesforceAgentforceAgentOptions(AgentOptions):
    client_id: str
    client_secret: str
    domain_url: str
    agent_id: str
    locale_id: str = "en_US"
    streaming: Optional[bool] = False


class SalesforceAgentforceAgent(Agent):
    def __init__(self, options: SalesforceAgentforceAgentOptions):
        super().__init__(options)
        self.client_id = options.client_id
        self.client_secret = options.client_secret
        self.domain_url = options.domain_url
        self.agent_id = options.agent_id
        self.locale_id = options.locale_id
        self.streaming = options.streaming
        self.access_token = self.get_access_token()

    def get_access_token(self) -> str:
        url = f"{self.domain_url}/services/oauth2/token"
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        data = {
            'grant_type': 'client_credentials',
            'client_id': self.client_id,
            'client_secret': self.client_secret
        }
        response = requests.post(url, headers=headers, data=data)
        response.raise_for_status()
        return response.json().get('access_token')

    def create_session(self, session_id: str) -> str:
        url = f"{self.domain_url}/einstein/ai-agent/v1/agents/{self.agent_id}/sessions"
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.access_token}'
        }
        data = {
            "externalSessionKey": session_id,
            "instanceConfig": {
                "endpoint": self.domain_url
            },
            "streamingCapabilities": {
                "chunkTypes": ["Text"]
            },
            "bypassUser": True
        }
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        return response.json().get('sessionId')

    def send_message(self, session_id: str, message: str, sequence_id: int) -> Dict[str, Any]:
        url = f"{self.domain_url}/einstein/ai-agent/v1/sessions/{session_id}/messages"
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.access_token}'
        }
        data = {
            "message": {
                "sequenceId": sequence_id,
                "type": "Text",
                "text": message
            }
        }
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        return response.json()

    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[Dict[str, str]] = None
    ) -> ConversationMessage:
        try:
            # Create a new session
            salesforce_session_id = self.create_session(session_id)

            # Send the user message to Salesforce Agentforce
            response = self.send_message(salesforce_session_id, input_text, sequence_id=1)

            # Extract the response message
            response_message = response.get('messages', [])[0].get('message', 'No response from Salesforce Agentforce.')

            return ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{"text": response_message}]
            )

        except Exception as error:
            Logger.error(f"Error processing request with Salesforce Agentforce: {str(error)}")
            raise error
