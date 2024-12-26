import { Agent, type AgentOptions } from "./agent";;
import { type ConversationMessage, ParticipantRole } from "../types";
import { GenerativeModel, GoogleGenerativeAI } from "@google/generative-ai";
import { Logger } from "../utils/logger";

export interface GoogleAIAgentOptions extends AgentOptions {
  apiKey: string;
  modelId?: string;
  baseUrl?: string;
  streaming?: boolean;
  inferenceConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };
}

const DEFAULT_MAX_OUTPUT_TOKENS = 1000;

export class GoogleAIAgent extends Agent {
  private genAI: GoogleGenerativeAI;
  private modelId: string;
  private client: GenerativeModel;
  private baseUrl: string | undefined;
  private streaming: boolean;
  private inferenceConfig: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };

  constructor(options: GoogleAIAgentOptions) {
    super(options);
    this.genAI = new GoogleGenerativeAI(options.apiKey);
    this.modelId = options.modelId ?? 'gemini-pro';
    this.baseUrl = options.baseUrl;
    this.client = this.genAI.getGenerativeModel({ model: this.modelId }, {baseUrl: this.baseUrl});
    this.streaming = options.streaming ?? false;
    this.inferenceConfig = {
      maxOutputTokens: options.inferenceConfig?.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
      temperature: options.inferenceConfig?.temperature,
      topP: options.inferenceConfig?.topP,
      stopSequences: options.inferenceConfig?.stopSequences,
    };
  }
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async processRequest(
    inputText: string,
    userId: string,
    sessionId: string,
    chatHistory: ConversationMessage[],
    additionalParams?: Record<string, string>
  ): Promise<ConversationMessage | AsyncIterable<any>> {
    const chat = this.client.startChat();

    for (const msg of chatHistory) {
      chat.sendMessage(msg.role.toLowerCase(), msg.content ? msg.content[0]?.text || '' : '');
    }

    const { maxOutputTokens, temperature, topP, stopSequences } = this.inferenceConfig;
    const generationConfig = { maxOutputTokens, temperature, topP, stopSequences };
    if (this.streaming) {
      return this.handleStreamingResponse(chat, inputText, generationConfig);
    } else {
      return this.handleSingleResponse(chat, inputText, generationConfig);
    }
  }

  private async handleSingleResponse(chat: any, inputText: string, generationConfig: any): Promise<ConversationMessage> {
    try {
      const result = await chat.sendMessage(inputText, generationConfig);
      const response = result.response;
      return { role: ParticipantRole.ASSISTANT, content: [{ text: response.text() }] };
    } catch (error) {
      Logger.logger.error('Error in Google Generative AI call:', error);
      throw error;
    }
  }

  private async *handleStreamingResponse(chat: any, inputText: string, generationConfig: any): AsyncIterable<string> {
    const result = await chat.sendMessageStream(inputText, generationConfig);
    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  }
}
