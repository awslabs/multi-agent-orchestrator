"""
Strands Agent Integration Module

This module provides integration between Agent-Squad and the Strands SDK,
allowing use of Strands SDK agents within the Agent-Squad framework.
"""
import os
import re
from typing import Any, Optional, AsyncIterable, Union, List, Dict, Mapping, Callable
from agent_squad.agents import Agent, AgentOptions, AgentStreamResponse
from agent_squad.types import ConversationMessage, ParticipantRole
from agent_squad.utils import Logger

# Import Strands SDK components
from strands.agent import Agent as StrandsSDKAgent
from strands.agent.agent_result import AgentResult
from strands.types.content import Messages
from strands.agent.conversation_manager import ConversationManager
from strands.types.traces import AttributeValue
from strands.types.models import Model

class StrandsAgent(Agent):
    """
    Agent that integrates Strands SDK functionality with Agent-Squad framework.

    This class bridges the gap between Agent-Squad's agent interface and
    the Strands SDK's agent capabilities, providing access to advanced
    tool management, conversation handling, and model interactions.
    """

    def __init__(self, options: AgentOptions,
        model: Union[Model, str, None] = None,
        messages: Optional[Messages] = None,
        tools: Optional[List[Union[str, Dict[str, str], Any]]] = None,
        system_prompt: Optional[str] = None,
        callback_handler: Optional[Callable] = None,
        conversation_manager: Optional[ConversationManager] = None,
        max_parallel_tools: Optional[int] = None,
        record_direct_tool_call: bool = True,
        load_tools_from_directory: bool = True,
        trace_attributes: Optional[Mapping[str, AttributeValue]] = None
    ):
        """
        Initialize the Strands Agent.

        Args:
            options: Configuration options for the agent

        Raises:
            ImportError: If Strands SDK is not available
            ValueError: If required options are missing
        """
        super().__init__(options)

        self.streaming = model.get_config().get('streaming', False)

        # Initialize Strands SDK Agent
        self.strands_agent: StrandsSDKAgent = StrandsSDKAgent(
            model=model,
            messages=messages,
            tools=tools,
            system_prompt=system_prompt,
            callback_handler=callback_handler,
            conversation_manager=conversation_manager,
            record_direct_tool_call=record_direct_tool_call,
            load_tools_from_directory=load_tools_from_directory,
            trace_attributes=trace_attributes
        )


    def is_streaming_enabled(self) -> bool:
        """
        Check if streaming is enabled for this agent.

        Returns:
            True if streaming is enabled, False otherwise
        """
        return self.streaming

    def _convert_chat_history_to_strands_format(
        self,
        chat_history: List[ConversationMessage]
    ) -> Messages:
        """
        Convert Agent-Squad chat history to Strands SDK message format.

        Args:
            chat_history: Agent-Squad conversation messages

        Returns:
            Messages in Strands SDK format
        """
        messages = []

        for msg in chat_history:
            # Convert role to Strands format
            role = "user" if msg.role == ParticipantRole.USER.value else "assistant"

            # Extract content
            content = []
            if msg.content:
                for content_block in msg.content:
                    if isinstance(content_block, dict) and "text" in content_block:
                        content.append({"text": content_block["text"]})
                    else:
                        # Handle other content types if needed
                        content.append(content_block)

            messages.append({
                "role": role,
                "content": content
            })

        return messages

    def _convert_strands_result_to_conversation_message(
        self,
        result: AgentResult
    ) -> ConversationMessage:
        """
        Convert Strands SDK AgentResult to Agent-Squad ConversationMessage.

        Args:
            result: Strands SDK agent result

        Returns:
            ConversationMessage in Agent-Squad format
        """
        # Extract text content from the result message
        text_content = ""
        content_blocks = result.message.get('content', [])
        for content in content_blocks:
            if content.get('text'):
                text_content += content.get('text', '')

        return ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{"text": text_content}]
        )

    def _prepare_conversation(
        self,
        input_text: str,
        chat_history: List[ConversationMessage]
    ) -> Messages:
        """Prepare the conversation history with the new user message."""
        strands_messages = self._convert_chat_history_to_strands_format(chat_history)
        return strands_messages

    async def _handle_streaming_response(
        self,
        input_text: str,
        strands_messages: Messages,
        agent_tracking_info: dict | None
    ) -> AsyncIterable[AgentStreamResponse]:
        """
        Handle streaming response from Strands SDK agent.

        Args:
            input_text: User input text
            strands_messages: Messages in Strands format
            agent_tracking_info: Agent tracking information

        Yields:
            AgentStreamResponse objects with text chunks or final message
        """
        try:
            # Set up the Strands agent with current conversation
            self.strands_agent.messages = strands_messages

            accumulated_text = ""
            metadata = {}

            kwargs = {
                "name": self.name,
                "payload_input": input_text,
                "agent_tracking_info": agent_tracking_info,
            }
            await self.callbacks.on_llm_start(**kwargs)

            # Use Strands SDK's streaming interface
            async for event in self.strands_agent.stream_async(input_text):
                if "data" in event:
                    chunk_text = event["data"]
                    accumulated_text += chunk_text

                    # Notify callbacks
                    await self.callbacks.on_llm_new_token(chunk_text)

                    # Yield the chunk
                    yield AgentStreamResponse(text=chunk_text)
                elif "event" in event and "metadata" in event["event"]:
                    metadata = event["event"].get("metadata")

            kwargs = {
                "name": self.name,
                "output": accumulated_text,
                "usage": metadata.get("usage"),
                "system": self.strands_agent.system_prompt,
                "input": input_text,
                "agent_tracking_info": agent_tracking_info,
            }
            await self.callbacks.on_llm_end(**kwargs)

            # Stream is complete, yield final message
            final_message = ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{"text": accumulated_text}]
            )
            yield AgentStreamResponse(final_message=final_message)

        except Exception as error:
            Logger.error(f"Error in streaming response: {str(error)}")
            raise error

    async def _handle_single_response(
        self,
        input_text: str,
        strands_messages: Messages,
        agent_tracking_info: dict | None
    ) -> ConversationMessage:
        """
        Handle single (non-streaming) response from Strands SDK agent.

        Args:
            input_text: User input text
            strands_messages: Messages in Strands format
            agent_tracking_info: Agent tracking information

        Returns:
            ConversationMessage response
        """
        try:
            # Set up the Strands agent with current conversation
            self.strands_agent.messages = strands_messages

            kwargs = {
                "name": self.name,
                "payload_input": input_text,
                "agent_tracking_info": agent_tracking_info,
            }
            await self.callbacks.on_llm_start(**kwargs)

            # Process the request
            result: AgentResult = self.strands_agent(input_text)

            # Convert result back to Agent-Squad format
            response = self._convert_strands_result_to_conversation_message(result)

            kwargs = {
                "name": self.name,
                "output": result.message,
                "usage": result.metrics.accumulated_usage if hasattr(result, 'metrics') else None,
                "system": self.strands_agent.system_prompt,
                "input": input_text,
                "agent_tracking_info": agent_tracking_info,
            }
            await self.callbacks.on_llm_end(**kwargs)

            return response

        except Exception as error:
            Logger.error(f"Error in single response: {str(error)}")
            raise error

    async def _process_with_strategy(
        self,
        streaming: bool,
        input_text: str,
        strands_messages: Messages,
        agent_tracking_info: dict | None
    ) -> Union[ConversationMessage, AsyncIterable[AgentStreamResponse]]:
        """Process the request using the specified strategy."""
        if streaming:
            async def stream_generator():
                async for response in self._handle_streaming_response(
                    input_text, strands_messages, agent_tracking_info
                ):
                    yield response
                    if response.final_message:
                        # Notify end callback for streaming
                        end_kwargs = {
                            "agent_name": self.name,
                            "response": response.final_message,
                            "messages": strands_messages,
                            "agent_tracking_info": agent_tracking_info
                        }
                        await self.callbacks.on_agent_end(**end_kwargs)

            return stream_generator()
        else:
            response = await self._handle_single_response(
                input_text, strands_messages, agent_tracking_info
            )

            # Notify end callback for single response
            end_kwargs = {
                "agent_name": self.name,
                "response": response,
                "messages": strands_messages,
                "agent_tracking_info": agent_tracking_info
            }
            await self.callbacks.on_agent_end(**end_kwargs)

            return response

    async def process_request(
        self,
        input_text: str,
        user_id: str,
        session_id: str,
        chat_history: List[ConversationMessage],
        additional_params: Optional[dict[str, str]] = None
    ) -> Union[ConversationMessage, AsyncIterable[AgentStreamResponse]]:
        """
        Process a user request using the Strands SDK agent.

        Args:
            input_text: The user's input text
            user_id: Identifier for the user
            session_id: Identifier for the current session
            chat_history: List of previous messages in the conversation
            additional_params: Optional additional parameters

        Returns:
            Either a complete ConversationMessage or an async iterable for streaming
        """
        try:
            # Prepare callback tracking
            kwargs = {
                "agent_name": self.name,
                "payload_input": input_text,
                "messages": chat_history,
                "additional_params": additional_params,
                "user_id": user_id,
                "session_id": session_id
            }
            agent_tracking_info = await self.callbacks.on_agent_start(**kwargs)

            # Convert chat history to Strands format
            strands_messages = self._prepare_conversation(input_text, chat_history)

            return await self._process_with_strategy(
                self.streaming, input_text, strands_messages, agent_tracking_info
            )

        except Exception as error:
            Logger.error(f"Error processing request with StrandsAgent: {str(error)}")
            raise error

