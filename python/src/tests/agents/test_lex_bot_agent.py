import pytest
from unittest.mock import Mock, patch
from botocore.exceptions import BotoCoreError, ClientError

from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.agents import LexBotAgent, LexBotAgentOptions

@pytest.fixture
def lex_bot_options():
    return LexBotAgentOptions(
        name="test_name",
        description="test_description",
        bot_id="test_bot_id",
        bot_alias_id="test_alias_id",
        locale_id="test_locale_id",
        region="us-west-2"
    )

@pytest.fixture
def mock_lex_client():
    with patch('boto3.client') as mock_client:
        yield mock_client.return_value

@pytest.fixture
def lex_bot_agent(lex_bot_options, mock_lex_client):
    return LexBotAgent(lex_bot_options)

def test_lex_bot_agent_initialization(lex_bot_options, lex_bot_agent):
    agent = LexBotAgent(lex_bot_options)
    assert agent.bot_id == lex_bot_options.bot_id
    assert agent.bot_alias_id == lex_bot_options.bot_alias_id
    assert agent.locale_id == lex_bot_options.locale_id

def test_lex_bot_agent_initialization_missing_params(lex_bot_agent):
    with pytest.raises(ValueError):
        LexBotAgent(
            LexBotAgentOptions(
            name="test_name",
            description="test_description"
        ))

@pytest.mark.asyncio
async def test_process_request_success(lex_bot_agent, mock_lex_client):
    mock_lex_client.recognize_text.return_value = {
        "messages": [{"content": "Hello"}, {"content": "How can I help?"}]
    }

    result = await lex_bot_agent.process_request(
        "Hi", "user123", "session456", []
    )

    assert isinstance(result, ConversationMessage)
    assert result.role == ParticipantRole.ASSISTANT.value
    assert result.content == [{"text": "Hello How can I help?"}]

    mock_lex_client.recognize_text.assert_called_once_with(
        botId="test_bot_id",
        botAliasId="test_alias_id",
        localeId="test_locale_id",
        sessionId="session456",
        text="Hi",
        sessionState={}
    )

@pytest.mark.asyncio
async def test_process_request_no_response(lex_bot_agent, mock_lex_client):
    mock_lex_client.recognize_text.return_value = {"messages": []}

    result = await lex_bot_agent.process_request(
        "Hi", "user123", "session456", []
    )

    assert isinstance(result, ConversationMessage)
    assert result.role == ParticipantRole.ASSISTANT.value
    assert result.content == [{"text": "No response from Lex bot."}]

@pytest.mark.asyncio
async def test_process_request_error(lex_bot_agent, mock_lex_client):
    mock_lex_client.recognize_text.side_effect = BotoCoreError()

    with pytest.raises(BotoCoreError):
        await lex_bot_agent.process_request(
            "Hi", "user123", "session456", []
        )

@pytest.mark.asyncio
async def test_process_request_client_error(lex_bot_agent, mock_lex_client):
    mock_lex_client.recognize_text.side_effect = ClientError(
        {"Error": {"Code": "TestException", "Message": "Test error message"}},
        "recognize_text"
    )

    with pytest.raises(ClientError):
        await lex_bot_agent.process_request(
            "Hi", "user123", "session456", []
        )