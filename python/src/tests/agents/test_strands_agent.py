"""
Test suite for StrandsAgent class.

This module provides comprehensive testing for the StrandsAgent class, which
integrates Strands SDK functionality with the Agent-Squad framework.
"""
import os
import pytest
import asyncio
from unittest.mock import MagicMock, patch, AsyncMock, call

from agent_squad.agents import AgentOptions
from agent_squad.agents.strands_agent import StrandsAgent
from agent_squad.types import ConversationMessage, ParticipantRole
from strands.agent.agent_result import AgentResult
from strands.types.models import Model


@pytest.fixture
def mock_model():
    """Create a mock model for testing."""
    mock = MagicMock(spec=Model)
    mock.get_config.return_value = {"streaming": True}
    return mock


@pytest.fixture
def mock_mcp_client():
    """Create a mock MCP client for testing."""
    mock = MagicMock()
    mock.list_tools_sync.return_value = [{"name": "test_tool"}]
    return mock


@pytest.fixture
def mock_strands_agent():
    """Create a mock Strands SDK Agent for testing."""
    with patch("agent_squad.agents.strands_agent.StrandsSDKAgent") as mock_agent_cls:
        mock_agent = MagicMock()
        mock_agent_cls.return_value = mock_agent
        yield mock_agent


@pytest.fixture
def agent_options():
    """Create agent options for testing."""
    return AgentOptions(name="test_agent", description="test agent description")


@pytest.fixture
def conversation_messages():
    """Create a list of conversation messages for testing."""
    return [
        ConversationMessage(
            role=ParticipantRole.USER.value,
            content=[{"text": "Hello"}]
        ),
        ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{"text": "How can I help?"}]
        )
    ]


@pytest.fixture
def mock_callbacks():
    """Create mock callbacks for testing."""
    callbacks = MagicMock()
    callbacks.on_llm_start = AsyncMock()
    callbacks.on_llm_new_token = AsyncMock()
    callbacks.on_llm_end = AsyncMock()
    callbacks.on_agent_start = AsyncMock(return_value={"tracking_id": "123"})
    callbacks.on_agent_end = AsyncMock()
    return callbacks


class TestStrandsAgent:
    """Test suite for the StrandsAgent class."""

    def test_init_basic(self, agent_options, mock_model, mock_strands_agent):
        """Test basic initialization of StrandsAgent."""
        agent = StrandsAgent(
            options=agent_options,
            model=mock_model,
            system_prompt="Test prompt"
        )

        assert agent.name == "test_agent"
        assert agent.streaming is True
        assert agent.mcp_clients == []
        assert agent.base_tools == []
        assert agent._mcp_session_active is False
        assert agent.strands_agent == mock_strands_agent

    def test_init_with_mcp_clients(self, agent_options, mock_model, mock_mcp_client, mock_strands_agent):
        """Test initialization with MCP clients."""
        mcp_clients = [mock_mcp_client]

        agent = StrandsAgent(
            options=agent_options,
            model=mock_model,
            mcp_clients=mcp_clients
        )

        assert agent.mcp_clients == mcp_clients
        assert agent._mcp_session_active is True
        mock_mcp_client.start.assert_called_once()
        mock_mcp_client.list_tools_sync.assert_called_once()

    def test_init_with_tools(self, agent_options, mock_model, mock_strands_agent):
        """Test initialization with predefined tools."""
        tools = [{"name": "custom_tool"}]

        agent = StrandsAgent(
            options=agent_options,
            model=mock_model,
            tools=tools
        )

        assert agent.base_tools == tools

    def test_init_mcp_client_error(self, agent_options, mock_model):
        """Test handling of MCP client errors during initialization."""
        mock_client = MagicMock()
        mock_client.start.side_effect = Exception("MCP client error")

        with pytest.raises(Exception, match="MCP client error"):
            StrandsAgent(
                options=agent_options,
                model=mock_model,
                mcp_clients=[mock_client]
            )

    @patch("agent_squad.agents.strands_agent.Logger")
    def test_del_with_mcp_clients(self, mock_logger, agent_options, mock_model, mock_mcp_client, mock_strands_agent):
        """Test proper cleanup in __del__ with MCP clients."""
        agent = StrandsAgent(
            options=agent_options,
            model=mock_model,
            mcp_clients=[mock_mcp_client]
        )

        # Manually call __del__ since it's not guaranteed to be called in tests
        agent.__del__()

        mock_mcp_client.__exit__.assert_called_once_with(None, None, None)
        assert agent._mcp_session_active is False
        mock_logger.info.assert_called_with(f"Closed MCP client session for agent {agent.name}")

    @patch("agent_squad.agents.strands_agent.Logger")
    def test_del_with_mcp_clients_error(self, mock_logger, agent_options, mock_model, mock_mcp_client, mock_strands_agent):
        """Test error handling in __del__ with MCP clients."""
        mock_mcp_client.__exit__.side_effect = Exception("Cleanup error")

        agent = StrandsAgent(
            options=agent_options,
            model=mock_model,
            mcp_clients=[mock_mcp_client]
        )

        # Manually call __del__
        agent.__del__()

        mock_mcp_client.__exit__.assert_called_once_with(None, None, None)
        mock_logger.error.assert_called_with("Error closing MCP client session: Cleanup error")

    def test_is_streaming_enabled(self, agent_options, mock_model, mock_strands_agent):
        """Test the is_streaming_enabled method."""
        # Test with streaming enabled
        mock_model.get_config.return_value = {"streaming": True}
        agent = StrandsAgent(options=agent_options, model=mock_model)
        assert agent.is_streaming_enabled() is True

        # Test with streaming disabled
        mock_model.get_config.return_value = {"streaming": False}
        agent = StrandsAgent(options=agent_options, model=mock_model)
        assert agent.is_streaming_enabled() is False

    def test_convert_chat_history_to_strands_format(self, agent_options, mock_model, conversation_messages, mock_strands_agent):
        """Test conversion of chat history to Strands format."""
        agent = StrandsAgent(options=agent_options, model=mock_model)
        result = agent._convert_chat_history_to_strands_format(conversation_messages)

        # Check conversion
        assert len(result) == 2
        assert result[0]["role"] == "user"
        assert result[0]["content"] == [{"text": "Hello"}]
        assert result[1]["role"] == "assistant"
        assert result[1]["content"] == [{"text": "How can I help?"}]

    def test_convert_chat_history_with_different_content_types(self, agent_options, mock_model, mock_strands_agent):
        """Test conversion of chat history with different content types."""
        messages = [
            ConversationMessage(
                role=ParticipantRole.USER.value,
                content=[{"text": "Hello"}, {"image_url": "http://example.com/image.jpg"}]
            )
        ]

        agent = StrandsAgent(options=agent_options, model=mock_model)
        result = agent._convert_chat_history_to_strands_format(messages)

        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert len(result[0]["content"]) == 2
        assert result[0]["content"][0] == {"text": "Hello"}
        assert result[0]["content"][1] == {"image_url": "http://example.com/image.jpg"}

    def test_convert_chat_history_with_empty_content(self, agent_options, mock_model, mock_strands_agent):
        """Test conversion of chat history with empty content."""
        messages = [
            ConversationMessage(
                role=ParticipantRole.USER.value,
                content=[]
            ),
            ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=None
            )
        ]

        agent = StrandsAgent(options=agent_options, model=mock_model)
        result = agent._convert_chat_history_to_strands_format(messages)

        assert len(result) == 2
        assert result[0]["role"] == "user"
        assert result[0]["content"] == []
        assert result[1]["role"] == "assistant"
        assert result[1]["content"] == []

    def test_convert_chat_history_with_complex_nested_content(self, agent_options, mock_model, mock_strands_agent):
        """Test conversion of chat history with complex nested content structures."""
        messages = [
            ConversationMessage(
                role=ParticipantRole.USER.value,
                content=[
                    {"text": "Hello"},
                    {"image_url": "http://example.com/image.jpg"},
                    {"tool_call": {"name": "weather", "parameters": {"location": "Seattle"}}}
                ]
            )
        ]

        agent = StrandsAgent(options=agent_options, model=mock_model)
        result = agent._convert_chat_history_to_strands_format(messages)

        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert len(result[0]["content"]) == 3
        assert result[0]["content"][0] == {"text": "Hello"}
        assert result[0]["content"][1] == {"image_url": "http://example.com/image.jpg"}
        assert result[0]["content"][2] == {"tool_call": {"name": "weather", "parameters": {"location": "Seattle"}}}

    def test_convert_strands_result_to_conversation_message(self, agent_options, mock_model, mock_strands_agent):
        """Test conversion of Strands result to ConversationMessage."""
        result = MagicMock(spec=AgentResult)
        result.message = {
            "role": "assistant",
            "content": [{"text": "This is a response"}]
        }

        agent = StrandsAgent(options=agent_options, model=mock_model)
        conversation_msg = agent._convert_strands_result_to_conversation_message(result)

        assert conversation_msg.role == ParticipantRole.ASSISTANT.value
        assert conversation_msg.content[0]["text"] == "This is a response"

    def test_convert_strands_result_with_multiple_content_blocks(self, agent_options, mock_model, mock_strands_agent):
        """Test conversion of Strands result with multiple content blocks."""
        result = MagicMock(spec=AgentResult)
        result.message = {
            "role": "assistant",
            "content": [
                {"text": "First part. "},
                {"text": "Second part."}
            ]
        }

        agent = StrandsAgent(options=agent_options, model=mock_model)
        conversation_msg = agent._convert_strands_result_to_conversation_message(result)

        assert conversation_msg.role == ParticipantRole.ASSISTANT.value
        assert conversation_msg.content[0]["text"] == "First part. Second part."

    def test_convert_strands_result_with_empty_content(self, agent_options, mock_model, mock_strands_agent):
        """Test conversion of Strands result with empty content."""
        result = MagicMock(spec=AgentResult)
        result.message = {
            "role": "assistant",
            "content": []
        }

        agent = StrandsAgent(options=agent_options, model=mock_model)
        conversation_msg = agent._convert_strands_result_to_conversation_message(result)

        assert conversation_msg.role == ParticipantRole.ASSISTANT.value
        assert conversation_msg.content[0]["text"] == ""

    def test_convert_strands_result_with_mixed_content_types(self, agent_options, mock_model, mock_strands_agent):
        """Test conversion of Strands result with mixed content types."""
        result = MagicMock(spec=AgentResult)
        result.message = {
            "role": "assistant",
            "content": [
                {"text": "Here's an image: "},
                {"image_url": "http://example.com/image.jpg"},
                {"text": " And some more text."}
            ]
        }

        agent = StrandsAgent(options=agent_options, model=mock_model)
        conversation_msg = agent._convert_strands_result_to_conversation_message(result)

        assert conversation_msg.role == ParticipantRole.ASSISTANT.value
        assert conversation_msg.content[0]["text"] == "Here's an image:  And some more text."

    def test_convert_strands_result_with_tool_use(self, agent_options, mock_model, mock_strands_agent):
        """Test conversion of Strands result with tool use content."""
        result = MagicMock(spec=AgentResult)
        result.message = {
            "role": "assistant",
            "content": [
                {"text": "Let me check that for you."},
                {"tool_use": {"name": "weather", "input": {"location": "Seattle"}}},
                {"text": "The weather is sunny."}
            ]
        }

        agent = StrandsAgent(options=agent_options, model=mock_model)
        conversation_msg = agent._convert_strands_result_to_conversation_message(result)

        assert conversation_msg.role == ParticipantRole.ASSISTANT.value
        assert conversation_msg.content[0]["text"] == "Let me check that for you.The weather is sunny."

    def test_prepare_conversation(self, agent_options, mock_model, conversation_messages, mock_strands_agent):
        """Test preparation of conversation for Strands agent."""
        agent = StrandsAgent(options=agent_options, model=mock_model)

        with patch.object(agent, '_convert_chat_history_to_strands_format') as mock_convert:
            mock_convert.return_value = [{"role": "user", "content": [{"text": "Converted"}]}]
            result = agent._prepare_conversation("New input", conversation_messages)

            mock_convert.assert_called_once_with(conversation_messages)
            assert result == [{"role": "user", "content": [{"text": "Converted"}]}]

    @pytest.mark.asyncio
    async def test_handle_streaming_response(self, agent_options, mock_model, mock_strands_agent, mock_callbacks):
        """Test handling of streaming response."""
        agent = StrandsAgent(options=agent_options, model=mock_model)
        agent.callbacks = mock_callbacks

        # Set up the stream mock
        stream_events = [
            {"data": "First "},
            {"data": "chunk"},
            {"event": {"metadata": {"usage": {"prompt_tokens": 10, "completion_tokens": 20}}}}
        ]
        mock_stream = self._async_generator(stream_events)
        agent.strands_agent.stream_async = MagicMock(return_value=mock_stream)

        # Run the method
        strands_messages = [{"role": "user", "content": [{"text": "Test"}]}]
        agent_tracking_info = {"tracking_id": "123"}
        responses = []

        async for response in agent._handle_streaming_response("Test input", strands_messages, agent_tracking_info):
            responses.append(response)

        # Verify results
        assert len(responses) == 3
        assert responses[0].text == "First "
        assert responses[1].text == "chunk"
        assert responses[2].final_message is not None
        assert responses[2].final_message.content[0]["text"] == "First chunk"

        # Verify callbacks
        agent.callbacks.on_llm_start.assert_called_once()
        assert agent.callbacks.on_llm_new_token.call_count == 2
        agent.callbacks.on_llm_new_token.assert_has_calls([
            call("First "),
            call("chunk")
        ])
        agent.callbacks.on_llm_end.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_streaming_response_error(self, agent_options, mock_model, mock_strands_agent, mock_callbacks):
        """Test error handling in streaming response."""
        agent = StrandsAgent(options=agent_options, model=mock_model)
        agent.callbacks = mock_callbacks

        # Set up the stream mock to raise an exception
        error = Exception("Stream error")
        agent.strands_agent.stream_async = MagicMock(side_effect=error)

        # Run the method
        strands_messages = [{"role": "user", "content": [{"text": "Test"}]}]
        agent_tracking_info = {"tracking_id": "123"}

        with pytest.raises(Exception, match="Stream error"):
            async for _ in agent._handle_streaming_response("Test input", strands_messages, agent_tracking_info):
                pass

        # Verify callbacks
        agent.callbacks.on_llm_start.assert_called_once()
        agent.callbacks.on_llm_end.assert_not_called()

    @pytest.mark.asyncio
    async def test_handle_single_response(self, agent_options, mock_model, mock_strands_agent, mock_callbacks):
        """Test handling of single (non-streaming) response."""
        agent = StrandsAgent(options=agent_options, model=mock_model)
        agent.callbacks = mock_callbacks

        # Set up the mock result
        mock_result = MagicMock(spec=AgentResult)
        mock_result.message = {
            "role": "assistant",
            "content": [{"text": "Test response"}]
        }
        mock_result.metrics = MagicMock()
        mock_result.metrics.accumulated_usage = {"prompt_tokens": 10, "completion_tokens": 20}
        agent.strands_agent = MagicMock()
        agent.strands_agent.return_value = mock_result

        # Run the method
        strands_messages = [{"role": "user", "content": [{"text": "Test"}]}]
        agent_tracking_info = {"tracking_id": "123"}

        with patch.object(agent, '_convert_strands_result_to_conversation_message',
                          return_value=ConversationMessage(
                              role=ParticipantRole.ASSISTANT.value,
                              content=[{"text": "Converted response"}]
                          )) as mock_convert:
            result = await agent._handle_single_response("Test input", strands_messages, agent_tracking_info)

            # Verify results
            assert result.role == ParticipantRole.ASSISTANT.value
            assert result.content[0]["text"] == "Converted response"

            # Verify Strands agent was called correctly
            agent.strands_agent.assert_called_once_with("Test input")
            mock_convert.assert_called_once_with(mock_result)

            # Verify callbacks
            agent.callbacks.on_llm_start.assert_called_once()
            agent.callbacks.on_llm_end.assert_called_once()

    @pytest.mark.asyncio
    async def test_handle_single_response_error(self, agent_options, mock_model, mock_strands_agent, mock_callbacks):
        """Test error handling in single response."""
        agent = StrandsAgent(options=agent_options, model=mock_model)
        agent.callbacks = mock_callbacks

        # Set up the mock to raise an exception
        agent.strands_agent = MagicMock(side_effect=Exception("Response error"))

        # Run the method
        strands_messages = [{"role": "user", "content": [{"text": "Test"}]}]
        agent_tracking_info = {"tracking_id": "123"}

        with pytest.raises(Exception, match="Response error"):
            await agent._handle_single_response("Test input", strands_messages, agent_tracking_info)

        # Verify callbacks
        agent.callbacks.on_llm_start.assert_called_once()
        agent.callbacks.on_llm_end.assert_not_called()

    @pytest.mark.asyncio
    async def test_process_with_strategy_streaming(self, agent_options, mock_model, mock_strands_agent, mock_callbacks):
        """Test processing with streaming strategy."""
        agent = StrandsAgent(options=agent_options, model=mock_model)
        agent.callbacks = mock_callbacks

        # Mock the streaming response handler
        mock_response = ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{"text": "Full response"}]
        )
        mock_stream_response = [
            MagicMock(text="First chunk", final_message=None),
            MagicMock(text="Second chunk", final_message=mock_response)
        ]

        with patch.object(agent, '_handle_streaming_response',
                         return_value=self._async_generator(mock_stream_response)) as mock_handler:
            strands_messages = [{"role": "user", "content": [{"text": "Test"}]}]
            agent_tracking_info = {"tracking_id": "123"}

            responses = []
            async for response in await agent._process_with_strategy(True, "Test input", strands_messages, agent_tracking_info):
                responses.append(response)

            # Verify results
            assert len(responses) == 2
            assert responses[0].text == "First chunk"
            assert responses[1].text == "Second chunk"
            assert responses[1].final_message == mock_response

            # Verify handler was called correctly
            mock_handler.assert_called_once_with("Test input", strands_messages, agent_tracking_info)

            # Verify on_agent_end was called for streaming
            agent.callbacks.on_agent_end.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_with_strategy_non_streaming(self, agent_options, mock_model, mock_strands_agent, mock_callbacks):
        """Test processing with non-streaming strategy."""
        agent = StrandsAgent(options=agent_options, model=mock_model)
        agent.callbacks = mock_callbacks

        # Mock the single response handler
        mock_response = ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{"text": "Full response"}]
        )

        with patch.object(agent, '_handle_single_response',
                         return_value=mock_response) as mock_handler:
            strands_messages = [{"role": "user", "content": [{"text": "Test"}]}]
            agent_tracking_info = {"tracking_id": "123"}

            result = await agent._process_with_strategy(False, "Test input", strands_messages, agent_tracking_info)

            # Verify results
            assert result == mock_response

            # Verify handler was called correctly
            mock_handler.assert_called_once_with("Test input", strands_messages, agent_tracking_info)

            # Verify on_agent_end was called for non-streaming
            agent.callbacks.on_agent_end.assert_called_once()

    @pytest.mark.asyncio
    async def test_process_request_streaming(self, agent_options, mock_model, mock_strands_agent, mock_callbacks):
        """Test process_request with streaming enabled."""
        # Set up mocks
        mock_model.get_config.return_value = {"streaming": True}
        agent = StrandsAgent(options=agent_options, model=mock_model)
        agent.callbacks = mock_callbacks

        mock_strands_messages = [{"role": "user", "content": [{"text": "Converted"}]}]
        mock_process_result = self._async_generator([MagicMock(text="Chunk")])

        with patch.object(agent, '_prepare_conversation',
                         return_value=mock_strands_messages) as mock_prepare, \
             patch.object(agent, '_process_with_strategy',
                         return_value=mock_process_result) as mock_process:

            result = await agent.process_request(
                input_text="Test input",
                user_id="user123",
                session_id="session456",
                chat_history=[]
            )

            # Verify the correct methods were called
            agent.callbacks.on_agent_start.assert_called_once()
            mock_prepare.assert_called_once()
            mock_process.assert_called_once_with(
                True, "Test input", mock_strands_messages, {"tracking_id": "123"}
            )

            # Confirm result is correct
            assert result == mock_process_result

    @pytest.mark.asyncio
    async def test_process_request_non_streaming(self, agent_options, mock_model, mock_strands_agent, mock_callbacks):
        """Test process_request with streaming disabled."""
        # Set up mocks
        mock_model.get_config.return_value = {"streaming": False}
        agent = StrandsAgent(options=agent_options, model=mock_model)
        agent.callbacks = mock_callbacks

        mock_strands_messages = [{"role": "user", "content": [{"text": "Converted"}]}]
        mock_response = ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{"text": "Response"}]
        )

        with patch.object(agent, '_prepare_conversation',
                         return_value=mock_strands_messages) as mock_prepare, \
             patch.object(agent, '_process_with_strategy',
                         return_value=mock_response) as mock_process:

            result = await agent.process_request(
                input_text="Test input",
                user_id="user123",
                session_id="session456",
                chat_history=[]
            )

            # Verify the correct methods were called
            agent.callbacks.on_agent_start.assert_called_once()
            mock_prepare.assert_called_once()
            mock_process.assert_called_once_with(
                False, "Test input", mock_strands_messages, {"tracking_id": "123"}
            )

            # Confirm result is correct
            assert result == mock_response

    @pytest.mark.asyncio
    async def test_process_request_error(self, agent_options, mock_model, mock_strands_agent, mock_callbacks):
        """Test process_request error handling."""
        agent = StrandsAgent(options=agent_options, model=mock_model)
        agent.callbacks = mock_callbacks

        with patch.object(agent, '_prepare_conversation',
                         side_effect=Exception("Process error")) as mock_prepare:

            with pytest.raises(Exception, match="Process error"):
                await agent.process_request(
                    input_text="Test input",
                    user_id="user123",
                    session_id="session456",
                    chat_history=[]
                )

            # Verify callbacks
            agent.callbacks.on_agent_start.assert_called_once()

    @staticmethod
    async def _async_generator(items):
        """Helper to create an async generator from a list of items."""
        for item in items:
            yield item
    @pytest.mark.asyncio
    async def test_handle_streaming_response_with_malformed_events(self, agent_options, mock_model, mock_strands_agent, mock_callbacks):
        """Test handling of streaming response with malformed events."""
        agent = StrandsAgent(options=agent_options, model=mock_model)
        agent.callbacks = mock_callbacks

        # Set up the stream mock with malformed events
        stream_events = [
            {"unexpected_key": "value"},  # Malformed event
            {"data": "Valid chunk"},
            {}  # Empty event
        ]
        mock_stream = self._async_generator(stream_events)
        agent.strands_agent.stream_async = MagicMock(return_value=mock_stream)

        # Run the method
        strands_messages = [{"role": "user", "content": [{"text": "Test"}]}]
        agent_tracking_info = {"tracking_id": "123"}
        responses = []

        async for response in agent._handle_streaming_response("Test input", strands_messages, agent_tracking_info):
            responses.append(response)

        # Verify results - should only get one valid chunk
        assert len(responses) == 2  # One for the chunk, one for final message
        assert responses[0].text == "Valid chunk"
        assert responses[1].final_message is not None
        assert responses[1].final_message.content[0]["text"] == "Valid chunk"

    @pytest.mark.asyncio
    async def test_handle_streaming_response_with_network_interruption(self, agent_options, mock_model, mock_strands_agent, mock_callbacks):
        """Test handling of streaming response with simulated network interruption."""
        agent = StrandsAgent(options=agent_options, model=mock_model)
        agent.callbacks = mock_callbacks

        # Create a generator that raises an exception mid-stream
        async def interrupted_generator():
            yield {"data": "First chunk"}
            yield {"data": "Second chunk"}
            raise ConnectionError("Network interrupted")
            yield {"data": "This should never be reached"}

        agent.strands_agent.stream_async = MagicMock(return_value=interrupted_generator())

        # Run the method
        strands_messages = [{"role": "user", "content": [{"text": "Test"}]}]
        agent_tracking_info = {"tracking_id": "123"}

        with pytest.raises(ConnectionError, match="Network interrupted"):
            async for _ in agent._handle_streaming_response("Test input", strands_messages, agent_tracking_info):
                pass

    @pytest.mark.asyncio
    async def test_process_request_with_invalid_chat_history(self, agent_options, mock_model, mock_strands_agent, mock_callbacks):
        """Test process_request with invalid chat history."""
        agent = StrandsAgent(options=agent_options, model=mock_model)
        agent.callbacks = mock_callbacks

        # Create invalid chat history (None instead of a list)
        invalid_chat_history = None

        with patch.object(agent, '_prepare_conversation',
                         side_effect=TypeError("Expected list, got NoneType")) as mock_prepare:

            with pytest.raises(TypeError, match="Expected list, got NoneType"):
                await agent.process_request(
                    input_text="Test input",
                    user_id="user123",
                    session_id="session456",
                    chat_history=invalid_chat_history
                )

            # Verify callbacks
            agent.callbacks.on_agent_start.assert_called_once()
