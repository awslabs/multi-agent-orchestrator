import { OpenAIClassifier, OpenAIClassifierOptions } from '../../src/classifiers/openAIClassifier';
import OpenAI from 'openai';
import { ConversationMessage, OPENAI_MODEL_ID_GPT_O_MINI } from "../../src/types";
import { MockAgent } from '../mock/mockAgent';

// Mock the OpenAI module
jest.mock('openai');

describe('OpenAIClassifier', () => {
    let classifier: OpenAIClassifier;
    let mockCreateCompletion: jest.Mock;

    const defaultOptions: OpenAIClassifierOptions = {
        apiKey: 'test-api-key',
    };

    beforeEach(() => {
        // Create a mock for the create method
        mockCreateCompletion = jest.fn();

        // Mock the OpenAI constructor and chat.completions.create method
        (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => ({
            chat: {
                completions: {
                    create: mockCreateCompletion,
                },
            },
        } as unknown as OpenAI));

        classifier = new OpenAIClassifier(defaultOptions);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create an instance with default options', () => {
            expect(classifier).toBeInstanceOf(OpenAIClassifier);
            expect(OpenAI).toHaveBeenCalledWith({ apiKey: 'test-api-key' });
        });

        it('should use custom model ID if provided', () => {
            const customOptions: OpenAIClassifierOptions = {
                ...defaultOptions,
                modelId: 'custom-model-id',
            };
            const customClassifier = new OpenAIClassifier(customOptions);
            expect(customClassifier['modelId']).toBe('custom-model-id');
        });

        it('should use default model ID if not provided', () => {
            expect(classifier['modelId']).toBe(OPENAI_MODEL_ID_GPT_O_MINI);
        });

        it('should set inference config with custom values', () => {
            const customOptions: OpenAIClassifierOptions = {
                ...defaultOptions,
                inferenceConfig: {
                    maxTokens: 500,
                    temperature: 0.7,
                    topP: 0.9,
                    stopSequences: ['STOP'],
                },
            };
            const customClassifier = new OpenAIClassifier(customOptions);
            expect(customClassifier['inferenceConfig']).toEqual(customOptions.inferenceConfig);
        });

        it('should throw an error if API key is not provided', () => {
            expect(() => new OpenAIClassifier({ apiKey: '' })).toThrow('OpenAI API key is required');
        });
    });

    describe('processRequest', () => {
        const inputText = 'Hello, how are you?';
        const chatHistory: ConversationMessage[] = [];

        it('should process request successfully', async () => {
            const mockResponse = {
                choices: [{
                    message: {
                        tool_calls: [{
                            function: {
                                name: 'analyzePrompt',
                                arguments: JSON.stringify({
                                    userinput: inputText,
                                    selected_agent: 'test-agent',
                                    confidence: 0.95,
                                }),
                            },
                        }],
                    },
                }],
            };

            const mockAgent = {
                'test-agent': new MockAgent({
                    name: "test-agent",
                    description: 'A tech support agent',
                })
            };

            classifier.setAgents(mockAgent);

            mockCreateCompletion.mockResolvedValue(mockResponse);

            const result = await classifier.processRequest(inputText, chatHistory);

            expect(mockCreateCompletion).toHaveBeenCalledWith({
                model: OPENAI_MODEL_ID_GPT_O_MINI,
                max_tokens: 1000,
                messages: [
                    {
                        role: 'system',
                        content: classifier['systemPrompt'], // Use the actual system prompt
                    },
                    {
                        role: 'user',
                        content: inputText
                    }
                ],
                temperature: undefined,
                top_p: undefined,
                tools: classifier['tools'], // Use the actual tools array
                tool_choice: { type: "function", function: { name: "analyzePrompt" } }
            });

            expect(result).toEqual({
                selectedAgent: expect.any(MockAgent),
                confidence: 0.95,
            });
        });

        it('should throw an error if no tool calls are found in the response', async () => {
            const mockResponse = {
                choices: [{
                    message: {}
                }],
            };

            mockCreateCompletion.mockResolvedValue(mockResponse);

            await expect(classifier.processRequest(inputText, chatHistory))
                .rejects.toThrow('No valid tool call found in the response');
        });

        it('should throw an error if tool input does not match expected structure', async () => {
            const mockResponse = {
                choices: [{
                    message: {
                        tool_calls: [{
                            function: {
                                name: 'analyzePrompt',
                                arguments: JSON.stringify({
                                    invalidKey: 'invalidValue',
                                }),
                            },
                        }],
                    },
                }],
            };

            mockCreateCompletion.mockResolvedValue(mockResponse);

            await expect(classifier.processRequest(inputText, chatHistory))
                .rejects.toThrow('Tool input does not match expected structure');
        });

        it('should throw an error if API request fails', async () => {
            const errorMessage = 'API request failed';
            mockCreateCompletion.mockRejectedValue(new Error(errorMessage));

            await expect(classifier.processRequest(inputText, chatHistory))
                .rejects.toThrow(errorMessage);
        });
    });
});