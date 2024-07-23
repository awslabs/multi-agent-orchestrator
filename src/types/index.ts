import { Agent } from "../agents/agent";
import { Classifier } from "../classifiers/classifier";
import { ChatStorage } from "../storage/chatStorage";
import { AccumulatorTransform } from "../utils/helpers";

export const BEDROCK_MODEL_ID_CLAUDE_3_HAIKU = "anthropic.claude-3-haiku-20240307-v1:0";
export const BEDROCK_MODEL_ID_CLAUDE_3_SONNET = "anthropic.claude-3-sonnet-20240229-v1:0";
export const BEDROCK_MODEL_ID_CLAUDE_3_5_SONNET = "anthropic.claude-3-5-sonnet-20240620-v1:0";
export const BEDROCK_MODEL_ID_LLAMA_3_70B = "meta.llama3-70b-instruct-v1:0";
export const OPENAI_MODEL_ID_GPT_O_MINI = "gpt-4o-mini";

export const ANTHROPIC_MODEL_ID_CLAUDE_3_5_SONNET = "claude-3-5-sonnet-20240620";

export const AgentTypes = {
  DEFAULT: "Common Knowledge",
  CLASSIFIER : "classifier",
} as const;

export type AgentTypes = typeof AgentTypes[keyof typeof AgentTypes];

export interface ClassifierResult {
  selectedAgent: Agent | null;
  confidence: number;
}


export interface ToolInput {
  userinput: string;
  selected_agent: string;
  confidence: string;
}

export interface AgentProcessingResult {
  userInput: string;
  agentId: string;
  agentName: string;
  userId: string;
  sessionId: string;
  additionalParams: Record<string, any>;
}

export interface DispatchInput {
  classifierResult: ClassifierResult;
  userId: string;
  sessionId: string;
}

export interface DispatchToAgentsParams {
  userInput: string;
  userId: string;
  sessionId: string;
  classifierResult: ClassifierResult;
  additionalParams?: Record<string, any>;
}

export interface FinalResult {
  language: string;
  languageConfidence: number;
  extractedData: string[];
  selectionTime: number;
  totalDuration: number;
  intents: Array<{
    intent: string;
    agent: string | null;
    response: string;
    topicContinuity: boolean;
    confidence: number;
    duration: number;
  }>;
}

export interface OrchestratorConfig {
  /** If true, logs the chat interactions with the agent */
  LOG_AGENT_CHAT?: boolean;

  /** If true, logs the chat interactions with the classifier */
  LOG_CLASSIFIER_CHAT?: boolean;

  /** If true, logs the raw, unprocessed output from the classifier */
  LOG_CLASSIFIER_RAW_OUTPUT?: boolean;

  /** If true, logs the processed output from the classifier */
  LOG_CLASSIFIER_OUTPUT?: boolean;

  /** If true, logs the execution times of various operations */
  LOG_EXECUTION_TIMES?: boolean;

  /** The maximum number of retry attempts for the classifier if it receives a bad XML response */
  MAX_RETRIES?: number;

  /**
   * If true, uses the default agent when no agent is identified during intent classification.
   *
   * When set to true:
   * - If no agent is identified, the system will fall back to using a predefined default agent.
   * - This ensures that user requests are still processed, even if a specific agent cannot be determined.
   *
   * When set to false:
   * - If no agent is identified, the system will return an error message to the user.
   * - This prompts the user to rephrase their request for better agent identification.
   *
   * Use this option to balance between always providing a response (potentially less accurate)
   * and ensuring high confidence in agent selection before proceeding.
   */
  USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED?: boolean;

  /**
   * The error message to display when a classification error occurs.
   *
   * This message is shown to the user when there's an internal error during the intent classification process,
   * separate from cases where no agent is identified.
   */
  CLASSIFICATION_ERROR_MESSAGE?: string;

  /**
   * The message to display when no agent is selected to handle the user's request.
   * 
   * This message is shown when the classifier couldn't determine an appropriate agent
   * and USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED is set to false.
   */
  NO_SELECTED_AGENT_MESSAGE?: string;

  /**
   * The general error message to display when an error occurs during request routing.
   * 
   * This message is shown when an unexpected error occurs during the processing of a user's request,
   * such as errors in agent dispatch or processing.
   */
  GENERAL_ROUTING_ERROR_MSG_MESSAGE?: string;

  /**
   * Maximum number of message pairs (user-assistant interactions) to retain per agent.
   *
   * This constant defines the upper limit for the conversation history stored for each agent.
   * Each pair consists of a user message and its corresponding assistant response.
   *
   * Usage:
   * - When saving messages: pass (MAX_MESSAGE_PAIRS_PER_AGENT * 2) as maxHistorySize
   * - When fetching chats: pass (MAX_MESSAGE_PAIRS_PER_AGENT * 2) as maxHistorySize
   *
   * Note: The actual number of messages stored will be twice this value,
   * as each pair consists of two messages (user and assistant).
   *
   * Example:
   * If MAX_MESSAGE_PAIRS_PER_AGENT is 5, up to 10 messages (5 pairs) will be stored per agent.
   */
  MAX_MESSAGE_PAIRS_PER_AGENT?: number;
}

export const DEFAULT_CONFIG: OrchestratorConfig = {
  /** Default: Do not log agent chat interactions */
  LOG_AGENT_CHAT: false,

  /** Default: Do not log classifier chat interactions */
  LOG_CLASSIFIER_CHAT: false,

  /** Default: Do not log raw classifier output */
  LOG_CLASSIFIER_RAW_OUTPUT: false,

  /** Default: Do not log processed classifier output */
  LOG_CLASSIFIER_OUTPUT: false,

  /** Default: Do not log execution times */
  LOG_EXECUTION_TIMES: false,

  /** Default: Retry classifier up to 3 times on bad XML response */
  MAX_RETRIES: 3,

  /** Default: Use the default agent when no agent is identified during intent classification */
  USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED: true,

  /** Default error message for classification errors */
  CLASSIFICATION_ERROR_MESSAGE: "I'm sorry, an error occurred while processing your request. Please try again later.",

  /** Default message when no agent is selected to handle the request */
  NO_SELECTED_AGENT_MESSAGE: "I'm sorry, I couldn't determine how to handle your request. Could you please rephrase it?",

  /** Default general error message for routing errors */
  GENERAL_ROUTING_ERROR_MSG_MESSAGE: "An error occurred while processing your request. Please try again later.",

  /** Default: Maximum of 100 message pairs (200 individual messages) to retain per agent */
  MAX_MESSAGE_PAIRS_PER_AGENT: 100,
};

/**
 * Represents a streaming response that can be asynchronously iterated over.
 * This type is useful for handling responses that come in chunks or streams.
 */
export type StreamingResponse = {
  [Symbol.asyncIterator]: () => AsyncIterator<string, void, unknown>;
};

/**
 * Represents the response from an agent, including metadata and output.
 * @property metadata - Contains all properties of AgentProcessingResult except 'response'.
 * @property output - The actual content of the agent's response, either as a transform or a string.
 * @property streaming - Indicates whether the response is being streamed or not.
 */
export type AgentResponse = {
  metadata: Omit<AgentProcessingResult, 'response'>;
  output: AccumulatorTransform | string;
  streaming: boolean;
};

/**
 * Configuration options for the Orchestrator.
 * @property storage - Optional ChatStorage instance for persisting conversations.
 * @property config - Optional partial configuration for the Orchestrator.
 * @property logger - Optional logging mechanism.
 */
export interface OrchestratorOptions {
  storage?: ChatStorage;
  config?: Partial<OrchestratorConfig>;
  logger?: any;
  classifier?: Classifier;
}

/**
 * Extends the Message type with a timestamp.
 * This is useful for tracking when messages were created or modified.
 */
export type TimestampedMessage = ConversationMessage & { timestamp: number };

export interface TemplateVariables {
  [key: string]: string | string[];
}

/**
 * Represents the possible roles in a conversation.
 */
export enum ParticipantRole {
  ASSISTANT = "assistant",
  USER = "user"
}

/**
 * Represents a single message in a conversation, including its content and the role of the sender.
 */
export interface ConversationMessage {
  role: ParticipantRole;
  content: any[] | undefined;
}

export interface RequestMetadata {
  userInput: string;
  agentId: string;
  agentName: string;
  userId: string;
  sessionId: string;
  additionalParams: Record<string, string>;
  errorType?: 'classification_failed';
}