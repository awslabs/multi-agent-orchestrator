import { ConversationMessage } from "../types";
import { AccumulatorTransform } from "../utils/helpers";


export interface AgentProcessingResult {
  // The original input provided by the user
  userInput: string;

  // Unique identifier for the agent that processed the request
  agentId: string;

  // Human-readable name of the agent
  agentName: string;

  // Unique identifier for the user who initiated the request
  userId: string;

  // Unique identifier for the current session
  sessionId: string;

  // Additional parameters or metadata related to the processing result
  // Can store any key-value pairs of varying types
  additionalParams: Record<string, any>;
}

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

export class AgentCallbacks {
  /**
   * Defines callbacks that can be triggered during agent processing.
   * Provides default implementations that can be overridden by subclasses.
   */

  async onAgentStart(
      _agentName: string,
      _input: any,
      _messages: any[],
      _runId?: string,
      _tags?: string[],
      _metadata?: Record<string, any>,
      ..._kwargs: any[]
  ): Promise<any> {
      /**
       * Callback method that runs when an agent starts processing.
       *
       * This method is called at the beginning of an agent's execution, providing information
       * about the agent session and its context.
       *
       * @param agentName Name of the agent that is starting
       * @param input Object containing the agent's input
       * @param messages Array of message objects representing the conversation history
       * @param runId Unique identifier for this specific agent run
       * @param tags Optional list of string tags associated with this agent run
       * @param metadata Optional dictionary containing additional metadata about the run
       * @param kwargs Additional keyword arguments that might be passed to the callback
       * @returns The return value is implementation-dependent
       */
      // Default implementation does nothing
  }

  async onAgentEnd(
      _agentName: string,
      _response: any,
      _messages: any[],
      _runId?: string,
      _tags?: string[],
      _metadata?: Record<string, any>,
      ..._kwargs: any[]
  ): Promise<any> {
      /**
       * Callback method that runs when an agent completes its processing.
       *
       * This method is called at the end of an agent's execution, providing information
       * about the completed agent session and its response.
       *
       * @param agentName Name of the agent that is completing
       * @param response Object containing the agent's response or output
       * @param messages Array of message objects representing the conversation history
       * @param runId Unique identifier for this specific agent run
       * @param tags Optional list of string tags associated with this agent run
       * @param metadata Optional dictionary containing additional metadata about the run
       * @param kwargs Additional keyword arguments that might be passed to the callback
       * @returns The return value is implementation-dependent
       */
      // Default implementation does nothing
  }

  async onLlmStart(
      _name: string,
      _input: any,
      _runId?: string,
      _tags?: string[],
      _metadata?: Record<string, any>,
      ..._kwargs: any[]
  ): Promise<any> {
      /**
       * Callback method that runs when an llm starts processing.
       *
       * This method is called at the beginning of an llm's execution, providing information
       * about the llm session and its context.
       *
       * @param name Name of the llm that is starting
       * @param input Object containing the llm's input
       * @param runId Unique identifier for this specific llm run
       * @param tags Optional list of string tags associated with this llm run
       * @param metadata Optional dictionary containing additional metadata about the run
       * @param kwargs Additional keyword arguments that might be passed to the callback
       * @returns The return value is implementation-dependent
       */
      // Default implementation does nothing
  }

  async onLlmNewToken(_token: string, ..._kwargs: any[]): Promise<void> {
    /**
     * Called when a new token is generated by the LLM.
     *
     * @param token The new token generated
     * @param kwargs Additional keyword arguments that might be passed to the callback
     */
    // Default implementation does nothing
}

  async onLlmEnd(
      _name: string,
      _output: any,
      _runId?: string,
      _tags?: string[],
      _metadata?: Record<string, any>,
      ..._kwargs: any[]
  ): Promise<any> {
      /**
       * Callback method that runs when an llm stops.
       *
       * This method is called at the end of an llm's execution, providing information
       * about the llm session and its context.
       *
       * @param name Name of the llm that is stopping
       * @param output Object containing the llm's output
       * @param runId Unique identifier for this specific llm run
       * @param tags Optional list of string tags associated with this llm run
       * @param metadata Optional dictionary containing additional metadata about the run
       * @param kwargs Additional keyword arguments that might be passed to the callback
       * @returns The return value is implementation-dependent
       */
      // Default implementation does nothing
  }
}

export interface AgentOptions {
  // The name of the agent
  name: string;

  // A description of the agent's purpose or capabilities
  description: string;

  // Optional: Determines whether to save the chat, defaults to true
  saveChat?: boolean;

  // Optional: Logger instance
  // If provided, the agent will use this logger for logging instead of the default console
  logger?: any | Console;

  // Optional: Flag to enable/disable agent debug trace logging
  // If true, the agent will log additional debug information
  LOG_AGENT_DEBUG_TRACE?: boolean;
}

/**
 * Abstract base class for all agents in the Agent Squad System.
 * This class defines the common structure and behavior for all agents.
 */
export abstract class Agent {
  /** The name of the agent. */
  name: string;

  /** The ID of the agent. */
  id: string;

  /** A description of the agent's capabilities and expertise. */
  description: string;

  /** Whether to save the chat or not. */
  saveChat: boolean;

  // Optional logger instance
  // If provided, the agent will use this logger for logging instead of the default console
  logger: any | Console = console

  // Flag to enable/disable agent debug trace logging
  // If true, the agent will log additional debug information
  LOG_AGENT_DEBUG_TRACE?: boolean;

  /**
   * Constructs a new Agent instance.
   * @param options - Configuration options for the agent.
   */
  constructor(options: AgentOptions) {
    this.name = options.name;
    this.id = this.generateKeyFromName(options.name);
    this.description = options.description;
    this.saveChat = options.saveChat ?? true;  // Default to true if not provided

    this.LOG_AGENT_DEBUG_TRACE = options.LOG_AGENT_DEBUG_TRACE ?? false;
    this.logger = options.logger ?? (this.LOG_AGENT_DEBUG_TRACE ? console : { info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, log: () => {} });

  }

  /**
   * Generates a unique key from a given name string.
   *
   * The key is generated by performing the following operations:
   * 1. Removing all non-alphanumeric characters from the name.
   * 2. Replacing all whitespace characters (spaces, tabs, etc.) with a hyphen (-).
   * 3. Converting the resulting string to lowercase.
   *
   * @param name - The input name string.
   * @returns A unique key derived from the input name.
   */
  private generateKeyFromName(name: string): string {
    // Remove special characters and replace spaces with hyphens
    const key = name
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase();
    return key;
  }

  /**
   * Logs debug information with class name and agent name prefix if debug tracing is enabled.
   * @param message - The message to log
   * @param data - Optional data to include with the log message
   */
  protected logDebug(className: string, message: string, data?: any): void {
    if (this.LOG_AGENT_DEBUG_TRACE && this.logger) {
      const prefix = `> ${className} \n> ${this.name} \n>`;
      if (data) {
        this.logger.info(`${prefix} ${message} \n>`, data);
      } else {
        this.logger.info(`${prefix} ${message} \n>`);
      }
    }
  }

/**
 * Abstract method to process a request.
 * This method must be implemented by all concrete agent classes.
 *
 * @param inputText - The user input as a string.
 * @param chatHistory - An array of Message objects representing the conversation history.
 * @param additionalParams - Optional additional parameters as key-value pairs.
 * @returns A Promise that resolves to a Message object containing the agent's response.
 */
abstract processRequest(
  inputText: string,
  userId: string,
  sessionId: string,
  chatHistory: ConversationMessage[],
  additionalParams?: Record<string, string>
): Promise<ConversationMessage | AsyncIterable<any>>;

}
