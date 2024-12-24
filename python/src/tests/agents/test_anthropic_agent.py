import pytest
from unittest.mock import patch,MagicMock
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.agents import AnthropicAgent, AnthropicAgentOptions
from multi_agent_orchestrator.utils import Logger

logger = Logger()

@pytest.fixture
def mock_anthropic():
    with patch('multi_agent_orchestrator.agents.anthropic_agent.AnthropicAgentOptions.client') as mock:
        yield mock

def test_no_api_key_init(mock_anthropic):
    try:
        options = AnthropicAgentOptions(
            name="TestAgent",
            description="A test agent",
        )

        _anthropic_llm_agent = AnthropicAgent(options)
        assert(_anthropic_llm_agent.api_key is not None)
    except Exception as e:
        assert(str(e) == "Anthropic API key or Anthropic client is required")

def test_custom_system_prompt_with_variable(mock_anthropic):
    options = AnthropicAgentOptions(
        api_key='test-api-key',
        name="TestAgent",
        description="A test agent",
        custom_system_prompt={
            'template': """This is my new prompt with this {{variable}}""",
            'variables': {'variable': 'value'}
        }
    )

    _anthropic_llm_agent = AnthropicAgent(options)
    assert(_anthropic_llm_agent.system_prompt == 'This is my new prompt with this value')

def test_custom_system_prompt_with_wrong_variable(mock_anthropic):
    options = AnthropicAgentOptions(
        api_key='test-api-key',
        name="TestAgent",
        description="A test agent",
        custom_system_prompt={
            'template': """This is my new prompt with this {{variable}}""",
            'variables': {'variableT': 'value'}
        }
    )

    _anthropic_llm_agent = AnthropicAgent(options)
    assert(_anthropic_llm_agent.system_prompt == 'This is my new prompt with this {{variable}}')

@pytest.mark.asyncio
async def test_process_request_single_response():
    # Create a mock Anthropic client
    with patch('anthropic.Anthropic') as MockAnthropic:
        # Setup the mock instance that will be created
        mock_instance = MagicMock()
        mock_instance.messages.create.return_value = MagicMock(content=[MagicMock(text="Test response")])
        MockAnthropic.return_value = mock_instance

        options = AnthropicAgentOptions(
            name="TestAgent",
            description="A test agent",
            api_key='test-api-key',
            model_id="claude-3-sonnet-20240229",
        )

        anthropic_llm_agent = AnthropicAgent(options)
        anthropic_llm_agent.client = mock_instance # mocking client

        response = await anthropic_llm_agent.process_request('Test prompt', 'user', 'session', [], {})

        # Verify the mock was called
        mock_instance.messages.create.assert_called_once_with(
            model="claude-3-sonnet-20240229",
            max_tokens=1000,
            messages=[{"role": "user", "content": "Test prompt"}],
            system=anthropic_llm_agent.system_prompt,
            temperature=0.1,
            top_p=0.9,
            stop_sequences=[]
        )
        assert isinstance(response, ConversationMessage)
        assert response.content[0].get('text') == "Test response"
        assert response.role == ParticipantRole.ASSISTANT.value
