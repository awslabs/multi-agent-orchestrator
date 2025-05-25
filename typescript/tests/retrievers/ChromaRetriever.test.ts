import { ChromaRetriever, ChromaRetrieverOptions } from '../../src/retrievers/ChromaRetriever';
import { ChromaClient, Collection } from 'chromadb';

// Mock ChromaDB
jest.mock('chromadb', () => {
  const mockCollection = {
    query: jest.fn().mockResolvedValue({
      documents: [['doc1', 'doc2']],
      metadatas: [['meta1', 'meta2']]
    })
  };

  const mockClient = {
    getOrCreateCollection: jest.fn().mockReturnValue(mockCollection)
  };

  return {
    ChromaClient: jest.fn().mockImplementation(() => mockClient),
    Collection: jest.fn()
  };
});

describe('ChromaRetriever', () => {
  let retriever: ChromaRetriever;
  let options: ChromaRetrieverOptions;

  beforeEach(async () => {
    options = {
      collectionName: 'test_collection',
      persistDirectory: './test_data'
    };
    retriever = new ChromaRetriever(options);
    await retriever['initializeCollection']();
  });

  describe('constructor', () => {
    it('should throw error if collectionName is not provided', () => {
      expect(() => {
        new ChromaRetriever({ collectionName: '' });
      }).toThrow('collectionName is required in options');
    });

    it('should initialize with remote client if host and port are provided', () => {
      const remoteOptions: ChromaRetrieverOptions = {
        collectionName: 'test_collection',
        host: 'localhost',
        port: 8000,
        ssl: true
      };
      const remoteRetriever = new ChromaRetriever(remoteOptions);
      expect(remoteRetriever).toBeDefined();
    });
  });

  describe('retrieve', () => {
    it('should throw error if text is not provided', async () => {
      await expect(retriever.retrieve('')).rejects.toThrow(
        'Input text is required for retrieve'
      );
    });

    it('should return formatted results', async () => {
      const results = await retriever.retrieve('test query');
      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        content: { text: 'doc1' },
        metadata: 'meta1'
      });
      expect(results[1]).toEqual({
        content: { text: 'doc2' },
        metadata: 'meta2'
      });
    });
  });

  describe('retrieveAndCombineResults', () => {
    it('should combine results into a single string', async () => {
      const result = await retriever.retrieveAndCombineResults('test query');
      expect(result).toBe('doc1\ndoc2');
    });
  });

  describe('retrieveAndGenerate', () => {
    it('should throw NotImplementedError', async () => {
      await expect(retriever.retrieveAndGenerate('test query')).rejects.toThrow(
        'retrieveAndGenerate is not implemented for ChromaRetriever'
      );
    });
  });
}); 