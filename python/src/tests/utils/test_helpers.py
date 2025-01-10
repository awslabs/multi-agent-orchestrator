import pytest
from datetime import datetime
from multi_agent_orchestrator.types import ConversationMessage, TimestampedMessage, ParticipantRole
import time

# Import the functions to be tested
from multi_agent_orchestrator.utils import is_tool_input, conversation_to_dict

def test_is_tool_input():
    # Test valid tool input
    valid_input = {"selected_agent": "agent1", "confidence": 0.8}
    assert is_tool_input(valid_input) == True

    # Test invalid inputs
    invalid_inputs = [
        {"selected_agent": "agent1"},  # Missing 'confidence'
        {"confidence": 0.8},  # Missing 'selected_agent'
        "not a dict",  # Not a dictionary
        {},  # Empty dictionary
        {"key1": "value1", "key2": "value2"}  # Dictionary without required keys
    ]
    for invalid_input in invalid_inputs:
        assert is_tool_input(invalid_input) == False

def test_conversation_to_dict():
    # Test with a single ConversationMessage
    conv_msg = ConversationMessage(role=ParticipantRole.USER.value, content="Hello")
    result = conversation_to_dict(conv_msg)
    assert result == {"role": "user", "content": "Hello"}

    # Test with a single TimestampedMessage
    timestamp = datetime.now()
    timestamped_msg = TimestampedMessage(role=ParticipantRole.ASSISTANT.value, content="Hi there", timestamp=timestamp)
    result = conversation_to_dict(timestamped_msg)
    assert result == {"role": "assistant", "content": "Hi there", "timestamp": timestamp}

    # Test with a list of messages
    messages = [
        ConversationMessage(role=ParticipantRole.USER.value, content="How are you?"),
        TimestampedMessage(role=ParticipantRole.ASSISTANT.value, content="I'm fine, thanks!", timestamp=timestamp)
    ]
    result = conversation_to_dict(messages)
    assert result == [
        {"role": "user", "content": "How are you?"},
        {"role": "assistant", "content": "I'm fine, thanks!", "timestamp": timestamp}
    ]

    time_now = int(time.time() * 1000)
    timestamped_message = TimestampedMessage(role=ParticipantRole.ASSISTANT.value, content="I'm fine, thanks!")
    time_after = int(time.time() * 1000)
    assert timestamped_message.timestamp != 0
    assert timestamped_message.timestamp != None
    assert timestamped_message.timestamp >= time_now
    assert timestamped_message.timestamp <= time_after
