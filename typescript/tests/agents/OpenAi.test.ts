import { OpenAIAgent, OpenAIAgentOptions } from '../../src/agents/openAIAgent';
import OpenAI from 'openai';
import { ParticipantRole } from '../../src/types';

// Create a mock OpenAI client type that matches the structure we need
const createMockOpenAIClient = () => ({
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
});

describe('OpenAIAgent', () => {
  const mockUserId = 'user123';
  const mockSessionId = 'session456';
  let mockClient;

  beforeEach(() => {
    // Create mocked OpenAI client
    mockClient = createMockOpenAIClient();

    // Set up default mock response
    mockClient.chat.completions.create.mockResolvedValue({
      choices: [{ message: { content: 'Mock response' } }],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processRequest', () => {
    it('should call OpenAI API with the correct parameters', async () => {
      const options  = {
        name: 'Test Agent',
        description: 'Test description',
        client: mockClient as unknown as OpenAI,
        customSystemPrompt: {
          template: 'Custom prompt with {{variable}}',
          variables: { variable: 'test-value' },
        },
      };

      const openAIAgent = new OpenAIAgent(options);

      const inputText = 'What is AI?';
      const chatHistory = [];

      const response = await openAIAgent.processRequest(
        inputText,
        mockUserId,
        mockSessionId,
        chatHistory
      );

      // Verify API call
      expect(mockClient.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(String),
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('Custom prompt with test-value'),
            }),
            expect.objectContaining({
              role: 'user',
              content: inputText,
            }),
          ]),
        })
      );
      // Verify response structure
      expect(response).toEqual({
        role: ParticipantRole.ASSISTANT,
        content: [{ text: 'Mock response' }],
      });
    });

    it('should handle streaming responses correctly when streaming is enabled', async () => {
      const options: OpenAIAgentOptions & { client: OpenAI } = {
        name: 'Test Agent',
        description: 'Test description',
        client: mockClient as unknown as OpenAI,
        streaming: true,
      };

      const openAIAgent = new OpenAIAgent(options);

      // Mock streaming response
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: 'Hello' } }] };
          yield { choices: [{ delta: { content: ' World' } }] };
        },
      };

      mockClient.chat.completions.create.mockResolvedValueOnce(mockStream as any);

      const inputText = 'What is AI?';
      const chatHistory = [];

      const response = await openAIAgent.processRequest(
        inputText,
        mockUserId,
        mockSessionId,
        chatHistory
      );

      // Verify it returns an AsyncIterable
      expect(response).toBeDefined();
      expect(typeof response[Symbol.asyncIterator]).toBe('function');

      // Verify the streamed content
      const chunks = [];
      for await (const chunk of response as AsyncIterable<string>) {
        chunks.push(chunk);
      }
      expect(chunks).toEqual(['Hello', ' World']);
    });

    it('should throw error when API call fails', async () => {
      const options: OpenAIAgentOptions & { client: OpenAI } = {
        name: 'Test Agent',
        description: 'Test description',
        client: mockClient as unknown as OpenAI,
      };

      const openAIAgent = new OpenAIAgent(options);

      // Mock API error
      mockClient.chat.completions.create.mockRejectedValueOnce(
        new Error('API Error')
      );

      const inputText = 'What is AI?';
      const chatHistory = [];

      await expect(
        openAIAgent.processRequest(inputText, mockUserId, mockSessionId, chatHistory)
      ).rejects.toThrow('API Error');
    });
  });
});
