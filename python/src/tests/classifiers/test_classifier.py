import unittest
from unittest.mock import AsyncMock, patch, MagicMock
from multi_agent_orchestrator.types import ConversationMessage, AgentTypes
from multi_agent_orchestrator.agents import Agent
from multi_agent_orchestrator.classifiers import Classifier, ClassifierResult
import re
from typing import List, Dict
import pytest
import asyncio

class MockAgent(Agent):
    def __init__(self, agent_id, description):
        self.id = agent_id
        self.description = description

    async def process_request(
            self,
            input_text: str,
            user_id: str,
            session_id: str,
            chat_history: List[ConversationMessage],
            additional_params: Dict[str, str] = None
        ):
        return ConversationMessage(role="assistant", content="Mock response")

class ConcreteClassifier(Classifier):
    async def process_request(self, input_text, chat_history):
        # For testing, we'll return a mock ClassifierResult
        return ClassifierResult(
            selected_agent=self.get_agent_by_id('agent-test'),
            confidence=0.9
        )

class TestClassifier(unittest.TestCase):
    def setUp(self):
        self.classifier = ConcreteClassifier()

        # Setup mock agents
        self.agents = {
            'agent-test': MockAgent('agent-test', 'Test agent description'),
            'agent-tech': MockAgent('agent-tech', 'Technical support agent'),
            'agent-billing': MockAgent('agent-billing', 'Billing support agent')
        }
        self.classifier.set_agents(self.agents)

    def test_set_agents(self):
        # Test that agents are correctly set and agent descriptions are generated
        expected_descriptions = "\n\n".join([
            "agent-test:Test agent description",
            "agent-tech:Technical support agent",
            "agent-billing:Billing support agent"
        ])
        self.assertEqual(self.classifier.agent_descriptions, expected_descriptions)
        self.assertEqual(len(self.classifier.agents), 3)

    def test_format_messages(self):
        # Test message formatting
        messages = [
            ConversationMessage(role='user', content=[{'text': 'Hello'}]),
            ConversationMessage(role='assistant', content=[{'text': 'Hi there'}])
        ]

        formatted_messages = self.classifier.format_messages(messages)
        self.assertEqual(formatted_messages, "user: Hello\nassistant: Hi there")

    def test_get_agent_by_id(self):
        # Test getting agent by full and partial ID
        agent = self.classifier.get_agent_by_id('agent-test')
        self.assertIsNotNone(agent)
        self.assertEqual(agent.id, 'agent-test')

        # Test case insensitivity and partial matching
        agent = self.classifier.get_agent_by_id('AGENT-TEST Something extra')
        self.assertIsNotNone(agent)
        self.assertEqual(agent.id, 'agent-test')

    def test_get_agent_by_id_not_found(self):
        # Test getting non-existent agent
        agent = self.classifier.get_agent_by_id('non-existent-agent')
        self.assertIsNone(agent)

        self.assertIsNone(self.classifier.get_agent_by_id(None))


    def test_replace_placeholders(self):
        # Test placeholder replacement
        template = "Hello {{NAME}}, welcome to {{COMPANY}}"
        variables = {
            "NAME": "John",
            "COMPANY": "Acme Corp"
        }

        result = self.classifier.replace_placeholders(template, variables)
        self.assertEqual(result, "Hello John, welcome to Acme Corp")

    def test_replace_placeholders_with_list(self):
        # Test placeholder replacement with list values
        template = "Users: {{USERS}}"
        variables = {
            "USERS": ["Alice", "Bob", "Charlie"]
        }

        result = self.classifier.replace_placeholders(template, variables)
        self.assertEqual(result, "Users: Alice\nBob\nCharlie")

    def test_replace_placeholders_missing_key(self):
        # Test placeholder replacement with missing key
        template = "Hello {{NAME}}"
        variables = {}

        result = self.classifier.replace_placeholders(template, variables)
        self.assertEqual(result, "Hello {{NAME}}")

    @pytest.mark.asyncio
    def test_classify(self):
        # Use asyncio.run to properly await the async method
        result = asyncio.run(self._async_test_classify())

        self.assertIsNotNone(result)
        self.assertIsNotNone(result.selected_agent)
        self.assertEqual(result.confidence, 0.9)
        self.assertEqual(result.selected_agent.id, 'agent-test')

    async def _async_test_classify(self):
        # Separate async method to actually perform the test
        chat_history = [
            ConversationMessage(role='user', content=[{'text': 'Initial query'}])
        ]

        return await self.classifier.classify('Test input', chat_history)

    def test_update_system_prompt(self):
        # Test system prompt update with custom variables
        custom_vars = {
            "EXTRA_INFO": "Additional context"
        }
        template = self.classifier.prompt_template = '\n {{EXTRA_INFO}}'
        self.classifier.set_system_prompt(template=template, variables=custom_vars)

        # Check that custom variables are included in system prompt
        self.assertIn("Additional context", self.classifier.system_prompt)
