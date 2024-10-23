---
title: Ollama Agent
description: A guide to creating an Ollama agent and integrating it into the Multi-Agent Orchestrator System.
---

Welcome to the Ollama Agent guide! This example will walk you through creating an Ollama agent and integrating it into your Multi-Agent Orchestrator System.
Let's dive in!

## 📚Prerequisites:
- Basic knowledge of TypeScript or Python
- Familiarity with the Multi-Agent Orchestrator System
- [Ollama installed](https://ollama.com/download) on your machine

## 💾 1. Ollama installation:

import { Tabs, TabItem } from '@astrojs/starlight/components';

<Tabs syncKey="runtime">
  <TabItem label="TypeScript" icon="seti:typescript" color="blue">
    First, let's install the Ollama JavaScript library:
    ```bash
    npm install ollama
    ```
  </TabItem>
  <TabItem label="Python" icon="seti:python">
    First, let's install the Ollama Python package:
    ```bash
    pip install ollama
    ```
  </TabItem>
</Tabs>

## 🧬 2. Create the Ollama Agent class:
Now, let's create our `OllamaAgent` class. This class extends the `Agent` abstract class from the Multi-Agent Orchestrator.
The [process_request](../overview#abstract-method-processrequest) method must be implemented by the `OllamaAgent`

<Tabs syncKey="runtime">
  <TabItem label="TypeScript" icon="seti:typescript" color="blue">
    ```typescript
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
    ```
  </TabItem>
  <TabItem label="Python" icon="seti:python">
    ```python
    from typing import List, Dict, Optional, AsyncIterable, Any
    from multi_agent_orchestrator.agents import Agent, AgentOptions
    from multi_agent_orchestrator.types import ConversationMessage, ParticipantRole
    from multi_agent_orchestrator.utils import Logger
    import ollama
    from dataclasses import dataclass

    @dataclass
    class OllamaAgentOptions(AgentOptions):
        streaming: bool = False
        model_id: str = "llama2"
        # Add other Ollama-specific options here (e.g., temperature, top_k, top_p)

    class OllamaAgent(Agent):
        def __init__(self, options: OllamaAgentOptions):
            super().__init__(options)
            self.model_id = options.model_id
            self.streaming = options.streaming

        async def handle_streaming_response(self, messages: List[Dict[str, str]]) -> ConversationMessage:
            text = ''
            try:
                response = ollama.chat(
                    model=self.model_id,
                    messages=messages,
                    stream=self.streaming
                )
                for part in response:
                    text += part['message']['content']
                    self.callbacks.on_llm_new_token(part['message']['content'])

                return ConversationMessage(
                    role=ParticipantRole.ASSISTANT.value,
                    content=[{"text": text}]
                )

            except Exception as error:
                Logger.get_logger().error("Error getting stream from Ollama model:", error)
                raise error



        async def process_request(
            self,
            input_text: str,
            user_id: str,
            session_id: str,
            chat_history: List[ConversationMessage],
            additional_params: Optional[Dict[str, str]] = None
        ) -> ConversationMessage | AsyncIterable[Any]:
            messages = [
                {"role": msg.role, "content": msg.content[0]['text']}
                for msg in chat_history
            ]
            messages.append({"role": ParticipantRole.USER.value, "content": input_text})

            if self.streaming:
                return await self.handle_streaming_response(messages)
            else:
                response = ollama.chat(
                    model=self.model_id,
                    messages=messages
                )
                return ConversationMessage(
                    role=ParticipantRole.ASSISTANT.value,
                    content=[{"text": response['message']['content']}]
                )
    ```
  </TabItem>
</Tabs>

Now that we have our `OllamaAgent`, let's add it to the Multi-Agent Orchestrator:

## 🔗 3. Add OllamaAgent to the orchestrator:

If you have used the quickstarter sample program, you can add the Ollama agent and run it:

<Tabs syncKey="runtime">
  <TabItem label="TypeScript" icon="seti:typescript" color="blue">
    ```typescript
    import { OllamaAgent } from "./ollamaAgent";
    import { MultiAgentOrchestrator } from "multi-agent-orchestrator"

    const orchestrator = new MultiAgentOrchestrator();

    // Add a text summarization agent using Ollama and Llama 2
    orchestrator.addAgent(
      new OllamaAgent({
        name: "Text Summarization Wizard",
        modelId: "llama2",
        description: "I'm your go-to agent for concise and accurate text summaries!",
        streaming: true
      })
    );
    ```
  </TabItem>
  <TabItem label="Python" icon="seti:python">
    ```python
    from ollamaAgent import OllamaAgent, OllamaAgentOptions
    from multi_agent_orchestrator.orchestrator import MultiAgentOrchestrator

    orchestrator = MultiAgentOrchestrator()

    # Add a text summarization agent using Ollama and Llama 2
    orchestrator.add_agent(
        OllamaAgent(OllamaAgentOptions(
            name="Text Summarization Wizard",
            model_id="llama2",
            description="I'm your go-to agent for concise and accurate text summaries!",
            streaming=True
        ))
    )
    ```
  </TabItem>
</Tabs>

And you are done!

## 🏃 4. Run Your Ollama Model Locally:
Before running your program, make sure to start the Ollama model locally:
```bash
ollama run llama2
```
If you haven't downloaded the Llama 2 model yet, it will be downloaded automatically before running.

🎉 **You're All Set!**

Congratulations! You've successfully integrated an Ollama agent into your Multi-Agent Orchestrator System. Now you can start summarizing text and leveraging the power of Llama 2 in your applications!

## 5.🔗 **Useful Links:**

- [Ollama](https://ollama.com/)
- [Ollama.js Documentation](https://github.com/ollama/ollama-js)
- [Ollama Python](https://github.com/ollama/ollama-python)
- [Ollama GitHub Repository](https://github.com/ollama)

## 6.💡 **Next Steps:**

- Experiment with different Ollama models
- Customize the agent's behavior by adjusting parameters
- Create specialized agents for various tasks using Ollama

Happy coding! 🚀