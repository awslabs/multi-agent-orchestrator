from typing import List, Dict, Any, AsyncIterable, Optional, Union
from dataclasses import dataclass
import re
import json
import os
import boto3
from multi_agent_orchestrator.agents import Agent, AgentOptions
from multi_agent_orchestrator.types import (ConversationMessage,
                       ParticipantRole,
                       BEDROCK_MODEL_ID_CLAUDE_3_HAIKU,
                       TemplateVariables)
from multi_agent_orchestrator.utils import conversation_to_dict, Logger
from multi_agent_orchestrator.retrievers import Retriever


@dataclass
class BedrockLLMAgentOptions(AgentOptions):
    streaming: Optional[bool] = None
    inference_config: Optional[Dict[str, Any]] = None
    guardrail_config: Optional[Dict[str, str]] = None
    retriever: Optional[Retriever] = None
    tool_config: Optional[Dict[str, Any]] = None
    custom_system_prompt: Optional[Dict[str, Any]] = None
    client: Optional[Any] = None


class BedrockLLMAgent(Agent):
    def __init__(self, options: BedrockLLMAgentOptions):
        super().__init__(options)
        if options.client:
            self.client = options.client
        else:
            if options.region:
                self.client = boto3.client(
                    'bedrock-runtime',
                    region_name=options.region or os.environ.get('AWS_REGION')
                )
            else:
                self.client = boto3.client('bedrock-runtime')

        self.model_id: str = options.model_id or BEDROCK_MODEL_ID_CLAUDE_3_HAIKU
        self.streaming: bool = options.streaming
        self.inference_config: Dict[str, Any]

        default_inference_config = {
            'maxTokens': 1000,
            'temperature': 0.0,
            'topP': 0.9,
            'stopSequences': []
        }

        if options.inference_config:
            self.inference_config = {**default_inference_config, **options.inference_config}
        else:
            self.inference_config = default_inference_config

        self.guardrail_config: Optional[Dict[str, str]] = options.guardrail_config or {}
        self.retriever: Optional[Retriever] = options.retriever
        self.tool_config: Optional[Dict[str, Any]] = options.tool_config

        self.prompt_template: str = f"""You are a {self.name}.
        {self.description}
        You will engage in an open-ended conversation,
        providing helpful and accurate information based on your expertise.
        The conversation will proceed as follows:
        - The human may ask an initial question or provide a prompt on any topic.
        - You will provide a relevant and informative response.
        - The human may then follow up with additional questions or prompts related to your previous
        response, allowing for a multi-turn dialogue on that topic.
        - Or, the human may switch to a completely new and unrelated topic at any point.
        - You will seamlessly shift your focus to the new topic, providing thoughtful and
        coherent responses based on your broad knowledge base.
        Throughout the conversation, you should aim to:
        - Understand the context and intent behind each new question or prompt.
        - Provide substantive and well-reasoned responses that directly address the query.
        - Draw insights and connections from your extensive knowledge when appropriate.
        - Ask for clarification if any part of the question or prompt is ambiguous.
        - Maintain a consistent, respectful, and engaging tone tailored
        to the human's communication style.
        - Seamlessly transition between topics as the human introduces new subjects."""

        self.system_prompt: str = ""
        self.custom_variables: TemplateVariables = {}
        self.default_max_recursions: int = 20

        if options.custom_system_prompt:
            self.set_system_prompt(
                options.custom_system_prompt.get('template'),
                options.custom_system_prompt.get('variables')
            )

    def is_streaming_enabled(self) -> bool:
        return self.streaming is True

    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[Dict[str, str]] = None
    ) -> Union[ConversationMessage, AsyncIterable[Any]]:

        user_message = ConversationMessage(
            role=ParticipantRole.USER.value,
            content=[{'text': input_text}]
        )

        conversation = [*chat_history, user_message]

        self.update_system_prompt()

        system_prompt = self.system_prompt

        if self.retriever:
            response = await self.retriever.retrieve_and_combine_results(input_text)
            context_prompt = "\nHere is the context to use to answer the user's question:\n" + response
            system_prompt += context_prompt

        converse_cmd = {
            'modelId': self.model_id,
            'messages': conversation_to_dict(conversation),
            'system': [{'text': system_prompt}],
            'inferenceConfig': {
                'maxTokens': self.inference_config.get('maxTokens'),
                'temperature': self.inference_config.get('temperature'),
                'topP': self.inference_config.get('topP'),
                'stopSequences': self.inference_config.get('stopSequences'),
            }
        }

        if self.guardrail_config:
            converse_cmd["guardrailConfig"] = self.guardrail_config

        if self.tool_config:
            converse_cmd["toolConfig"] = {'tools': self.tool_config["tool"]}

        if self.tool_config:
            continue_with_tools = True
            final_message: ConversationMessage = {'role': ParticipantRole.USER.value, 'content': []}
            max_recursions = self.tool_config.get('toolMaxRecursions', self.default_max_recursions)

            while continue_with_tools and max_recursions > 0:
                if self.streaming:
                    bedrock_response = await self.handle_streaming_response(converse_cmd)
                else:
                    bedrock_response = await self.handle_single_response(converse_cmd)

                conversation.append(bedrock_response)

                if any('toolUse' in content for content in bedrock_response.content):
                    await self.tool_config['useToolHandler'](bedrock_response, conversation)
                else:
                    continue_with_tools = False
                    final_message = bedrock_response

                max_recursions -= 1
                converse_cmd['messages'] = conversation_to_dict(conversation)

            return final_message

        if self.streaming:
            return await self.handle_streaming_response(converse_cmd)

        return await self.handle_single_response(converse_cmd)

    async def handle_single_response(self, converse_input: Dict[str, Any]) -> ConversationMessage:
        try:
            response = self.client.converse(**converse_input)
            if 'output' not in response:
                raise ValueError("No output received from Bedrock model")
            return ConversationMessage(
                role=response['output']['message']['role'],
                content=response['output']['message']['content']
            )
        except Exception as error:
            Logger.error(f"Error invoking Bedrock model:{str(error)}")
            raise error

    async def handle_streaming_response(self, converse_input: Dict[str, Any]) -> ConversationMessage:
        try:
            response = self.client.converse_stream(**converse_input)

            message = {}
            content = []
            message['content'] = content
            text = ''
            tool_use = {}

            #stream the response into a message.
            for chunk in response['stream']:
                if 'messageStart' in chunk:
                    message['role'] = chunk['messageStart']['role']
                elif 'contentBlockStart' in chunk:
                    tool = chunk['contentBlockStart']['start']['toolUse']
                    tool_use['toolUseId'] = tool['toolUseId']
                    tool_use['name'] = tool['name']
                elif 'contentBlockDelta' in chunk:
                    delta = chunk['contentBlockDelta']['delta']
                    if 'toolUse' in delta:
                        if 'input' not in tool_use:
                            tool_use['input'] = ''
                        tool_use['input'] += delta['toolUse']['input']
                    elif 'text' in delta:
                        text += delta['text']
                        self.callbacks.on_llm_new_token(delta['text'])
                elif 'contentBlockStop' in chunk:
                    if 'input' in tool_use:
                        tool_use['input'] = json.loads(tool_use['input'])
                        content.append({'toolUse': tool_use})
                        tool_use = {}
                    else:
                        content.append({'text': text})
                        text = ''
            return ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=message['content']
            )

        except Exception as error:
            Logger.error(f"Error getting stream from Bedrock model: {str(error)}")
            raise error

    def set_system_prompt(self,
                          template: Optional[str] = None,
                          variables: Optional[TemplateVariables] = None) -> None:
        if template:
            self.prompt_template = template
        if variables:
            self.custom_variables = variables
        self.update_system_prompt()

    def update_system_prompt(self) -> None:
        all_variables: TemplateVariables = {**self.custom_variables}
        self.system_prompt = self.replace_placeholders(self.prompt_template, all_variables)

    @staticmethod
    def replace_placeholders(template: str, variables: TemplateVariables) -> str:
        def replace(match):
            key = match.group(1)
            if key in variables:
                value = variables[key]
                return '\n'.join(value) if isinstance(value, list) else str(value)
            return match.group(0)

        return re.sub(r'{{(\w+)}}', replace, template)
