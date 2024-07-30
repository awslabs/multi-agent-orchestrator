from abc import ABC, abstractmethod
from typing import List, Optional
from ..types import ConversationMessage

class ChatStorage(ABC):
    def _is_consecutive_message(self, conversation: List[ConversationMessage], new_message: ConversationMessage) -> bool:
        if not conversation:
            return False
        return conversation[-1].role == new_message.role

    def _trim_conversation(self, conversation: List[ConversationMessage], max_history_size: Optional[int] = None) -> List[ConversationMessage]:
        if max_history_size is None:
            return conversation
        
        # Ensure max_history_size is even to maintain complete binoms
        adjusted_max_history_size = max_history_size if max_history_size % 2 == 0 else max_history_size - 1
        return conversation[-adjusted_max_history_size:]

    @abstractmethod
    async def save_chat_message(self, user_id: str, session_id: str, agent_id: str, new_message: ConversationMessage, max_history_size: Optional[int] = None) -> bool:
        pass

    @abstractmethod
    async def save_chat_message(self, user_id: str, session_id: str, agent_id: str, new_message: ConversationMessage, max_history_size: Optional[int] = None) -> bool:
        pass

    @abstractmethod
    async def fetch_chat(self, user_id: str, session_id: str, agent_id: str, max_history_size: Optional[int] = None) -> List[ConversationMessage]:
        pass

    @abstractmethod
    async def fetch_all_chats(self, user_id: str, session_id: str) -> List[ConversationMessage]:
        pass