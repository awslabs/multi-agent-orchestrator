---
title: Quickstart
---
# Quickstart Guide for Multi-Agent Orchestrator

To help you kickstart with the Multi-Agent Orchestrator framework, we'll walk you through the step-by-step process of setting up and running your first multi-agent conversation.

<br>

> 💁 Ensure you have Node.js and npm installed on your development environment before proceeding.

## Prerequisites

1. Create a new Node.js project:
   ```bash
   mkdir test_multi_agent_orchestrator
   cd test_multi_agent_orchestrator
   npm init
   ```
   Follow the steps to generate a `package.json` file.

2. Authenticate with your AWS account


This quickstart demonstrates the use of Amazon Bedrock for both classification and agent responses. 

By default, the framework is configured as follows:
  - Classifier: Uses the **[Bedrock Classifier](/multi-agent-orchestrator/classifiers/built-in/bedrock-classifier/)** implementation with `anthropic.claude-3-5-sonnet-20240620-v1:0`
  - Agent: Utilizes the **[Bedrock LLM Agent](/multi-agent-orchestrator/agents/built-in/bedrock-llm-agent)** with `anthropic.claude-3-haiku-20240307-v1:0`

<br>

> **Important**
> 
>   These are merely default settings and can be easily changed to suit your needs or preferences. 

<br>

You have the flexibility to:
  - Change the classifier model or implementation
  - Change the agent model or implementation
  - Use any other compatible models available through Amazon Bedrock

Ensure you have [requested access](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html) to the models you intend to use through the AWS console.

<br>

> **To customize the model selection**:
>   - For the classifier, refer to [our guide](/multi-agent-orchestrator/classifiers/overview) on configuring the classifier.
>   - For the agent, refer to our guide on configuring [agents](/multi-agent-orchestrator/agents/overview).

## 🚀 Get Started!

1. Install the Multi-Agent Orchestrator framework in your Node.js project:
   ```bash
   npm install multi-agent-orchestrator
   ```

2. Create a new file named `quickstart.ts` and add the following code:

3. Create an Orchestrator:
   ```typescript
   import { MultiAgentOrchestrator } from "multi-agent-orchestrator";
   const orchestrator = new MultiAgentOrchestrator({
     config: {
       LOG_AGENT_CHAT: true,
       LOG_CLASSIFIER_CHAT: true,
       LOG_CLASSIFIER_RAW_OUTPUT: false,
       LOG_CLASSIFIER_OUTPUT: true,
       LOG_EXECUTION_TIMES: true,
     }
   });
   ```

4. Add Agents:
   ```typescript
   import { BedrockLLMAgent } from "multi-agent-orchestrator";
   orchestrator.addAgent(
     new BedrockLLMAgent({
       name: "Tech Agent",
       description: "Specializes in technology areas including software development, hardware, AI, cybersecurity, blockchain, cloud computing, emerging tech innovations, and pricing/costs related to technology products and services.",
     })
   );
   
   orchestrator.addAgent(
     new BedrockLLMAgent({
       name: "Health Agent",
       description: "Focuses on health and medical topics such as general wellness, nutrition, diseases, treatments, mental health, fitness, healthcare systems, and medical terminology or concepts.",
     })
   );
   ```

5. Send a Query:
   ```typescript
   const userId = "quickstart-user";
   const sessionId = "quickstart-session";
   const query = "What are the latest trends in AI?";
   console.log(`\nUser Query: ${query}`);


   async function main() {
      try {
        const response = await orchestrator.routeRequest(query, userId, sessionId);
        console.log("\n** RESPONSE ** \n");
        console.log(`> Agent ID: ${response.metadata.agentId}`);
        console.log(`> Agent Name: ${response.metadata.agentName}`);
        console.log(`> User Input: ${response.metadata.userInput}`);
        console.log(`> User ID: ${response.metadata.userId}`);
        console.log(`> Session ID: ${response.metadata.sessionId}`);
        console.log(
          `> Additional Parameters:`,
          response.metadata.additionalParams
        );
        console.log(`\n> Response: ${response.output}`);
        // ... rest of the logging code ...
      } catch (error) {
        console.error("An error occurred:", error);
        // Here you could also add more specific error handling if needed
      }
    }

    main();
   ```

Now, let's run the quickstart script:
```bash
npx ts-node quickstart.ts
```

Congratulations! 🎉
You've successfully set up and run your first multi-agent conversation using the Multi-Agent Orchestrator System.

## 👨‍💻 Next Steps

Now that you've seen the basic functionality, here are some next steps to explore:

1. Try adding other agents from those built-in in the framework ([Bedrock LLM Agent](/multi-agent-orchestrator/agents/built-in/bedrock-llm-agent), [Amazon Lex Bot](/multi-agent-orchestrator/agents/built-in/lex-bot-agent), [Amazon Bedrock Agent](/multi-agent-orchestrator/agents/built-in/amazon-bedrock-agent), [Lambda Agent](/multi-agent-orchestrator/agents/built-in/lambda-agent), [OpenAI Agent](/multi-agent-orchestrator/agents/built-in/openai-agent)).
2. Experiment with different storage options, such as [Amazon DynamoDB](/multi-agent-orchestrator/storage/dynamodb) for persistent storage.
3. Explore the [Agent Overlap Analysis](/multi-agent-orchestrator/advanced-features/agent-overlap) feature to optimize your agent configurations.
4. Integrate the system into a web application or deploy it as an [AWS Lambda function](/multi-agent-orchestrator/deployment/aws-lambda).
5. Try adding your own [custom agents](/multi-agent-orchestrator/agents/custom-agents) by extending the `Agent` class.

For more detailed information on these advanced features, check out our full documentation.

## 🧹 Cleanup

As this quickstart uses in-memory storage and local resources, there's no cleanup required. Simply stop the script when you're done experimenting.