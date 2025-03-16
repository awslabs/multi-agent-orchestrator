import os
import uuid
import requests
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from multi_agent_orchestrator.agents import Agent, AgentOptions
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.utils import Logger


@dataclass
class SalesforceAgentforceAgentOptions(AgentOptions):
    """
    Configuration options for Salesforce Agentforce Agent initialization.
    """
    client_id: str = None
    client_secret: str = None
    domain_url: str = None
    agent_id: str = None
    locale_id: str = "en_US"
    streaming: Optional[bool] = False


class SalesforceAgentforceAgent(Agent):
    """
    Specialized agent for interacting with Salesforce Agentforce.
    """

    def __init__(self, options: SalesforceAgentforceAgentOptions):
        """
        Initialize the Salesforce Agentforce agent with configuration.
        """
        super().__init__(options)
        self.client_id = options.client_id
        self.client_secret = options.client_secret
        self.domain_url = options.domain_url
        self.agent_id = options.agent_id
        self.locale_id = options.locale_id
        self.streaming = options.streaming
        self.access_token = None

    def _get_access_token(self) -> str:
        """
        Fetch an access token from Salesforce.
        """
        url = f"https://{self.domain_url}/services/oauth2/token"
        payload = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret
        }
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        response = requests.post(url, data=payload, headers=headers)
        response.raise_for_status()
        self.access_token = response.json().get("access_token")
        Logger.info("Successfully obtained Salesforce access token.")
        return self.access_token

    def _create_session(self, session_id: str) -> str:
        """
        Create a session with Salesforce Agentforce.
        """
        url = f"https://api.salesforce.com/einstein/ai-agent/v1/agents/{self.agent_id}/sessions"
        payload = {
            "externalSessionKey": session_id,
            "instanceConfig": {"endpoint": f"https://{self.domain_url}"},
            "streamingCapabilities": {"chunkTypes": ["Text"]},
            "bypassUser": True
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.access_token}"
        }

        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        session_id = response.json().get("sessionId")
        Logger.info(f"Successfully created Salesforce session: {session_id}")
        return session_id

    def _send_message(self, session_id: str, sequence_id: int, message: str) -> str:
        """
        Send a message to the Salesforce Agentforce session.
        """
        url = f"https://api.salesforce.com/einstein/ai-agent/v1/sessions/{session_id}/messages"
        payload = {
            "message": {
                "sequenceId": sequence_id,
                "type": "Text",
                "text": message
            }
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.access_token}"
        }

        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()
        messages = response.json().get("messages", [])
        concatenated_messages = "\n".join(msg.get("message", "") for msg in messages)
        Logger.info(f"Received response from Salesforce: {concatenated_messages}")
        return concatenated_messages

    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[Dict[str, str]] = None
    ) -> ConversationMessage:
        """
        Process a user request through Salesforce Agentforce.
        """
        if not self.access_token:
            self._get_access_token()

        salesforce_session_id = self._create_session(session_id)
        response_text = self._send_message(
            session_id=salesforce_session_id,
            sequence_id=len(chat_history) + 1,
            message=input_text
        )

        return ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{"text": response_text}]
        )