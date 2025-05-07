import { Retriever } from "./retriever";
import { ChromaClient, Collection } from "chromadb";

/**
 * Interface defining the options for ChromaRetriever
 */
export interface ChromaRetrieverOptions {
  collectionName: string;
  persistDirectory?: string;
  host?: string;
  port?: number;
  ssl?: boolean;
  nResults?: number;
  embeddingFunction?: any;
}

/**
 * ChromaRetriever class for interacting with ChromaDB
 * Extends the base Retriever class
 */
export class ChromaRetriever extends Retriever {
  private client: ChromaClient;
  private collection: Collection;
  protected options: ChromaRetrieverOptions;

  /**
   * Constructor for ChromaRetriever
   * @param options - Configuration options for the retriever
   */
  constructor(options: ChromaRetrieverOptions) {
    super(options);
    this.options = options;

    if (!this.options.collectionName) {
      throw new Error("collectionName is required in options");
    }

    // Initialize ChromaDB client
    if (this.options.host && this.options.port) {
      this.client = new ChromaClient({
        path: `http${this.options.ssl ? 's' : ''}://${this.options.host}:${this.options.port}`
      });
    } else {
      this.client = new ChromaClient({
        path: this.options.persistDirectory
      });
    }

    // Initialize collection
    this.initializeCollection();
  }

  private async initializeCollection(): Promise<void> {
    this.collection = await this.client.getOrCreateCollection({
      name: this.options.collectionName,
      embeddingFunction: this.options.embeddingFunction
    });
  }

  /**
   * Retrieve documents from ChromaDB based on the input text
   * @param text - The input text to base the retrieval on
   * @returns A promise that resolves to an array of retrieved documents with their metadata
   */
  public async retrieve(text: string): Promise<any[]> {
    if (!text) {
      throw new Error("Input text is required for retrieve");
    }

    const results = await this.collection.query({
      queryTexts: [text],
      nResults: this.options.nResults || 4
    });

    // Format results
    const formattedResults = [];
    for (let i = 0; i < results.documents[0].length; i++) {
      formattedResults.push({
        content: {
          text: results.documents[0][i]
        },
        metadata: results.metadatas?.[0]?.[i] || {}
      });
    }

    return formattedResults;
  }

  /**
   * Retrieve and combine results based on input text
   * @param text - The input text
   * @returns A promise that resolves to the combined retrieval results
   */
  public async retrieveAndCombineResults(text: string): Promise<string> {
    const results = await this.retrieve(text);
    return this.combineRetrievalResults(results);
  }

  /**
   * Placeholder for retrieve and generate functionality
   * @param text - The input text
   * @returns A promise that resolves to the generated content
   */
  public async retrieveAndGenerate(text: string): Promise<any> {
    throw new Error("retrieveAndGenerate is not implemented for ChromaRetriever");
  }

  /**
   * Private method to combine retrieval results
   * @param retrievalResults - Array of retrieved documents
   * @returns A string combining all the text content from the results
   */
  private combineRetrievalResults(retrievalResults: any[]): string {
    return retrievalResults
      .filter(result => result && result.content && typeof result.content.text === 'string')
      .map(result => result.content.text)
      .join("\n");
  }
} 