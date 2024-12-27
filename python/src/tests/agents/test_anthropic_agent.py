import pytest
from unittest.mock import patch,MagicMock
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.agents import AnthropicAgent, AnthropicAgentOptions
from multi_agent_orchestrator.utils import Logger
from anthropic import Anthropic, AsyncAnthropic
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

def test_client(mock_anthropic):
    try:
        options = AnthropicAgentOptions(
            name="TestAgent",
            description="A test agent",
            client=Anthropic(),
            streaming=True

        )

        _anthropic_llm_agent = AnthropicAgent(options)
        assert(_anthropic_llm_agent.api_key is not None)
    except Exception as e:
        assert(str(e) == "If streaming is enabled, the provided client must be an AsyncAnthropic client")

    try:
        options = AnthropicAgentOptions(
            name="TestAgent",
            description="A test agent",
            client=AsyncAnthropic(),
            streaming=False

        )

        _anthropic_llm_agent = AnthropicAgent(options)
        assert(_anthropic_llm_agent.api_key is not None)
    except Exception as e:
        assert(str(e) == "If streaming is disabled, the provided client must be an Anthropic client")

    options = AnthropicAgentOptions(
        name="TestAgent",
        description="A test agent",
        client=AsyncAnthropic(),
        streaming=True

    )
    _anthropic_llm_agent = AnthropicAgent(options)


def test_inference_config(mock_anthropic):

    options = AnthropicAgentOptions(
            name="TestAgent",
            description="A test agent",
            client=Anthropic(),
            streaming=False,
            inference_config={
                'temperature': 0.5,
                'topP': 0.5,
                'topK': 0.5,
                'maxTokens': 1000,
            }
        )

    _anthropic_llm_agent = AnthropicAgent(options)
    assert _anthropic_llm_agent.inference_config == {
                'temperature': 0.5,
                'topP': 0.5,
                'topK': 0.5,
                'maxTokens': 1000,
                'stopSequences': []
            }

    options = AnthropicAgentOptions(
            name="TestAgent",
            description="A test agent",
            client=Anthropic(),
            streaming=False,
            inference_config={
                'temperature': 0.5,
                'topK': 0.5,
                'maxTokens': 1000,
            }
        )

    _anthropic_llm_agent = AnthropicAgent(options)
    assert _anthropic_llm_agent.inference_config == {
                'temperature': 0.5,
                'topP': 0.9,
                'topK': 0.5,
                'maxTokens': 1000,
                'stopSequences': []
            }



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
            model='claude-3-sonnet-20240229',
            max_tokens=1000,
            messages=[{'role': 'user', 'content': 'Test prompt'}],
            system="You are a TestAgent.\n        A test agent\n        Provide helpful and accurate information based on your expertise.\n        You will engage in an open-ended conversation,\n        providing helpful and accurate information based on your expertise.\n        The conversation will proceed as follows:\n        - The human may ask an initial question or provide a prompt on any topic.\n        - You will provide a relevant and informative response.\n        - The human may then follow up with additional questions or prompts related to your previous\n        response, allowing for a multi-turn dialogue on that topic.\n        - Or, the human may switch to a completely new and unrelated topic at any point.\n        - You will seamlessly shift your focus to the new topic, providing thoughtful and\n        coherent responses based on your broad knowledge base.\n        Throughout the conversation, you should aim to:\n        - Understand the context and intent behind each new question or prompt.\n        - Provide substantive and well-reasoned responses that directly address the query.\n        - Draw insights and connections from your extensive knowledge when appropriate.\n        - Ask for clarification if any part of the question or prompt is ambiguous.\n        - Maintain a consistent, respectful, and engaging tone tailored\n        to the human's communication style.\n        - Seamlessly transition between topics as the human introduces new subjects.",
            temperature=0.1,
            top_p=0.9,
            stop_sequences=[]
        )
        assert isinstance(response, ConversationMessage)
        assert response.content[0].get('text') == "Test response"
        assert response.role == ParticipantRole.ASSISTANT.value


def test_streaming(mock_anthropic):
    options = AnthropicAgentOptions(
        api_key='test-api-key',
        name="TestAgent",
        description="A test agent",
        custom_system_prompt={
            'template': """This is my new prompt with this {{variable}}""",
            'variables': {'variable': 'value'}
        },
        streaming=True
    )

    _anthropic_llm_agent = AnthropicAgent(options)
    assert(_anthropic_llm_agent.is_streaming_enabled() == True)

    options = AnthropicAgentOptions(
        api_key='test-api-key',
        name="TestAgent",
        description="A test agent",
        custom_system_prompt={
            'template': """This is my new prompt with this {{variable}}""",
            'variables': {'variable': 'value'}
        },
        streaming=False
    )

    _anthropic_llm_agent = AnthropicAgent(options)
    assert(_anthropic_llm_agent.is_streaming_enabled() == False)

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
    assert(_anthropic_llm_agent.is_streaming_enabled() == False)
