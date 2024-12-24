"""
Storage implementations for chat history.
"""
from .chat_storage import ChatStorage
from .in_memory_chat_storage import InMemoryChatStorage

_AWS_AVAILABLE = False

try:
    from .dynamodb_chat_storage import DynamoDbChatStorage
    _AWS_AVAILABLE = True
except ImportError:
    _AWS_AVAILABLE = False

__all__ = [
    'ChatStorage',
    'InMemoryChatStorage',
]

if _AWS_AVAILABLE:
    __all__.extend([
        'DynamoDbChatStorage'
    ])