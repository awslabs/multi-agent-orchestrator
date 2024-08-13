from typing import List, Dict, Optional
import time
from collections import defaultdict
from multi_agent_orchestrator.storage import ChatStorage
from multi_agent_orchestrator.types import ConversationMessage, TimestampedMessage
from multi_agent_orchestrator.utils import Logger

class InMemoryChatStorage(ChatStorage):
    def __init__(self):
        super().__init__()
        self.conversations = defaultdict(list)

    async def save_chat_message(
        self,
        user_id: str,
        session_id: str,
        agent_id: str,
        new_message: ConversationMessage,
        max_history_size: Optional[int] = None
    ) -> List[Dict]:
        key = self._generate_key(user_id, session_id, agent_id)
        conversation = self.conversations[key]

        if self.is_consecutive_message(conversation, new_message):
            Logger.debug(f"> Consecutive {new_message.role} \
                       message detected for agent {agent_id}. Not saving.")
            return self._remove_timestamps(conversation)

        timestamped_message = TimestampedMessage(
            role=new_message.role,
            content=new_message.content,
            timestamp=time.time() * 1000)
        conversation.append(timestamped_message)
        conversation = self.trim_conversation(conversation, max_history_size)
        self.conversations[key] = conversation
        return self._remove_timestamps(conversation)

    async def fetch_chat(
        self,
        user_id: str,
        session_id: str,
        agent_id: str,
        max_history_size: Optional[int] = None
    ) -> List[Dict]:
        key = self._generate_key(user_id, session_id, agent_id)
        conversation = self.conversations[key]
        if max_history_size is not None:
            conversation = self.trim_conversation(conversation, max_history_size)
        return self._remove_timestamps(conversation)

    async def fetch_all_chats(
        self,
        user_id: str,
        session_id: str
    ) -> List[ConversationMessage]:
        all_messages = []
        for key, messages in self.conversations.items():
            stored_user_id, stored_session_id, agent_id = key.split('#')
            if stored_user_id == user_id and stored_session_id == session_id:
                for message in messages:
                    new_content = message.content if message.content else []
                    all_messages.append(TimestampedMessage(
                        role=message.role,
                        content=new_content,
                        timestamp=message.timestamp
                    ))

        # Sort messages by timestamp
        all_messages.sort(key=lambda x: x.timestamp)
        return self._remove_timestamps(all_messages)

    @staticmethod
    def _generate_key(user_id: str, session_id: str, agent_id: str) -> str:
        return f"{user_id}#{session_id}#{agent_id}"

    @staticmethod
    def _remove_timestamps(messages: List[Dict]) -> List[ConversationMessage]:
        return [ConversationMessage(
            role=message.role,
            content=message.content
            ) for message in messages]
