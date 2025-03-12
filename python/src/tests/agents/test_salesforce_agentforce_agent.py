import pytest
from unittest.mock import patch, Mock
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.agents.salesforce_agentforce_agent import SalesforceAgentforceAgent, SalesforceAgentforceAgentOptions

@pytest.fixture
def mock_salesforce_agentforce_agent():
    options = SalesforceAgentforceAgentOptions(
        name="Salesforce Agent",
        description="Handles queries related to Salesforce",
        client_id="test_client_id",
        client_secret="test_client_secret",
        domain_url="https://test.salesforce.com",
        agent_id="test_agent_id",
        locale_id="en_US"
    )
    return SalesforceAgentforceAgent(options)

@patch('multi_agent_orchestrator.agents.salesforce_agentforce_agent.requests.post')
def test_get_access_token(mock_post, mock_salesforce_agentforce_agent):
    mock_response = Mock()
    mock_response.json.return_value = {'access_token': 'test_access_token'}
    mock_post.return_value = mock_response

    access_token = mock_salesforce_agentforce_agent.get_access_token()
    assert access_token == 'test_access_token'
    mock_post.assert_called_once_with(
        'https://test.salesforce.com/services/oauth2/token',
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        data={
            'grant_type': 'client_credentials',
            'client_id': 'test_client_id',
            'client_secret': 'test_client_secret'
        }
    )

@patch('multi_agent_orchestrator.agents.salesforce_agentforce_agent.requests.post')
def test_create_session(mock_post, mock_salesforce_agentforce_agent):
    mock_response = Mock()
    mock_response.json.return_value = {'sessionId': 'test_session_id'}
    mock_post.return_value = mock_response

    session_id = mock_salesforce_agentforce_agent.create_session('test_session')
    assert session_id == 'test_session_id'
    mock_post.assert_called_once_with(
        'https://test.salesforce.com/einstein/ai-agent/v1/agents/test_agent_id/sessions',
        headers={
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_access_token'
        },
        json={
            "externalSessionKey": 'test_session',
            "instanceConfig": {
                "endpoint": 'https://test.salesforce.com'
            },
            "streamingCapabilities": {
                "chunkTypes": ["Text"]
            },
            "bypassUser": True
        }
    )

@patch('multi_agent_orchestrator.agents.salesforce_agentforce_agent.requests.post')
def test_send_message(mock_post, mock_salesforce_agentforce_agent):
    mock_response = Mock()
    mock_response.json.return_value = {'messages': [{'message': 'Test response'}]}
    mock_post.return_value = mock_response

    response = mock_salesforce_agentforce_agent.send_message('test_session_id', 'Test message', 1)
    assert response == {'messages': [{'message': 'Test response'}]}
    mock_post.assert_called_once_with(
        'https://test.salesforce.com/einstein/ai-agent/v1/sessions/test_session_id/messages',
        headers={
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test_access_token'
        },
        json={
            "message": {
                "sequenceId": 1,
                "type": "Text",
                "text": 'Test message'
            }
        }
    )

@pytest.mark.asyncio
@patch('multi_agent_orchestrator.agents.salesforce_agentforce_agent.SalesforceAgentforceAgent.create_session')
@patch('multi_agent_orchestrator.agents.salesforce_agentforce_agent.SalesforceAgentforceAgent.send_message')
async def test_process_request(mock_send_message, mock_create_session, mock_salesforce_agentforce_agent):
    mock_create_session.return_value = 'test_salesforce_session_id'
    mock_send_message.return_value = {'messages': [{'message': 'Test response from Salesforce'}]}

    response = await mock_salesforce_agentforce_agent.process_request(
        input_text="Test input",
        user_id="test_user",
        session_id="test_session",
        chat_history=[]
    )

    assert isinstance(response, ConversationMessage)
    assert response.role == ParticipantRole.ASSISTANT.value
    assert response.content == [{"text": "Test response from Salesforce"}]

    mock_create_session.assert_called_once_with('test_session')
    mock_send_message.assert_called_once_with('test_salesforce_session_id', 'Test input', 1)
