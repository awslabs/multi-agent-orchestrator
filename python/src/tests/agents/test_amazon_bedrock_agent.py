import pytest
from unittest.mock import Mock, patch
from botocore.exceptions import BotoCoreError, ClientError
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.agents import AmazonBedrockAgent, AmazonBedrockAgentOptions

@pytest.fixture
def mock_boto3_client():
    with patch('boto3.client') as mock_client:
        yield mock_client

@pytest.fixture
def bedrock_agent(mock_boto3_client):
    options = AmazonBedrockAgentOptions(
        agent_id='test_agent_id',
        agent_alias_id='test_agent_alias_id',
        region='us-west-2',
        name='test_agent_name',
        description='test_agent description'
    )
    return AmazonBedrockAgent(options)

def test_init(bedrock_agent, mock_boto3_client):
    assert bedrock_agent.agent_id == 'test_agent_id'
    assert bedrock_agent.agent_alias_id == 'test_agent_alias_id'
    mock_boto3_client.assert_called_once_with('bedrock-agent-runtime', region_name='us-west-2')

@pytest.mark.asyncio
async def test_process_request_success(bedrock_agent):
    mock_response = {
        'completion': [
            {'chunk': {'bytes': b'Hello'}},
            {'chunk': {'bytes': b', world!'}}
        ]
    }
    bedrock_agent.client.invoke_agent = Mock(return_value=mock_response)

    result = await bedrock_agent.process_request(
        input_text="Test input",
        user_id="test_user",
        session_id="test_session",
        chat_history=[]
    )

    assert isinstance(result, ConversationMessage)
    assert result.role == ParticipantRole.ASSISTANT.value
    assert result.content == [{"text": "Hello, world!"}]

    bedrock_agent.client.invoke_agent.assert_called_once_with(
        agentId='test_agent_id',
        agentAliasId='test_agent_alias_id',
        sessionId='test_session',
        inputText='Test input',
        enableTrace=False,
        streamingConfigurations={},
        sessionState={}
    )

@pytest.mark.asyncio
async def test_process_request_error(bedrock_agent):
    bedrock_agent.client.invoke_agent = Mock(side_effect=ClientError(
        {'Error': {'Code': 'TestException', 'Message': 'Test error'}},
        'invoke_agent'
    ))

    try:
        result = await bedrock_agent.process_request(
            input_text="Test input",
            user_id="test_user",
            session_id="test_session",
            chat_history=[]
        )
    except Exception as error:
        assert isinstance(error, ClientError)
        assert error.response['Error']['Code'] == 'TestException'
        assert error.response['Error']['Message'] == 'Test error'
        pass

    # Optionally, you can assert that the invoke_agent method was called
    bedrock_agent.client.invoke_agent.assert_called_once()

@pytest.mark.asyncio
async def test_process_request_empty_chunk(bedrock_agent):
    mock_response = {
        'completion': [
            {'not_chunk': 'some_data'},
            {'chunk': {'bytes': b'Hello'}},
        ]
    }
    bedrock_agent.client.invoke_agent = Mock(return_value=mock_response)

    result = await bedrock_agent.process_request(
        input_text="Test input",
        user_id="test_user",
        session_id="test_session",
        chat_history=[]
    )

    assert isinstance(result, ConversationMessage)
    assert result.role == ParticipantRole.ASSISTANT.value
    assert result.content == [{"text": "Hello"}]

@pytest.mark.asyncio
async def test_process_request_with_additional_params(bedrock_agent):
    mock_response = {
        'completion': [
            {'chunk': {'bytes': b'Response with additional params'}}
        ]
    }
    bedrock_agent.client.invoke_agent = Mock(return_value=mock_response)

    result = await bedrock_agent.process_request(
        input_text="Test input",
        user_id="test_user",
        session_id="test_session",
        chat_history=[],
        additional_params={"param1": "value1"}
    )

    assert isinstance(result, ConversationMessage)
    assert result.role == ParticipantRole.ASSISTANT.value
    assert result.content == [{"text": "Response with additional params"}]
