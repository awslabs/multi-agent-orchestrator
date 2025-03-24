import pytest
from typing import Dict, List
from unittest.mock import Mock, patch
from multi_agent_orchestrator.types import ConversationMessage
from multi_agent_orchestrator.agents import (
    AgentProcessingResult,
    AgentResponse,
    AgentStreamResponse,
    AgentCallbacks,
    AgentOptions,
    Agent,
)


class TestAgent:
    @pytest.fixture
    def mock_agent_options(self):
        return AgentOptions(
            name="Test Agent",
            description="A test agent",
            save_chat=True,
            callbacks=None,
            LOG_AGENT_DEBUG_TRACE=True
        )

    @pytest.fixture
    def mock_agent(self, mock_agent_options):
        class MockAgent(Agent):
            async def process_request(
                self,
                input_text: str,
                user_id: str,
                session_id: str,
                chat_history: List[ConversationMessage],
                additional_params: Dict[str, str] = None,
            ):
                return ConversationMessage(role="assistant", content="Mock response")

        return MockAgent(mock_agent_options)

    def test_agent_processing_result(self):
        result = AgentProcessingResult(
            user_input="Hello",
            agent_id="test-agent",
            agent_name="Test Agent",
            user_id="user123",
            session_id="session456",
        )
        assert result.user_input == "Hello"
        assert result.agent_id == "test-agent"
        assert result.agent_name == "Test Agent"
        assert result.user_id == "user123"
        assert result.session_id == "session456"
        assert isinstance(result.additional_params, dict)
        assert len(result.additional_params) == 0

    def test_agent_processing_result_with_params(self):
        """Test AgentProcessingResult with additional parameters"""
        additional_params = {"model": "gpt-4", "temperature": 0.7, "custom_setting": True}
        result = AgentProcessingResult(
            user_input="Question",
            agent_id="test-agent",
            agent_name="Test Agent",
            user_id="user123",
            session_id="session456",
            additional_params=additional_params
        )

        assert result.additional_params == additional_params
        assert result.additional_params["model"] == "gpt-4"
        assert result.additional_params["temperature"] == 0.7
        assert result.additional_params["custom_setting"] is True

    def test_agent_stream_response(self):
        """Test for the AgentStreamResponse class"""
        # Test initialization with default values
        stream_response = AgentStreamResponse()
        assert stream_response.text == ""
        assert stream_response.final_message is None

        # Test initialization with custom values
        message = ConversationMessage(role="assistant", content="Final response")
        stream_response = AgentStreamResponse(text="Partial text", final_message=message)
        assert stream_response.text == "Partial text"
        assert stream_response.final_message == message
        assert stream_response.final_message.content == "Final response"

    def test_agent_response(self):
        metadata = AgentProcessingResult(
            user_input="Hello",
            agent_id="test-agent",
            agent_name="Test Agent",
            user_id="user123",
            session_id="session456",
        )
        response = AgentResponse(
            metadata=metadata, output="Hello, user!", streaming=False
        )
        assert response.metadata == metadata
        assert response.output == "Hello, user!"
        assert response.streaming is False

    def test_agent_callbacks(self):
        callbacks = AgentCallbacks()
        callbacks.on_llm_new_token("test")  # Should not raise an exception

    def test_agent_options(self, mock_agent_options):
        assert mock_agent_options.name == "Test Agent"
        assert mock_agent_options.description == "A test agent"
        assert mock_agent_options.save_chat is True
        assert mock_agent_options.callbacks is None

    def test_agent_options_with_debug_trace(self):
        """Test AgentOptions with LOG_AGENT_DEBUG_TRACE parameter"""
        options = AgentOptions(
            name="Debug Agent",
            description="An agent with debug tracing",
            save_chat=True,
            callbacks=None,
            LOG_AGENT_DEBUG_TRACE=True
        )

        assert options.name == "Debug Agent"
        assert options.description == "An agent with debug tracing"
        assert options.LOG_AGENT_DEBUG_TRACE is True

    def test_agent_initialization(self, mock_agent, mock_agent_options):
        assert mock_agent.name == mock_agent_options.name
        assert mock_agent.id == "test-agent"
        assert mock_agent.description == mock_agent_options.description
        assert mock_agent.save_chat == mock_agent_options.save_chat
        assert isinstance(mock_agent.callbacks, AgentCallbacks)

    def test_generate_key_from_name(self):
        assert Agent.generate_key_from_name("Test Agent") == "test-agent"
        assert Agent.generate_key_from_name("Complex Name! @#$%") == "complex-name-"
        assert Agent.generate_key_from_name("Agent123") == "agent123"
        assert Agent.generate_key_from_name("Agent2-test") == "agent2-test"
        assert Agent.generate_key_from_name("Agent4-test") == "agent4-test"
        assert Agent.generate_key_from_name("Agent 123!") == "agent-123"
        assert Agent.generate_key_from_name("Agent@#$%^&*()") == "agent"
        assert Agent.generate_key_from_name("Trailing Space  ") == "trailing-space-"
        assert (
            Agent.generate_key_from_name("123 Mixed Content 456!")
            == "123-mixed-content-456"
        )
        assert Agent.generate_key_from_name("Mix@of123Symbols$") == "mixof123symbols"

    @pytest.mark.asyncio
    async def test_process_request(self, mock_agent):
        chat_history = [ConversationMessage(role="user", content="Hello")]
        result = await mock_agent.process_request(
            input_text="Hi",
            user_id="user123",
            session_id="session456",
            chat_history=chat_history,
        )
        assert isinstance(result, ConversationMessage)
        assert result.role == "assistant"
        assert result.content == "Mock response"

    def test_streaming(self, mock_agent):
        assert mock_agent.is_streaming_enabled() is False

    @pytest.mark.asyncio
    async def test_log_debug(self, mock_agent, monkeypatch):
        """Test the log_debug method"""

        # Import the agent module to patch it directly
        import multi_agent_orchestrator.utils.logger as logger

        # Enable debug tracing for the test
        mock_agent.log_debug_trace = True

        # Create a mock logger
        mock_logger = Mock()
        # Patch at the point where the agent module references Logger
        monkeypatch.setattr(logger, "Logger", mock_logger)

        # Test logging without data
        mock_agent.log_debug("TestClass", "Test message")


        # Reset the mock
        mock_logger.info.reset_mock()

        # Test logging with data
        test_data = {"key": "value"}
        mock_agent.log_debug("TestClass", "Test message with data", test_data)

        # Test when debug tracing is disabled
        mock_logger.info.reset_mock()
        mock_agent.log_debug_trace = False
        mock_agent.log_debug("TestClass", "Should not log")
        mock_logger.info.assert_not_called()