import { AnthropicClassifier, AnthropicClassifierOptions } from '../../src/classifiers/anthropicClassifier';
import { Anthropic } from "@anthropic-ai/sdk";
import { ConversationMessage, ANTHROPIC_MODEL_ID_CLAUDE_3_5_SONNET } from "../../src/types";
import { MockAgent } from '../mock/mockAgent';

// Mock the entire Anthropic module
jest.mock('@anthropic-ai/sdk');

describe('AnthropicClassifier', () => {
  let classifier: AnthropicClassifier;
  let mockCreateMessage: jest.Mock;

  const defaultOptions: AnthropicClassifierOptions = {
    apiKey: 'test-api-key',
  };

  beforeEach(() => {
    // Create a mock for the create method
    mockCreateMessage = jest.fn();

    // Mock the Anthropic constructor
    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(() => ({
      messages: {
        create: mockCreateMessage,
      },
    } as unknown as Anthropic));

    classifier = new AnthropicClassifier(defaultOptions);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an instance with default options', () => {
      expect(classifier).toBeInstanceOf(AnthropicClassifier);
      expect(Anthropic).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
    });

    it('should use custom model ID if provided', () => {
      const customOptions: AnthropicClassifierOptions = {
        ...defaultOptions,
        modelId: 'custom-model-id',
      };
      const customClassifier = new AnthropicClassifier(customOptions);
      expect(customClassifier['modelId']).toBe('custom-model-id');
    });

    it('should use default model ID if not provided', () => {
      expect(classifier['modelId']).toBe(ANTHROPIC_MODEL_ID_CLAUDE_3_5_SONNET);
    });

    it('should set inference config with custom values', () => {
      const customOptions: AnthropicClassifierOptions = {
        ...defaultOptions,
        inferenceConfig: {
          maxTokens: 500,
          temperature: 0.7,
          topP: 0.9,
          stopSequences: ['STOP'],
        },
      };
      const customClassifier = new AnthropicClassifier(customOptions);
      expect(customClassifier['inferenceConfig']).toEqual(customOptions.inferenceConfig);
    });

    it('should throw an error if API key is not provided', () => {
      expect(() => new AnthropicClassifier({ apiKey: '' })).toThrow('Anthropic API key is required');
    });
  });

  describe('processRequest', () => {
    const inputText = 'Hello, how are you?';
    const chatHistory: ConversationMessage[] = [];

    it('should process request successfully', async () => {
      const mockResponse = {
        content: [
          {
            type: 'tool_use',
            input: {
              userinput: inputText,
              selected_agent: 'test-agent',
              confidence: 0.95,
            },
          },
        ],
      };

      const mockAgent = {
          'test-agent': new MockAgent({
            name: "test-agent",
            description: 'A tech support agent',
      })};
      
      classifier.setAgents(mockAgent);

      mockCreateMessage.mockResolvedValue(mockResponse);

      const result = await classifier.processRequest(inputText, chatHistory);

    //   expect(mockCreateMessage).toHaveBeenCalledWith({
    //     model: ANTHROPIC_MODEL_ID_CLAUDE_3_5_SONNET,
    //     max_tokens: 1000,
    //     messages: [{ role: ParticipantRole.USER, content: inputText }],
    //     system: expect.any(String),
    //     temperature: undefined,
    //     top_p: undefined,
    //     tools: expect.any(Array),
    //   });

      expect(result).toEqual({
        selectedAgent: expect.any(MockAgent),
        confidence: 0.95,
      });
    });

    it('should throw an error if no tool use is found in the response', async () => {
      const mockResponse = {
        content: [],
      };

      mockCreateMessage.mockResolvedValue(mockResponse);

      await expect(classifier.processRequest(inputText, chatHistory)).rejects.toThrow('No tool use found in the response');
    });

    it('should throw an error if tool input does not match expected structure', async () => {
      const mockResponse = {
        content: [
          {
            type: 'tool_use',
            input: {
              invalidKey: 'invalidValue',
            },
          },
        ],
      };

      mockCreateMessage.mockResolvedValue(mockResponse);

      await expect(classifier.processRequest(inputText, chatHistory)).rejects.toThrow('Tool input does not match expected structure');
    });

    it('should throw an error if API request fails', async () => {
      const errorMessage = 'API request failed';
      mockCreateMessage.mockRejectedValue(new Error(errorMessage));

      await expect(classifier.processRequest(inputText, chatHistory)).rejects.toThrow(errorMessage);
    });
  });
});