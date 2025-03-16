"""
Amazon Bedrock Agent Integration Module

This module provides a robust implementation for interacting with Amazon Bedrock agents,
offering a flexible and extensible way to process conversational interactions using
AWS Bedrock's agent runtime capabilities.
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
    """
    Configuration options for Amazon Bedrock Agent initialization.

    Provides flexible configuration for Bedrock agent runtime:
    - agent_id: Unique identifier for the Bedrock agent
    - agent_alias_id: Specific alias for the agent
    - client: Optional custom boto3 client (allows dependency injection)
    - streaming: Flag to enable streaming response mode (on final response)
    - enableTrace: Flag to enable detailed event tracing
    """
    region: Optional[str] = None
    agent_id: str = None
    agent_alias_id: str = None
    client: Optional[Any] = None
    streaming: Optional[bool] = False
    enableTrace: Optional[bool] = False


class AmazonBedrockAgent(Agent):
    """
    Specialized agent for interacting with Amazon Bedrock's intelligent agent runtime.

    This class extends the base Agent class to provide:
    - Direct integration with AWS Bedrock agent runtime
    - Configurable response handling (streaming/non-streaming)
    - Comprehensive error management
    - Flexible session and conversation state management
    """

    def __init__(self, options: AmazonBedrockAgentOptions):
        """
        Initialize the Bedrock agent with comprehensive configuration.

        Handles client creation, either using a provided client or
        automatically creating one based on AWS configuration.

        :param options: Detailed configuration for agent initialization
        """
        super().__init__(options)

        # Store core agent identifiers
        self.agent_id = options.agent_id
        self.agent_alias_id = options.agent_alias_id

        # Set up Bedrock runtime client
        if options.client:
            # Use provided client (useful for testing or custom configurations)
            self.client = options.client
        else:
            # Create default client using AWS region from options or environment
            self.client = boto3.client('bedrock-agent-runtime',
                                    region_name=options.region or os.environ.get('AWS_REGION'))

        # Configure response handling modes
        self.streaming = options.streaming
        self.enableTrace = options.enableTrace

    def is_streaming_enabled(self) -> bool:
        """
        Check if streaming mode is active for response processing.

        :return: Boolean indicating streaming status
        """
        return self.streaming is True

    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[Dict[str, str]] = None
    ) -> ConversationMessage:
        """
        Process a user request through the Bedrock agent runtime.

        Handles the entire interaction lifecycle:
        - Manages session state
        - Invokes agent with configured parameters
        - Processes streaming or non-streaming responses
        - Handles potential errors

        :param input_text: User's input message
        :param user_id: Identifier for the user
        :param session_id: Unique conversation session identifier
        :param chat_history: Previous conversation messages
        :param additional_params: Optional supplementary parameters
        :return: Agent's response as a conversation message
        """
        # Initialize session state, defaulting to empty if not provided
        session_state = {}
        if (additional_params and 'sessionState' in additional_params):
            session_state = additional_params['sessionState']

        try:
            # Configure streaming behavior
            streamingConfigurations = {
                'streamFinalResponse': self.streaming
            }

            # Invoke Bedrock agent with comprehensive configuration
            response = self.client.invoke_agent(
                agentId=self.agent_id,
                agentAliasId=self.agent_alias_id,
                sessionId=session_id,
                inputText=input_text,
                enableTrace=self.enableTrace,
                sessionState=session_state,
                streamingConfigurations=streamingConfigurations if self.streaming else {}
            )

            # Process response, handling both streaming and non-streaming modes
            completion = ""
            for event in response['completion']:
                if 'chunk' in event:
                    # Process streaming chunk
                    chunk = event['chunk']
                    decoded_response = chunk['bytes'].decode('utf-8')

                    # Trigger callback for each token (useful for real-time updates)
                    self.callbacks.on_llm_new_token(decoded_response)
                    completion += decoded_response

                elif 'trace' in event:
                    # Log trace events if tracing is enabled
                    Logger.info(f"Received event: {event}") if self.enableTrace else None

                else:
                    # Ignore unrecognized event types
                    pass

            # Construct and return the conversation message
            return ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{"text": completion}]
            )

        except (BotoCoreError, ClientError) as error:
            # Comprehensive error logging and propagation
            Logger.error(f"Error processing request: {str(error)}")
            raise error