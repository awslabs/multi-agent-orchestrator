from typing import List, Dict, Optional, AsyncIterable, Any
from multi_agent_orchestrator.agents import Agent, AgentOptions
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.utils import Logger
import ollama
from dataclasses import dataclass

@dataclass
class OllamaAgentOptions(AgentOptions):
    streaming: bool = True
    model_id: str = "llama3.1:latest",
    id="ollama-agent"
    # Add other Ollama-specific options here (e.g., temperature, top_k, top_p)

class OllamaAgent(Agent):
    def __init__(self, options: OllamaAgentOptions):
        super().__init__(options)
        self.options = options

    async def handle_streaming_response(self, messages: List[Dict[str, str]]) -> AsyncIterable[str]:
        try:
            response = ollama.chat(
                model=self.options.model_id,
                messages=messages,
                stream=self.options.streaming
            )
            for part in response:
                self.callbacks.on_llm_new_token(part['message']['content'])
        except Exception as error:
            Logger.error("Error getting stream from Ollama model:", error)
            raise error

    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[Dict[str, str]] = None
    ) -> ConversationMessage | AsyncIterable[Any]:
        messages = [
            {"role": msg.role, "content": msg.content[0]['text']}
            for msg in chat_history
        ]
        messages.append({"role": ParticipantRole.USER.value, "content": input_text})

        if self.options.streaming:
            return await self.handle_streaming_response(messages)
        else:
            response = ollama.chat(
                model=self.options.model_id,
                messages=messages
            )
            return ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{"text": response['message']['content']}]
            )