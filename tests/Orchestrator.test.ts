import { MultiAgentOrchestrator, OrchestratorOptions } from '../src/orchestrator';
import { Agent, AgentOptions } from '../src/agents/agent';
import { BedrockClassifier } from '../src/classifiers/bedrockClassifier';
import { InMemoryChatStorage } from '../src/storage/memoryChatStorage';
import { ParticipantRole } from '../src/types/index';
import { ClassifierResult } from '../src/classifiers/classifier';
import { ConversationMessage } from '../src/types/index';
import { AccumulatorTransform } from '../src/utils/helpers';

// Mock the dependencies
jest.mock('../src/agents/agent');
jest.mock('../src/classifiers/bedrockClassifier');
jest.mock('../src/storage/memoryChatStorage');
jest.mock('../src/utils/helpers');

// Create a mock Agent class
class MockAgent extends Agent {
    constructor(options: AgentOptions) {
      super(options);
    }
  
    async processRequest(
      _inputText: string,
      _userId: string,
      _sessionId: string,
      _chatHistory: ConversationMessage[],
      _additionalParams?: Record<string, string>
    ): Promise<ConversationMessage | AsyncIterable<any>> {
      // This is a mock implementation
      return {
        role: ParticipantRole.ASSISTANT,
        content: [{ text: 'Mock response' }],
      };
    }
  }

describe('MultiAgentOrchestrator', () => {
  let orchestrator: MultiAgentOrchestrator;
  let mockAgent: jest.Mocked<MockAgent>;
  let mockClassifier: jest.Mocked<BedrockClassifier>;
  let mockStorage: jest.Mocked<InMemoryChatStorage>;

  beforeEach(() => {
    // Create mock instances
    mockAgent = {
      id: 'test-agent',
      name: 'Test Agent',
      description: 'A test agent',
      processRequest: jest.fn(),
    } as unknown as jest.Mocked<Agent>;

    mockClassifier = new BedrockClassifier() as jest.Mocked<BedrockClassifier>;
    mockStorage = new InMemoryChatStorage() as jest.Mocked<InMemoryChatStorage>;

    // Configure orchestrator options
    const options: OrchestratorOptions = {
      storage: mockStorage,
      classifier: mockClassifier,
      config: {
        LOG_EXECUTION_TIMES: true,
        USE_DEFAULT_AGENT_IF_NONE_IDENTIFIED: true,
      },
    };

    // Create orchestrator instance
    orchestrator = new MultiAgentOrchestrator(options);
    orchestrator.addAgent(mockAgent);
  });

  test('addAgent adds an agent and updates classifier', () => {
    const newAgent: Agent = {
      id: 'new-agent',
      name: 'New Agent',
      description: 'A new test agent',
      processRequest: jest.fn(),
    } as unknown as jest.Mocked<Agent>;

    orchestrator.addAgent(newAgent);
    expect(mockClassifier.setAgents).toHaveBeenCalled();
  });

  test('getAllAgents returns all added agents', () => {
    const agents = orchestrator.getAllAgents();
    expect(agents).toHaveProperty('test-agent');
    expect(agents['test-agent']).toEqual({
      name: 'Test Agent',
      description: 'A test agent',
    });
  });

  test('routeRequest with identified agent', async () => {
    const userInput = 'Test input';
    const userId = 'user1';
    const sessionId = 'session1';

    const mockClassifierResult: ClassifierResult = {
      selectedAgent: mockAgent,
      confidence: 0.8,
    };

    mockClassifier.classify.mockResolvedValue(mockClassifierResult);

    (mockAgent.processRequest as jest.Mock).mockImplementation(async () => ({
      role: 'assistant',
      content: [{ text: 'Agent response' }],
    }));

    mockStorage.fetchAllChats.mockResolvedValue([]);

    const response = await orchestrator.routeRequest(userInput, userId, sessionId);

    expect(response.output).toBe('Agent response');
    expect(response.metadata.agentId).toBe(mockAgent.id);
    expect(mockStorage.fetchAllChats).toHaveBeenCalledWith(userId, sessionId);
    expect(mockClassifier.classify).toHaveBeenCalledWith(userInput, []);
    expect(mockAgent.processRequest).toHaveBeenCalled();
  });

//   test('routeRequest with no identified agent', async () => {
//     const userInput = 'Unclassifiable input';
//     const userId = 'user1';
//     const sessionId = 'session1';

//     const mockClassifierResult: ClassifierResult = {
//       selectedAgent: null,
//       confidence: 0,
//     };

//     mockClassifier.classify.mockResolvedValue(mockClassifierResult);

//     const defaultAgent = orchestrator.getDefaultAgent();
//     jest.spyOn(defaultAgent, 'processRequest').mockImplementation(async () => ({
//       role: 'assistant',
//       content: [{ text: 'Default agent response' }],
//     }));

//     const response = await orchestrator.routeRequest(userInput, userId, sessionId);

//     expect(response.output).toBe('Default agent response');
//     expect(response.metadata.agentId).toBe(AgentTypes.DEFAULT);
//   });

//   test('routeRequest with classification error', async () => {
//     const userInput = 'Error-causing input';
//     const userId = 'user1';
//     const sessionId = 'session1';

//     mockClassifier.classify.mockRejectedValue(new Error('Classification error'));

//     const response = await orchestrator.routeRequest(userInput, userId, sessionId);

//     expect(response.output).toBe(orchestrator['config'].CLASSIFICATION_ERROR_MESSAGE);
//     expect(response.metadata.errorType).toBe('classification_failed');
//   });

  test('routeRequest with streaming response', async () => {
    const userInput = 'Stream input';
    const userId = 'user1';
    const sessionId = 'session1';

    const mockClassifierResult: ClassifierResult = {
      selectedAgent: mockAgent,
      confidence: 0.8,
    };

    mockClassifier.classify.mockResolvedValue(mockClassifierResult);

    const mockStream = (async function* () {
      yield 'Chunk 1';
      yield 'Chunk 2';
    })();

    mockAgent.processRequest.mockResolvedValue(mockStream);

    const mockAccumulatorTransform = new AccumulatorTransform();
    (AccumulatorTransform as jest.MockedClass<typeof AccumulatorTransform>).mockImplementation(() => mockAccumulatorTransform);

    const response = await orchestrator.routeRequest(userInput, userId, sessionId);

    expect(response.streaming).toBe(true);
    expect(response.output).toBe(mockAccumulatorTransform);
  });

  test('setDefaultAgent changes the default agent', () => {
    const newDefaultAgent: Agent = {
      id: 'new-default',
      name: 'New Default Agent',
      description: 'A new default agent',
      processRequest: jest.fn(),
    } as unknown as jest.Mocked<Agent>;

    orchestrator.setDefaultAgent(newDefaultAgent);
    expect(orchestrator.getDefaultAgent()).toBe(newDefaultAgent);
  });

  test('setClassifier changes the classifier', () => {
    const newClassifier = new BedrockClassifier();
    orchestrator.setClassifier(newClassifier);
    expect(orchestrator['classifier']).toBe(newClassifier);
  });
});