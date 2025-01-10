import pytest
from unittest.mock import Mock, AsyncMock, patch
from typing import AsyncIterable
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.agents import (
    BedrockLLMAgent,
    BedrockLLMAgentOptions,
    AgentStreamResponse)
from multi_agent_orchestrator.utils import Logger, AgentTools, AgentTool

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

    assert isinstance(result, AsyncIterable)

    async for chunk in result:
        assert isinstance(chunk, AgentStreamResponse)
        if chunk.final_message:
            assert chunk.final_message.role == ParticipantRole.ASSISTANT.value
            assert chunk.final_message.content[0]['text'] == 'This is a test response'


@pytest.mark.asyncio
async def test_process_request_with_tool_use(bedrock_llm_agent, mock_boto3_client):
    async def _handler(message, conversation):
        return ConversationMessage(role=ParticipantRole.ASSISTANT, content=[{'text': 'Tool response'}])
    bedrock_llm_agent.tool_config = {
        "tool": [
            Tool(name='test_tool', func=_handler, description='This is a test handler')
        ],
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

def test_streaming(mock_boto3_client):
    options = BedrockLLMAgentOptions(
        name="TestAgent",
        description="A test agent",
        custom_system_prompt={
            'template': """This is my new prompt with this {{variable}}""",
            'variables': {'variable': 'value'}
        },
        streaming=True
    )

    agent = BedrockLLMAgent(options)
    assert(agent.is_streaming_enabled() == True)

    options = BedrockLLMAgentOptions(
        name="TestAgent",
        description="A test agent",
        custom_system_prompt={
            'template': """This is my new prompt with this {{variable}}""",
            'variables': {'variable': 'value'}
        },
        streaming=False
    )

    agent = BedrockLLMAgent(options)
    assert(agent.is_streaming_enabled() == False)

    options = BedrockLLMAgentOptions(
        name="TestAgent",
        description="A test agent",
        custom_system_prompt={
            'template': """This is my new prompt with this {{variable}}""",
            'variables': {'variable': 'value'}
        }
    )

    agent = BedrockLLMAgent(options)
    assert(agent.is_streaming_enabled() == False)

