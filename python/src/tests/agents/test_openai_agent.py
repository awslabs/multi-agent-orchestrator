import pytest
from unittest.mock import Mock, AsyncMock, patch
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.agents import OpenAIAgent, OpenAIAgentOptions

@pytest.fixture
def mock_openai_client():
    mock_client = Mock()
    # Set up nested structure to match OpenAI client
    mock_client.chat = Mock()
    mock_client.chat.completions = Mock()
    mock_client.chat.completions.create = Mock()
    return mock_client


@pytest.fixture
def openai_agent(mock_openai_client):
    with patch('openai.OpenAI', return_value=mock_openai_client):
        options = OpenAIAgentOptions(
            name="TestAgent",
            description="A test OpenAI agent",
            api_key="test-api-key",
            model="gpt-4",
            streaming=False,
            inference_config={
                'maxTokens': 500,
                'temperature': 0.5,
                'topP': 0.8,
                'stopSequences': []
            }
        )
        agent = OpenAIAgent(options)
        agent.client = mock_openai_client  # Explicitly set the mock client
        return agent


def test_custom_system_prompt_with_variable():
    with patch('openai.OpenAI'):
        options = OpenAIAgentOptions(
            name="TestAgent",
            description="A test agent",
            api_key="test-api-key",
            custom_system_prompt={
                'template': "This is a prompt with {{variable}}",
                'variables': {'variable': 'value'}
            }
        )
        agent = OpenAIAgent(options)
        assert agent.system_prompt == "This is a prompt with value"


@pytest.mark.asyncio
async def test_process_request_success(openai_agent, mock_openai_client):
    # Create a mock response object
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message = Mock()
    mock_response.choices[0].message.content = "This is a test response"
    mock_openai_client.chat.completions.create.return_value = mock_response

    result = await openai_agent.process_request(
        "Test question",
        "test_user",
        "test_session",
        []
    )

    assert isinstance(result, ConversationMessage)
    assert result.role == ParticipantRole.ASSISTANT.value
    assert result.content[0]['text'] == 'This is a test response'


@pytest.mark.asyncio
async def test_process_request_streaming(openai_agent, mock_openai_client):
    openai_agent.streaming = True

    # Create mock chunks
    class MockChunk:
        def __init__(self, content):
            self.choices = [Mock()]
            self.choices[0].delta = Mock()
            self.choices[0].delta.content = content

    mock_stream = [
        MockChunk("This "),
        MockChunk("is "),
        MockChunk("a "),
        MockChunk("test response")
    ]
    mock_openai_client.chat.completions.create.return_value = mock_stream

    result = await openai_agent.process_request(
        "Test question",
        "test_user",
        "test_session",
        []
    )

    # chunks = []
    # async for chunk in result:
    #     chunks.append(chunk)

    # assert chunks == ["This ", "is ", "a ", "test response"]
    assert isinstance(result, ConversationMessage)
    assert result.role == ParticipantRole.ASSISTANT.value
    assert result.content[0]['text'] == 'This is a test response'


@pytest.mark.asyncio
async def test_process_request_with_retriever(openai_agent, mock_openai_client):
    # Set up mock retriever
    mock_retriever = AsyncMock()
    mock_retriever.retrieve_and_combine_results.return_value = "Context from retriever"
    openai_agent.retriever = mock_retriever

    # Set up mock response
    mock_response = Mock()
    mock_response.choices = [Mock()]
    mock_response.choices[0].message = Mock()
    mock_response.choices[0].message.content = "Response with context"
    mock_openai_client.chat.completions.create.return_value = mock_response

    result = await openai_agent.process_request(
        "Test question",
        "test_user",
        "test_session",
        []
    )

    mock_retriever.retrieve_and_combine_results.assert_called_once_with("Test question")
    assert isinstance(result, ConversationMessage)
    assert result.content[0]['text'] == "Response with context"


@pytest.mark.asyncio
async def test_process_request_api_error(openai_agent, mock_openai_client):
    mock_openai_client.chat.completions.create.side_effect = Exception("API Error")

    with pytest.raises(Exception) as exc_info:
        await openai_agent.process_request(
            "Test input",
            "user123",
            "session456",
            []
        )
    assert "API Error" in str(exc_info.value)


@pytest.mark.asyncio
async def test_handle_single_response_no_choices(openai_agent, mock_openai_client):
    # Create mock response with no choices
    mock_response = Mock()
    mock_response.choices = []
    mock_openai_client.chat.completions.create.return_value = mock_response

    with pytest.raises(ValueError, match='No choices returned from OpenAI API'):
        await openai_agent.handle_single_response({
            "model": "gpt-4",
            "messages": [{"role": "user", "content": "Hi"}],
            "stream": False
        })


def test_is_streaming_enabled(openai_agent):
    assert not openai_agent.is_streaming_enabled()
    openai_agent.streaming = True
    assert openai_agent.is_streaming_enabled()