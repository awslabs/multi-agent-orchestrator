import json
from typing import List, Dict, Any, AsyncIterable, Optional, Union
from dataclasses import dataclass, field
import re
from anthropic import AsyncAnthropic, Anthropic
from multi_agent_orchestrator.agents import Agent, AgentOptions
from multi_agent_orchestrator.types import (ConversationMessage,
                       ParticipantRole,
                       TemplateVariables)
from multi_agent_orchestrator.utils import conversation_to_dict, Logger
from multi_agent_orchestrator.retrievers import Retriever


@dataclass
class AnthropicAgentOptions(AgentOptions):
    api_key: Optional[str] = None
    client: Optional[Any] = None
    model_id: str = "claude-3-5-sonnet-20240620"
    streaming: Optional[bool] = False
    inference_config: Optional[Dict[str, Any]] = None
    retriever: Optional[Retriever] = None
    tool_config: Optional[Dict[str, Any]] = None
    custom_system_prompt: Optional[Dict[str, Any]] = None



class AnthropicAgent(Agent):
    def __init__(self, options: AnthropicAgentOptions):
        super().__init__(options)

        if not options.api_key and not options.client:
            raise ValueError("Anthropic API key or Anthropic client is required")

        self.streaming = options.streaming

        if options.client:
            if self.streaming:
                if not isinstance(options.client, AsyncAnthropic):
                    raise ValueError("If streaming is enabled, the provided client must be an AsyncAnthropic client")
            else:
                if not isinstance(options.client, Anthropic):
                    raise ValueError("If streaming is disabled, the provided client must be an Anthropic client")
            self.client = options.client
        else:
            if self.streaming:
                self.client = AsyncAnthropic(api_key=options.api_key)
            else:
                self.client = Anthropic(api_key=options.api_key)

        self.system_prompt = ''
        self.custom_variables = {}

        self.default_max_recursions: int = 5

        self.model_id = options.model_id

        default_inference_config = {
            'maxTokens': 1000,
            'temperature': 0.1,
            'topP': 0.9,
            'stopSequences': []
        }

        if options.inference_config:
            self.inference_config = {**default_inference_config, **options.inference_config}
        else:
            self.inference_config = default_inference_config

        self.retriever = options.retriever
        self.tool_config = options.tool_config

        self.prompt_template: str = f"""You are a {self.name}.
        {self.description}
        Provide helpful and accurate information based on your expertise.
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

        if options.custom_system_prompt:
            self.set_system_prompt(
                options.custom_system_prompt.template,
                options.custom_system_prompt.variables
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

        messages = [{"role": "user" if msg.role == ParticipantRole.USER.value else "assistant",
                     "content": msg.content[0]['text'] if msg.content else ''} for msg in chat_history]
        messages.append({"role": "user", "content": input_text})

        self.update_system_prompt()
        system_prompt = self.system_prompt

        if self.retriever:
            response = await self.retriever.retrieve_and_combine_results(input_text)
            context_prompt = f"\nHere is the context to use to answer the user's question:\n{response}"
            system_prompt += context_prompt

        input = {
            "model": self.model_id,
            "max_tokens": self.inference_config.get('maxTokens'),
            "messages": messages,
            "system": system_prompt,
            "temperature": self.inference_config.get('temperature'),
            "top_p": self.inference_config.get('topP'),
            "stop_sequences": self.inference_config.get('stopSequences'),
        }

        try:
            if self.tool_config:
                input['tools'] = self.tool_config["tool"]
                final_message = ''
                tool_use = True
                recursions = self.tool_config.get('toolMaxRecursions') if self.tool_config  else self.default_max_recursions

                while tool_use and recursions > 0:
                    if self.streaming:
                        response = await self.handle_streaming_response(input)
                    else:
                        response = await self.handle_single_response(input)

                    tool_use_blocks = [content for content in response.content if content.type == 'tool_use']

                    if tool_use_blocks:
                        input['messages'].append({"role": "assistant", "content": response.content})
                        if not self.tool_config or not self.tool_config.get('useToolHandler'):
                            raise ValueError("No tools available for tool use")
                        tool_response = await self.tool_config['useToolHandler'](response, input['messages'])
                        input['messages'].append(tool_response)
                        tool_use = True
                    else:
                        text_content = next((content for content in response.content if content.type == 'text'), None)
                        final_message = text_content.text if text_content else ''

                    if response.stop_reason == 'end_turn':
                        tool_use = False

                    recursions -= 1

                return ConversationMessage(role=ParticipantRole.ASSISTANT.value, content=[{'text': final_message}])
            else:
                if self.streaming:
                    response = await self.handle_streaming_response(input)
                else:
                    response = await self.handle_single_response(input)

            return ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{'text':response.content[0].text}]
            )

        except Exception as error:
            Logger.error(f"Error processing request: {error}")
            raise error

    async def handle_single_response(self, input_data: Dict) -> Any:
        try:
            response = self.client.messages.create(**input_data)
            return response
        except Exception as error:
            Logger.error(f"Error invoking Anthropic: {error}")
            raise error

    async def handle_streaming_response(self, input) -> Any:
        message = {}
        content = []
        accumulated = {}
        message['content'] = content

        try:
            async with self.client.messages.stream(**input) as stream:
                async for event in stream:
                    if event.type == "text":
                        self.callbacks.on_llm_new_token(event.text)
                    elif event.type == "input_json":
                        message['input'] = json.loads(event.partial_json)
                    elif event.type == "content_block_stop":
                        recursions = 0
                        break

                # you can still get the accumulated final message outside of
                # the context manager, as long as the entire stream was consumed
                # inside of the context manager
                accumulated = await stream.get_final_message()
            return accumulated

        except Exception as error:
            Logger.error(f"Error getting stream from Anthropic model: {str(error)}")
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
