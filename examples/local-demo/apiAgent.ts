import { 
  ConversationMessage, 
  ParticipantRole,
  Agent,
  AgentOptions 
} from "multi-agent-orchestrator";


export interface ApiAgentOptions extends AgentOptions {
    endpoint: string;
    method: string;
    streaming?: boolean;
    headersCallback?: () => Record<string, string>
    inputPayloadEncoder?: (inputText: string, ...additionalParams: any) => any; 
    outputPayloadDecoder?: (response: any) => any;
}

export class ApiAgent extends Agent {

    private options: ApiAgentOptions;

    constructor(options: ApiAgentOptions) {
        super(options);
        this.options = options;
        this.options.inputPayloadEncoder = options.inputPayloadEncoder ?? this.defaultInputPayloadEncoder;
        this.options.outputPayloadDecoder = options.outputPayloadDecoder ?? this.defaultOutputPayloadDecoder;
    }

    private defaultInputPayloadEncoder(inputText: string, chatHistory: ConversationMessage[]) {
      return { input: inputText, history: chatHistory };
    }

    private defaultOutputPayloadDecoder(response: any) {
      return response.output
    }

    private async *fetch(payload: any, streaming: boolean = false): AsyncGenerator<any, string | void, unknown> {
        const defaultHeaders = {
          'Content-Type': 'application/json',
        };
        
        // Merge default headers with callback headers if provided
        const headers = this.options.headersCallback 
          ? { ...defaultHeaders, ...this.options.headersCallback() } 
          : defaultHeaders;
      
        const response = await fetch(this.options.endpoint, {
          method: this.options.method,
          headers: headers,
          body: JSON.stringify(payload),
        });
      
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      
        if (!response.body) {
          throw new Error('Response body is null');
        }
      
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
      
        if (streaming) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              const chunk = decoder.decode(value, { stream: true });
              const message = this.options.outputPayloadDecoder!(chunk);
              yield message;
            }
          } finally {
            reader.releaseLock();
          }
        } else {
          try {
            let result = '';
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }
              result += decoder.decode(value, { stream: false });
            }
            return result;
          } finally {
            reader.releaseLock();
          }
        }
      }

    async processRequest(
        inputText: string,
        userId: string,
        sessionId: string,
        chatHistory: ConversationMessage[],
        additionalParams?: Record<string, string>
      ): Promise<ConversationMessage | AsyncIterable<any>> {

        if (this.options.streaming) {
            return this.fetch(this.options.inputPayloadEncoder!(inputText, chatHistory), true);
        } 
        else 
        {
            const result = await this.fetch(this.options.inputPayloadEncoder!(inputText, chatHistory, userId, sessionId, additionalParams), false).next();
            return Promise.resolve({ role: ParticipantRole.ASSISTANT, content: [{ text: this.options.outputPayloadDecoder!(result.value)}] });
        }
      }
}