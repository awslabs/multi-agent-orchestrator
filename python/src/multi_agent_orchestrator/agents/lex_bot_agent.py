from typing import List, Dict, Optional
from dataclasses import dataclass
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from multi_agent_orchestrator.agents import Agent, AgentOptions
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.utils import Logger
import os

@dataclass
class LexBotAgentOptions(AgentOptions):
    bot_id: str = None
    bot_alias_id: str = None
    locale_id: str = None

class LexBotAgent(Agent):
    def __init__(self, options: LexBotAgentOptions):
        super().__init__(options)
        if (options.region is None):
            self.region = os.environ.get("AWS_REGION", 'us-east-1')
        else:
            self.region = options.region
        self.lex_client = boto3.client('lexv2-runtime', region_name=self.region)
        self.bot_id = options.bot_id
        self.bot_alias_id = options.bot_alias_id
        self.locale_id = options.locale_id

        if not all([self.bot_id, self.bot_alias_id, self.locale_id]):
            raise ValueError("bot_id, bot_alias_id, and locale_id are required for LexBotAgent")

    async def process_request(self, input_text: str, user_id: str, session_id: str,
                        chat_history: List[ConversationMessage],
                        additional_params: Optional[Dict[str, str]] = None) -> ConversationMessage:
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

