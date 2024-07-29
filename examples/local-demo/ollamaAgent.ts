import {
    Agent,
    AgentOptions,
    ConversationMessage,
    ParticipantRole,
    Logger
  } from "multi-agent-orchestrator";
  import ollama from 'ollama'
  
  export interface OllamaAgentOptions extends AgentOptions {
    streaming?: boolean;
    // Add other Ollama-specific options here (e.g., temperature, top_k, top_p)
  }
  
  export class OllamaAgent extends Agent {
    private options: OllamaAgentOptions;
  
    constructor(options: OllamaAgentOptions) {
      super(options);
      this.options = {
        name: options.name,
        description: options.description,
        modelId: options.modelId ?? "llama2",
        streaming: options.streaming ?? false
      };
    }
  
    private async *handleStreamingResponse(messages: any[]): AsyncIterable<string> {
      try {
        const response = await ollama.chat({
          model: this.options.modelId ?? "llama2",
          messages: messages,
          stream: true,
        });
  
        for await (const part of response) {
          yield part.message.content;
        }
      } catch (error) {
        Logger.logger.error("Error getting stream from Ollama model:", error);
        throw error;
      }
    }
  
    async processRequest(
      inputText: string,
      userId: string,
      sessionId: string,
      chatHistory: ConversationMessage[],
      additionalParams?: Record<string, string>
    ): Promise<ConversationMessage | AsyncIterable<any>> {
      const messages = chatHistory.map(item => ({
        role: item.role,
        content: item.content![0].text
      }));
      messages.push({role: ParticipantRole.USER, content: inputText});
  
      if (this.options.streaming) {
        return this.handleStreamingResponse(messages);
      } else {
        const response = await ollama.chat({
          model: this.options.modelId!,
          messages: messages,
        });
        const message: ConversationMessage = {
          role: ParticipantRole.ASSISTANT, 
          content: [{text: response.message.content}]
        };
        return message;
      }
    }
  }