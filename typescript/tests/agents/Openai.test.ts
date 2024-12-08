import { OpenAIAgent } from '../../src/agents/openAIAgent';
import { ConversationMessage, ParticipantRole } from '../../src/types';
import { OpenAI } from 'openai';

jest.mock('openai');

describe('OpenAIAgent', () => {
    let agent: OpenAIAgent;
    let mockCreateCompletion: jest.Mock;
    let toolMock: jest.Mock;
    let toolHandler: jest.Mock;

    beforeEach(() => {
        mockCreateCompletion = jest.fn();
        toolMock = jest.fn();
        toolHandler = jest.fn();

        (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => ({
            chat: {
                completions: {
                    create: mockCreateCompletion,
                },
            },
        } as unknown as OpenAI));

        agent = new OpenAIAgent({
            name: 'Test Agent',
            description: 'A test agent',
            apiKey: 'test-api-key',
            model: 'test-model',
            streaming: false,
            inferenceConfig: {
                maxTokens: 1000,
                temperature: 0.5,
                topP: 0.9,
                stopSequences: ['\n'],
            },
            toolConfig: {
                tool: [{
                    function: toolMock,
                    type: 'function',
                }],
                useToolHandler: toolHandler,
                toolMaxRecursions: 5,
            },
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('processRequest', () => {
        it('should process request successfully no function calls', async () => {
            const inputText = 'test input';
            const userId = 'test-user';
            const sessionId = 'test-session';
            const chatHistory: ConversationMessage[] = [];

            mockCreateCompletion.mockResolvedValue({
                choices: [
                    {
                        message: {
                            content: 'test response',
                            role: ParticipantRole.ASSISTANT,
                        },
                    },
                ],
            });

            const response = await agent.processRequest(inputText, userId, sessionId, chatHistory);

            expect(response).toEqual({
                role: ParticipantRole.ASSISTANT,
                content: [{ text: 'test response' }],
            });
            expect(mockCreateCompletion).toHaveBeenCalledTimes(1);
        });

        it('should process request with multiple tool calls', async () => {
            const inputText = 'test input';
            const userId = 'test-user';
            const sessionId = 'test-session';
            const chatHistory: ConversationMessage[] = [];
        
            // Create a mock implementation that changes on the second call
            let callCount = 0;
            mockCreateCompletion.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    // First call - return tool call response
                    return {
                        choices: [
                            {
                                message: {
                                    tool_calls: [
                                        {
                                            id: 'call1',
                                            function: {
                                                name: 'test_function',
                                                arguments: JSON.stringify({ test: 'argument' }),
                                            },
                                        },
                                    ]
                                },
                            },
                        ],
                    };
                } else {
                    // Subsequent calls - return final response
                    return {
                        choices: [
                            {
                                message: {
                                    content: 'Final response after tool call',
                                },
                            },
                        ],
                    };
                }
            });
        
            // Mock tool handler
            toolHandler.mockResolvedValue('function output')
        
            const response = await agent.processRequest(inputText, userId, sessionId, chatHistory);
        
            expect(mockCreateCompletion).toHaveBeenCalledTimes(2); // Ensure two calls were made
            expect(toolHandler).toHaveBeenCalledTimes(1);
            expect(response).toEqual({
                role: ParticipantRole.ASSISTANT,
                content: [{ text: 'Final response after tool call' }],
            });
        });

        it('should throw an error if API returns no choices', async () => {
            const inputText = 'test input';
            const userId = 'test-user';
            const sessionId = 'test-session';
            const chatHistory: ConversationMessage[] = [];

            mockCreateCompletion.mockResolvedValue({
                choices: [],
            });

            await expect(agent.processRequest(inputText, userId, sessionId, chatHistory))
                .rejects.toThrow('No choices returned from OpenAI API');
        })

        it('should throw an error if API request fails', async () => {
            const inputText = 'test input';
            const userId = 'test-user';
            const sessionId = 'test-session';
            const chatHistory: ConversationMessage[] = [];

            mockCreateCompletion.mockRejectedValue(new Error('API request failed'));

            await expect(agent.processRequest(inputText, userId, sessionId, chatHistory))
                .rejects.toThrow('API request failed');
        });
    });
});