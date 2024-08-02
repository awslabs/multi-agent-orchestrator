---
title: Ollama Agent
description: A guide to creating a Ollama agent and integrate it into the Multi-Agent Orchestrator System.
---

Welcome to the Ollama Agent guide! This example will walk you through creating an Ollama agent and integrating it into your Multi-Agent Orchestrator System.
Let's dive in!

## 📚Prerequisites:
- Basic knowledge of TypeScript
- Familiarity with the Multi-Agent Orchestrator System
- [Ollama installed](https://ollama.com/download) on your machine


## 💾 1. Ollama js installation:

First, let's install the Ollama JavaScript library:
```bash
npm install ollama
```

## 🧬 2. Create the Ollama Agent class:
Now, let's create our `OllamaAgent` class. This class extends the `Agent` abstract class from the Multi-Agent Orchestrator:

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

Now that we have our `OllamaAgent`, let's add it to the Multi-Agent Orchestrator:


## 🔗 3. Add OllamaAgent to the orchestrator:

If you have used the quickstarter sample program, you add the Ollama agent and run it:

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
- [Ollama GitHub Repository](https://github.com/ollama)

## 6.💡 **Next Steps:**

- Experiment with different Ollama models
- Customize the agent's behavior by adjusting parameters
- Create specialized agents for various tasks using Ollama

Happy coding! 🚀

