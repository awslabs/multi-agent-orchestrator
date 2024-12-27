from typing import List, Dict, Optional, Union
import time
import json
from psycopg2 import connect, sql
from psycopg2.extras import RealDictCursor
from multi_agent_orchestrator.storage import ChatStorage
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole, TimestampedMessage
from multi_agent_orchestrator.utils import Logger


class PostgresChatStorage(ChatStorage):
    """PostgreSQL-based chat storage implementation."""

    def __init__(self, db_url: str):
        """Initialize PostgreSQL storage.

        Args:
            db_url: Database connection URL (e.g., 'postgresql://user:password@host:port/dbname')
        """
        super().__init__()
        self.connection = connect(db_url, cursor_factory=RealDictCursor)
        self.connection.autocommit = True
        self._initialize_database()

    def _initialize_database(self) -> None:
        """Create necessary tables and indexes if they don't exist."""
        try:
            with self.connection.cursor() as cursor:
                # Create conversations table
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS conversations (
                        user_id TEXT NOT NULL,
                        session_id TEXT NOT NULL,
                        agent_id TEXT NOT NULL,
                        message_index INTEGER NOT NULL,
                        role TEXT NOT NULL,
                        content TEXT NOT NULL,
                        timestamp BIGINT NOT NULL,
                        PRIMARY KEY (user_id, session_id, agent_id, message_index)
                    )
                """
                )

                # Create index for faster queries
                cursor.execute(
                    """
                    CREATE INDEX IF NOT EXISTS idx_conversations_lookup 
                    ON conversations(user_id, session_id, agent_id)
                """
                )
        except Exception as error:
            Logger.error(f"Error initializing database: {str(error)}")
            raise error

    async def save_chat_message(
        self,
        user_id: str,
        session_id: str,
        agent_id: str,
        new_message: ConversationMessage,
        max_history_size: Optional[int] = None,
    ) -> List[ConversationMessage]:
        """Save a new chat message."""
        try:
            existing_conversation = await self.fetch_chat(user_id, session_id, agent_id)

            if self.is_consecutive_message(existing_conversation, new_message):
                Logger.debug(
                    f"> Consecutive {new_message.role} message detected for agent {agent_id}. Not saving."
                )
                return existing_conversation

            with self.connection.cursor() as cursor:
                # Get next message index
                cursor.execute(
                    """
                    SELECT COALESCE(MAX(message_index) + 1, 0) as next_index
                    FROM conversations
                    WHERE user_id = %s AND session_id = %s AND agent_id = %s
                """,
                    (user_id, session_id, agent_id),
                )
                next_index = cursor.fetchone()["next_index"]

                timestamp = int(time.time() * 1000)
                content = json.dumps(new_message.content)

                # Insert new message
                cursor.execute(
                    """
                    INSERT INTO conversations (
                        user_id, session_id, agent_id, message_index,
                        role, content, timestamp
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                    (
                        user_id,
                        session_id,
                        agent_id,
                        next_index,
                        new_message.role,
                        content,
                        timestamp,
                    ),
                )

                # Clean up old messages if max_history_size is set
                if max_history_size is not None:
                    cursor.execute(
                        """
                        DELETE FROM conversations
                        WHERE user_id = %s
                            AND session_id = %s
                            AND agent_id = %s
                            AND message_index <= (
                                SELECT MAX(message_index) - %s
                                FROM conversations
                                WHERE user_id = %s
                                    AND session_id = %s
                                    AND agent_id = %s
                            )
                    """,
                        (
                            user_id,
                            session_id,
                            agent_id,
                            max_history_size,
                            user_id,
                            session_id,
                            agent_id,
                        ),
                    )

            # Return updated conversation
            return await self.fetch_chat(
                user_id, session_id, agent_id, max_history_size
            )
        except Exception as error:
            Logger.error(f"Error saving message: {str(error)}")
            raise error

    async def fetch_chat(
        self,
        user_id: str,
        session_id: str,
        agent_id: str,
        max_history_size: Optional[int] = None,
    ) -> List[ConversationMessage]:
        """Fetch chat messages."""
        try:
            query = sql.SQL(
                """
                SELECT role, content, timestamp
                FROM conversations
                WHERE user_id = %s AND session_id = %s AND agent_id = %s
                ORDER BY message_index {order}
            """
            ).format(
                order=sql.SQL("DESC LIMIT %s") if max_history_size else sql.SQL("ASC")
            )

            params = [user_id, session_id, agent_id]
            if max_history_size:
                params.append(max_history_size)

            with self.connection.cursor() as cursor:
                cursor.execute(query, params)
                messages = cursor.fetchall()

            if max_history_size:
                messages.reverse()

            return [
                ConversationMessage(
                    role=msg["role"], content=json.loads(msg["content"])
                )
                for msg in messages
            ]
        except Exception as error:
            Logger.error(f"Error fetching chat: {str(error)}")
            raise error

    async def fetch_all_chats(
        self, user_id: str, session_id: str
    ) -> List[ConversationMessage]:
        """Fetch all chat messages for a user and session."""
        try:
            with self.connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT role, content, timestamp, agent_id
                    FROM conversations
                    WHERE user_id = %s AND session_id = %s
                    ORDER BY timestamp ASC
                """,
                    (user_id, session_id),
                )

                return [
                    ConversationMessage(
                        role=msg["role"],
                        content=self._format_content(
                            msg["role"], json.loads(msg["content"]), msg["agent_id"]
                        ),
                    )
                    for msg in cursor.fetchall()
                ]
        except Exception as error:
            Logger.error(f"Error fetching all chats: {str(error)}")
            raise error

    def _format_content(
        self, role: str, content: Union[List, str], agent_id: str
    ) -> List[Dict[str, str]]:
        """Format message content with agent ID for assistant messages."""
        if role == ParticipantRole.ASSISTANT.value:
            text = content[0]["text"] if isinstance(content, list) else content
            return [{"text": f"[{agent_id}] {text}"}]
        return content if isinstance(content, list) else [{"text": content}]

    def close(self) -> None:
        """Close the database connection."""
        self.connection.close()
