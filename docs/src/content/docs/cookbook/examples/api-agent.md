---
title: Api Agent
description: A guide to creating an API agent and integrating it into the Multi-Agent Orchestrator System.
---

This example will walk you through creating an Api agent and integrating it into your Multi-Agent Orchestrator System. 
Let's dive in!

## 📚Prerequisites:
- Basic knowledge of TypeScript or Python
- Familiarity with the Multi-Agent Orchestrator System

## 🧬 1. Create the Api Agent class:
Let's create our `ApiAgent` class. This class extends the `Agent` abstract class from the Multi-Agent Orchestrator.
The [process_request](../overview#abstract-method-processrequest) method must be implemented by the `ApiAgent`

import { Tabs, TabItem } from '@astrojs/starlight/components';

<Tabs syncKey="runtime">
  <TabItem label="TypeScript" icon="seti:typescript" color="blue">
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
  </TabItem>
  <TabItem label="Python" icon="seti:python">
    ```python
    from typing import List, Dict, Optional, AsyncIterable, Any, Callable
    from dataclasses import dataclass, field
    from multi_agent_orchestrator.agents import Agent, AgentOptions
    from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
    import aiohttp
    import json

    @dataclass
    class ApiAgentOptions(AgentOptions):
        endpoint: str
        method: str
        streaming: bool = False
        headers_callback: Optional[Callable[[], Dict[str, str]]] = None
        input_payload_encoder: Optional[Callable[[str, List[ConversationMessage], str, str, Optional[Dict[str, str]]], Any]] = None
        output_payload_decoder: Optional[Callable[[Any], Any]] = None

    class ApiAgent(Agent):
        def __init__(self, options: ApiAgentOptions):
            super().__init__(options)
            self.options = options
            self.options.input_payload_encoder = options.input_payload_encoder or self.default_input_payload_encoder
            self.options.output_payload_decoder = options.output_payload_decoder or self.default_output_payload_decoder

        @staticmethod
        def default_input_payload_encoder(input_text: str, chat_history: List[ConversationMessage], 
                                          user_id: str, session_id: str, 
                                          additional_params: Optional[Dict[str, str]] = None) -> Dict:
            return {"input": input_text, "history": chat_history}

        @staticmethod
        def default_output_payload_decoder(response: Any) -> Any:
            return response.get('output')

        async def fetch(self, payload: Any, streaming: bool = False) -> AsyncIterable[Any]:
            headers = self.get_headers()
            async with aiohttp.ClientSession() as session:
                async with session.request(self.options.method, self.options.endpoint, 
                                           headers=headers, json=payload) as response:
                    if response.status != 200:
                        raise Exception(f"HTTP error! status: {response.status}")
                    
                    if streaming:
                        async for chunk in response.content.iter_any():
                            yield self.options.output_payload_decoder(chunk.decode())
                    else:
                        content = await response.text()
                        yield self.options.output_payload_decoder(content)

        def get_headers(self) -> Dict[str, str]:
            default_headers = {'Content-Type': 'application/json'}
            if self.options.headers_callback:
                return {**default_headers, **self.options.headers_callback()}
            return default_headers

        async def process_request(
            self,
            input_text: str,
            user_id: str,
            session_id: str,
            chat_history: List[ConversationMessage],
            additional_params: Optional[Dict[str, str]] = None
        ) -> ConversationMessage | AsyncIterable[Any]:
            payload = self.options.input_payload_encoder(input_text, chat_history, user_id, session_id, additional_params)

            if self.options.streaming:
                return self.fetch(payload, True)
            else:
                result = await self.fetch(payload, False).__anext__()
                return ConversationMessage(
                    role=ParticipantRole.ASSISTANT.value,
                    content=[{"text": result}]
                )
    ```
  </TabItem>
</Tabs>

This ApiAgent class provides flexibility for users to customize how input is encoded before sending to the API, how output is decoded after receiving from the API, and how headers are generated. This is done through three optional callbacks in the ApiAgentOptions interface:

- input_payload_encoder
- output_payload_decoder
- headers_callback

Let's break these down:

**1. input_payload_encoder:**
This function allows users to customize how the input is formatted before sending it to the API.

- Default behavior: If not provided, it uses the default_input_payload_encoder, which creates a payload with `input` and `history` fields.
- Custom behavior: Users can provide their own function to format the input however their API expects it. This function receives the input text, chat history, and other parameters, allowing for flexible payload creation.

**Example usage:**

<Tabs syncKey="runtime">
  <TabItem label="TypeScript" icon="seti:typescript" color="blue">
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
  </TabItem>
  <TabItem label="Python" icon="seti:python">
    ```python
    def custom_input_encoder(input_text, chat_history, user_id, session_id, additional_params):
        return {
            "message": input_text,
            "context": chat_history,
            "user": user_id,
            "session": session_id,
            **(additional_params or {})
        }
    ```
  </TabItem>
</Tabs>

**2. output_payload_decoder:**
This function allows users to customize how the API response is processed.

- Default behavior: If not provided, it uses the default_output_payload_decoder, which simply returns the `output` field from the response.
- Custom behavior: Users can provide their own function to extract and process the relevant data from the API response.

**Example usage:**

<Tabs syncKey="runtime">
  <TabItem label="TypeScript" icon="seti:typescript" color="blue">
    ```typescript
    const customOutputDecoder = (response) => {
      return {
        text: response.generated_text,
        customAttribute: response.customAttribute
      };
    };
    ```
  </TabItem>
  <TabItem label="Python" icon="seti:python">
    ```python
    def custom_output_decoder(response):
        return {
            "text": response.get("generated_text"),
            "customAttribute": response.get("customAttribute")
        }
    ```
  </TabItem>
</Tabs>

**3. headers_callback:**
This function allows users to add custom headers to the API request.

- Default behavior: If not provided, it only sets the 'Content-Type' header to 'application/json'.
- Custom behavior: Users can provide their own function to return additional headers, which will be merged with the default headers.

**Example usage:**

<Tabs syncKey="runtime">
  <TabItem label="TypeScript" icon="seti:typescript" color="blue">
    ```typescript
    const customHeadersCallback = () => {
      return {
        'Authorization': 'Bearer ' + getApiKey(),
        'X-Custom-Header': 'SomeValue'
      };
    };
    ```
  </TabItem>
  <TabItem label="Python" icon="seti:python">
    ```python
    def custom_headers_callback():
        return {
            'Authorization': f'Bearer {get_api_key()}',
            'X-Custom-Header': 'SomeValue'
        }
    ```
  </TabItem>
</Tabs>

To use these custom functions, you would include them in the options when creating a new ApiAgent.
This design allows users to adapt the ApiAgent to work with a wide variety of APIs without having to modify the core ApiAgent class. It provides a flexible way to handle different API specifications and requirements.

Now that we have our `ApiAgent`, let's add it to the Multi-Agent Orchestrator:

## 🔗 2. Add ApiAgent to the orchestrator:

If you have used the quickstarter sample program, you can add the Api agent and run it:

<Tabs syncKey="runtime">
  <TabItem label="TypeScript" icon="seti:typescript" color="blue">
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
  </TabItem>
  <TabItem label="Python" icon="seti:python">
    ```python
    from api_agent import ApiAgent, ApiAgentOptions
    from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator

    orchestrator = MultiAgentOrchestrator()

    orchestrator.add_agent(
        ApiAgent(ApiAgentOptions(
            name="Text Summarization Agent",
            description="This is a very simple text summarization agent.",
            endpoint="http://127.0.0.1:11434/api/chat",
            method="POST",
            streaming=True,
            input_payload_encoder=custom_input_encoder,
            output_payload_decoder=custom_output_decoder,
        ))
    )
    ```
  </TabItem>
</Tabs>

🎉**And You're All Set!**

## 3.💡 **Next Steps:**

- Experiment with different Api endpoints
- Create specialized agents for various tasks using ApiAgent
- Include your existing Api with the Multi-agent orchestrator

Happy coding! 🚀