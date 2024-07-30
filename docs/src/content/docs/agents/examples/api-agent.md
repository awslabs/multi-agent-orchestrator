---
title: Api Agent
description: A guide to creating an API agent and integrate it into the Multi-Agent Orchestrator System.
---

This example will walk you through creating an Api agent and integrating it into your Multi-Agent Orchestrator System. 
Let's dive in!

## 📚Prerequisites:
- Basic knowledge of TypeScript
- Familiarity with the Multi-Agent Orchestrator System


## 🧬 1. Create the Api Agent class:
Let's create our `ApiAgent` class. This class extends the `Agent` abstract class from the Multi-Agent Orchestrator.
The [processRequest](../overview#abstract-method-processrequest) method must be implemented by the `ApiAgent`

```typescript
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
```

This ApiAgent class provides flexibility for users to customize how input is encoded before sending to the API, how output is decoded after receiving from the API, and how headers are generated. This is done through three optional callbacks in the ApiAgentOptions interface:

- inputPayloadEncoder
- outputPayloadDecoder
- headersCallback

Let's break these down:

**1. inputPayloadEncoder:**
This function allows users to customize how the input is formatted before sending it to the API.

- Default behavior: If not provided, it uses the defaultInputPayloadEncoder, which creates a payload with `input` and `history` fields.
- Custom behavior: Users can provide their own function to format the input however their API expects it. This function receives the input text, chat history, and other parameters, allowing for flexible payload creation.

**Example usage:**
```typescript
const customInputEncoder = (inputText, chatHistory, userId, sessionId, additionalParams) => {
  return {
    message: inputText,
    context: chatHistory,
    user: userId,
    session: sessionId,
    ...additionalParams
  };
};
```

**2. outputPayloadDecoder:**
This function allows users to customize how the API response is processed.

- Default behavior: If not provided, it uses the defaultOutputPayloadDecoder, which simply returns the `output` field from the response.
- Custom behavior: Users can provide their own function to extract and process the relevant data from the API response.

**Example usage:**
```typescript
const customOutputDecoder = (response) => {
  return {
    text: response.generated_text,
    customAttribute: response.customAttribute
  };
};
```

**3. headersCallback:**
This function allows users to add custom headers to the API request.

- Default behavior: If not provided, it only sets the 'Content-Type' header to 'application/json'.
- Custom behavior: Users can provide their own function to return additional headers, which will be merged with the default headers.

**Example usage:**
```typescript
const customHeadersCallback = () => {
  return {
    'Authorization': 'Bearer ' + getApiKey(),
    'X-Custom-Header': 'SomeValue'
  };
};
```

To use these custom functions, you would include them in the options when creating a new ApiAgent.
This design allows users to adapt the ApiAgent to work with a wide variety of APIs without having to modify the core ApiAgent class. It provides a flexible way to handle different API specifications and requirements.

Now that we have our `ApiAgent`, let's add it to the Multi-Agent Orchestrator:


## 🔗 2. Add ApiAgent to the orchestrator:

If you have used the quickstarter sample program, you add the Api agent and run it:

```typescript
import { ApiAgent } from "./apiAgent";
import { MultiAgentOrchestrator } from "multi-agent-orchestrator"

const orchestrator = new MultiAgentOrchestrator();

orchestrator.addAgent(
    new ApiAgent({
      name: "Text Summarization Agent",
      description: "This is a very simple text summarization agent.",
      endpoint:"http://127.0.0.1:11434/api/chat",
      method:"POST",
      streaming: true,
      inputPayloadEncoder: customInputEncoder,
      outputPayloadDecoder: customOutputDecoder,
  }))
```

🎉**And You're All Set!**


## 3.💡 **Next Steps:**

- Experiment with different Api endpoints
- Create specialized agents for various tasks using ApiAgent
- Include your existing Api with the Multi-agent orchestrator

Happy coding! 🚀

