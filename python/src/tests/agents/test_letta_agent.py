import pytest
from unittest.mock import Mock, patch
from multi_agent_orchestrator.types import ConversationMessage
from multi_agent_orchestrator.agents import LettaAgent, LettaAgentOptions
from letta.schemas.letta_response import LettaResponse

@pytest.fixture
def mock_local_client():
    with patch('letta.LocalClient') as mock_client:
        yield mock_client

@pytest.fixture
def letta_agent(mock_local_client):
    options = LettaAgentOptions(
        name='test_agent_name',
        description='test_agent description',
        model_name='letta',
        model_name_embedding='letta'
    )
    return LettaAgent(options)

def test_init(letta_agent, mock_local_client):
    mock_local_client.return_value.get_agent_by_name.side_effect = ValueError()
    mock_local_client.return_value.create_agent.return_value.id = 'test_agent_id'
    
    assert letta_agent.options.name == 'test_agent_name'
    assert letta_agent.options.description == 'test_agent description'