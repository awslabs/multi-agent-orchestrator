import { Agent, AgentOptions } from "./agent";
import { ConversationMessage, ParticipantRole, BEDROCK_MODEL_ID_CLAUDE_3_HAIKU } from "../types";
import { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand, ContentBlock } from "@aws-sdk/client-bedrock-runtime";
import { Logger } from "../utils/logger";

interface BedrockTranslatorAgentOptions extends AgentOptions {
  sourceLanguage?: string;
  targetLanguage?: string;
  modelId?: string;
  streaming?: boolean;
  inferenceConfig?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };
}

interface ToolInput {
  translation: string;
}

function isToolInput(input: unknown): input is ToolInput {
  return (
    typeof input === 'object' &&
    input !== null &&
    'translation' in input
  );
}

export class BedrockTranslatorAgent extends Agent {
  private sourceLanguage?: string;
  private targetLanguage: string;
  private modelId: string;
  private client: BedrockRuntimeClient;
  private streaming: boolean;
  private inferenceConfig: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };

  private tools = [
    {
      toolSpec: {
        name: "Translate",
        description: "Translate text to target language",
        inputSchema: {
          json: {
            type: "object",
            properties: {
              translation: {
                type: "string",
                description: "The translated text",
              },
            },
            required: ["translation"],
          },
        },
      },
    },
  ];

  constructor(options: BedrockTranslatorAgentOptions) {
    super(options);
    this.sourceLanguage = options.sourceLanguage;
    this.targetLanguage = options.targetLanguage || 'English';
    this.modelId = options.modelId || BEDROCK_MODEL_ID_CLAUDE_3_HAIKU;
    this.client = new BedrockRuntimeClient({ region: options.region });
    this.streaming = options.streaming ?? false;
    this.inferenceConfig = options.inferenceConfig || {};
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
  ): Promise<ConversationMessage | AsyncIterable<any>> {
    try {
      // Check if input is a number
      if (!isNaN(Number(inputText))) {
        return {
          role: ParticipantRole.ASSISTANT,
          content: [{ text: inputText }],
        };
      }

      const userMessage: ConversationMessage = {
        role: ParticipantRole.USER,
        content: [{ text: `<userinput>${inputText}</userinput>` }],
      };

      let systemPrompt = `You are a translator. Translate the text within the <userinput> tags`;
      if (this.sourceLanguage) {
        systemPrompt += ` from ${this.sourceLanguage} to ${this.targetLanguage}`;
      } else {
        systemPrompt += ` to ${this.targetLanguage}`;
      }
      systemPrompt += `. Only provide the translation using the Translate tool.`;

      const converseCmd = {
        modelId: this.modelId,
        messages: [userMessage],
        system: [{ text: systemPrompt }],
        toolConfig: {
          tools: this.tools,
          toolChoice: {
            tool: {
              name: "Translate",
            },
          },
        },
        inferenceConfiguration: {
          maximumTokens: this.inferenceConfig.maxTokens,
          temperature: this.inferenceConfig.temperature,
          topP: this.inferenceConfig.topP,
          stopSequences: this.inferenceConfig.stopSequences,
        },
      };

      if (this.streaming) {
        return this.handleStreamingResponse(converseCmd);
      } else {
        return this.handleSingleResponse(converseCmd);
      }
    } catch (error) {
      Logger.logger.error("Error processing translation request:", error);
      return this.createErrorResponse("An error occurred while processing your translation request.", error);
    }
  }

  private async handleSingleResponse(input: any): Promise<ConversationMessage> {
    const command = new ConverseCommand(input);
    const response = await this.client.send(command);

    if (!response.output) {
      throw new Error("No output received from Bedrock model");
    }
    if (response.output.message.content) {
      const responseContentBlocks = response.output.message.content as ContentBlock[];

      for (const contentBlock of responseContentBlocks) {
        if ("toolUse" in contentBlock) {
          const toolUse = contentBlock.toolUse;
          if (!toolUse) {
            throw new Error("No tool use found in the response");
          }

          if (!isToolInput(toolUse.input)) {
            throw new Error("Tool input does not match expected structure");
          }

          if (typeof toolUse.input.translation !== 'string') {
            throw new Error("Translation is not a string");
          }

          return {
            role: ParticipantRole.ASSISTANT,
            content: [{ text: toolUse.input.translation }],
          };
        }
      }
    }

    throw new Error("No valid tool use found in the response");
  }

  private async *handleStreamingResponse(input: any): AsyncIterable<string> {
    try {
      const command = new ConverseStreamCommand(input);
      const response = await this.client.send(command);
      let translation = "";

      for await (const chunk of response.stream) {
        if (chunk.contentBlockDelta && chunk.contentBlockDelta.delta && chunk.contentBlockDelta.delta.toolUse) {
          const toolUse = chunk.contentBlockDelta.delta.toolUse;
          if (toolUse.input && isToolInput(toolUse.input)) {
            translation = toolUse.input.translation;
            yield translation;
          }
        }
      }

      if (!translation) {
        throw new Error("No valid translation found in the streaming response");
      }
    } catch (error) {
      Logger.logger.error("Error getting stream from Bedrock model:", error);
      yield this.createErrorResponse("An error occurred while streaming the translation from the Bedrock model.", error).content[0].text;
    }
  }

  setSourceLanguage(language: string | undefined): void {
    this.sourceLanguage = language;
  }

  setTargetLanguage(language: string): void {
    this.targetLanguage = language;
  }
}