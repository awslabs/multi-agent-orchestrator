import os
from typing import Any, Optional
from dataclasses import dataclass
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from agent_squad.agents import Agent, AgentOptions
from agent_squad.types import ConversationMessage, ParticipantRole
from agent_squad.utils import Logger
from agent_squad.shared import user_agent

@dataclass
class LexBotAgentOptions(AgentOptions):
    region: Optional[str] = None
    bot_id: str = None
    bot_alias_id: str = None
    locale_id: str = None
    client: Optional[Any] = None

class LexBotAgent(Agent):
    def __init__(self, options: LexBotAgentOptions):
        super().__init__(options)
        if (options.region is None):
            self.region = os.environ.get("AWS_REGION", 'us-east-1')
        else:
            self.region = options.region

        if options.client:
            self.lex_client = options.client

        else:
            self.lex_client = boto3.client('lexv2-runtime', region_name=self.region)

        user_agent.register_feature_to_client(self.lex_client, feature="lex-agent")


        self.bot_id = options.bot_id
        self.bot_alias_id = options.bot_alias_id
        self.locale_id = options.locale_id

        if not all([self.bot_id, self.bot_alias_id, self.locale_id]):
            raise ValueError("bot_id, bot_alias_id, and locale_id are required for LexBotAgent")

    async def process_request(self, input_text: str, user_id: str, session_id: str,
                        chat_history: list[ConversationMessage],
                        additional_params: Optional[dict[str, str]] = None) -> ConversationMessage:
        try:
            params = {
                'botId': self.bot_id,
                'botAliasId': self.bot_alias_id,
                'localeId': self.locale_id,
                'sessionId': session_id,
                'text': input_text,
                'sessionState': {}  # You might want to maintain session state if needed
            }

            response = self.lex_client.recognize_text(**params)

            concatenated_content = ' '.join(
                message.get('content', '') for message in response.get('messages', [])
                if message.get('content')
            )

            return ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{"text": concatenated_content or "No response from Lex bot."}]
            )

        except (BotoCoreError, ClientError) as error:
            Logger.error(f"Error processing request: {str(error)}")
            raise error

