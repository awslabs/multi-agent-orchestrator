import { Retriever } from "./retriever";
import {
  BedrockAgentRuntimeClient,
  RetrieveAndGenerateConfiguration,
  RetrieveCommand,
  RetrieveAndGenerateCommand,
  KnowledgeBaseRetrievalConfiguration,
  KnowledgeBaseRetrievalResult,
} from "@aws-sdk/client-bedrock-agent-runtime";

/**
 * Interface defining the options for AmazonKnowledgeBasesRetriever
 */
export interface AmazonKnowledgeBasesRetrieverOptions {
  knowledgeBaseId?: string;
  retrievalConfiguration?: KnowledgeBaseRetrievalConfiguration;
  retrieveAndGenerateConfiguration?: RetrieveAndGenerateConfiguration;
}

/**
 * AmazonKnowledgeBasesRetriever class for interacting with Amazon Knowledge Bases
 * Extends the base Retriever class
 */
export class AmazonKnowledgeBasesRetriever extends Retriever {
  private client: BedrockAgentRuntimeClient;
  protected options: AmazonKnowledgeBasesRetrieverOptions;

  /**
   * Constructor for AmazonKnowledgeBasesRetriever
   * @param client - AWS Bedrock Agent Runtime client
   * @param options - Configuration options for the retriever
   */
  constructor(client: BedrockAgentRuntimeClient, options: AmazonKnowledgeBasesRetrieverOptions) {
    super(options);
    this.client = client;
    this.options = options;

    // Validate that at least knowledgeBaseId is provided
    if (!this.options.knowledgeBaseId) {
      throw new Error("knowledgeBaseId is required in options");
    }
  }

  /**
   * Private method to send a command to the AWS Bedrock Agent Runtime
   * @param command - The command to send
   * @returns A promise that resolves to the response from the command
   * @throws Error if the command fails
   */
  private async send_command(command: any): Promise<any> {
    try {
      const response = await this.client.send(command);
      return response;
    } catch (error) {
      throw new Error(`Failed to execute command: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieve and generate based on input text
   * @param text - The input text
   * @param retrieveAndGenerateConfiguration - Optional configuration for retrieve and generate
   * @returns A promise that resolves to the result of the retrieve and generate operation
   */
  public async retrieveAndGenerate(
    text: string,
    retrieveAndGenerateConfiguration?: RetrieveAndGenerateConfiguration,
  ): Promise<any> {
    if (!text) {
      throw new Error("Input text is required for retrieveAndGenerate");
    }

    const command = new RetrieveAndGenerateCommand({
      input: { text: text },
      retrieveAndGenerateConfiguration: retrieveAndGenerateConfiguration || this.options.retrieveAndGenerateConfiguration,
    });
    return this.send_command(command);
  }

  /**
   * Retrieve information based on input text
   * @param text - The input text
   * @param knowledgeBaseId - Optional knowledge base ID (overrides the one in options)
   * @param retrievalConfiguration - Optional retrieval configuration (overrides the one in options)
   * @returns A promise that resolves to the retrieval results
   */
  public async retrieve(
    text: string,
    knowledgeBaseId?: string,
    retrievalConfiguration?: KnowledgeBaseRetrievalConfiguration
  ): Promise<any> {
    if (!text) {
      throw new Error("Input text is required for retrieve");
    }
    else{
        const command = new RetrieveCommand({
        knowledgeBaseId: knowledgeBaseId || this.options.knowledgeBaseId,
        retrievalConfiguration: retrievalConfiguration || this.options.retrievalConfiguration,
        retrievalQuery: { text: text }
        });
        return this.send_command(command);
    }
  }

  /**
   * Retrieve and combine results based on input text
   * @param text - The input text
   * @param knowledgeBaseId - Optional knowledge base ID (overrides the one in options)
   * @param retrievalConfiguration - Optional retrieval configuration (overrides the one in options)
   * @returns A promise that resolves to the combined retrieval results
   */
  public async retrieveAndCombineResults(
    text: string,
    knowledgeBaseId?: string,
    retrievalConfiguration?: KnowledgeBaseRetrievalConfiguration
  ): Promise<string> {
    const results = await this.retrieve(text, knowledgeBaseId, retrievalConfiguration);
    
    if (!results.retrievalResults || !Array.isArray(results.retrievalResults)) {
      throw new Error("Unexpected response format from retrieve operation");
    }

    return this.combineRetrievalResults(results.retrievalResults);
  }

  /**
   * Private method to combine retrieval results
   * @param retrievalResults - Array of KnowledgeBaseRetrievalResult
   * @returns A string combining all the text content from the results
   */
  private combineRetrievalResults(retrievalResults: KnowledgeBaseRetrievalResult[]): string {
    return retrievalResults
      .filter(result => result && result.content && typeof result.content.text === 'string')
      .map(result => result.content.text)
      .join("\n");
  }
}