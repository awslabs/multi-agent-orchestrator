import io
import pytest
import json
from unittest.mock import Mock, patch
from botocore.response import StreamingBody
from multi_agent_orchestrator.agents import AgentOptions
from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.agents import LambdaAgent, LambdaAgentOptions

def custom_payload_decoder(payload):
    return ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{'text': 'Hello from custom payload decoder'}]
        )

@pytest.fixture
def lambda_agent_options():
    return LambdaAgentOptions(
        name="test_agent",
        description="Test Agent",
        function_name="test_function",
        function_region="us-west-2"
    )

@pytest.fixture
def mock_boto3_client():
    with patch('boto3.client') as mock_client:
        yield mock_client

@pytest.fixture
def lambda_agent(lambda_agent_options, mock_boto3_client):
    return LambdaAgent(lambda_agent_options)

def test_init(lambda_agent, lambda_agent_options, mock_boto3_client):
    mock_boto3_client.assert_called_once_with('lambda', region_name="us-west-2")
    assert lambda_agent.options == lambda_agent_options
    assert callable(lambda_agent.encoder)
    assert callable(lambda_agent.decoder)

def test_default_input_payload_encoder(lambda_agent):

    input_text = "Hello, world!"
    chat_history = [
        ConversationMessage(role=ParticipantRole.USER.value, content=[{"text": "Hi"}]),
        ConversationMessage(role=ParticipantRole.ASSISTANT.value, content=[{"text": "Hello!"}])
    ]
    user_id = "user123"
    session_id = "session456"
    additional_params = {"param1": "value1"}

    encoded_payload = lambda_agent.encoder(input_text, chat_history, user_id, session_id, additional_params)
    decoded_payload = json.loads(encoded_payload)

    assert decoded_payload["query"] == input_text
    assert len(decoded_payload["chatHistory"]) == 2
    assert decoded_payload["additionalParams"] == additional_params
    assert decoded_payload["userId"] == user_id
    assert decoded_payload["sessionId"] == session_id

def test_default_output_payload_decoder(lambda_agent):
    mock_response = {
        "Payload": Mock(read=lambda: json.dumps({
            "body": json.dumps({
                "response": "Hello, I'm an AI assistant!"
            })
        }).encode("utf-8"))
    }

    decoded_message = lambda_agent.decoder(mock_response)

    assert isinstance(decoded_message, ConversationMessage)
    assert decoded_message.role == ParticipantRole.ASSISTANT.value
    assert decoded_message.content == [{"text": "Hello, I'm an AI assistant!"}]

@pytest.mark.asyncio
async def test_process_request(mock_boto3_client):
    lambda_agent = LambdaAgent(options=LambdaAgentOptions(
        name="test_agent",
        description="Test Agent",
        function_name="test_function",
        function_region="us-west-2",
        output_payload_decoder=custom_payload_decoder
    ))
    mock_lambda_client = Mock()
    mock_boto3_client.return_value = mock_lambda_client

    # Create a mock response that matches the actual Lambda invoke response
    mock_response = {
        "Payload": Mock(read=lambda: json.dumps({
            "body": json.dumps({
                "response": "Hello, I'm an AI assistant!"
            })
        }).encode("utf-8"))
    }

    mock_lambda_client.invoke.return_value = mock_response

    input_text = "Process this"
    user_id = "user123"
    session_id = "session456"
    chat_history = []
    additional_params = {"param1": "value1"}

    result = await lambda_agent.process_request(input_text, user_id, session_id, chat_history, additional_params)

    assert isinstance(result, ConversationMessage)
    assert result.role == ParticipantRole.ASSISTANT.value
    assert result.content == [{"text": "Hello from custom payload decoder"}]



def test_custom_encoder_decoder(lambda_agent_options, mock_boto3_client):
    def custom_encoder(*args):
        return json.dumps({"custom": "encoder"})

    def custom_decoder(response):
        return ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{"text": "Custom decoder"}]
        )

    custom_options = LambdaAgentOptions(
        name="test_agent",
        description="Test Agent",
        function_name="test_function",
        function_region="us-west-2",
        input_payload_encoder=custom_encoder,
        output_payload_decoder=custom_decoder
    )

    custom_agent = LambdaAgent(custom_options)

    assert custom_agent.encoder == custom_encoder
    assert custom_agent.decoder == custom_decoder

    encoded = custom_agent.encoder("input", [], "user", "session")
    assert json.loads(encoded) == {"custom": "encoder"}

    decoded = custom_agent.decoder({})
    assert decoded.role == ParticipantRole.ASSISTANT.value
    assert decoded.content == [{"text": "Custom decoder"}]