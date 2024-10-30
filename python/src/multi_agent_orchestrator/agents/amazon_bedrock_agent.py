"""This module implements an Amazon Bedrock agent that interacts with a runtime client.
"""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
import os
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from multi_agent_orchestrator.agents import Agent, AgentOptions
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.utils import Logger


@dataclass
class AmazonBedrockAgentOptions(AgentOptions):
    """Options for Amazon Bedrock Agent."""
    agent_id: str = None
    agent_alias_id: str = None
    client: Optional[Any] = None


class AmazonBedrockAgent(Agent):
    """
    Represents an Amazon Bedrock agent that interacts with a runtime client.
    Extends base Agent class and implements specific methods for Amazon Bedrock.
    """

    def __init__(self, options: AmazonBedrockAgentOptions):
        """
        Constructs an instance of AmazonBedrockAgent with the specified options.
        Initializes the agent ID, agent alias ID, and creates a new Bedrock agent runtime client.

        :param options: Options to configure the Amazon Bedrock agent.
        """
        super().__init__(options)
        self.agent_id = options.agent_id
        self.agent_alias_id = options.agent_alias_id
        if options.client:
            self.client = options.client
        else:
            self.client = boto3.client('bedrock-agent-runtime',
                                    region_name=options.region or os.environ.get('AWS_REGION'))

    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[Dict[str, str]] = None
    ) -> ConversationMessage:
        """
        Processes a user request by sending it to the Amazon Bedrock agent for processing.

        :param input_text: The user input as a string.
        :param user_id: The ID of the user sending the request.
        :param session_id: The ID of the session associated with the conversation.
        :param chat_history: A list of ConversationMessage objects representing
        the conversation history.
        :param additional_params: Optional additional parameters as key-value pairs.
        :return: A ConversationMessage object containing the agent's response.
        """
        try:
            response = self.client.invoke_agent(
                agentId=self.agent_id,
                agentAliasId=self.agent_alias_id,
                sessionId=session_id,
                inputText=input_text
            )

            completion = ""
            for event in response['completion']:
                if 'chunk' in event:
                    chunk = event['chunk']
                    decoded_response = chunk['bytes'].decode('utf-8')
                    completion += decoded_response
                else:
                    Logger.warn("Received a chunk event with no chunk data")

            return ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{"text": completion}]
            )

        except (BotoCoreError, ClientError) as error:
            Logger.error(f"Error processing request: {str(error)}")
            raise error
