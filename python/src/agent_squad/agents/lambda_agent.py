import json
from typing import List, Dict, Optional, Callable, Any
from dataclasses import dataclass
import boto3
from agent_squad.agents import Agent, AgentOptions
from agent_squad.types import ConversationMessage, ParticipantRole
from agent_squad.utils import conversation_to_dict
from agent_squad.shared import user_agent

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

        user_agent.register_feature_to_client(self.lambda_client, feature="lambda-agent")

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
        kwargs = {
            "agent_name": self.name,
            "input": input_text,
            "messages": chat_history,
            "additional_params": additional_params,
            "user_id": user_id,
            "session_id": session_id,
        }
        agent_tracking_info = await self.callbacks.on_agent_start(**kwargs)

        payload = self.encoder(input_text, chat_history, user_id, session_id, additional_params)

        response = self.lambda_client.invoke(
            FunctionName=self.options.function_name,
            Payload=payload
        )
        result = self.decoder(response)

        kwargs = {
            "agent_name": self.name,
            "response": result,
            "messages": chat_history,
            "agent_tracking_info": agent_tracking_info
        }
        await self.callbacks.on_agent_end(**kwargs)

        return result
