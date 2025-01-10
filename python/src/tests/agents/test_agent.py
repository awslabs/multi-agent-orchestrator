import pytest
from typing import Dict, List
from unittest.mock import Mock
from multi_agent_orchestrator.types import ConversationMessage
from multi_agent_orchestrator.agents import (
    AgentProcessingResult,
    AgentResponse,
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
