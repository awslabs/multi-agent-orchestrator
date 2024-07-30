import {
  ConversationMessage,
  ParticipantRole,
  Agent,
  AgentOptions
} from "multi-agent-orchestrator";

/**
 * Extended options for the ApiAgent class.
 */
export interface ApiAgentOptions extends AgentOptions {
  endpoint: string;
  method: string;
  streaming?: boolean;
  headersCallback?: () => Record<string, string>;
  inputPayloadEncoder?: (inputText: string, ...additionalParams: any) => any;
  outputPayloadDecoder?: (response: any) => any;
}

/**
 * ApiAgent class for handling API-based agent interactions.
 */
export class ApiAgent extends Agent {
  private options: ApiAgentOptions;

  constructor(options: ApiAgentOptions) {
    super(options);
    this.options = options;
    this.options.inputPayloadEncoder = options.inputPayloadEncoder ?? this.defaultInputPayloadEncoder;
    this.options.outputPayloadDecoder = options.outputPayloadDecoder ?? this.defaultOutputPayloadDecoder;
  }

  /**
   * Default input payload encoder.
   */
  private defaultInputPayloadEncoder(inputText: string, chatHistory: ConversationMessage[]): any {
    return { input: inputText, history: chatHistory };
  }

  /**
   * Default output payload decoder.
   */
  private defaultOutputPayloadDecoder(response: any): any {
    return response.output;
  }

  /**
   * Fetch data from the API.
   * @param payload - The payload to send to the API.
   * @param streaming - Whether to use streaming or not.
   */
  private async *fetch(payload: any, streaming: boolean = false): AsyncGenerator<any, string | void, unknown> {
    const headers = this.getHeaders();
    const response = await this.sendRequest(payload, headers);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      if (streaming) {
        yield* this.handleStreamingResponse(reader, decoder);
      } else {
        return yield* this.handleNonStreamingResponse(reader, decoder);
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Get headers for the API request.
   */
  private getHeaders(): Record<string, string> {
    const defaultHeaders = {
      'Content-Type': 'application/json',
    };
    return this.options.headersCallback
      ? { ...defaultHeaders, ...this.options.headersCallback() }
      : defaultHeaders;
  }

  /**
   * Send the API request.
   */
  private async sendRequest(payload: any, headers: Record<string, string>): Promise<Response> {
    return fetch(this.options.endpoint, {
      method: this.options.method,
      headers: headers,
      body: JSON.stringify(payload),
    });
  }

  /**
   * Handle streaming response.
   */
  private async *handleStreamingResponse(reader: any, decoder: any): AsyncGenerator<any, void, unknown> {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const message = this.options.outputPayloadDecoder!(chunk);
      yield message;
    }
  }

  /**
   * Handle non-streaming response.
   */
  private async *handleNonStreamingResponse(reader: any, decoder: any): AsyncGenerator<never, string, unknown> {
    let result = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: false });
    }
    return result;
  }

  /**
   * Process the request and return the response.
   */
  async processRequest(
    inputText: string,
    userId: string,
    sessionId: string,
    chatHistory: ConversationMessage[],
    additionalParams?: Record<string, string>
  ): Promise<ConversationMessage | AsyncIterable<any>> {
    const payload = this.options.inputPayloadEncoder!(inputText, chatHistory, userId, sessionId, additionalParams);

    if (this.options.streaming) {
      return this.fetch(payload, true);
    } else {
      const result = await this.fetch(payload, false).next();
      return {
        role: ParticipantRole.ASSISTANT,
        content: [{ text: this.options.outputPayloadDecoder!(result.value) }]
      };
    }
  }
}