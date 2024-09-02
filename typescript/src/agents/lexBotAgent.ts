import { Agent, AgentOptions } from "./agent";
import { ConversationMessage, ParticipantRole } from "../types";
import {
  LexRuntimeV2Client,
  RecognizeTextCommand,
  RecognizeTextCommandOutput,
} from "@aws-sdk/client-lex-runtime-v2";
import { Logger } from "../utils/logger";

/**
 * Options for configuring an Amazon Lex Bot agent.
 * Extends base AgentOptions with specific parameters required for Amazon Lex.
 */
export interface LexBotAgentOptions extends AgentOptions {
  botId: string; // The ID of the Lex Bot
  botAliasId: string; // The alias ID of the Lex Bot
  localeId: string; // The locale of the bot (e.g., en_US)
}

/**
 * LexBotAgent class for interacting with Amazon Lex Bot.
 * Extends the base Agent class.
 */
export class LexBotAgent extends Agent {
  private readonly lexClient: LexRuntimeV2Client;
  private readonly botId: string;
  private readonly botAliasId: string;
  private readonly localeId: string;

  /**
   * Constructor for LexBotAgent.
   * @param options - Configuration options for the Lex Bot agent
   */
  constructor(options: LexBotAgentOptions) {
    super(options);
    this.lexClient = new LexRuntimeV2Client({ region: options.region });
    this.botId = options.botId;
    this.botAliasId = options.botAliasId;
    this.localeId = options.localeId;
    // Validate required fields
    if (!this.botId || !this.botAliasId || !this.localeId) {
      throw new Error("botId, botAliasId, and localeId are required for LexBotAgent");
    }
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
    try {
      // Prepare the parameters for the Lex Bot request
      const params = {
        botId: this.botId,
        botAliasId: this.botAliasId,
        localeId: this.localeId,
        sessionId: sessionId,
        text: inputText,
        sessionState: {
          // You might want to maintain session state if needed
        },
      };

      // Create and send the command to the Lex Bot
      const command = new RecognizeTextCommand(params);
      const response: RecognizeTextCommandOutput = await this.lexClient.send(command);

      // Process the messages returned by Lex
      let concatenatedContent = '';
      if (response.messages && response.messages.length > 0) {
        concatenatedContent = response.messages
          .map(message => message.content)
          .filter(Boolean)
          .join(' ');
      }

      // Construct and return the Message object
      return {
        role: ParticipantRole.ASSISTANT,
        content: [{ text: concatenatedContent || "No response from Lex bot." }],
      };
    } catch (error) {
      // Log the error and return an error response
      Logger.logger.error("Error processing request in LexBotAgent:", error);
      return this.createErrorResponse("An error occurred while processing your request with the Lex bot.", error);
    }
  }
}