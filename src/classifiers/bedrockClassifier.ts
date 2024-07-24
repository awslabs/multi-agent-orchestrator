import {
  BEDROCK_MODEL_ID_CLAUDE_3_5_SONNET,
  ClassifierResult,
  ConversationMessage,
  ParticipantRole,
} from "../types";
import {
  BedrockRuntimeClient,
  ContentBlock,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";

import { Classifier } from "./classifier";
import { isToolInput } from "../utils/helpers";
import { Logger } from "../utils/logger";


export interface BedrockClassifierOptions {
  modelId?: string;
  region?: string;
  inferenceConfig?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };
}

/**
 * IntentClassifier class extends BedrockAgent to provide specialized functionality
 * for classifying user intents, selecting appropriate agents, and generating
 * structured response.
 */
export class BedrockClassifier extends Classifier{
  protected inferenceConfig: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };
  protected client: BedrockRuntimeClient;
  protected region: string;
  protected tools = [
    {
      toolSpec: {
        name: "analyzePrompt",
        description: "Analyze the user input and provide structured output",
        inputSchema: {
          json: {
            type: "object",
            properties: {
              userinput: {
                type: "string",
                description: "The original user input",
              },
              selected_agent: {
                type: "string",
                description: "The name of the selected agent",
              },
              confidence: {
                type: "number",
                description: "Confidence level between 0 and 1",
              },
            },
            required: ["userinput", "selected_agent", "confidence"],
          },
        },
      },
    },
  ];



  /**
   * Constructs a new IntentClassifier instance.
   * @param options - Configuration options for the agent, inherited from AgentOptions.
   */
  constructor(options: Partial<BedrockClassifierOptions> = {}) {
    super();
    
    // Initialize default values or use provided options
    this.region = options.region || process.env.REGION;
    this.client = new BedrockRuntimeClient({region:this.region});
    this.modelId = options.modelId || BEDROCK_MODEL_ID_CLAUDE_3_5_SONNET;
    // Initialize inferenceConfig only if it's provided in options
    this.inferenceConfig = {
      maxTokens: options.inferenceConfig?.maxTokens,
      temperature: options.inferenceConfig?.temperature,
      topP: options.inferenceConfig?.topP,
      stopSequences: options.inferenceConfig?.stopSequences,
    };
  }

  /**
   * Method to process a request.
   * This method must be implemented by all concrete agent classes.
   *
   * @param inputText - The user input as a string.
   * @param chatHistory - An array of Message objects representing the conversation history.
   * @param additionalParams - Optional additional parameters as key-value pairs.
   * @returns A Promise that resolves to a Message object containing the agent's response.
   */
  async processRequest(
    inputText: string,
    chatHistory: ConversationMessage[]
  ): Promise<ClassifierResult> {
    // Construct the user's message based on the provided inputText
    const userMessage: ConversationMessage = {
      role: ParticipantRole.USER,
      content: [{ text: inputText }],
    };

    // Prepare the command to converse with the Bedrock API
    const converseCmd = {
      modelId: this.modelId,
      messages: [userMessage],
      system: [{ text: this.systemPrompt }],
      toolConfig: {
        tools: this.tools,
        toolChoice: {
          tool: {
            name: "analyzePrompt",
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

    try {
      const command = new ConverseCommand(converseCmd);
      const response = await this.client.send(command);

      if (!response.output) {
        throw new Error("No output received from Bedrock model");
      }
      if (response.output.message.content) {
        const responseContentBlocks = response.output.message
          .content as ContentBlock[];

        for (const contentBlock of responseContentBlocks) {
          if ("toolUse" in contentBlock) {
            const toolUse = contentBlock.toolUse;
              if (!toolUse) {
                throw new Error("No tool use found in the response");
              }
        
              if (!isToolInput(toolUse.input)) {
                throw new Error("Tool input does not match expected structure");
              }

              const intentClassifierResult: ClassifierResult = {
                selectedAgent: this.getAgentById(toolUse.input.selected_agent),
                confidence: parseFloat(toolUse.input.confidence),
              };
              return intentClassifierResult;
          }
        }
      }

      throw new Error("No valid tool use found in the response");
    } catch (error) {
      Logger.logger.error("Error processing request:", error);
      // Instead of returning a default result, we'll throw the error
      throw error;
    }
  }


}
