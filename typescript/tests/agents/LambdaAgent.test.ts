import { LambdaAgent, LambdaAgentOptions } from '../../src/agents/lambdaAgent';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { ConversationMessage, ParticipantRole } from '../../src/types';

// Mock the AWS SDK
jest.mock('@aws-sdk/client-lambda');
jest.mock('../../src/common/src/awsSdkUtils', () => ({
    addUserAgentMiddleware: jest.fn(),
}));

describe('LambdaAgent', () => {
    let lambdaAgent: LambdaAgent;
    let mockLambdaClient: jest.Mocked<LambdaClient>;

    const defaultOptions: LambdaAgentOptions = {
        functionName: 'test-function',
        functionRegion: 'us-east-1',
        name: 'TestAgent',
        description: 'Test Agent Description'
    };

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();

        // Setup mock response
        mockLambdaClient = {
            send: jest.fn()
        } as any;

        (LambdaClient as jest.Mock).mockImplementation(() => mockLambdaClient);

        // Mock InvokeCommand to capture the Payload
        (InvokeCommand as unknown as jest.Mock<any>).mockImplementation((params) => {
            return {
                ...params,
                // Store the original params so they can be inspected in tests
                _params: params
            };
        });

        lambdaAgent = new LambdaAgent(defaultOptions);
    });

    describe('constructor', () => {
        it('should initialize with correct options', () => {
            expect(LambdaClient).toHaveBeenCalledWith({
                region: defaultOptions.functionRegion
            });
        });
    });

    describe('processRequest', () => {
        const testInput = 'test input';
        const testUserId = 'user123';
        const testSessionId = 'session123';
        const testChatHistory: ConversationMessage[] = [];
        const testAdditionalParams = { param1: 'value1' };

        it('should process request with default encoders/decoders', async () => {
            const mockResponse = {
                Payload: new TextEncoder().encode(JSON.stringify({
                    body: JSON.stringify({
                        response: 'test response'
                    })
                }))
            };

            mockLambdaClient.send.mockResolvedValueOnce(mockResponse as never);

            const result = await lambdaAgent.processRequest(
                testInput,
                testUserId,
                testSessionId,
                testChatHistory,
                testAdditionalParams
            );

            // Verify Lambda invocation
            expect(mockLambdaClient.send).toHaveBeenCalledWith({"FunctionName": "test-function", "Payload": "{\"query\":\"test input\",\"chatHistory\":[],\"additionalParams\":{\"param1\":\"value1\"},\"userId\":\"user123\",\"sessionId\":\"session123\"}", "_params": {"FunctionName": "test-function", "Payload": "{\"query\":\"test input\",\"chatHistory\":[],\"additionalParams\":{\"param1\":\"value1\"},\"userId\":\"user123\",\"sessionId\":\"session123\"}"}})


            // Verify the payload structure by accessing the command passed to send
            const invokeCommand = (mockLambdaClient.send as unknown as jest.Mock<any>).mock.calls[0][0];

            // Access the parameters captured by our mock implementation
            const params = invokeCommand._params;

            expect(params.FunctionName).toBe('test-function');

            // Check the payload was correctly formatted
            const payload = JSON.parse(params.Payload);

            expect(payload).toEqual({
                query: testInput,
                chatHistory: testChatHistory,
                additionalParams: testAdditionalParams,
                userId: testUserId,
                sessionId: testSessionId
            });

            // Verify response structure
            expect(result).toEqual({
                role: ParticipantRole.ASSISTANT,
                content: [{ text: 'test response' }]
            });
        });

        it('should use custom input payload encoder when provided', async () => {
            const customEncoder = jest.fn().mockReturnValue('custom encoded payload');
            const customOptions = {
                ...defaultOptions,
                inputPayloadEncoder: customEncoder
            };

            const customLambdaAgent = new LambdaAgent(customOptions);
            mockLambdaClient.send.mockResolvedValueOnce({
                Payload: new TextEncoder().encode(JSON.stringify({
                    body: JSON.stringify({
                        response: 'test response'
                    })
                }))
            } as never);

            await customLambdaAgent.processRequest(
                testInput,
                testUserId,
                testSessionId,
                testChatHistory,
                testAdditionalParams
            );

            expect(customEncoder).toHaveBeenCalledWith(
                testInput,
                testChatHistory,
                testUserId,
                testSessionId,
                testAdditionalParams
            );

            // Verify custom payload was passed to invoke command
            const invokeCommand = (mockLambdaClient.send as jest.Mock).mock.calls[0][0];
            expect(invokeCommand._params.Payload).toBe('custom encoded payload');
        });

        it('should use custom output payload decoder when provided', async () => {
            const customDecoder = jest.fn().mockReturnValue({
                role: ParticipantRole.ASSISTANT,
                content: [{ text: 'custom decoded response' }]
            }) as any;

            const customOptions = {
                ...defaultOptions,
                outputPayloadDecoder: customDecoder
            };

            const customLambdaAgent = new LambdaAgent(customOptions);
            const mockResponse = {
                Payload: new TextEncoder().encode('test payload')
            } as never;

            mockLambdaClient.send.mockResolvedValueOnce(mockResponse);

            const result = await customLambdaAgent.processRequest(
                testInput,
                testUserId,
                testSessionId,
                testChatHistory
            );

            expect(customDecoder).toHaveBeenCalledWith(mockResponse);
            expect(result).toEqual({
                role: ParticipantRole.ASSISTANT,
                content: [{ text: 'custom decoded response' }]
            });
        });

        it('should handle Lambda invocation errors', async () => {
            const mockError = new Error('Lambda error');
            mockLambdaClient.send.mockRejectedValueOnce(mockError as never);

            await expect(lambdaAgent.processRequest(
                testInput,
                testUserId,
                testSessionId,
                testChatHistory
            )).rejects.toThrow('Lambda error');
        });
    });
});