import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { ConversationMessage, ParticipantRole } from "../types";
import { Agent, AgentOptions } from "./agent";
import { Logger } from "../utils/logger";

/**
 * Options for configuring an Amazon Bedrock agent.
 * Extends base AgentOptions with specific parameters required for Amazon Bedrock.
 */
export interface AmazonBedrockAgentOptions extends AgentOptions {
  agentId: string;        // The ID of the Amazon Bedrock agent.
  agentAliasId: string;   // The alias ID of the Amazon Bedrock agent.
  client?: BedrockAgentRuntimeClient;  // Client for interacting with the Bedrock agent runtime.
}


/**
 * Represents an Amazon Bedrock agent that interacts with a runtime client.
 * Extends base Agent class and implements specific methods for Amazon Bedrock.
 */
export class AmazonBedrockAgent extends Agent {
  private agentId: string;                    // The ID of the Amazon Bedrock agent.
  private agentAliasId: string;               // The alias ID of the Amazon Bedrock agent.
  private client: BedrockAgentRuntimeClient;  // Client for interacting with the Bedrock agent runtime.

  /**
   * Constructs an instance of AmazonBedrockAgent with the specified options.
   * Initializes the agent ID, agent alias ID, and creates a new Bedrock agent runtime client.
   * @param options - Options to configure the Amazon Bedrock agent.
   */
  constructor(options: AmazonBedrockAgentOptions) {
    super(options);
    this.agentId = options.agentId;
    this.agentAliasId = options.agentAliasId;
    this.client = options.client ? options.client : options.region
    ? new BedrockAgentRuntimeClient({ region: options.region })
    : new BedrockAgentRuntimeClient();
  }

  /**
   * Processes a user request by sending it to the Amazon Bedrock agent for processing.
   * @param inputText - The user input as a string.
   * @param userId - The ID of the user sending the request.
   * @param sessionId - The ID of the session associated with the conversation.
   * @param chatHistory - An array of Message objects representing the conversation history.
   * @param additionalParams - Optional additional parameters as key-value pairs.
   * @returns A Promise that resolves to a Message object containing the agent's response.
   */
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async processRequest(
    inputText: string,
    userId: string,
    sessionId: string,
    chatHistory: ConversationMessage[],
    additionalParams?: Record<string, string>
  ): Promise<ConversationMessage> {
    // Construct the command to invoke the Amazon Bedrock agent with user input
    const command = new InvokeAgentCommand({
      agentId: this.agentId,
      agentAliasId: this.agentAliasId,
      sessionId,
      inputText
    });

    try {
      let completion = "";
      const response = await this.client.send(command);

      // Process the response from the Amazon Bedrock agent
      if (response.completion === undefined) {
        throw new Error("Completion is undefined");
      }

      // Aggregate chunks of response data
      for await (const chunkEvent of response.completion) {
        if (chunkEvent.chunk) {
          const chunk = chunkEvent.chunk;
          const decodedResponse = new TextDecoder("utf-8").decode(chunk.bytes);
          completion += decodedResponse;
        } else {
          Logger.logger.warn("Received a chunk event with no chunk data");
        }
      }

      // Return the completed response as a Message object
      return {
        role: ParticipantRole.ASSISTANT,
        content: [{ text: completion }],
      };
    } catch (err) {
      // Handle errors encountered while invoking the Amazon Bedrock agent
      Logger.logger.error(err);
      throw err;
    }
  }
}

