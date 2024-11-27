import { Classifier, ClassifierResult } from "../../src/classifiers/classifier";
import { Agent } from "../../src/agents/agent";
import { ConversationMessage, ParticipantRole, TemplateVariables } from "../../src/types";
import { BedrockLLMAgent } from "../../src/agents/bedrockLLMAgent";

class MockBedrockLLMAgent extends BedrockLLMAgent {
  constructor(config: { name: string; streaming: boolean; description: string }) {
    super(config);
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async processRequest(
    inputText: string,
    userId: string,
    sessionId: string,
    chatHistory: ConversationMessage[],
    additionalParams?: Record<string, string>
  ): Promise<ConversationMessage | AsyncIterable<any>> {
    throw new Error('Method not implemented.');
  }
}


// Mock implementation of the abstract Classifier class
class MockClassifier extends Classifier {
  async processRequest(
    inputText: string,
    chatHistory: ConversationMessage[]
  ): Promise<ClassifierResult> {
    if (inputText.includes('tech')) {
      return {
        selectedAgent: this.getAgentById('tech-agent'),
        confidence: 0.9
      };
    } else if (inputText.includes('billing')) {
      return {
        selectedAgent: this.getAgentById('billing-agent'),
        confidence: 0.8
      };
    }
    return {
      selectedAgent: null,
      confidence: 0.5
    };
  }
}

describe('Classifier', () => {
  let classifier: MockClassifier;
  let mockAgents: { [key: string]: Agent };

  beforeEach(() => {
    classifier = new MockClassifier();
    mockAgents = {
      'tech-agent': new MockBedrockLLMAgent({
        name: "tech-agent",
        streaming: true,
        description: 'A tech support agent',
      }),
      'billing-agent': new MockBedrockLLMAgent({
        name: "billing-agent",
        streaming: true,
        description: 'A billing support agent',
      }),
    };
    classifier.setAgents(mockAgents);
  });

  describe('setAgents', () => {
    test('should set agent descriptions', () => {
      expect(classifier['agentDescriptions']).toContain('tech-agent:A tech support agent');
      expect(classifier['agentDescriptions']).toContain('billing-agent:A billing support agent');
    });

    test('should set agents property', () => {
      expect(classifier['agents']).toEqual(mockAgents);
    });
  });

  describe('setHistory', () => {
    test('should format messages correctly', () => {
      const messages: ConversationMessage[] = [
        { role: ParticipantRole.USER, content: [{ text: 'Hello' }] },
        { role: ParticipantRole.ASSISTANT, content: [{ text: 'Hi there!' }] },
      ];
      classifier.setHistory(messages);
      expect(classifier['history']).toBe('user: Hello\nassistant: Hi there!');
    });

    test('should handle empty messages array', () => {
      classifier.setHistory([]);
      expect(classifier['history']).toBe('');
    });

    test('should handle multiple content items', () => {
      const messages: ConversationMessage[] = [
        { role: ParticipantRole.USER, content: [{ text: 'Hello' }, { text: 'World' }] },
      ];
      classifier.setHistory(messages);
      expect(classifier['history']).toBe('user: Hello World');
    });
  });

  describe('setSystemPrompt', () => {
    test('should update promptTemplate when provided', () => {
      const newTemplate = 'New template {{CUSTOM_VAR}}';
      classifier.setSystemPrompt(newTemplate);
      expect(classifier['promptTemplate']).toBe(newTemplate);
    });

    test('should update customVariables when provided', () => {
      const variables: TemplateVariables = { CUSTOM_VAR: 'Custom value' };
      classifier.setSystemPrompt(undefined, variables);
      expect(classifier['customVariables']).toEqual(variables);
    });

    test('should update both promptTemplate and customVariables when provided', () => {
      const newTemplate = 'New template {{CUSTOM_VAR}}';
      const variables: TemplateVariables = { CUSTOM_VAR: 'Custom value' };
      classifier.setSystemPrompt(newTemplate, variables);
      expect(classifier['promptTemplate']).toBe(newTemplate);
      expect(classifier['customVariables']).toEqual(variables);
    });

    test('should call updateSystemPrompt', () => {
      const spy = jest.spyOn(classifier as any, 'updateSystemPrompt');
      classifier.setSystemPrompt();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('classify', () => {
    test('should set history and update system prompt before processing', async () => {
      const setHistorySpy = jest.spyOn(classifier, 'setHistory');
      const updateSystemPromptSpy = jest.spyOn(classifier as any, 'updateSystemPrompt');
      const processRequestSpy = jest.spyOn(classifier, 'processRequest');

      await classifier.classify('test input', []);

      expect(setHistorySpy).toHaveBeenCalled();
      expect(updateSystemPromptSpy).toHaveBeenCalled();
      expect(processRequestSpy).toHaveBeenCalled();
    });

    test('should return ClassifierResult for tech-related input', async () => {
      const result = await classifier.classify('I have a tech question', []);
      expect(result.selectedAgent).toBe(mockAgents['tech-agent']);
      expect(result.confidence).toBe(0.9);
    });

    test('should return ClassifierResult for billing-related input', async () => {
      const result = await classifier.classify('I have a billing question', []);
      expect(result.selectedAgent).toBe(mockAgents['billing-agent']);
      expect(result.confidence).toBe(0.8);
    });

    test('should return default agent for non-specific input', async () => {
      const result = await classifier.classify('General question', []);
      expect(result.selectedAgent).toBe(null);
      expect(result.confidence).toBe(0.5);
    });
  });

  describe('getAgentById', () => {
    test('should return the correct agent', () => {
      const agent = classifier['getAgentById']('tech-agent');
      expect(agent).toBe(mockAgents['tech-agent']);
    });

    test('should return null for non-existent agent', () => {
      const agent = classifier['getAgentById']('non-existent-agent');
      expect(agent).toBeNull();
    });

    test('should handle empty string', () => {
      const agent = classifier['getAgentById']('');
      expect(agent).toBeNull();
    });

    test('should handle agent id with spaces', () => {
      const agent = classifier['getAgentById']('tech-agent with spaces');
      expect(agent).toBe(mockAgents['tech-agent']);
    });
  });

  describe('replaceplaceholders', () => {
    test('should replace placeholders with provided variables', () => {
      const template = 'Hello {{NAME}}, welcome to {{PLACE}}!';
      const variables: TemplateVariables = { NAME: 'John', PLACE: 'Paris' };
      const result = classifier['replaceplaceholders'](template, variables);
      expect(result).toBe('Hello John, welcome to Paris!');
    });

    test('should handle array values', () => {
      const template = 'Items: {{ITEMS}}';
      const variables: TemplateVariables = { ITEMS: ['apple', 'banana', 'orange'] };
      const result = classifier['replaceplaceholders'](template, variables);
      expect(result).toBe('Items: apple\nbanana\norange');
    });

    test('should leave unmatched placeholders unchanged', () => {
      const template = 'Hello {{NAME}}, today is {{DATE}}';
      const variables: TemplateVariables = { NAME: 'Alice' };
      const result = classifier['replaceplaceholders'](template, variables);
      expect(result).toBe('Hello Alice, today is {{DATE}}');
    });
  });

  describe('updateSystemPrompt', () => {
    test('should update systemPrompt with all variables', () => {
      classifier['agentDescriptions'] = 'Agent Descriptions';
      classifier['history'] = 'Chat History';
      classifier['updateSystemPrompt']();
      expect(classifier['systemPrompt']).toContain('Agent Descriptions');
      expect(classifier['systemPrompt']).toContain('Chat History');
    });
  });
});
