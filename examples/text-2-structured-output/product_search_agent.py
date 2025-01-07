import os
import json
import boto3
from typing import List, Dict, Any, AsyncIterable, Optional, Union
from dataclasses import dataclass
from enum import Enum
from multi_agent_orchestrator.agents import Agent, AgentOptions
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.utils import conversation_to_dict, Logger
import asyncio
from concurrent.futures import ThreadPoolExecutor

from prompts import PRODUCT_SEARCH_PROMPT


@dataclass
class ProductSearchAgentOptions(AgentOptions):
    max_tokens: int = 1000
    temperature: float = 0.0
    top_p: float = 0.9
    client: Optional[Any] = None

class ProductSearchAgent(Agent):
    def __init__(self, options: ProductSearchAgentOptions):
        self.name = options.name
        self.id = self.generate_key_from_name(options.name)
        self.description = options.description
        self.save_chat = options.save_chat
        self.model_id = options.model_id
        self.region = options.region
        self.max_tokens = options.max_tokens
        self.temperature = options.temperature
        self.top_p = options.top_p
        
        # Use the provided client or create a new one
        self.client = options.client if options.client else self._create_client()

        self.system_prompt = PRODUCT_SEARCH_PROMPT


    @staticmethod
    def generate_key_from_name(name: str) -> str:
        import re
        key = re.sub(r'[^a-zA-Z\s-]', '', name)
        key = re.sub(r'\s+', '-', key)
        return key.lower()

    def _create_client(self):
        #print(f"Creating Bedrock client for region: {self.region}")
        return boto3.client('bedrock-runtime', region_name=self.region)



    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[Dict[str, str]] = None
    ) -> Union[ConversationMessage, AsyncIterable[Any]]:
        print(f"Processing request for user: {user_id}, session: {session_id}")
        print(f"Input text: {input_text}")
        try:
            print("Sending request to Bedrock model")
            
            user_message = ConversationMessage(
                role=ParticipantRole.USER.value,
                content=[{'text': input_text}]
            )

            conversation = [*chat_history, user_message]
            request_body = {
                "modelId": self.model_id,
                "messages": conversation_to_dict(conversation),
                "system": [{"text": self.system_prompt}],
                "inferenceConfig": {
                    "maxTokens": self.max_tokens,
                    "temperature": self.temperature,
                    "topP": self.top_p,
                    "stopSequences": []
                },
            }

            print("Starting Bedrock call...")

            response=self.client.converse(**request_body)

            llm_response = response['output']['message']['content'][0]['text']
            parsed_response = json.loads(llm_response)
            
            #TODO use the output to call the backend to fetch the data matching the user query
                       
            return ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{"text": json.dumps({"output": parsed_response, "type": "json"})}]
            )
            
        except Exception as error:
            print(f"Error processing request: {str(error)}")
            raise ValueError(f"Error processing request: {str(error)}")