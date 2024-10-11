import { Agent, AgentOptions } from "./agent";
import {
  ConversationMessage,
  ParticipantRole,
  TemplateVariables,
} from "../types";
import { Retriever } from "../retrievers/retriever";
import { Logger } from "../utils/logger"
import { Anthropic } from "@anthropic-ai/sdk";

export interface AnthropicAgentOptions extends AgentOptions {
  modelId?: string;
  streaming?: boolean;
  toolConfig?: {
    tool: Anthropic.Tool[];
    useToolHandler: (response: any, conversation: any[]) => any ;
    toolMaxRecursions?: number;
  };
  // Optional: Configuration for the inference process
  inferenceConfig?: {
    // Maximum number of tokens to generate in the response
    maxTokens?: number;

    // Controls randomness in output generation
    // Higher values (e.g., 0.8) make output more random, lower values (e.g., 0.2) make it more deterministic
    temperature?: number;

    // Controls diversity of output via nucleus sampling
    // 1.0 considers all tokens, lower values (e.g., 0.9) consider only the most probable tokens
    topP?: number;

    // Array of sequences that will stop the model from generating further tokens when encountered
    stopSequences?: string[];
  };
  retriever?: Retriever;
  customSystemPrompt?: {
    template: string, variables?: TemplateVariables
  };
  }

  type WithApiKey = {
  apiKey: string;
  client?: never;
  };

  type WithClient = {
  client: Anthropic;
  apiKey?: never;
  };

  export type AnthropicAgentOptionsWithAuth = AnthropicAgentOptions & (WithApiKey | WithClient);

  export class AnthropicAgent extends Agent {

  private client: Anthropic;
  protected streaming: boolean;
  private modelId: string;
  protected customSystemPrompt?: string;
  protected inferenceConfig: {
    maxTokens: number;
    temperature: number;
    topP: number;
    stopSequences: string[];
  };

  protected retriever?: Retriever;

  private toolConfig?: {
    tool: Anthropic.Tool[];
    useToolHandler: (response: any, conversation: any[]) => any;
    toolMaxRecursions?: number;
  };

  private promptTemplate: string;
  private systemPrompt: string;
  private customVariables: TemplateVariables;
  private defaultMaxRecursions: number = 20;

  constructor(options: AnthropicAgentOptionsWithAuth) {
    super(options);

    if (!options.apiKey && !options.client) {
      throw new Error("Anthropic API key or Anthropic client is required");
    }
    if (options.client){
      this.client = options.client;
    }
    else {
      if (!options.apiKey) throw new Error("Anthropic API key is required");
      this.client = new Anthropic({ apiKey: options.apiKey});
    }

    this.systemPrompt = '';
    this.customVariables = {};

    this.streaming = options.streaming ?? false;

    this.modelId = options.modelId || "claude-3-5-sonnet-20240620";

    const defaultMaxTokens = 1000; // You can adjust this default value as needed
    this.inferenceConfig = {
      maxTokens: options.inferenceConfig?.maxTokens ?? defaultMaxTokens,
      temperature: options.inferenceConfig?.temperature ?? 0.1,
      topP: options.inferenceConfig?.topP ?? 0.9,
      stopSequences: options.inferenceConfig?.stopSequences ?? [],
    };

    this.retriever = options.retriever;

    this.toolConfig = options.toolConfig;

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
    _additionalParams?: Record<string, string>
  ): Promise<ConversationMessage | AsyncIterable<any>> {

    // Format messages to Anthropic's format
    const messages:Anthropic.MessageParam[] = chatHistory.map(message => ({
      role: message.role === ParticipantRole.USER ? 'user' : 'assistant',
      content: message.content![0]['text'] || '' // Fallback to empty string if content is undefined
    }));
    messages.push({ role: 'user', content: inputText })

    this.updateSystemPrompt();

    let systemPrompt = this.systemPrompt;

    // Update the system prompt with the latest history, agent descriptions, and custom variables
    if (this.retriever) {
      // retrieve from Vector store and combined results as a string into the prompt
      const response = await this.retriever.retrieveAndCombineResults(inputText);
      const contextPrompt =
        "\nHere is the context to use to answer the user's question:\n" +
        response;
        systemPrompt = systemPrompt + contextPrompt;
    }


    try {
      if (this.streaming){
        return this.handleStreamingResponse(messages, systemPrompt);

      } else {
        let finalMessage:string = '';
        let toolUse = false;
        let recursions = this.toolConfig?.toolMaxRecursions || 5;
        do {

          // Call Anthropic
          const response = await this.handleSingleResponse({
            model: this.modelId,
            max_tokens: this.inferenceConfig.maxTokens,
            messages: messages,
            system: systemPrompt,
            temperature: this.inferenceConfig.temperature,
            top_p: this.inferenceConfig.topP,
            tools: this.toolConfig?.tool,
          });

          const toolUseBlocks = response.content.filter<Anthropic.ToolUseBlock>(
            (content) => content.type === "tool_use",
          );

          if (toolUseBlocks.length > 0) {
            // Append current response to the conversation
            messages.push({role:'assistant', content:response.content});
            const toolResponse = await this.toolConfig!.useToolHandler(response, messages);
            messages.push(toolResponse);
            toolUse = true;
          } else {
            const textContent = response.content.find(
              (content): content is Anthropic.TextBlock => content.type === "text"
            );
            finalMessage = textContent?.text || '';
          }

          if (response.stop_reason === 'end_turn'){
            toolUse = false;
          }

          recursions--;
        }while (toolUse && recursions > 0)


        return {role: ParticipantRole.ASSISTANT, content:[{'text':finalMessage}]}
      }
    }
    catch (error) {
      Logger.logger.error("Error processing request:", error);
      // Instead of returning a default result, we'll throw the error
      throw error;
    }
  }

  protected async handleSingleResponse(input: any): Promise<Anthropic.Message> {
    try {
      const response = await this.client.messages.create(input);
      return response as Anthropic.Message;

    } catch (error) {
      Logger.logger.error("Error invoking Anthropic:", error);
      throw error;
    }
  }

  private async *handleStreamingResponse(messages: any[], prompt:any): AsyncIterable<string> {
    const stream = await this.client.messages.stream({
      model: this.modelId,
      max_tokens: this.inferenceConfig.maxTokens,
      messages: messages,
      system: prompt,
      temperature: this.inferenceConfig.temperature,
      top_p: this.inferenceConfig.topP,
      tools: this.toolConfig?.tool,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text;
      }
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