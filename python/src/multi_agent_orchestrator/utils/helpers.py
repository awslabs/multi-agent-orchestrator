"""
Helpers method
"""
from typing import Any
from multi_agent_orchestrator.types import ConversationMessage, TimestampedMessage

def is_tool_input(input_obj: Any) -> bool:
    """Check if the input object is a tool input."""
    return (
        isinstance(input_obj, dict)
        and 'selected_agent' in input_obj
        and 'confidence' in input_obj
    )

def conversation_to_dict(
    conversation:
        ConversationMessage |
        TimestampedMessage |
        list[ConversationMessage | TimestampedMessage]
) -> dict[str, Any] | list[dict[str, Any]]:
    """Convert conversation to dictionary format."""
    if isinstance(conversation, list):
        return [message_to_dict(msg) for msg in conversation]
    return message_to_dict(conversation)

def message_to_dict(message: ConversationMessage | TimestampedMessage) -> dict[str, Any]:
    """Convert a single message to dictionary format."""
    result = {
        "role": message.role.value if hasattr(message.role, 'value') else str(message.role),
        "content": message.content
    }
    if isinstance(message, TimestampedMessage):
        result["timestamp"] = message.timestamp
    return result
