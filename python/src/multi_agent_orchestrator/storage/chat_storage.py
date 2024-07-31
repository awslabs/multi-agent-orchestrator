from abc import ABC, abstractmethod
from typing import List, Optional
from multi_agent_orchestrator.types import ConversationMessage

class ChatStorage(ABC):
    """Abstract base class representing the interface for an agent.
    """
    def is_consecutive_message(self,
                               conversation: List[ConversationMessage],
                               new_message: ConversationMessage) -> bool:
        """
        Check if the new message is consecutive with the last message in the conversation.

        Args:
            conversation (List[ConversationMessage]): The existing conversation.
            new_message (ConversationMessage): The new message to check.

        Returns:
            bool: True if the new message is consecutive, False otherwise.
        """
        if not conversation:
            return False
        return conversation[-1].role == new_message.role

    def trim_conversation(self,
                          conversation: List[ConversationMessage],
                          max_history_size: Optional[int] = None) -> List[ConversationMessage]:
        """
        Trim the conversation to the specified maximum history size.

        Args:
            conversation (List[ConversationMessage]): The conversation to trim.
            max_history_size (Optional[int]): The maximum number of messages to keep.

        Returns:
            List[ConversationMessage]: The trimmed conversation.
        """
        if max_history_size is None:
            return conversation
        # Ensure max_history_size is even to maintain complete binoms
        if max_history_size % 2 == 0:
            adjusted_max_history_size = max_history_size
        else:
            adjusted_max_history_size = max_history_size - 1
        return conversation[-adjusted_max_history_size:]

    @abstractmethod
    async def save_chat_message(self,
                                user_id: str,
                                session_id: str,
                                agent_id: str,
                                new_message: ConversationMessage,
                                max_history_size: Optional[int] = None) -> bool:
        """
        Save a new chat message.

        Args:
            user_id (str): The user ID.
            session_id (str): The session ID.
            agent_id (str): The agent ID.
            new_message (ConversationMessage): The new message to save.
            max_history_size (Optional[int]): The maximum history size.

        Returns:
            bool: True if the message was saved successfully, False otherwise.
        """

    @abstractmethod
    async def fetch_chat(self,
                         user_id: str,
                         session_id: str,
                         agent_id: str,
                         max_history_size: Optional[int] = None) -> List[ConversationMessage]:
        """
        Fetch chat messages.

        Args:
            user_id (str): The user ID.
            session_id (str): The session ID.
            agent_id (str): The agent ID.
            max_history_size (Optional[int]): The maximum number of messages to fetch.

        Returns:
            List[ConversationMessage]: The fetched chat messages.
        """

    @abstractmethod
    async def fetch_all_chats(self,
                              user_id: str,
                              session_id: str) -> List[ConversationMessage]:
        """
        Fetch all chat messages for a user and session.

        Args:
            user_id (str): The user ID.
            session_id (str): The session ID.

        Returns:
            List[ConversationMessage]: All chat messages for the user and session.
        """
