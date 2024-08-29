import {
  BedrockRuntimeClient,
  ConverseCommand,
  ConverseStreamCommand,
  Tool,
} from "@aws-sdk/client-bedrock-runtime";
import { Agent, AgentOptions } from "./agent";
import {
  BEDROCK_MODEL_ID_CLAUDE_3_HAIKU,
  ConversationMessage,
  ParticipantRole,
  TemplateVariables,
} from "../types";
import { Retriever } from "../retrievers/retriever";
import { Logger } from "../utils/logger"

export interface BedrockLLMAgentOptions extends AgentOptions {
  streaming?: boolean;
  inferenceConfig?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };
  guardrailConfig?: {
    guardrailIdentifier: string;
    guardrailVersion: string;
  };
  retriever?: Retriever;
  toolConfig?: {
    tool: Tool[];
    useToolHandler: (response: any, conversation: ConversationMessage[]) => void ;
    toolMaxRecursions?: number;
  };
  customSystemPrompt?: {
    template: string, variables?: TemplateVariables
  };
}

export class BedrockLLMAgent extends Agent {
  protected client: BedrockRuntimeClient;
  protected customSystemPrompt?: string;
  protected streaming: boolean;
  protected inferenceConfig: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    stopSequences?: string[];
  };
  protected modelId?: string;
  protected guardrailConfig?: {
    guardrailIdentifier: string;
    guardrailVersion: string;
  };
  protected retriever?: Retriever;
  private toolConfig?: {
    tool: any[];
    useToolHandler: (response: any, conversation: ConversationMessage[]) => void;
    toolMaxRecursions?: number;
  };
  private promptTemplate: string;
  private systemPrompt: string;
  private customVariables: TemplateVariables;
  private defaultMaxRecursions: number = 20;

  constructor(options: BedrockLLMAgentOptions) {
    super(options);
    this.client = options.region
      ? new BedrockRuntimeClient({ region: options.region })
      : new BedrockRuntimeClient();
    this.modelId = options.modelId ?? BEDROCK_MODEL_ID_CLAUDE_3_HAIKU;
    this.streaming = options.streaming ?? false;
    this.inferenceConfig = options.inferenceConfig ?? {};
    this.guardrailConfig = options.guardrailConfig ?? null;
    this.retriever = options.retriever ?? null;
    this.toolConfig = options.toolConfig ?? null;
    this.promptTemplate = `You are a ${this.name}. ${this.description} Provide helpful and accurate information based on your expertise.
    You will engage in an open-ended conversation, providing helpful and accurate information based on your expertise.
    The conversation will proceed as follows:
    - The human may ask an initial question or provide a prompt on any topic.
    - You will provide a relevant and informative response.
    - The human may then follow up with additional questions or prompts related to your previous response, allowing for a multi-turn dialogue on that topic.
    - Or, the human may switch to a completely new and unrelated topic at any point.
    - You will seamlessly shift your focus to the new topic, providing thoughtful and coherent responses based on your broad knowledge base.
    Throughout the conversation, you should aim to:
    - Understand the context and intent behind each new question or prompt.
    - Provide substantive and well-reasoned responses that directly address the query.
    - Draw insights and connections from your extensive knowledge when appropriate.
    - Ask for clarification if any part of the question or prompt is ambiguous.
    - Maintain a consistent, respectful, and engaging tone tailored to the human's communication style.
    - Seamlessly transition between topics as the human introduces new subjects.`

    if (options.customSystemPrompt) {
      this.setSystemPrompt(
        options.customSystemPrompt.template,
        options.customSystemPrompt.variables
      );
    }
  }

  async processRequest(
    inputText: string,
    userId: string,
    sessionId: string,
    chatHistory: ConversationMessage[],
    additionalParams?: Record<string, string>
  ): Promise<ConversationMessage | AsyncIterable<any>> {
    try {
      const userMessage: ConversationMessage = {
        role: ParticipantRole.USER,
        content: [{ text: `${inputText}` }],
      };

      const conversation: ConversationMessage[] = [
        ...chatHistory,
        userMessage,
      ];

      this.updateSystemPrompt();

      let systemPrompt = this.systemPrompt;

      if (this.retriever) {
        const response = await this.retriever.retrieveAndCombineResults(inputText);
        const contextPrompt =
          "\nHere is the context to use to answer the user's question:\n" +
          response;
          systemPrompt = systemPrompt + contextPrompt;
      }

      const converseCmd = {
        modelId: this.modelId,
        messages: conversation,
        system: [{ text: systemPrompt }], 
        inferenceConfig: {
          maxTokens: this.inferenceConfig.maxTokens,
          temperature: this.inferenceConfig.temperature,
          topP: this.inferenceConfig.topP,
          stopSequences: this.inferenceConfig.stopSequences,
        },
        guardrailConfig: this.guardrailConfig? this.guardrailConfig:undefined,
        toolConfig: (this.toolConfig ? { tools:this.toolConfig.tool}:undefined)
      };

      if (this.toolConfig){
        let continueWithTools = true;
        let finalMessage:ConversationMessage = { role: ParticipantRole.USER, content:[]};
        let maxRecursions = this.toolConfig.toolMaxRecursions || this.defaultMaxRecursions;

        while (continueWithTools && maxRecursions > 0){
          const bedrockResponse = await this.handleSingleResponse(converseCmd);
          conversation.push(bedrockResponse);

          if (bedrockResponse.content.some((content) => 'toolUse' in content)){
            await this.toolConfig.useToolHandler(bedrockResponse, conversation);
          }
          else {
            continueWithTools = false;
            finalMessage = bedrockResponse;
          }
          maxRecursions--;

          converseCmd.messages = conversation;
        }
        return finalMessage;
      }
      else {
        if (this.streaming) {
          return this.handleStreamingResponse(converseCmd);
        } else {
          return this.handleSingleResponse(converseCmd);
        }
      }
    } catch (error) {
      Logger.logger.error("Error in BedrockLLMAgent.processRequest:", error);
      return this.createErrorResponse("An error occurred while processing your request.", error);
    }
  }

  protected async handleSingleResponse(input: any): Promise<ConversationMessage> {
    try {
      const command = new ConverseCommand(input);

      const response = await this.client.send(command);
      if (!response.output) {
        throw new Error("No output received from Bedrock model");
      }
      return response.output.message as ConversationMessage;
    } catch (error) {
      Logger.logger.error("Error invoking Bedrock model:", error);
      return this.createErrorResponse("An error occurred while processing your request with the Bedrock model.", error);
    }
  }

  private async *handleStreamingResponse(input: any): AsyncIterable<string> {
    try {
      const command = new ConverseStreamCommand(input);
      const response = await this.client.send(command);
      for await (const chunk of response.stream) {
        const content = chunk.contentBlockDelta?.delta?.text;
        if (chunk.contentBlockDelta && chunk.contentBlockDelta.delta && chunk.contentBlockDelta.delta.text) {
          yield content;
        }
      }
    } catch (error) {
      Logger.logger.error("Error getting stream from Bedrock model:", error);
      yield this.createErrorResponse("An error occurred while streaming the response from the Bedrock model.", error).content[0].text;
    }
  }

  setSystemPrompt(template?: string, variables?: TemplateVariables): void {
    if (template) {
      this.promptTemplate = template;
    }

    if (variables) {
      this.customVariables = variables;
    }

    this.updateSystemPrompt();
  }

  private updateSystemPrompt(): void {
    const allVariables: TemplateVariables = {
      ...this.customVariables
    };

    this.systemPrompt = this.replaceplaceholders(
      this.promptTemplate,
      allVariables
    );
  }

  private replaceplaceholders(
    template: string,
    variables: TemplateVariables
  ): string {
    return template.replace(/{{(\w+)}}/g, (match, key) => {
      if (key in variables) {
        const value = variables[key];
        if (Array.isArray(value)) {
          return value.join("\n");
        }
        return value;
      }
      return match; // If no replacement found, leave the placeholder as is
    });
  }
}