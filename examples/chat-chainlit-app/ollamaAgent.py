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

class OllamaAgent(Agent):
    def __init__(self, options: OllamaAgentOptions):
        super().__init__(options)
        self.model_id = options.model_id
        self.streaming = options.streaming

    async def handle_streaming_response(self, messages: List[Dict[str, str]]) -> ConversationMessage:
        text = ''
        try:
            response = ollama.chat(
                model=self.model_id,
                messages=messages,
                stream=self.streaming
            )
            for part in response:
                text += part['message']['content']
                self.callbacks.on_llm_new_token(part['message']['content'])

            return ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{"text": text}]
            )

        except Exception as error:
            Logger.logger.error("Error getting stream from Ollama model:", error)
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

        if self.streaming:
            return await self.handle_streaming_response(messages)
        else:
            response = ollama.chat(
                model=self.model_id,
                messages=messages
            )
            return ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{"text": response['message']['content']}]
            )