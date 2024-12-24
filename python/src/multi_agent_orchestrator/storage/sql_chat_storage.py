from typing import List, Dict, Optional, Union
import time
import json
from libsql_client import Client, create_client
from multi_agent_orchestrator.storage import ChatStorage
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole, TimestampedMessage
from multi_agent_orchestrator.utils import Logger

class SqlChatStorage(ChatStorage):
    """SQL-based chat storage implementation supporting both local SQLite and remote Turso databases."""
    
    def __init__(
        self,
        url: str,
        auth_token: Optional[str] = None
    ):
        """Initialize SQL storage.
        
        Args:
            url: Database URL (e.g., 'file:local.db' or 'libsql://your-db-url.com')
            auth_token: Authentication token for remote databases (optional)
        """
        super().__init__()
        self.client = create_client(
            url=url,
            auth_token=auth_token
        )
        self._initialize_database()

    def _initialize_database(self) -> None:
        """Create necessary tables and indexes if they don't exist."""
        try:
            # Create conversations table
            self.client.execute("""
                CREATE TABLE IF NOT EXISTS conversations (
                    user_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    agent_id TEXT NOT NULL,
                    message_index INTEGER NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    timestamp INTEGER NOT NULL,
                    PRIMARY KEY (user_id, session_id, agent_id, message_index)
                )
            """)

            # Create index for faster queries
            self.client.execute("""
                CREATE INDEX IF NOT EXISTS idx_conversations_lookup 
                ON conversations(user_id, session_id, agent_id)
            """)
        except Exception as error:
            Logger.error(f"Error initializing database: {str(error)}")
            raise error

    async def save_chat_message(
        self,
        user_id: str,
        session_id: str,
        agent_id: str,
        new_message: ConversationMessage,
        max_history_size: Optional[int] = None
    ) -> List[ConversationMessage]:
        """Save a new chat message."""
        try:
            # Fetch existing conversation
            existing_conversation = await self.fetch_chat(user_id, session_id, agent_id)

            if self.is_consecutive_message(existing_conversation, new_message):
                Logger.debug(f"> Consecutive {new_message.role} message detected for agent {agent_id}. Not saving.")
                return existing_conversation

            # Get next message index
            result = self.client.execute("""
                SELECT COALESCE(MAX(message_index) + 1, 0) as next_index
                FROM conversations
                WHERE user_id = ? AND session_id = ? AND agent_id = ?
            """, [user_id, session_id, agent_id])
            
            next_index = result.rows[0]['next_index']
            timestamp = int(time.time() * 1000)
            content = json.dumps(new_message.content)

            # Begin transaction
            with self.client.transaction():
                # Insert new message
                self.client.execute("""
                    INSERT INTO conversations (
                        user_id, session_id, agent_id, message_index,
                        role, content, timestamp
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, [
                    user_id, session_id, agent_id, next_index,
                    new_message.role, content, timestamp
                ])

                # Clean up old messages if max_history_size is set
                if max_history_size is not None:
                    self.client.execute("""
                        DELETE FROM conversations
                        WHERE user_id = ?
                            AND session_id = ?
                            AND agent_id = ?
                            AND message_index <= (
                                SELECT MAX(message_index) - ?
                                FROM conversations
                                WHERE user_id = ?
                                    AND session_id = ?
                                    AND agent_id = ?
                            )
                    """, [
                        user_id, session_id, agent_id,
                        max_history_size,
                        user_id, session_id, agent_id
                    ])

            # Return updated conversation
            return await self.fetch_chat(user_id, session_id, agent_id, max_history_size)
        except Exception as error:
            Logger.error(f"Error saving message: {str(error)}")
            raise error

    async def fetch_chat(
        self,
        user_id: str,
        session_id: str,
        agent_id: str,
        max_history_size: Optional[int] = None
    ) -> List[ConversationMessage]:
        """Fetch chat messages."""
        try:
            query = """
                SELECT role, content, timestamp
                FROM conversations
                WHERE user_id = ? AND session_id = ? AND agent_id = ?
                ORDER BY message_index {}
            """.format('DESC LIMIT ?' if max_history_size else 'ASC')

            params = [user_id, session_id, agent_id]
            if max_history_size:
                params.append(max_history_size)

            result = self.client.execute(query, params)
            messages = result.rows

            # If we used LIMIT, reverse to maintain chronological order
            if max_history_size:
                messages.reverse()

            return [
                ConversationMessage(
                    role=msg['role'],
                    content=json.loads(msg['content'])
                ) for msg in messages
            ]
        except Exception as error:
            Logger.error(f"Error fetching chat: {str(error)}")
            raise error

    async def fetch_all_chats(
        self,
        user_id: str,
        session_id: str
    ) -> List[ConversationMessage]:
        """Fetch all chat messages for a user and session."""
        try:
            result = self.client.execute("""
                SELECT role, content, timestamp, agent_id
                FROM conversations
                WHERE user_id = ? AND session_id = ?
                ORDER BY timestamp ASC
            """, [user_id, session_id])

            return [
                ConversationMessage(
                    role=msg['role'],
                    content=self._format_content(
                        msg['role'],
                        json.loads(msg['content']),
                        msg['agent_id']
                    )
                ) for msg in result.rows
            ]
        except Exception as error:
            Logger.error(f"Error fetching all chats: {str(error)}")
            raise error

    def _format_content(
        self,
        role: str,
        content: Union[List, str],
        agent_id: str
    ) -> List[Dict[str, str]]:
        """Format message content with agent ID for assistant messages."""
        if role == ParticipantRole.ASSISTANT.value:
            text = content[0]['text'] if isinstance(content, list) else content
            return [{'text': f"[{agent_id}] {text}"}]
        return content if isinstance(content, list) else [{'text': content}]

    def close(self) -> None:
        """Close the database connection."""
        self.client.close()