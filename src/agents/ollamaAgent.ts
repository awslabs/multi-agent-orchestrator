import {  ConversationMessage, ParticipantRole } from "../types";
import { Agent, AgentOptions } from "./agent";
import { Logger } from "../utils/logger";
import ollama from 'ollama'

export interface OllamaAgentOptions extends AgentOptions {
    streaming?: boolean;
}

export class OllamaAgent extends Agent {
    private options: OllamaAgentOptions;

    constructor(options: OllamaAgentOptions) {
        super(options);
        this.options = options;
    }

    private async *handleStreamingResponse(messages: any[]): AsyncIterable<string> {
        try {
            const response = await ollama.chat({
                model: this.options.modelId,
                messages: messages,
                stream: true,
              });
              for await (const part of response) {
                yield part.message.content;
              }
        } catch (error) {
          Logger.logger.error("Error getting stream from Bedrock model:", error);
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

        const messages = chatHistory.map(item =>({
              role: item.role,
              content: item.content[0].text
            }
         ));
        messages.push({role: ParticipantRole.USER, content: inputText});
        if (this.options.streaming){
            return this.handleStreamingResponse(messages);
        } else {
            const response = await ollama.chat({
                model: this.options.modelId,
                messages: messages,
              });
              console.log(JSON.stringify(response.message.content));
            const message:ConversationMessage = {role: ParticipantRole.ASSISTANT, content:[{text:response.message.content}]};
            return message;
        }
      }
}
