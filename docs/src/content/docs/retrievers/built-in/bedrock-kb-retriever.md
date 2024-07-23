---
title: Knowledge Bases for Amazon Bedrock retriever
description: An overview of Knowledge Bases for Amazon Bedrock retriever configuration an usage.
---

Knowledge bases for Amazon Bedrock is an Amazon Web Services (AWS) offering which lets you quickly build RAG applications by using your private data to customize FM response.

Implementing RAG requires organizations to perform several cumbersome steps to convert data into embeddings (vectors), store the embeddings in a specialized vector database, and build custom integrations into the database to search and retrieve text relevant to the user’s query. This can be time-consuming and inefficient.

With Knowledge Bases for Amazon Bedrock, simply point to the location of your data in Amazon S3, and Knowledge Bases for Amazon Bedrock takes care of the entire ingestion workflow into your vector database. If you do not have an existing vector database, Amazon Bedrock creates an Amazon OpenSearch Serverless vector store for you. 
For retrievals, use the AWS SDK - Amazon Bedrock integration via the Retrieve API to retrieve relevant results for a user query from knowledge bases.

Knowledge base can be configured through AWS Console or by using AWS SDKs.

## Using the Knowledge Bases Retriever

You can add a Knowledge Base for Amazon Bedrock to a `BedrockLLMAgent`. This way you can benefit from using any LLM you want to generate the response based on the information retrieved from your knowledge base.
Here is how you can include a retriever into an agent.

```typescript
orchestrator.addAgent(
    new BedrockLLMAgent({
      name: "My personal agent",
      description:
        "My personal agent is responsible for giving information from an Knowledge Base for Amazon Bedrock.",
      streaming: true,
      inferenceConfig: {
        temperature: 0.1,
      },
      retriever: new AmazonKnowledgeBasesRetriever(
        new BedrockAgentRuntimeClient(),
        {
          knowledgeBaseId: "AXEPIJP4ETUA",
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              numberOfResults: 5,
              overrideSearchType: SearchType.HYBRID,
            },
          },
        }
      )
    })
  );
```