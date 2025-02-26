import asyncio
import pytest
from unittest.mock import AsyncMock, Mock, patch
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.agents import BedrockLLMAgent, BedrockLLMAgentOptions
from multi_agent_orchestrator.utils import Logger

logger = Logger()

@pytest.fixture
def mock_boto3_client():
    with patch('boto3.client') as mock_client:
        yield mock_client

@pytest.fixture
def bedrock_llm_agent(mock_boto3_client):
    options = BedrockLLMAgentOptions(
        name="TestAgent",
        description="A test agent",
        model_id="test-model",
        region="us-west-2",
        streaming=False,
        inference_config={
            'maxTokens': 500,
            'temperature': 0.5,
            'topP': 0.8,
            'stopSequences': []
        },
        guardrail_config={
        'guardrailIdentifier': 'myGuardrailIdentifier',
        'guardrailVersion': 'myGuardrailVersion',
        'trace': 'enabled'
    }
    )
    agent = BedrockLLMAgent(options)
    yield agent
    mock_boto3_client.reset_mock()


def test_no_region_init(bedrock_llm_agent, mock_boto3_client):
    mock_boto3_client.reset_mock()
    options = BedrockLLMAgentOptions(
        name="TestAgent",
        description="A test agent",
    )

    _bedrock_llm_agent = BedrockLLMAgent(options)
    mock_boto3_client.assert_called_once_with('bedrock-runtime')

def test_custom_system_prompt_with_variable(bedrock_llm_agent, mock_boto3_client):
    options = BedrockLLMAgentOptions(
        name="TestAgent",
        description="A test agent",
        custom_system_prompt={
            'template': """This is my new prompt with this {{variable}}""",
            'variables': {'variable': 'value'}
        }
    )

    _bedrock_llm_agent = BedrockLLMAgent(options)
    assert(_bedrock_llm_agent.system_prompt == 'This is my new prompt with this value')


def test_custom_system_prompt_with_wrong_variable(bedrock_llm_agent, mock_boto3_client):
    options = BedrockLLMAgentOptions(
        name="TestAgent",
        description="A test agent",
        custom_system_prompt={
            'template': """This is my new prompt with this {{variable}}""",
            'variables': {'variableT': 'value'}
        }
    )

    _bedrock_llm_agent = BedrockLLMAgent(options)
    assert(_bedrock_llm_agent.system_prompt == 'This is my new prompt with this {{variable}}')


@pytest.mark.asyncio
async def test_process_request_single_response(bedrock_llm_agent, mock_boto3_client):
    mock_response = {
        'output': {
            'message': {
                'role': 'assistant',
                'content': [{'text': 'This is a test response'}]
            }
        }
    }
    mock_boto3_client.return_value.converse.return_value = mock_response

    input_text = "Test question"
    user_id = "test_user"
    session_id = "test_session"
    chat_history = []

    result = await bedrock_llm_agent.process_request(input_text, user_id, session_id, chat_history)

    assert isinstance(result, ConversationMessage)
    assert result.role == ParticipantRole.ASSISTANT.value
    assert result.content[0]['text'] == 'This is a test response'


@pytest.mark.asyncio
async def test_process_request_streaming(bedrock_llm_agent, mock_boto3_client):
    bedrock_llm_agent.streaming = True
    mock_stream_response = {
        "stream": [
            {"messageStart": {"role": "assistant"}},
            {"contentBlockDelta": {"delta": {"text": "This "}}},
            {"contentBlockDelta": {"delta": {"text": "is "}}},
            {"contentBlockDelta": {"delta": {"text": "a "}}},
            {"contentBlockDelta": {"delta": {"text": "test "}}},
            {"contentBlockDelta": {"delta": {"text": "response"}}},
            {"contentBlockStop"}
        ]
    }
    mock_boto3_client.return_value.converse_stream.return_value = mock_stream_response

    input_text = "Test question"
    user_id = "test_user"
    session_id = "test_session"
    chat_history = []

    result = await bedrock_llm_agent.process_request(input_text, user_id, session_id, chat_history)

    assert isinstance(result, ConversationMessage)
    assert result.role == ParticipantRole.ASSISTANT.value
    assert result.content[0]['text'] == 'This is a test response'

@pytest.mark.asyncio
async def test_process_request_with_tool_use(bedrock_llm_agent, mock_boto3_client):
    bedrock_llm_agent.tool_config = {
        "tool": {"name": "test_tool"},
        "toolMaxRecursions": 2,
        "useToolHandler": AsyncMock()
    }

    mock_responses = [
        {
            'output': {
                'message': {
                    'role': 'assistant',
                    'content': [{'toolUse': {'name': 'test_tool'}}]
                }
            }
        },
        {
            'output': {
                'message': {
                    'role': 'assistant',
                    'content': [{'text': 'Final response'}]
                }
            }
        }
    ]
    mock_boto3_client.return_value.converse.side_effect = mock_responses

    input_text = "Test question"
    user_id = "test_user"
    session_id = "test_session"
    chat_history = []

    result = await bedrock_llm_agent.process_request(input_text, user_id, session_id, chat_history)

    assert isinstance(result, ConversationMessage)
    assert result.role == ParticipantRole.ASSISTANT.value
    assert result.content[0]['text'] == 'Final response'
    assert bedrock_llm_agent.tool_config['useToolHandler'].call_count == 1

def test_set_system_prompt(bedrock_llm_agent):
    new_template = "You are a {{role}}. Your task is {{task}}."
    variables = {"role": "test agent", "task": "to run tests"}

    bedrock_llm_agent.set_system_prompt(new_template, variables)

    assert bedrock_llm_agent.prompt_template == new_template
    assert bedrock_llm_agent.custom_variables == variables
    assert bedrock_llm_agent.system_prompt == "You are a test agent. Your task is to run tests."

@pytest.mark.asyncio
async def test_streaming_with_callbacks(bedrock_llm_agent, mock_boto3_client):
    """Test that callbacks are called correctly during streaming"""
    bedrock_llm_agent.streaming = True
    mock_callbacks = Mock()  # Use Mock instead of AsyncMock
    bedrock_llm_agent.callbacks = mock_callbacks
    
    mock_stream_response = {
        "stream": [
            {"messageStart": {"role": "assistant"}},
            {"contentBlockDelta": {"delta": {"text": "First"}}},
            {"contentBlockDelta": {"delta": {"text": "Second"}}},
            {"contentBlockStop": {}}
        ]
    }
    mock_boto3_client.return_value.converse_stream.return_value = mock_stream_response

    result = await bedrock_llm_agent.process_request("Test", "user", "session", [])
    
    # Verify callbacks were called for each token
    assert mock_callbacks.on_llm_new_token.call_count == 2
    mock_callbacks.on_llm_new_token.assert_any_call("First")
    mock_callbacks.on_llm_new_token.assert_any_call("Second")

@pytest.mark.asyncio
async def test_streaming_with_tool_use(bedrock_llm_agent, mock_boto3_client):
    """Test streaming with tool use mixed in"""
    bedrock_llm_agent.streaming = True
    mock_callbacks = Mock()  # Use Mock instead of AsyncMock
    bedrock_llm_agent.callbacks = mock_callbacks
    
    mock_stream_response = {
        "stream": [
            {"messageStart": {"role": "assistant"}},
            {"contentBlockStart": {"start": {"toolUse": {"toolUseId": "123", "name": "test_tool"}}}},
            {"contentBlockDelta": {"delta": {"toolUse": {"input": '{"key": "'}}}},
            {"contentBlockDelta": {"delta": {"toolUse": {"input": 'value"}'}}}},
            {"contentBlockStop": {}},
            {"contentBlockDelta": {"delta": {"text": "Final response"}}},
            {"contentBlockStop": {}}
        ]
    }
    mock_boto3_client.return_value.converse_stream.return_value = mock_stream_response

    result = await bedrock_llm_agent.process_request("Test", "user", "session", [])
    
    assert result.content[0]["toolUse"]["input"] == {"key": "value"}
    assert result.content[1]["text"] == "Final response"
    assert mock_callbacks.on_llm_new_token.call_count == 1
    mock_callbacks.on_llm_new_token.assert_called_with("Final response")

@pytest.mark.asyncio
async def test_streaming_error_handling(bedrock_llm_agent, mock_boto3_client):
    """Test handling of errors during streaming"""
    bedrock_llm_agent.streaming = True
 
    class StreamError(Exception):
        pass

    def mock_stream(): 
        yield {"messageStart": {"role": "assistant"}}
        yield {"contentBlockDelta": {"delta": {"text": "Partial"}}}
        raise StreamError("Stream failed")

    mock_boto3_client.return_value.converse_stream.return_value = {
        "stream": mock_stream()
    }

    with pytest.raises(StreamError):
        await bedrock_llm_agent.process_request("Test", "user", "session", [])

@pytest.mark.asyncio
async def test_streaming_cancellation(bedrock_llm_agent, mock_boto3_client):
    """Test proper cleanup when streaming is cancelled"""
    bedrock_llm_agent.streaming = True
    cleanup_called = False
    processed_tokens = []

    def mock_stream():
        nonlocal cleanup_called
        try:
            yield {"messageStart": {"role": "assistant"}} 
            for i in range(100):
                token = {"contentBlockDelta": {"delta": {"text": f"token_{i}"}}}
                processed_tokens.append(token)
                yield token
        finally:
            cleanup_called = True

    mock_boto3_client.return_value.converse_stream.return_value = {
        "stream": mock_stream()
    }
 
    task = asyncio.create_task(
        bedrock_llm_agent.process_request("Test", "user", "session", [])
    )
 
    await asyncio.sleep(0.1) 
    task.cancel()

    try:
        await task
    except asyncio.CancelledError: 
        assert len(processed_tokens) > 0
        assert len(processed_tokens) < 100
        assert cleanup_called
        raise  # Re-raise the CancelledError for the test


@pytest.mark.asyncio
async def test_streaming_concurrent_requests(bedrock_llm_agent, mock_boto3_client):
    """Test handling multiple concurrent streaming requests"""
    bedrock_llm_agent.streaming = True

    def create_mock_stream(text):
        def mock_stream():
            yield {"messageStart": {"role": "assistant"}}
            yield {"contentBlockDelta": {"delta": {"text": text}}}
            yield {"contentBlockStop": {}}
        return mock_stream
 
    async def make_request(text):
        mock_boto3_client.return_value.converse_stream.return_value = {
            "stream": create_mock_stream(text)()
        }
        return await bedrock_llm_agent.process_request(text, "user", "session", [])

    results = await asyncio.gather(
        make_request("First"),
        make_request("Second"),
        make_request("Third")
    )

    assert [r.content[0]["text"] for r in results] == ["First", "Second", "Third"]


# Add more tests as needed for other methods and edge cases