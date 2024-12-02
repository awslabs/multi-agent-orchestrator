from typing import List, Dict, Any, Optional, Callable
from dataclasses import dataclass
import os
import json
import boto3
from multi_agent_orchestrator.utils import (Logger, conversation_to_dict)
from multi_agent_orchestrator.agents import (Agent, AgentOptions)
from multi_agent_orchestrator.types import (ConversationMessage, ParticipantRole)

# BedrockFlowsAgentOptions Dataclass
@dataclass
class BedrockFlowsAgentOptions(AgentOptions):
    flowIdentifier: str = None
    flowAliasIdentifier: str = None
    bedrock_agent_client: Optional[Any] = None
    enableTrace: Optional[bool] = False
    flow_input_encoder: Optional[Callable] = None
    flow_output_decoder: Optional[Callable] = None


# BedrockFlowsAgent Class
class BedrockFlowsAgent(Agent):

    def __init__(self, options: BedrockFlowsAgentOptions):
        super().__init__(options)

        # Initialize bedrock agent client
        if options.bedrock_agent_client:
            self.bedrock_agent_client = options.bedrock_agent_client
        else:
            if options.region:
                self.bedrock_agent_client = boto3.client(
                    'bedrock-agent-runtime',
                    region_name=options.region or os.environ.get('AWS_REGION')
                )
            else:
                self.bedrock_agent_client = boto3.client('bedrock-agent-runtime')

        self.enableTrace = options.enableTrace
        self.flowAliasIdentifier = options.flowAliasIdentifier
        self.flowIdentifier = options.flowIdentifier

        if options.flow_input_encoder is None:
            self.flow_input_encoder = self.__default_flow_input_encoder
        else:
            self.flow_input_encoder = options.flow_input_encoder

        if options.flow_output_decoder is None:
            self.flow_output_decoder = self.__default_flow_output_decoder
        else:
            self.flow_output_decoder = options.flow_output_decoder

    def __default_flow_input_encoder(self,
        input_text: str,
        **kwargs
    ) -> Any:
        """Encode Flow Input payload as a string."""
        return [
                    {
                        'content': {
                            'document': input_text
                        },
                        'nodeName': 'FlowInputNode',
                        'nodeOutputName': 'document'
                    }
                ]

    def __default_flow_output_decoder(self, response: Any, **kwargs) -> ConversationMessage:
        """Decode Flow output as a string and create ConversationMessage."""
        decoded_response = response
        return ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{'text': str(decoded_response)}]
        )

    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[Dict[str, str]] = None
    ) -> ConversationMessage:
        try:
            response = self.bedrock_agent_client.invoke_flow(
                flowIdentifier=self.flowIdentifier,
                flowAliasIdentifier=self.flowAliasIdentifier,
                inputs=[
                    {
                        'content': {
                            'document': self.flow_input_encoder(self, input_text, chat_history=chat_history, user_id=user_id, session_id=session_id, additional_params=additional_params)
                        },
                        'nodeName': 'FlowInputNode',
                        'nodeOutputName': 'document'
                    }
                ],
                enableTrace=self.enableTrace
            )

            if 'responseStream' not in response:
                raise ValueError("No output received from Bedrock model")

            eventstream = response.get('responseStream')
            final_response = None
            for event in eventstream:
                Logger.info(event) if self.enableTrace else None
                if 'flowOutputEvent' in event:
                    final_response = event['flowOutputEvent']['content']['document']

            bedrock_response = self.flow_output_decoder(self, final_response)

            return bedrock_response

        except Exception as error:
            Logger.error(f"Error processing request with Bedrock: {str(error)}")
            raise error

