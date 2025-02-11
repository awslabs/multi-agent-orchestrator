from enum import Enum
from typing import Union, TypedDict, Optional, Any
from dataclasses import dataclass, field
import time

# Constants
BEDROCK_MODEL_ID_CLAUDE_3_HAIKU = "anthropic.claude-3-haiku-20240307-v1:0"
BEDROCK_MODEL_ID_CLAUDE_3_SONNET = "anthropic.claude-3-sonnet-20240229-v1:0"
BEDROCK_MODEL_ID_CLAUDE_3_5_SONNET = "anthropic.claude-3-5-sonnet-20240620-v1:0"
BEDROCK_MODEL_ID_LLAMA_3_70B = "meta.llama3-70b-instruct-v1:0"
OPENAI_MODEL_ID_GPT_O_MINI = "gpt-4o-mini"
ANTHROPIC_MODEL_ID_CLAUDE_3_5_SONNET = "claude-3-5-sonnet-20240620"

class AgentProviderType(Enum):
    BEDROCK = "BEDROCK"
    ANTHROPIC = "ANTHROPIC"


class AgentTypes(Enum):
    DEFAULT = "Common Knowledge"
    CLASSIFIER = "classifier"

class ToolInput(TypedDict):
    userinput: str
    selected_agent: str
    confidence: str

class RequestMetadata(TypedDict):
    user_input: str
    agent_id: str
    agent_name: str
    user_id: str
    session_id: str
    additional_params :Optional[dict[str, str]]
    error_type: Optional[str]


class ParticipantRole(Enum):
    ASSISTANT = "assistant"
    USER = "user"

class UsageMetrics(TypedDict):
    inputTokens: int
    outputTokens: int
    totalTokens: int

class PerformanceMetrics(TypedDict):
    latencyMs: int

@dataclass
class ConversationMessageMetadata:
    usage: Optional[UsageMetrics] = field(default_factory=dict)
    metrics: Optional[PerformanceMetrics] = field(default_factory=dict)

    def __add__(self, other: 'ConversationMessageMetadata') -> 'ConversationMessageMetadata':
        if not isinstance(other, ConversationMessageMetadata):
            return NotImplemented

        # Add usage metrics if both exist
        new_usage = None
        if self.usage and other.usage:
            new_usage = {
                'inputTokens': self.usage['inputTokens'] + other.usage['inputTokens'],
                'outputTokens': self.usage['outputTokens'] + other.usage['outputTokens'],
                'totalTokens': self.usage['totalTokens'] + other.usage['totalTokens']
            }

        # Add performance metrics if both exist
        new_metrics = None
        if self.metrics and other.metrics:
            new_metrics = {
                'latencyMs': self.metrics['latencyMs'] + other.metrics['latencyMs']
            }

        return ConversationMessageMetadata(
            usage=new_usage,
            metrics=new_metrics
        )


class ConversationMessage:
    role: ParticipantRole
    content: list[Any]
    metadata: Optional[ConversationMessageMetadata]

    def __init__(self,
                 role: ParticipantRole,
                 content: Optional[list[Any]] = None,
                 metadata: Optional[ConversationMessageMetadata] = None
                 ):
        self.role = role
        self.content = content
        if metadata:
            self.metadata = metadata

class TimestampedMessage(ConversationMessage):
    def __init__(self,
                 role: ParticipantRole,
                 content: Optional[list[Any]] = None,
                 timestamp: Optional[int] = None):
        super().__init__(role, content)  # Call the parent constructor
        self.timestamp = timestamp or int(time.time() * 1000)      # Initialize the timestamp attribute (in ms)

TemplateVariables = dict[str, Union[str, list[str]]]

@dataclass
class OrchestratorConfig:
    LOG_AGENT_CHAT: bool = False    # pylint: disable=invalid-name
    LOG_CLASSIFIER_CHAT: bool = False   # pylint: disable=invalid-name
    LOG_CLASSIFIER_RAW_OUTPUT: bool = False # pylint: disable=invalid-name
    LOG_CLASSIFIER_OUTPUT: bool = False # pylint: disable=invalid-name
    LOG_EXECUTION_TIMES: bool = False   # pylint: disable=invalid-name
    MAX_RETRIES: int = 3    # pylint: disable=invalid-name
    USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED: bool = True   # pylint: disable=invalid-name
    CLASSIFICATION_ERROR_MESSAGE: str = None
    NO_SELECTED_AGENT_MESSAGE: str = "I'm sorry, I couldn't determine how to handle your request.\
    Could you please rephrase it?"  # pylint: disable=invalid-name
    GENERAL_ROUTING_ERROR_MSG_MESSAGE: str = None
    MAX_MESSAGE_PAIRS_PER_AGENT: int = 100  # pylint: disable=invalid-name