from typing import Union, Optional
import time
import boto3
from multi_agent_orchestrator.storage import ChatStorage
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole, TimestampedMessage
from multi_agent_orchestrator.utils import Logger, conversation_to_dict
from operator import attrgetter


class DynamoDbChatStorage(ChatStorage):
    def __init__(self,
                 table_name: str,
                 region: str,
                 ttl_key: Optional[str] = None,
                 ttl_duration: int = 3600):
        super().__init__()
        self.table_name = table_name
        self.ttl_key = ttl_key
        self.ttl_duration = int(ttl_duration)
        self.dynamodb = boto3.resource('dynamodb', region_name=region)
        self.table = self.dynamodb.Table(table_name)

    async def save_chat_message(
        self,
        user_id: str,
        session_id: str,
        agent_id: str,
        new_message: Union[ConversationMessage, TimestampedMessage],
        max_history_size: Optional[int] = None
    ) -> list[ConversationMessage]:
        key = self._generate_key(user_id, session_id, agent_id)
        existing_conversation = await self.fetch_chat_with_timestamp(user_id, session_id, agent_id)

        if self.is_same_role_as_last_message(existing_conversation, new_message):
            Logger.debug(f"> Consecutive {new_message.role} \
                          message detected for agent {agent_id}. Not saving.")
            return existing_conversation

        if isinstance(new_message, ConversationMessage):
            new_message = TimestampedMessage(
                role=new_message.role,
                content=new_message.content)

        existing_conversation.append(new_message)

        trimmed_conversation: list[TimestampedMessage] = self.trim_conversation(
            existing_conversation,
            max_history_size
        )

        item: dict[str, Union[str, list[TimestampedMessage], int]] = {
            'PK': user_id,
            'SK': key,
            'conversation': conversation_to_dict(trimmed_conversation),
        }

        if self.ttl_key:
            item[self.ttl_key] = int(time.time()) + self.ttl_duration

        try:
            self.table.put_item(Item=item)
        except Exception as error:
            Logger.error(f"Error saving conversation to DynamoDB:{str(error)}")
            raise error

        return self._remove_timestamps(trimmed_conversation)

    async def save_chat_messages(self,
        user_id: str,
        session_id: str,
        agent_id: str,
        new_messages: Union[list[ConversationMessage], list[TimestampedMessage]],
        max_history_size: Optional[int] = None
    ) -> list[ConversationMessage]:

        """
        Save multiple messages at once
        """
        key = self._generate_key(user_id, session_id, agent_id)
        existing_conversation = await self.fetch_chat_with_timestamp(user_id, session_id, agent_id)

        #TODO: check messages are consecutive
        # if self.is_same_role_as_last_message(existing_conversation, new_messages):
        #     Logger.debug(f"> Consecutive {new_message.role} \
        #                   message detected for agent {agent_id}. Not saving.")
        #     return existing_conversation

        if isinstance(new_messages[0], ConversationMessage):  # Check only first message
            new_messages = [
                TimestampedMessage(
                    role=new_message.role,
                    content=new_message.content
                )
             for new_message in new_messages]

        existing_conversation.extend(new_messages)

        trimmed_conversation: list[TimestampedMessage] = self.trim_conversation(
            existing_conversation,
            max_history_size
        )

        item: dict[str, Union[str, list[TimestampedMessage], int]] = {
            'PK': user_id,
            'SK': key,
            'conversation': conversation_to_dict(trimmed_conversation),
        }

        if self.ttl_key:
            item[self.ttl_key] = int(time.time()) + self.ttl_duration

        try:
            self.table.put_item(Item=item)
        except Exception as error:
            Logger.error(f"Error saving conversation to DynamoDB:{str(error)}")
            raise error

        return self._remove_timestamps(trimmed_conversation)

    async def fetch_chat(
        self,
        user_id: str,
        session_id: str,
        agent_id: str
    ) -> list[ConversationMessage]:
        key = self._generate_key(user_id, session_id, agent_id)
        try:
            response = self.table.get_item(Key={'PK': user_id, 'SK': key})
            stored_messages: list[TimestampedMessage] = self._dict_to_conversation(
                response.get('Item', {}).get('conversation', [])
            )
            return self._remove_timestamps(stored_messages)
        except Exception as error:
            Logger.error(f"Error getting conversation from DynamoDB:{str(error)}")
            raise error

    async def fetch_chat_with_timestamp(
        self,
        user_id: str,
        session_id: str,
        agent_id: str
    ) -> list[TimestampedMessage]:
        key = self._generate_key(user_id, session_id, agent_id)
        try:
            response = self.table.get_item(Key={'PK': user_id, 'SK': key})
            stored_messages: list[TimestampedMessage] = self._dict_to_conversation(
                response.get('Item', {}).get('conversation', [])
            )
            return stored_messages
        except Exception as error:
            Logger.error(f"Error getting conversation from DynamoDB: {str(error)}")
            raise error

    async def fetch_all_chats(self, user_id: str, session_id: str) -> list[ConversationMessage]:
        try:
            response = self.table.query(
                KeyConditionExpression="PK = :pk AND begins_with(SK, :skPrefix)",
                ExpressionAttributeValues={
                    ':pk': user_id,
                    ':skPrefix': f"{session_id}#"
                }
            )

            if not response.get('Items'):
                return []

            all_chats = []
            for item in response['Items']:
                if not isinstance(item.get('conversation'), list):
                    Logger.error(f"Unexpected item structure:{item}")
                    continue

                agent_id = item['SK'].split('#')[1]
                for msg in item['conversation']:
                    content = msg['content']
                    if msg['role'] == ParticipantRole.ASSISTANT.value:
                        text = content[0]['text'] if isinstance(content, list) else content
                        content = [{'text': f"[{agent_id}] {text}"}]
                    elif not isinstance(content, list):
                        content = [{'text': content}]

                    all_chats.append(
                        TimestampedMessage(
                            role=msg['role'],
                            content=content,
                            timestamp=int(msg['timestamp'])
                        ))

            all_chats.sort(key=attrgetter('timestamp'))
            return self._remove_timestamps(all_chats)
        except Exception as error:
            Logger.error(f"Error querying conversations from DynamoDB:{str(error)}")
            raise error

    def _generate_key(self, user_id: str, session_id: str, agent_id: str) -> str:
        return f"{session_id}#{agent_id}"

    def _remove_timestamps(self,
                           messages: list[Union[TimestampedMessage]]) -> list[ConversationMessage]:
        return [ConversationMessage(role=message.role,
                                    content=message.content
                                    ) for message in messages]

    def _dict_to_conversation(self,
                              messages: list[dict]) -> list[TimestampedMessage]:
        return [TimestampedMessage(role=msg['role'],
                                   content=msg['content'],
                                   timestamp=msg['timestamp']
                                   ) for msg in messages]
