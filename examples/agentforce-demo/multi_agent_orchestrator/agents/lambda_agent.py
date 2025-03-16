import json
from typing import List, Dict, Optional, Callable, Any
from dataclasses import dataclass
import boto3
from multi_agent_orchestrator.agents import Agent, AgentOptions
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.utils import conversation_to_dict

@dataclass
class LambdaAgentOptions(AgentOptions):
    """Options for Lambda Agent."""
    function_name: Optional[str] = None
    function_region: Optional[str] = None
    input_payload_encoder: Optional[Callable[
        [str, List[ConversationMessage], str, str, Optional[Dict[str, str]]],
        str
    ]] = None
    output_payload_decoder: Optional[Callable[
        [Dict[str, Any]],
        ConversationMessage
    ]] = None


class LambdaAgent(Agent):
    def __init__(self, options: LambdaAgentOptions):
        super().__init__(options)
        self.options = options
        self.lambda_client = boto3.client('lambda', region_name=self.options.function_region)
        if self.options.input_payload_encoder is None:
            self.encoder = self.__default_input_payload_encoder
        else:
            self.encoder = self.options.input_payload_encoder

        if self.options.output_payload_decoder is None:
            self.decoder = self.__default_output_payload_decoder
        else:
            self.decoder = self.options.output_payload_decoder

    def __default_input_payload_encoder(self,
        input_text: str,
        chat_history: List[ConversationMessage],
        user_id: str,
        session_id: str,
        additional_params: Optional[Dict[str, str]] = None
    ) -> str:
        """Encode input payload as JSON string."""
        return json.dumps({
            'query': input_text,
            'chatHistory': conversation_to_dict(chat_history),
            'additionalParams': additional_params,
            'userId': user_id,
            'sessionId': session_id,
        })


    def __default_output_payload_decoder(self, response: Dict[str, Any]) -> ConversationMessage:
        """Decode Lambda response and create ConversationMessage."""
        decoded_response = json.loads(
            json.loads(response['Payload'].read().decode('utf-8'))['body']
            )['response']
        return ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{'text': decoded_response}]
        )

    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[Dict[str, str]] = None
    ) -> ConversationMessage:
        """Process the request by invoking Lambda function and decoding the response."""
        payload = self.encoder(input_text, chat_history, user_id, session_id, additional_params)

        response = self.lambda_client.invoke(
            FunctionName=self.options.function_name,
            Payload=payload
        )
        return self.decoder(response)
