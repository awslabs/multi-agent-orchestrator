from typing import List, Dict, Optional, AsyncIterable, Any, AsyncGenerator
from dataclasses import dataclass
from agent_squad.agents import Agent, AgentOptions, AgentStreamResponse
from agent_squad.types import ConversationMessage, ParticipantRole, TemplateVariables
from agent_squad.utils import Logger
import ollama


@dataclass
class OllamaAgentOptions(AgentOptions):
    streaming: bool = False
    model_id: str = "llama3.2"
    inference_config: Optional[Dict[str, Any]] = None
    custom_system_prompt: Optional[Dict[str, Any]] = None


class OllamaAgent(Agent):
    def __init__(self, options: OllamaAgentOptions):
        super().__init__(options)
        self.model_id = options.model_id
        self.streaming = options.streaming
        self.inference_config = options.inference_config or {}

        self.prompt_template = f"""You are a {self.name}.
        {self.description} Provide helpful and accurate information based on your expertise.
        You will engage in an open-ended conversation, providing helpful and accurate information based on your expertise.
        The conversation will proceed as follows:
        - The human may ask an initial question or provide a prompt on any topic.
        - You will provide a relevant and informative response.
        - The human may then follow up with additional questions or prompts related to your previous response,
          allowing for a multi-turn dialogue on that topic.
        - Or, the human may switch to a completely new and unrelated topic at any point.
        - You will seamlessly shift your focus to the new topic, providing thoughtful and coherent responses
          based on your broad knowledge base.
        Throughout the conversation, you should aim to:
        - Understand the context and intent behind each new question or prompt.
        - Provide substantive and well-reasoned responses that directly address the query.
        - Draw insights and connections from your extensive knowledge when appropriate.
        - Ask for clarification if any part of the question or prompt is ambiguous.
        - Maintain a consistent, respectful, and engaging tone tailored to the human's communication style.
        - Seamlessly transition between topics as the human introduces new subjects."""

        self.system_prompt = ""
        self.custom_variables: TemplateVariables = {}

        if options.custom_system_prompt:
            self.set_system_prompt(
                options.custom_system_prompt.get('template'),
                options.custom_system_prompt.get('variables')
            )

    def is_streaming_enabled(self) -> bool:
        return self.streaming

    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[Dict[str, str]] = None
    ) -> ConversationMessage | AsyncIterable[Any]:
        try:
            self.update_system_prompt()

            messages = [{"role": "system", "content": self.system_prompt}]
            messages += [{"role": msg.role, "content": msg.content[0]['text']} for msg in chat_history]
            messages.append({"role": ParticipantRole.USER.value, "content": input_text})

            request_options = {
                "model": self.model_id,
                "messages": messages,
                "options": {
                    "temperature": self.inference_config.get("temperature", 0.0),
                    "top_p": self.inference_config.get("top_p", 0.9),
                    "stop": self.inference_config.get("stop", [])
                },
                "stream": self.streaming
            }

            if self.streaming:
                return self.handle_streaming_response(request_options)
            else:
                return await self.handle_single_response(request_options)


        except Exception as error:
            Logger.get_logger().error(f"Error in Ollama API call: {str(error)}")
            raise error

    async def handle_single_response(self, request_options: Dict[str, Any]) -> ConversationMessage:
        try:
            response = ollama.chat(**request_options)
            if not response.get('message') or not response['message'].get('content'):
                raise ValueError('No message content returned from Ollama API')

            return ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{"text": response['message']['content']}]
            )

        except Exception as error:
            Logger.get_logger().error(f"Error in Ollama single response: {str(error)}")
            raise error

    async def handle_streaming_response(self, request_options: Dict[str, Any]) -> AsyncGenerator[AgentStreamResponse, None]:
        try:
            stream = ollama.chat(**request_options)
            accumulated_message = []

            for chunk in stream:
                chunk_content = chunk.get('message', {}).get('content', '')
                if chunk_content:
                    accumulated_message.append(chunk_content)
                    self.callbacks.on_llm_new_token(chunk_content)
                    yield AgentStreamResponse(text=chunk_content)

            yield AgentStreamResponse(final_message=ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{"text": ''.join(accumulated_message)}]
            ))

        except Exception as error:
            Logger.get_logger().error(f"Error in Ollama streaming response: {str(error)}")
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
        self.system_prompt = self.replace_placeholders(self.prompt_template, self.custom_variables)

    @staticmethod
    def replace_placeholders(template: str, variables: TemplateVariables) -> str:
        import re
        def replace(match):
            key = match.group(1)
            if key in variables:
                value = variables[key]
                return '\n'.join(value) if isinstance(value, list) else str(value)
            return match.group(0)

        return re.sub(r'{{(\w+)}}', replace, template)
