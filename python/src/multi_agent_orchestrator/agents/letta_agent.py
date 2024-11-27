from dataclasses import dataclass
from typing import List, Optional, Dict
from letta import LocalClient
from letta.schemas.memory import ChatMemory
from letta.schemas.letta_response import LettaResponse
from letta import LLMConfig, EmbeddingConfig
from multi_agent_orchestrator.types import ConversationMessage
from multi_agent_orchestrator.agents import Agent, AgentOptions
from multi_agent_orchestrator.utils import Logger

@dataclass
class LettaAgentOptions(AgentOptions):
    model_name: str = "letta" 
    model_name_embedding: str = "letta" 


class LettaAgent(Agent):
    """
    Represents a Letta agent that interacts with a runtime client.
    Extends base Agent class and implements specific methods for Letta.
    """
    def __init__(self, options: LettaAgentOptions):
        super().__init__(options)
        self.options = options
        self.client = LocalClient()
        self.client.set_default_llm_config(LLMConfig.default_config(model_name=options.model_name)) 
        self.client.set_default_embedding_config(EmbeddingConfig.default_config(model_name=options.model_name_embedding)) 

        try:
            agent_state = self.client.get_agent_by_name(agent_name=options.name)
        except ValueError:
            agent_state = self.client.create_agent(
                name=options.name, 
                memory=ChatMemory(
                    human=f"My name is {options.name}", 
                    persona=options.description
                )
            )
        self._letta_id = agent_state.id

    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[Dict[str, str]] = None
    ) -> ConversationMessage:
        
        response = self.client.send_message(
            agent_id=self._letta_id, 
            message=input_text, 
            role="user" 
        )
        return ConversationMessage(
            role="assistant",
            content=LettaAgent._process_response(response),
        )
    
    @staticmethod
    def _process_response(response: LettaResponse) -> str:
        """
        Extracts the message from the 'send_message' function call in the LettaResponse.
        
        Args:
            response (LettaResponse): The response object containing messages
            
        Returns:
            str: The extracted message from send_message function call, or empty string if not found
        """
        for message in response.messages:
            if (message.message_type == "function_call" and 
                message.function_call.name == "send_message"):
                
                # Extract arguments string and convert to dictionary
                import json
                args = message.function_call.arguments
                args_dict = json.loads(args)
                return args_dict.get("message", "")
        
        return ""

