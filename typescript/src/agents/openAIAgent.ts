import { Agent, AgentOptions } from './agent';
import { ConversationMessage, OPENAI_MODEL_ID_GPT_O_MINI, ParticipantRole } from '../types';
import OpenAI from 'openai';
import { Logger } from '../utils/logger';

export interface OpenAIAgentOptions extends AgentOptions {
  apiKey: string;
  model?: string;
  streaming?: boolean;
  inferenceConfig?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };
}

const DEFAULT_MAX_TOKENS = 1000;

export class OpenAIAgent extends Agent {
  private openai: OpenAI;
  private model: string;
  private streaming: boolean;
  private inferenceConfig: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };

  constructor(options: OpenAIAgentOptions) {
    super(options);
    this.openai = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model ?? OPENAI_MODEL_ID_GPT_O_MINI;
    this.streaming = options.streaming ?? false;
    this.inferenceConfig = {
      maxTokens: options.inferenceConfig?.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: options.inferenceConfig?.temperature,
      topP: options.inferenceConfig?.topP,
      stopSequences: options.inferenceConfig?.stopSequences,
    };
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
/* eslint-disable @typescript-eslint/no-unused-vars */  async processRequest(
    inputText: string,
    userId: string,
    sessionId: string,
    chatHistory: ConversationMessage[],
    additionalParams?: Record<string, string>
  ): Promise<ConversationMessage | AsyncIterable<any>> {
    try {
      const messages = [
        ...chatHistory.map(msg => ({
          role: msg.role.toLowerCase() as OpenAI.Chat.ChatCompletionMessageParam['role'],
          content: msg.content[0]?.text || ''
        })),
        { role: 'user' as const, content: inputText }
      ] as OpenAI.Chat.ChatCompletionMessageParam[];

      const { maxTokens, temperature, topP, stopSequences } = this.inferenceConfig;
      const requestOptions: OpenAI.Chat.ChatCompletionCreateParams = {
        model: this.model,
        messages: messages,
        max_tokens: maxTokens,
        stream: this.streaming,
        temperature,
        top_p: topP,
        stop: stopSequences,
      };

      if (this.streaming) {
        return this.handleStreamingResponse(requestOptions);
      } else {
        return this.handleSingleResponse(requestOptions);
      }
    } catch (error) {
      Logger.logger.error('Error in OpenAIAgent.processRequest:', error);
      return this.createErrorResponse("An error occurred while processing your request.", error);
    }
  }

  private async handleSingleResponse(input: any): Promise<ConversationMessage> {
    try {
      const nonStreamingOptions = { ...input, stream: false };
      const chatCompletion = await this.openai.chat.completions.create(nonStreamingOptions);
      if (!chatCompletion.choices || chatCompletion.choices.length === 0) {
        throw new Error('No choices returned from OpenAI API');
      }
      const assistantMessage = chatCompletion.choices[0]?.message?.content;
      if (typeof assistantMessage !== 'string') {
        throw new Error('Unexpected response format from OpenAI API');
      }
      return {
        role: ParticipantRole.ASSISTANT,
        content: [{ text: assistantMessage }],
      };
    } catch (error) {
      Logger.logger.error('Error in OpenAIAgent.handleSingleResponse:', error);
      return this.createErrorResponse("An error occurred while processing your request with the OpenAI API.", error);
    }
  }

  private async *handleStreamingResponse(options: OpenAI.Chat.ChatCompletionCreateParams): AsyncIterable<string> {
    try {
      const stream = await this.openai.chat.completions.create({ ...options, stream: true });
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      Logger.logger.error('Error in OpenAIAgent.handleStreamingResponse:', error);
      yield this.createErrorResponse("An error occurred while streaming the response from the OpenAI API.", error).content[0].text;
    }
  }
}