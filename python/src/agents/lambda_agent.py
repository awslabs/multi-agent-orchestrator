import json
from typing import List, Dict, Optional, Callable, Any
import boto3
from src.agents.agent import Agent, AgentOptions
from src.types import ConversationMessage, ParticipantRole
from src.utils import conversation_to_dict

class LambdaAgentOptions(AgentOptions):
    def __init__(
        self,
        name: str,
        description: str,
        function_name: str,
        function_region: str,
        input_payload_encoder: Optional[Callable[[str, List[ConversationMessage], str, str, Optional[Dict[str, str]]], str]] = None,
        output_payload_decoder: Optional[Callable[[Dict[str, Any]], ConversationMessage]] = None
    ):
        super().__init__(name, description)
        self.function_name = function_name
        self.function_region = function_region
        self.input_payload_encoder = input_payload_encoder
        self.output_payload_decoder = output_payload_decoder

class LambdaAgent(Agent):
    def __init__(self, options: LambdaAgentOptions):
        super().__init__(options)
        self.options = options
        self.lambda_client = boto3.client('lambda', region_name=self.options.function_region)

    @staticmethod
    def default_input_payload_encoder(
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

    @staticmethod
    def default_output_payload_decoder(response: Dict[str, Any]) -> ConversationMessage:
        """Decode Lambda response and create ConversationMessage."""
        decoded_response = json.loads(json.loads(response['Payload'].read().decode('utf-8'))['body'])['response']
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
        encoder = self.options.input_payload_encoder or self.default_input_payload_encoder
        payload = encoder(input_text, chat_history, user_id, session_id, additional_params)

        response = self.lambda_client.invoke(
            FunctionName=self.options.function_name,
            Payload=payload
        )

        decoder = self.options.output_payload_decoder or self.default_output_payload_decoder
        return decoder(response)