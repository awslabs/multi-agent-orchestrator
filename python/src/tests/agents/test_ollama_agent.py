import pytest
from unittest.mock import Mock, AsyncMock, patch
from typing import AsyncIterable
from agent_squad.types import ConversationMessage, ParticipantRole
from agent_squad.agents import OllamaAgent, OllamaAgentOptions, AgentStreamResponse

@pytest.fixture
def mock_ollama_client():
    mock_client = Mock()
    mock_client.chat = Mock()
    return mock_client


@pytest.fixture
def ollama_agent(mock_ollama_client):
    with patch('ollama.chat', return_value=mock_ollama_client):
        options = OllamaAgentOptions(
            name="TestAgent",
            description="A test Ollama agent",
            model_id="llama3.2",
            streaming=False,
            inference_config={
                'temperature': 0.5,
                'top_p': 0.8,
                'stop_sequences': []
            }
        )
        agent = OllamaAgent(options)
        return agent


def test_custom_system_prompt_with_variable():
    options = OllamaAgentOptions(
        name="TestAgent",
        description="A test agent",
        custom_system_prompt={
            'template': "This is a prompt with {{variable}}",
            'variables': {'variable': 'value'}
        }
    )
    agent = OllamaAgent(options)
    assert agent.system_prompt == "This is a prompt with value"


@pytest.mark.asyncio
async def test_process_request_success(ollama_agent):
    with patch('ollama.chat') as mock_chat:
        mock_chat.return_value = {"message": {"content": "This is a test response"}}

        result = await ollama_agent.process_request(
            "Test question",
            "test_user",
            "test_session",
            []
        )

        assert isinstance(result, ConversationMessage)
        assert result.role == ParticipantRole.ASSISTANT.value
        assert result.content[0]['text'] == 'This is a test response'


@pytest.mark.asyncio
async def test_process_request_streaming(ollama_agent):
    ollama_agent.streaming = True

    class MockChunk(dict):
        def __init__(self, content):
            super().__init__({"message": {"content": content}})

    mock_stream = [
        MockChunk("This "),
        MockChunk("is "),
        MockChunk("a "),
        MockChunk("test response")
    ]

    with patch('ollama.chat', return_value=mock_stream):
        result = await ollama_agent.process_request(
            "Test question",
            "test_user",
            "test_session",
            []
        )

        assert isinstance(result, AsyncIterable)

        chunks = []
        async for chunk in result:
            assert isinstance(chunk, AgentStreamResponse)
            if chunk.text:
                chunks.append(chunk.text)

        assert chunks == ["This ", "is ", "a ", "test response"]


@pytest.mark.asyncio
async def test_process_request_with_error(ollama_agent):
    with patch('ollama.chat', side_effect=Exception("API Error")):
        with pytest.raises(Exception) as exc_info:
            await ollama_agent.process_request(
                "Test input",
                "user123",
                "session456",
                []
            )
        assert "API Error" in str(exc_info.value)


@pytest.mark.asyncio
async def test_handle_single_response_no_content(ollama_agent):
    with patch('ollama.chat', return_value={"message": {}}):
        with pytest.raises(ValueError, match='No message content returned from Ollama API'):
            await ollama_agent.handle_single_response({
                "model": "llama3.2",
                "messages": [{"role": "user", "content": "Hi"}],
                "stream": False
            })


def test_is_streaming_enabled(ollama_agent):
    assert not ollama_agent.is_streaming_enabled()
    ollama_agent.streaming = True
    assert ollama_agent.is_streaming_enabled()
