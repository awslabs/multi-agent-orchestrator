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
        record_direct_tool_call: bool = True,
        load_tools_from_directory: bool = True,
        trace_attributes: Optional[Mapping[str, AttributeValue]] = None,
        mcp_clients: Optional[List[Any]] = None
    ):
        """
        Initialize the Strands Agent.

        Args:
            options: Configuration options for the agent
            model: The LLM model to use (Strands Model object, model name string, or None)
            messages: Optional initial messages for the conversation
            tools: Optional list of tools to make available to the agent
            system_prompt: Optional system prompt to guide the agent's behavior
            callback_handler: Optional callback handler for agent events
            conversation_manager: Optional conversation manager for handling conversation state
            record_direct_tool_call: Whether to record direct tool calls in conversation history
            load_tools_from_directory: Whether to load tools from directory
            trace_attributes: Optional trace attributes for observability
            mcp_clients: Optional list of MCP clients to provide additional tools

        Raises:
            ImportError: If Strands SDK is not available
            ValueError: If required options are missing
        """
        super().__init__(options)

        # Safely get streaming configuration from model if provided
        self.streaming = False
        if model is not None and hasattr(model, 'get_config'):
            self.streaming = model.get_config().get('streaming', False)

        self.mcp_clients = mcp_clients or []
        self.base_tools = tools or []
        self.strands_agent = None
        self._mcp_session_active = False

        # Start MCP client session if provided
        if len(self.mcp_clients) > 0:
            try:
                for mcp_client in mcp_clients:
                    mcp_client.start()
                self._mcp_session_active = True
                Logger.info(f"Started MCP client session for agent {self.name}")
            except Exception as e:
                Logger.error(f"Failed to start MCP client session: {str(e)}")
                raise

        final_tools = self.base_tools.copy() if self.base_tools else []

        if len(self.mcp_clients) > 0 and self._mcp_session_active:
            # Pass the MCP client directly to Strands SDK
            for mcp_client in mcp_clients:
                mcp_tools = mcp_client.list_tools_sync()
                final_tools.extend(mcp_tools)


        # Initialize the Strands agent with MCP client properly managed
        self.strands_agent: StrandsSDKAgent = StrandsSDKAgent(
            model=model,
            messages=messages,
            tools=final_tools,
            system_prompt=system_prompt,
            callback_handler=callback_handler,
            conversation_manager=conversation_manager,
            record_direct_tool_call=record_direct_tool_call,
            load_tools_from_directory=load_tools_from_directory,
            trace_attributes=trace_attributes
        )


    def close(self):
        """
        Explicitly close and cleanup MCP client sessions.

        This method should be called when the agent is no longer needed
        to ensure proper resource cleanup.
        """
        if self.mcp_clients and self._mcp_session_active:
            try:
                for mcp_client in self.mcp_clients:
                    mcp_client.__exit__(None, None, None)
                self._mcp_session_active = False
                Logger.info(f"Closed MCP client session for agent {self.name}")
            except Exception as e:
                Logger.error(f"Error closing MCP client session: {str(e)}")

    def __del__(self):
        """Cleanup MCP client session when agent is destroyed."""
        try:
            self.close()
        except Exception as e:
            # Avoid raising exceptions in __del__
            Logger.error(f"Error during cleanup in __del__: {str(e)}")


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
                    if isinstance(content_block, dict):
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
        agent_tracking_info: Optional[Dict[str, Any]]
    ) -> AsyncIterable[AgentStreamResponse]:
        """
        Handle streaming response from Strands SDK agent.

        Args:
            input_text: User input text
            strands_messages: Messages in Strands format
            agent_tracking_info: Agent tracking information

        Yields:
            AgentStreamResponse objects with text chunks or final message

        Raises:
            ValueError: If streaming is not supported by the model
            ConnectionError: If there's an issue with the streaming connection
            Exception: For other unexpected errors
        """
        try:
            # Set up the Strands agent with current conversation
            self.strands_agent.messages = strands_messages

            # We'll store metadata but avoid accumulating the full text to save memory
            metadata = {}
            final_text = ""  # Only used for callbacks at the end

            kwargs = {
                "name": self.name,
                "payload_input": input_text,
                "agent_tracking_info": agent_tracking_info,
            }
            await self.callbacks.on_llm_start(**kwargs)

            # Use Strands SDK's streaming interface
            stream = self.strands_agent.stream_async(input_text)
            async for event in stream:
                if "data" in event:
                    chunk_text = event["data"]
                    final_text += chunk_text  # Only for final callbacks

                    # Notify callbacks
                    await self.callbacks.on_llm_new_token(chunk_text)

                    # Yield the chunk
                    yield AgentStreamResponse(text=chunk_text)
                elif "event" in event and "metadata" in event["event"]:
                    metadata = event["event"].get("metadata")
                # Silently ignore malformed events

            kwargs = {
                "name": self.name,
                "output": final_text,
                "usage": metadata.get("usage"),
                "system": self.strands_agent.system_prompt,
                "input": input_text,
                "agent_tracking_info": agent_tracking_info,
            }
            await self.callbacks.on_llm_end(**kwargs)

            # Stream is complete, yield final message
            final_message = ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{"text": final_text}]
            )
            yield AgentStreamResponse(final_message=final_message)

        except ConnectionError as error:
            Logger.error(f"Connection error in streaming response: {str(error)}")
            raise ConnectionError(f"Streaming connection failed: {str(error)}")
        except ValueError as error:
            Logger.error(f"Value error in streaming response: {str(error)}")
            raise ValueError(f"Streaming configuration error: {str(error)}")
        except Exception as error:
            Logger.error(f"Error in streaming response: {str(error)}")
            raise

    async def _handle_single_response(
        self,
        input_text: str,
        strands_messages: Messages,
        agent_tracking_info: Optional[Dict[str, Any]]
    ) -> ConversationMessage:
        """
        Handle single (non-streaming) response from Strands SDK agent.

        Args:
            input_text: User input text
            strands_messages: Messages in Strands format
            agent_tracking_info: Agent tracking information

        Returns:
            ConversationMessage response

        Raises:
            ValueError: If there's an issue with the input parameters
            RuntimeError: If there's an issue with the Strands agent execution
            Exception: For other unexpected errors
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

        except ValueError as error:
            Logger.error(f"Value error in single response: {str(error)}")
            raise ValueError(f"Invalid input parameters: {str(error)}")
        except RuntimeError as error:
            Logger.error(f"Runtime error in single response: {str(error)}")
            raise RuntimeError(f"Strands agent execution error: {str(error)}")
        except Exception as error:
            Logger.error(f"Error in single response: {str(error)}")
            raise

    async def _process_with_strategy(
        self,
        streaming: bool,
        input_text: str,
        strands_messages: Messages,
        agent_tracking_info: Optional[Dict[str, Any]]
    ) -> Union[ConversationMessage, AsyncIterable[AgentStreamResponse]]:
        """
        Process the request using the specified strategy (streaming or non-streaming).

        This method routes the request to the appropriate handler based on whether
        streaming is enabled, and handles callback notifications.

        Args:
            streaming: Whether to use streaming response
            input_text: User input text
            strands_messages: Messages in Strands format
            agent_tracking_info: Agent tracking information

        Returns:
            Either a ConversationMessage (non-streaming) or an AsyncIterable of
            AgentStreamResponse objects (streaming)

        Raises:
            ValueError: If there's an issue with the input parameters
            RuntimeError: If there's an issue with the execution
        """
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
        additional_params: Optional[Dict[str, str]] = None
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

        Raises:
            ValueError: If input parameters are invalid
            RuntimeError: If there's an issue with the Strands agent execution
            Exception: For other unexpected errors
        """
        if not input_text:
            raise ValueError("Input text cannot be empty")

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

        except ValueError as error:
            Logger.error(f"Value error processing request with StrandsAgent: {str(error)}")
            raise ValueError(f"Invalid input parameters: {str(error)}")
        except RuntimeError as error:
            Logger.error(f"Runtime error processing request with StrandsAgent: {str(error)}")
            raise RuntimeError(f"Strands agent execution error: {str(error)}")
        except Exception as error:
            Logger.error(f"Error processing request with StrandsAgent: {str(error)}")
            raise

