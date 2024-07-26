import { AmazonKnowledgeBasesRetriever, AmazonKnowledgeBasesRetrieverOptions } from '../../src/retrievers/AmazonKBRetriever';
import { BedrockAgentRuntimeClient, RetrieveCommand, RetrieveAndGenerateCommand } from "@aws-sdk/client-bedrock-agent-runtime";

// Mock the BedrockAgentRuntimeClient
jest.mock('@aws-sdk/client-bedrock-agent-runtime');

describe('AmazonKnowledgeBasesRetriever', () => {
  let retriever: AmazonKnowledgeBasesRetriever;
  let mockClient: jest.Mocked<BedrockAgentRuntimeClient>;
  let options: AmazonKnowledgeBasesRetrieverOptions;

  beforeEach(() => {
    mockClient = new BedrockAgentRuntimeClient({}) as jest.Mocked<BedrockAgentRuntimeClient>;
    options = {
      knowledgeBaseId: 'test-kb-id',
    };
    retriever = new AmazonKnowledgeBasesRetriever(mockClient, options);
  });

  test('constructor throws error when knowledgeBaseId is not provided', () => {
    expect(() => {
      new AmazonKnowledgeBasesRetriever(mockClient, {});
    }).toThrow('knowledgeBaseId is required in options');
  });

  test('retrieveAndGenerate calls send_command with correct parameters', async () => {
    const mockResponse:never = { result: 'success' } as never;
    mockClient.send.mockResolvedValue(mockResponse);

    const result = await retriever.retrieveAndGenerate('test input');

    expect(mockClient.send).toHaveBeenCalledWith(expect.any(RetrieveAndGenerateCommand));
    expect(result as never).toEqual(mockResponse);
  });

  test('retrieveAndGenerate throws error when text is empty', async () => {
    await expect(retriever.retrieveAndGenerate('')).rejects.toThrow('Input text is required for retrieveAndGenerate');
  });

  test('retrieve calls send_command with correct parameters', async () => {
    const mockResponse = { retrievalResults: [{ content: { text: 'test result' } }] };
    mockClient.send.mockResolvedValue(mockResponse as never);

    const result = await retriever.retrieve('test input');

    expect(mockClient.send).toHaveBeenCalledWith(expect.any(RetrieveCommand));
    expect(result as never).toEqual(mockResponse);
  });

  test('retrieve throws error when text is empty', async () => {
    await expect(retriever.retrieve('')).rejects.toThrow('Input text is required for retrieve');
  });

  test('retrieveAndCombineResults combines results correctly', async () => {
    const mockResponse = {
      retrievalResults: [
        { content: { text: 'result 1' } },
        { content: { text: 'result 2' } }
      ]
    };
    mockClient.send.mockResolvedValue(mockResponse as never);

    const result = await retriever.retrieveAndCombineResults('test input');

    expect(result as never).toBe('result 1\nresult 2');
  });

  test('retrieveAndCombineResults throws error when response format is unexpected', async () => {
    mockClient.send.mockResolvedValue({} as never);

    await expect(retriever.retrieveAndCombineResults('test input')).rejects.toThrow('Unexpected response format from retrieve operation');
  });

  test('send_command throws error when client.send fails', async () => {
    mockClient.send.mockRejectedValue(new Error('API error') as never);

    await expect(retriever.retrieve('test input')).rejects.toThrow('Failed to execute command: API error');
  });
});
