---
title: Custom retriever
description: An overview of retrievers and supported type in the Multi-Agent Orchestrator System
---

The Multi-Agent Orchestrator System allows you to create custom retrievers by extending the abstract Retriever class. This flexibility enables you to integrate various data sources and retrieval methods into your agent system. In this guide, we'll walk through the process of creating a custom retriever, provide an example using OpenSearch Serverless, and explain how to set the retriever for a BedrockLLMAgent.


## Steps to Create a Custom Retriever

1. Create a new class that extends the `Retriever` abstract class.
2. Implement the required abstract methods: `retrieve`, `retrieveAndCombineResults`, and `retrieveAndGenerate`.
3. Add any additional methods or properties specific to your retriever.

## Example: OpenSearchServerless Retriever

Here's an example of a custom retriever that uses OpenSearch Serverless:

Install Opensearch npm package:
```
npm install "@opensearch-project/opensearch"
```

```typescript
import { Retriever } from "multi-agent-orchestrator";
import { Client } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

/**
 * Interface for OpenSearchServerlessRetriever options
 */
export interface OpenSearchServerlessRetrieverOptions {
  collectionEndpoint: string;
  index: string;
  region: string;
  vectorField: string;
  textField: string;
  k: number;
}

/**
 * OpenSearchServerlessRetriever class for interacting with OpenSearch Serverless
 * Extends the base Retriever class
 */
export class OpenSearchServerlessRetriever extends Retriever {
  private client: Client;
  private bedrockClient: BedrockRuntimeClient;

  /**
   * Constructor for OpenSearchServerlessRetriever
   * @param options - Configuration options for the retriever
   */
  constructor(options: OpenSearchServerlessRetrieverOptions) {
    super(options);

    if (!options.collectionEndpoint || !options.index || !options.region) {
      throw new Error("collectionEndpoint, index, and region are required in options");
    }

    this.client = new Client({
      ...AwsSigv4Signer({
        region: options.region,
        service: 'aoss',
        getCredentials: () => defaultProvider()(),
      }),
      node: options.collectionEndpoint,
    });

    this.bedrockClient = new BedrockRuntimeClient({ region: options.region });

    this.options.vectorField = options.vectorField;
    this.options.textField = options.textField;
    this.options.k = options.k;
  }

  /**
   * Retrieve information based on input text
   * @param text - The input text
   * @returns A promise that resolves to the retrieval results
   */
  async retrieve(text: string): Promise<any> {
    try {
      // Get embeddings from Bedrock
      const embeddings = await this.getEmbeddings(text);

      // Search OpenSearch using the embeddings
      const results = await this.client.search({
        index: this.options.index,
        body: {
          _source: {
            excludes: [this.options.vectorField]
          },
          query: {
            bool: {
              must: [
                {
                  knn: {
                    [this.options.vectorField]: { vector: embeddings, k: this.options.k },
                  },
                },
              ],
            },
          },
          size: this.options.k,
        },
      });

      return results.body.hits.hits;
    } catch (error) {
      throw new Error(`Failed to retrieve: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get embeddings from Bedrock for the input text
   * @param text - The input text
   * @returns A promise that resolves to the embeddings
   */
  private async getEmbeddings(text: string): Promise<number[]> {
    try {
      const response = await this.bedrockClient.send(
        new InvokeModelCommand({
          modelId: "amazon.titan-embed-text-v2:0",
          body: JSON.stringify({
            inputText: text,
          }),
          contentType: "application/json",
          accept: "application/json",
        })
      );

      const body = new TextDecoder().decode(response.body);
      const embeddings = JSON.parse(body).embedding;

      if (!Array.isArray(embeddings)) {
        throw new Error("Invalid embedding format received from Bedrock");
      }

      return embeddings;
    } catch (error) {
      throw new Error(`Failed to get embeddings: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieve and combine results based on input text
   * @param text - The input text
   * @returns A promise that resolves to the combined retrieval results
   */
  async retrieveAndCombineResults(text: string): Promise<string> {
    try {
      const results = await this.retrieve(text);
      return results
        .filter((hit: any) => hit._source && hit._source[this.options.textField])
        .map((hit: any) => hit._source[this.options.textField])
        .join("\n");
    } catch (error) {
      throw new Error(`Failed to retrieve and combine results: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieve and generate based on input text
   * @param text - The input text
   * @returns A promise that resolves to the generated content
   */
  async retrieveAndGenerate(text: string): Promise<string> {
    // This method would typically involve generating content based on retrieved results.
    // For this example, we'll just return the combined results.
    return this.retrieveAndCombineResults(text);
  }

  /**
   * Update a document in the OpenSearch index
   * @param id - The document ID
   * @param content - The content to update
   * @returns A promise that resolves to the update response
   */
  async updateDocument(id: string, content: any): Promise<any> {
    try {
      const response = await this.client.update({
        index: this.options.index,
        id: id,
        body: {
          doc: content
        }
      });
      return response.body;
    } catch (error) {
      throw new Error(`Failed to update document: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
```


## Using the Custom Retriever with BedrockLLMAgent

To use your custom OpenSearchServerlessRetriever:


```typescript
import { BedrockLLMAgent } from './path-to-bedrockLLMAgent';

const agent = new BedrockLLMAgent({
  name: 'My Bedrock Agent with OpenSearch Serverless',
  description: 'An agent that uses OpenSearch Serverless for retrieval',
  retriever: new OpenSearchServerlessRetriever({
      collectionEndpoint: "https://xxxxxxxxxxx.us-east-1.aoss.amazonaws.com",
      index: "vector-index",
      region: process.env.AWS_REGION!,
      textField: "textField",
      vectorField: "vectorField",
      k:5,
    })
});

// Example usage
const query = "What is the capital of France?";
const response = await agent.processRequest(query, 'user123', 'session456', []);
console.log(response);
```

In this example, we create an instance of our custom `OpenSearchServerlessRetriever` and then pass it to the `BedrockLLMAgent` constructor using the `retriever` field. This allows the agent to use your custom retriever for enhanced knowledge retrieval during request processing.

## How BedrockLLMAgent Uses the Retriever

When a BedrockLLMAgent processes a request and a retriever is set, it typically follows these steps:

1. The agent receives a user query through the `processRequest` method.
2. Before sending the query to the language model, the agent calls the retriever's `retrieveAndCombineResults` method with the user's query.
3. The retriever fetches relevant information from its data source (in this case, OpenSearch Serverless).
4. The retrieved information is combined and added to the context sent to the language model.
5. The language model then generates a response based on both the user's query and the additional context provided by the retriever.

This process allows the agent to leverage external knowledge sources, potentially improving the accuracy and relevance of its responses.

---

By adapting this example as a CustomRetriever for OpenSearch Serverless, you can seamlessly incorporate your **pre-built Opensearch Serverless clusters** into the Multi-Agent Orchestrator System, enhancing your agents' knowledge retrieval capabilities.