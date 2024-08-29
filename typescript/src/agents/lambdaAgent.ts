import { ConversationMessage, ParticipantRole } from "../types";
import { Agent, AgentOptions } from "./agent";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { Logger } from "../utils/logger";

export interface LambdaAgentOptions extends AgentOptions {
  functionName: string;
  functionRegion: string;
  inputPayloadEncoder?: (inputText: string, ...additionalParams: any) => any;
  outputPayloadDecoder?: (response: any) => ConversationMessage;
}

export class LambdaAgent extends Agent {
  private options: LambdaAgentOptions;
  private lambdaClient: LambdaClient;

  constructor(options: LambdaAgentOptions) {
    super(options);
    this.options = options;
    this.lambdaClient = new LambdaClient({region:this.options.functionRegion});
  }

  private defaultInputPayloadEncoder(inputText: string, chatHistory: ConversationMessage[], userId: string, sessionId:string, additionalParams?: Record<string, string>):string {
    return JSON.stringify({
      query: inputText,
      chatHistory: chatHistory,
      additionalParams: additionalParams,
      userId: userId,
      sessionId: sessionId,
    });
  }

  private defaultOutputPayloaderDecoder(response: any): ConversationMessage {
    const decodedResponse = JSON.parse(JSON.parse(new TextDecoder("utf-8").decode(response.Payload)).body).response;
    const message: ConversationMessage = {
      role: ParticipantRole.ASSISTANT,
      content: [{ text: `${decodedResponse}` }]
    };
    return message;
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
      const payload = this.options.inputPayloadEncoder
        ? this.options.inputPayloadEncoder(inputText, chatHistory, userId, sessionId, additionalParams)
        : this.defaultInputPayloadEncoder(inputText, chatHistory, userId, sessionId, additionalParams);

      const invokeParams = {
        FunctionName: this.options.functionName,
        Payload: payload,
      };

      const response = await this.lambdaClient.send(new InvokeCommand(invokeParams));

      if (response.FunctionError) {
        throw new Error(`Lambda function returned an error: ${response.FunctionError}`);
      }

      const message = this.options.outputPayloadDecoder
        ? this.options.outputPayloadDecoder(response)
        : this.defaultOutputPayloaderDecoder(response);

      return message;
    } catch (error) {
      Logger.logger.error(`Error in LambdaAgent.processRequest for function ${this.options.functionName}:`, error);
      return this.createErrorResponse("An error occurred while processing your request with the Lambda function.", error);
    }
  }
}