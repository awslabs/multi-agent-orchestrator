from typing import Dict, List, Union, AsyncIterable, Optional, Any
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from multi_agent_orchestrator.types import ConversationMessage
from multi_agent_orchestrator.utils import Logger


@dataclass
class AgentProcessingResult:
    user_input: str
    agent_id: str
    agent_name: str
    user_id: str
    session_id: str
    additional_params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResponse:
    metadata: AgentProcessingResult
    output: Union[Any, str]
    streaming: bool


class AgentCallbacks:
    def on_llm_new_token(self, token: str) -> None:
        # Default implementation
        pass


@dataclass
class AgentOptions:
    name: str
    description: str
    save_chat: bool = True
    callbacks: Optional[AgentCallbacks] = None
    # Optional: Flag to enable/disable agent debug trace logging
    # If true, the agent will log additional debug information
    LOG_AGENT_DEBUG_TRACE: Optional[bool] = False


class Agent(ABC):
    def __init__(self, options: AgentOptions):
        self.name = options.name
        self.id = self.generate_key_from_name(options.name)
        self.description = options.description
        self.save_chat = options.save_chat
        self.callbacks = (
            options.callbacks if options.callbacks is not None else AgentCallbacks()
        )
        self.LOG_AGENT_DEBUG_TRACE = (
            options.LOG_AGENT_DEBUG_TRACE
            if options.LOG_AGENT_DEBUG_TRACE is not None
            else False
        )

    def is_streaming_enabled(self) -> bool:
        return False

    @staticmethod
    def generate_key_from_name(name: str) -> str:
        import re

        # Remove special characters and replace spaces with hyphens
        key = re.sub(r"[^a-zA-Z0-9\s-]", "", name)
        key = re.sub(r"\s+", "-", key)
        return key.lower()

    @abstractmethod
    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[Dict[str, str]] = None,
    ) -> Union[ConversationMessage, AsyncIterable[Any]]:
        pass

    def log_debug(self, class_name, message, data=None):
        if self.LOG_AGENT_DEBUG_TRACE:
            prefix = f"> {class_name} \n> {self.name} \n>"
            if data:
                Logger.info(f"{prefix} {message} \n> {data}")
            else:
                Logger.info(f"{prefix} {message} \n>")
