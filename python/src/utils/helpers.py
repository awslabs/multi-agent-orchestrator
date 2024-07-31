from typing import Any, List, Dict, Union
from ..types import ConversationMessage, TimestampedMessage


def is_tool_input(input_obj: Any) -> bool:
    return (
        isinstance(input_obj, dict) and
        'selected_agent' in input_obj and
        'confidence' in input_obj
    )


def conversation_to_dict(
        conversation: Union[
            ConversationMessage,
            TimestampedMessage,
            List[Union[
                ConversationMessage,
                TimestampedMessage]
            ]
        ]) -> Union[Dict[str, Any], List[Dict[str, Any]]]:
    if isinstance(conversation, list):
        return [message_to_dict(msg) for msg in conversation]

    return message_to_dict(conversation)

@staticmethod
def message_to_dict(message: Union[ConversationMessage, TimestampedMessage]) -> Dict[str, Any]:
    result = {
        "role": message.role.value if hasattr(message.role, 'value') else str(message.role),
        "content": message.content
    }

    if isinstance(message, TimestampedMessage):
        result["timestamp"] = message.timestamp

    return result
