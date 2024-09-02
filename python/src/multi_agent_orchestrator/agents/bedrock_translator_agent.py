from typing import List, Dict, Optional, Any, Union, AsyncIterable
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole, BEDROCK_MODEL_ID_CLAUDE_3_HAIKU
from multi_agent_orchestrator.utils import conversation_to_dict, Logger
from dataclasses import dataclass
from .agent import Agent, AgentOptions
import boto3

@dataclass
class BedrockTranslatorAgentOptions(AgentOptions):
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    inference_config: Optional[Dict[str, Any]] = None
    model_id: Optional[str] = None
    region: Optional[str] = None
    streaming: Optional[bool] = None

class BedrockTranslatorAgent(Agent):
    def __init__(self, options: BedrockTranslatorAgentOptions):
        super().__init__(options)
        self.source_language = options.source_language
        self.target_language = options.target_language or 'English'
        self.model_id = options.model_id or BEDROCK_MODEL_ID_CLAUDE_3_HAIKU
        self.client = boto3.client('bedrock-runtime', region_name=options.region)
        self.streaming = options.streaming or False

        # Default inference configuration
        self.inference_config: Dict[str, Any] = options.inference_config or {
            'maxTokens': 1000,
            'temperature': 0.0,
            'topP': 0.9,
            'stopSequences': []
        }

        # Define the translation tool
        self.tools = [{
            "toolSpec": {
                "name": "Translate",
                "description": "Translate text to target language",
                "inputSchema": {
                    "json": {
                        "type": "object",
                        "properties": {
                            "translation": {
                                "type": "string",
                                "description": "The translated text",
                            },
                        },
                        "required": ["translation"],
                    },
                },
            },
        }]

    async def process_request(self,
                              input_text: str,
                              user_id: str,
                              session_id: str,
                              chat_history: List[ConversationMessage],
                              additional_params: Optional[Dict[str, str]] = None) -> Union[ConversationMessage, AsyncIterable[Any]]:
        try:
            # Check if input is a number and return it as-is if true
            if input_text.isdigit():
                return ConversationMessage(
                    role=ParticipantRole.ASSISTANT,
                    content=[{"text": input_text}]
                )

            # Prepare user message
            user_message = ConversationMessage(
                role=ParticipantRole.USER,
                content=[{"text": f"<userinput>{input_text}</userinput>"}]
            )

            # Construct system prompt
            system_prompt = "You are a translator. Translate the text within the <userinput> tags"
            if self.source_language:
                system_prompt += f" from {self.source_language} to {self.target_language}"
            else:
                system_prompt += f" to {self.target_language}"
            system_prompt += ". Only provide the translation using the Translate tool."

            # Prepare the converse command for Bedrock
            converse_cmd = {
                "modelId": self.model_id,
                "messages": [conversation_to_dict(user_message)],
                "system": [{"text": system_prompt}],
                "toolConfig": {
                    "tools": self.tools,
                    "toolChoice": {
                        "tool": {
                            "name": "Translate",
                        },
                    },
                },            
                'inferenceConfig': self.inference_config
            }

            if self.streaming:
                return await self.handle_streaming_response(converse_cmd)
            else:
                return await self.handle_single_response(converse_cmd)

        except Exception as error:
            Logger.error("Error processing translation request:", error)
            return self.createErrorResponse("An error occurred while processing your translation request.", error)

    async def handle_single_response(self, converse_cmd: Dict[str, Any]) -> ConversationMessage:
        response = self.client.converse(**converse_cmd)

        if 'output' not in response:
            raise ValueError("No output received from Bedrock model")

        if response['output'].get('message', {}).get('content'):
            response_content_blocks = response['output']['message']['content']

            for content_block in response_content_blocks:
                if "toolUse" in content_block:
                    tool_use = content_block["toolUse"]
                    if not tool_use:
                        raise ValueError("No tool use found in the response")

                    if not isinstance(tool_use.get('input'), dict) or 'translation' not in tool_use['input']:
                        raise ValueError("Tool input does not match expected structure")

                    translation = tool_use['input']['translation']
                    if not isinstance(translation, str):
                        raise ValueError("Translation is not a string")

                    # Return the translated text
                    return ConversationMessage(
                        role=ParticipantRole.ASSISTANT,
                        content=[{"text": translation}]
                    )

        raise ValueError("No valid tool use found in the response")

    async def handle_streaming_response(self, converse_cmd: Dict[str, Any]) -> AsyncIterable[str]:
        try:
            response = self.client.converse_stream(**converse_cmd)
            async for chunk in response["stream"]:
                if "contentBlockDelta" in chunk:
                    content = chunk.get("contentBlockDelta", {}).get("delta", {}).get("text")
                    if content:
                        yield content
        except Exception as error:
            Logger.error("Error getting stream from Bedrock model:", error)
            yield self.createErrorResponse("An error occurred while streaming the response from the Bedrock model.", error).content[0].text

    def set_source_language(self, language: Optional[str]):
        """Set the source language for translation"""
        self.source_language = language

    def set_target_language(self, language: str):
        """Set the target language for translation"""
        self.target_language = language