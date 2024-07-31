import json
import boto3
from typing import List, Dict, Optional, Callable, AsyncIterable, Any, Union
from .agent import Agent, AgentOptions
from ..types import ConversationMessage, ParticipantRole

class LambdaAgentOptions(AgentOptions):
    def __init__(self, name: str, description: str, function_name: str, function_region: str,
                 input_payload_encoder: Optional[Callable] = None,
                 output_payload_decoder: Optional[Callable] = None):
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

    def default_input_payload_encoder(self, input_text: str, chat_history: List[ConversationMessage],
                                      user_id: str, session_id: str,
                                      additional_params: Optional[Dict[str, str]] = None) -> str:
        return json.dumps({
            'query': input_text,
            'chatHistory': chat_history,
            'additionalParams': additional_params,
            'userId': user_id,
            'sessionId': session_id,
        })
    
    def on_llm_new_token(self, token: str) -> None:
        self.callbacks.on_llm_new_token(token)

    def default_output_payload_decoder(self, response: Dict) -> ConversationMessage:
        decoded_response = json.loads(json.loads(response['Payload'].read().decode('utf-8'))['body'])['response']
        message = ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{'text': f"{decoded_response}"}]
        )
        return message

    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[Dict[str, str]] = None
    ) -> ConversationMessage:
        payload = (self.options.input_payload_encoder(input_text, chat_history, user_id, session_id, additional_params)
                   if self.options.input_payload_encoder
                   else self.default_input_payload_encoder(input_text, chat_history, user_id, session_id, additional_params))

        invoke_params = {
            'FunctionName': self.options.function_name,
            'Payload': payload,
        }

        response = self.lambda_client.invoke(**invoke_params)

        message = (self.options.output_payload_decoder(response)
                   if self.options.output_payload_decoder
                   else self.default_output_payload_decoder(response))

        return message