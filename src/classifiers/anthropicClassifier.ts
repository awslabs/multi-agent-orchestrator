import {
    ANTHROPIC_MODEL_ID_CLAUDE_3_5_SONNET,
  ClassifierResult,
  ConversationMessage,
  ParticipantRole,
} from "../types";
import { isToolInput } from "../utils/helpers";
import { Logger } from "../utils/logger";
import { Classifier } from "./classifier";
import { Anthropic } from "@anthropic-ai/sdk";

export interface AnthropicClassifierOptions {
  modelId?: string;
  inferenceConfig?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };
  apiKey: string;
}

export class AnthropicClassifier extends Classifier {
  private client: Anthropic;
  protected inferenceConfig: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };

  private tools: Anthropic.Tool[] = [
    {
      name: 'analyzePrompt',
      description: 'Analyze the user input and provide structured output',
      input_schema: {
        type: 'object',
        properties: {
          userinput: {
            type: 'string',
            description: 'The original user input',
          },
          selected_agent: {
            type: 'string',
            description: 'The name of the selected agent',
          },
          confidence: {
            type: 'number',
            description: 'Confidence level between 0 and 1',
          },
        },
        required: ['userinput', 'selected_agent', 'confidence'],
      },
    },
  ];


  constructor(options: AnthropicClassifierOptions) {
    super();

    if (!options.apiKey) {
      throw new Error("Anthropic API key is required");
    }
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.modelId = options.modelId || ANTHROPIC_MODEL_ID_CLAUDE_3_5_SONNET;
    // Set default value for max_tokens if not provided
    const defaultMaxTokens = 1000; // You can adjust this default value as needed
    this.inferenceConfig = {
      maxTokens: options.inferenceConfig?.maxTokens ?? defaultMaxTokens,
      temperature: options.inferenceConfig?.temperature,
      topP: options.inferenceConfig?.topP,
      stopSequences: options.inferenceConfig?.stopSequences,
    };

}

/* eslint-disable @typescript-eslint/no-unused-vars */
async processRequest(
    inputText: string,
    chatHistory: ConversationMessage[]
  ): Promise<ClassifierResult> {
    const userMessage: Anthropic.MessageParam = {
      role: ParticipantRole.USER,
      content: inputText,
    };

    try {
      const response = await this.client.messages.create({
        model: this.modelId,
        max_tokens: this.inferenceConfig.maxTokens,
        messages: [userMessage],
        system: this.systemPrompt,
        temperature: this.inferenceConfig.temperature,
        top_p: this.inferenceConfig.topP,
        tools: this.tools
      });

      const toolUse = response.content.find(
        (content): content is Anthropic.ToolUseBlock => content.type === "tool_use"
      );

      if (!toolUse) {
        throw new Error("No tool use found in the response");
      }

      if (!isToolInput(toolUse.input)) {
        throw new Error("Tool input does not match expected structure");
      }


      // Create and return IntentClassifierResult
      const intentClassifierResult: ClassifierResult = {
        selectedAgent: this.getAgentById(toolUse.input.selected_agent),
        confidence: parseFloat(toolUse.input.confidence),
      };
      return intentClassifierResult;

    } catch (error) {
      Logger.logger.error("Error processing request:", error);
      // Instead of returning a default result, we'll throw the error
      throw error;
    }
  }


}
