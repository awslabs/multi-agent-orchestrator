import pytest
from unittest.mock import Mock, patch, MagicMock
from agent_squad.agents.bedrock_flows_agent import BedrockFlowsAgent, BedrockFlowsAgentOptions
from agent_squad.types import ConversationMessage, ParticipantRole


class TestBedrockFlowsAgent:

    def setup_method(self):
        """Set up test fixtures"""
        self.mock_client = Mock()
        self.options = BedrockFlowsAgentOptions(
            name="test-flows-agent",
            description="Test flows agent",
            flowIdentifier="test-flow-id",
            flowAliasIdentifier="test-alias-id",
            region="us-east-1",
            bedrock_agent_client=self.mock_client,
            enableTrace=True
        )

    def test_init_with_provided_client(self):
        """Test initialization with provided client"""
        agent = BedrockFlowsAgent(self.options)

        assert agent.bedrock_agent_client == self.mock_client
        assert agent.flowIdentifier == "test-flow-id"
        assert agent.flowAliasIdentifier == "test-alias-id"
        assert agent.enableTrace is True

    @patch('boto3.client')
    def test_init_without_client(self, mock_boto3_client):
        """Test initialization without provided client"""
        options = BedrockFlowsAgentOptions(
            name="test-flows-agent",
            description="Test flows agent",
            flowIdentifier="test-flow-id",
            flowAliasIdentifier="test-alias-id",
            region="us-west-2"
        )

        mock_client = Mock()
        mock_boto3_client.return_value = mock_client

        agent = BedrockFlowsAgent(options)

        assert agent.bedrock_agent_client == mock_client
        mock_boto3_client.assert_called_once_with(
            'bedrock-agent-runtime',
            region_name='us-west-2'
        )

    @patch.dict('os.environ', {'AWS_REGION': 'eu-west-1'})
    @patch('boto3.client')
    def test_init_with_env_region(self, mock_boto3_client):
        """Test initialization using environment region"""
        options = BedrockFlowsAgentOptions(
            name="test-flows-agent",
            description="Test flows agent",
            flowIdentifier="test-flow-id",
            flowAliasIdentifier="test-alias-id"
        )

        mock_client = Mock()
        mock_boto3_client.return_value = mock_client

        agent = BedrockFlowsAgent(options)

        assert agent.bedrock_agent_client == mock_client
        mock_boto3_client.assert_called_once_with(
            'bedrock-agent-runtime',
            region_name='eu-west-1'
        )

    def test_default_flow_input_encoder(self):
        """Test the default flow input encoder"""
        agent = BedrockFlowsAgent(self.options)

        input_text = "Test input text"
        result = agent._BedrockFlowsAgent__default_flow_input_encoder(input_text)

        expected = [
            {
                'content': {
                    'document': input_text
                },
                'nodeName': 'FlowInputNode',
                'nodeOutputName': 'document'
            }
        ]

        assert result == expected

    def test_default_flow_output_decoder(self):
        """Test the default flow output decoder"""
        agent = BedrockFlowsAgent(self.options)

        response = "Test response from flow"
        result = agent._BedrockFlowsAgent__default_flow_output_decoder(response)

        assert isinstance(result, ConversationMessage)
        assert result.role == ParticipantRole.ASSISTANT.value
        assert result.content == [{'text': str(response)}]

    def test_custom_encoders_decoders(self):
        """Test initialization with custom encoder/decoder functions"""
        def custom_encoder(input_text, **kwargs):
            return {"custom": input_text}

        def custom_decoder(response, **kwargs):
            return ConversationMessage(
                role=ParticipantRole.ASSISTANT.value,
                content=[{'text': f"Custom: {response}"}]
            )

        options = BedrockFlowsAgentOptions(
            name="test-flows-agent",
            description="Test flows agent",
            flowIdentifier="test-flow-id",
            flowAliasIdentifier="test-alias-id",
            bedrock_agent_client=self.mock_client,
            flow_input_encoder=custom_encoder,
            flow_output_decoder=custom_decoder
        )

        agent = BedrockFlowsAgent(options)

        assert agent.flow_input_encoder == custom_encoder
        assert agent.flow_output_decoder == custom_decoder

    @pytest.mark.asyncio
    async def test_process_request_success(self):
        """Test successful request processing"""
        # Mock the response stream
        mock_event_stream = [
            {
                'flowOutputEvent': {
                    'content': {
                        'document': 'Flow response text'
                    }
                }
            }
        ]

        self.mock_client.invoke_flow.return_value = {
            'responseStream': mock_event_stream
        }

        agent = BedrockFlowsAgent(self.options)

        result = await agent.process_request(
            input_text="Test input",
            user_id="user123",
            session_id="session123",
            chat_history=[],
            additional_params={"key": "value"}
        )

        assert isinstance(result, ConversationMessage)
        assert result.role == ParticipantRole.ASSISTANT.value
        assert result.content == [{'text': 'Flow response text'}]

        # Verify the invoke_flow call
        self.mock_client.invoke_flow.assert_called_once()
        call_args = self.mock_client.invoke_flow.call_args
        assert call_args[1]['flowIdentifier'] == "test-flow-id"
        assert call_args[1]['flowAliasIdentifier'] == "test-alias-id"
        assert call_args[1]['enableTrace'] is True

        # Verify the input structure includes the flow input encoder result
        inputs = call_args[1]['inputs']
        assert len(inputs) == 1
        assert inputs[0]['nodeName'] == 'FlowInputNode'
        assert inputs[0]['nodeOutputName'] == 'document'

    @pytest.mark.asyncio
    async def test_process_request_no_response_stream(self):
        """Test handling of missing response stream"""
        self.mock_client.invoke_flow.return_value = {}

        agent = BedrockFlowsAgent(self.options)

        with pytest.raises(ValueError, match="No output received from Bedrock model"):
            await agent.process_request(
                input_text="Test input",
                user_id="user123",
                session_id="session123",
                chat_history=[]
            )

    @pytest.mark.asyncio
    async def test_process_request_empty_event_stream(self):
        """Test handling of empty event stream"""
        self.mock_client.invoke_flow.return_value = {
            'responseStream': []
        }

        agent = BedrockFlowsAgent(self.options)

        result = await agent.process_request(
            input_text="Test input",
            user_id="user123",
            session_id="session123",
            chat_history=[]
        )

        # Should handle None response gracefully
        assert isinstance(result, ConversationMessage)
        assert result.role == ParticipantRole.ASSISTANT.value
        assert result.content == [{'text': 'None'}]

    @pytest.mark.asyncio
    async def test_process_request_multiple_events(self):
        """Test handling of multiple events in stream"""
        mock_event_stream = [
            {
                'someOtherEvent': {
                    'data': 'ignore this'
                }
            },
            {
                'flowOutputEvent': {
                    'content': {
                        'document': 'First response'
                    }
                }
            },
            {
                'flowOutputEvent': {
                    'content': {
                        'document': 'Final response'
                    }
                }
            }
        ]

        self.mock_client.invoke_flow.return_value = {
            'responseStream': mock_event_stream
        }

        agent = BedrockFlowsAgent(self.options)

        result = await agent.process_request(
            input_text="Test input",
            user_id="user123",
            session_id="session123",
            chat_history=[]
        )

        # Should use the final response
        assert isinstance(result, ConversationMessage)
        assert result.content == [{'text': 'Final response'}]

    @pytest.mark.asyncio
    async def test_process_request_boto3_exception(self):
        """Test handling of boto3 exceptions"""
        from botocore.exceptions import ClientError

        self.mock_client.invoke_flow.side_effect = ClientError(
            error_response={'Error': {'Code': 'AccessDenied', 'Message': 'Access denied'}},
            operation_name='InvokeFlow'
        )

        agent = BedrockFlowsAgent(self.options)

        with pytest.raises(ClientError):
            await agent.process_request(
                input_text="Test input",
                user_id="user123",
                session_id="session123",
                chat_history=[]
            )

    @pytest.mark.asyncio
    async def test_process_request_generic_exception(self):
        """Test handling of generic exceptions"""
        self.mock_client.invoke_flow.side_effect = Exception("Generic error")

        agent = BedrockFlowsAgent(self.options)

        with pytest.raises(Exception, match="Generic error"):
            await agent.process_request(
                input_text="Test input",
                user_id="user123",
                session_id="session123",
                chat_history=[]
            )

    @pytest.mark.asyncio
    async def test_process_request_with_trace_disabled(self):
        """Test request processing with trace disabled"""
        options = BedrockFlowsAgentOptions(
            name="test-flows-agent",
            description="Test flows agent",
            flowIdentifier="test-flow-id",
            flowAliasIdentifier="test-alias-id",
            bedrock_agent_client=self.mock_client,
            enableTrace=False
        )

        mock_event_stream = [
            {
                'flowOutputEvent': {
                    'content': {
                        'document': 'Response with trace disabled'
                    }
                }
            }
        ]

        self.mock_client.invoke_flow.return_value = {
            'responseStream': mock_event_stream
        }

        agent = BedrockFlowsAgent(options)

        result = await agent.process_request(
            input_text="Test input",
            user_id="user123",
            session_id="session123",
            chat_history=[]
        )

        assert isinstance(result, ConversationMessage)
        assert result.content == [{'text': 'Response with trace disabled'}]

        # Verify enableTrace was set to False
        call_args = self.mock_client.invoke_flow.call_args
        assert call_args[1]['enableTrace'] is False
