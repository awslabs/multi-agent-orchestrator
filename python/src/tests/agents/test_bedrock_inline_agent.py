import unittest
from unittest.mock import Mock
import json
from typing import Dict, Any

from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
from multi_agent_orchestrator.agents import BedrockInlineAgent, BedrockInlineAgentOptions

class TestBedrockInlineAgent(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # Mock clients
        self.mock_bedrock_client = Mock()
        self.mock_bedrock_agent_client = Mock()

        # Sample action groups and knowledge bases
        self.action_groups = [
            {
                "actionGroupName": "TestActionGroup1",
                "description": "Test action group 1 description"
            },
            {
                "actionGroupName": "TestActionGroup2",
                "description": "Test action group 2 description"
            }
        ]

        self.knowledge_bases = [
            {
                "knowledgeBaseId": "kb1",
                "description": "Test knowledge base 1"
            },
            {
                "knowledgeBaseId": "kb2",
                "description": "Test knowledge base 2"
            }
        ]

        # Create agent instance
        self.agent = BedrockInlineAgent(
            BedrockInlineAgentOptions(
                name="Test Agent",
                description="Test agent description",
                client=self.mock_bedrock_client,
                bedrock_agent_client=self.mock_bedrock_agent_client,
                action_groups_list=self.action_groups,
                knowledge_bases=self.knowledge_bases
            )
        )

    async def test_initialization(self):
        """Test agent initialization and configuration"""
        self.assertEqual(self.agent.name, "Test Agent")
        self.assertEqual(self.agent.description, "Test agent description")
        self.assertEqual(len(self.agent.action_groups_list), 2)
        self.assertEqual(len(self.agent.knowledge_bases), 2)
        self.assertEqual(self.agent.tool_config['toolMaxRecursions'], 1)

    async def test_process_request_without_tool_use(self):
        """Test processing a request that doesn't require tool use"""
        # Mock the converse response
        mock_response = {
            'output': {
                'message': {
                    'role': 'assistant',
                    'content': [{'text': 'Test response'}]
                }
            }
        }
        self.mock_bedrock_client.converse.return_value = mock_response

        # Test input
        input_text = "Hello"
        chat_history = []

        # Process request
        response = await self.agent.process_request(
            input_text=input_text,
            user_id='test_user',
            session_id='test_session',
            chat_history=chat_history
        )

        # Verify response
        self.assertIsInstance(response, ConversationMessage)
        self.assertEqual(response.role, ParticipantRole.ASSISTANT.value)
        self.assertEqual(response.content[0]['text'], 'Test response')

    async def test_process_request_with_tool_use(self):
        """Test processing a request that requires tool use"""
        # Mock the converse response with tool use
        tool_use_response = {
            'output': {
                'message': {
                    'role': 'assistant',
                    'content': [{
                        'toolUse': {
                            'name': 'inline_agent_creation',
                            'input': {
                                'action_group_names': ['TestActionGroup1'],
                                'knowledge_bases': ['kb1'],
                                'description': 'Test description',
                                'user_request': 'Test request'
                            }
                        }
                    }]
                }
            }
        }
        self.mock_bedrock_client.converse.return_value = tool_use_response

        # Mock the inline agent response
        mock_completion = {
            'chunk': {
                'bytes': b'Inline agent response'
            }
        }
        self.mock_bedrock_agent_client.invoke_inline_agent.return_value = {
            'completion': [mock_completion]
        }

        # Test input
        input_text = "Use inline agent"
        chat_history = []

        # Process request
        response = await self.agent.process_request(
            input_text=input_text,
            user_id='test_user',
            session_id='test_session',
            chat_history=chat_history
        )

        # Verify response
        self.assertIsInstance(response, ConversationMessage)
        self.assertEqual(response.role, ParticipantRole.ASSISTANT.value)
        self.assertEqual(response.content[0]['text'], 'Inline agent response')

        # Verify inline agent was called with correct parameters
        self.mock_bedrock_agent_client.invoke_inline_agent.assert_called_once()
        call_kwargs = self.mock_bedrock_agent_client.invoke_inline_agent.call_args[1]
        self.assertEqual(len(call_kwargs['actionGroups']), 1)
        self.assertEqual(len(call_kwargs['knowledgeBases']), 1)
        self.assertEqual(call_kwargs['inputText'], 'Test request')

    async def test_error_handling(self):
        """Test error handling in process_request"""
        # Mock the converse method to raise an exception
        self.mock_bedrock_client.converse.side_effect = Exception("Test error")

        # Test input
        input_text = "Hello"
        chat_history = []

        # Verify exception is raised
        with self.assertRaises(Exception) as context:
            await self.agent.process_request(
                input_text=input_text,
                user_id='test_user',
                session_id='test_session',
                chat_history=chat_history
            )

        self.assertTrue("Test error" in str(context.exception))

    async def test_system_prompt_formatting(self):
        """Test system prompt formatting and template replacement"""
        # Test with custom variables
        test_variables = {
            'test_var': 'test_value'
        }
        self.agent.set_system_prompt(
            template="Test template with {{test_var}}",
            variables=test_variables
        )

        self.assertEqual(self.agent.system_prompt, "Test template with test_value")

    async def test_inline_agent_tool_handler(self):
        """Test the inline agent tool handler"""
        # Mock response content
        response = ConversationMessage(
            role=ParticipantRole.ASSISTANT.value,
            content=[{
                'toolUse': {
                    'name': 'inline_agent_creation',
                    'input': {
                        'action_group_names': ['TestActionGroup1'],
                        'knowledge_bases': ['kb1'],
                        'description': 'Test description',
                        'user_request': 'Test request'
                    }
                }
            }]
        )

        # Mock inline agent response
        mock_completion = {
            'chunk': {
                'bytes': b'Handler test response'
            }
        }
        self.mock_bedrock_agent_client.invoke_inline_agent.return_value = {
            'completion': [mock_completion]
        }

        # Call handler
        result = await self.agent.inline_agent_tool_handler(
            session_id='test_session',
            response=response,
            conversation=[]
        )

        # Verify result
        self.assertIsInstance(result, ConversationMessage)
        self.assertEqual(result.content[0]['text'], 'Handler test response')

    async def test_custom_prompt_template(self):
        """Test custom prompt template setup"""
        custom_template = "Custom template {{test_var}}"
        custom_variables = {"test_var": "test_value"}

        self.agent.set_system_prompt(
            template=custom_template,
            variables=custom_variables
        )

        self.assertEqual(self.agent.prompt_template, custom_template)
        self.assertEqual(self.agent.custom_variables, custom_variables)
        self.assertEqual(self.agent.system_prompt, "Custom template test_value")

if __name__ == '__main__':
    unittest.main()