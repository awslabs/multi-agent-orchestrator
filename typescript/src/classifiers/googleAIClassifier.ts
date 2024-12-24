import { GenerativeModel, GoogleGenerativeAI, SchemaType, type Tool } from "@google/generative-ai";
import { type ConversationMessage } from "multi-agent-orchestrator";
import { isClassifierToolInput } from "multi-agent-orchestrator";
import { Logger } from "multi-agent-orchestrator";
import { Classifier, type ClassifierResult } from "multi-agent-orchestrator";

const GOOGLE_GENERATIVE_AI_MODEL_ID = 'gemini-pro';

export interface GoogleGenerativeAIClassifierOptions {
  modelId?: string;
  inferenceConfig?: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };
  apiKey: string;
  baseUrl?: string;
}

export class GoogleAIClassifier extends Classifier {
  private genAI: GoogleGenerativeAI;
  private client: GenerativeModel;
  protected inferenceConfig: {
    maxOutputTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };
  private baseUrl: string | undefined;
  private tools: Tool[];

  constructor(options: GoogleGenerativeAIClassifierOptions) {
    super();

    if (!options.apiKey) {
      throw new Error("Google Generative AI API key is required");
    }
    this.genAI = new GoogleGenerativeAI(options.apiKey);
    this.modelId = options.modelId || GOOGLE_GENERATIVE_AI_MODEL_ID;

    const defaultMaxOutputTokens = 1000;
    this.inferenceConfig = {
      maxOutputTokens: options.inferenceConfig?.maxOutputTokens ?? defaultMaxOutputTokens,
      temperature: options.inferenceConfig?.temperature,
      topP: options.inferenceConfig?.topP,
      stopSequences: options.inferenceConfig?.stopSequences,
    };
    this.baseUrl = options.baseUrl;
    this.client = this.genAI.getGenerativeModel({ model: this.modelId }, {baseUrl: this.baseUrl});
    this.tools = [{
      functionDeclarations: [{
        name: 'analyzePrompt',
        description: 'Analyze the user input and provide structured output',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            userinput: { type: SchemaType.STRING },
            selected_agent: { type: SchemaType.STRING },
            confidence: { type: SchemaType.NUMBER },
          },
          required: ['userinput', 'selected_agent', 'confidence'],
        },
      }],
    }];
  }

  async processRequest(
    inputText: string,
    chatHistory: ConversationMessage[]
  ): Promise<ClassifierResult> {
    const chat = this.client.startChat({
      tools: this.tools,
      systemInstruction: {
        role: "system",
        parts: [{text: this.systemPrompt}]
      }
    });

    try {
      const result = await chat.sendMessage(inputText, {
        // maxOutputTokens: this.inferenceConfig.maxOutputTokens,
        // temperature: this.inferenceConfig.temperature,
        // topP: this.inferenceConfig.topP,
        // stopSequences: this.inferenceConfig.stopSequences,
      });

      const toolCall = result.response.functionCalls()?.[0];

      if (!toolCall || toolCall.name !== "analyzePrompt") {
        throw new Error("No valid tool call found in the response");
}

      const toolInput = toolCall.args;

      if (!isClassifierToolInput(toolInput)) {
        throw new Error("Tool input does not match expected structure");
      }

      const intentClassifierResult: ClassifierResult = {
        selectedAgent: this.getAgentById(toolInput.selected_agent),
        confidence: parseFloat(toolInput.confidence),
      };
      return intentClassifierResult;

    } catch (error) {
      Logger.logger.error("Error processing request:", error);
      throw error;
    }
  }
}
