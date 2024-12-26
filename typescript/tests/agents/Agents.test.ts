import { ConversationMessage, ParticipantRole } from '../../src/types';
import { MockAgent } from '../mock/mockAgent'; // MockAgent extends Agent
import { AgentOptions } from '../../src/agents/agent';

describe('Agents', () => {
  describe('generateKeyFromName', () => {
    it('should remove non-alphanumeric characters and replace spaces with hyphens', () => {
      const agent = new MockAgent({ name: 'Test Agent', description: 'Test description' });
      const key = agent['generateKeyFromName']('Hello, World!');
      expect(key).toBe('hello-world');
    });

    it('should convert the key to lowercase', () => {
      const agent = new MockAgent({ name: 'Test Agent', description: 'Test description' });
      const key = agent['generateKeyFromName']('UPPERCASE');
      expect(key).toBe('uppercase');
    });

    it('should convert the key to lowercase and keep the numbers', () => {
      const agent = new MockAgent({ name: 'Test Agent', description: 'Test description' });
      const key = agent['generateKeyFromName']('Agent123');
      expect(key).toBe('agent123');
    });

    it('should convert the key to lowercase', () => {
      const agent = new MockAgent({ name: 'Test Agent', description: 'Test description' });
      const key = agent['generateKeyFromName']('Agent2-test');
      expect(key).toBe('agent2-test');
    });
    
    it('should handle multiple spaces', () => {
      const agent = new MockAgent({ name: 'Test Agent', description: 'Test description' });
      const key = agent['generateKeyFromName']('Agent 123!');
      expect(key).toBe('agent-123');
    });

    it('should remove special characters', () => {
      const agent = new MockAgent({ name: 'Test Agent', description: 'Test description' });
      const key = agent['generateKeyFromName']('Agent@#$%^&*()');
      expect(key).toBe('agent');
    });

    it('should handle mixed content with numbers', () => {
      const agent = new MockAgent({ name: 'Test Agent', description: 'Test description' });
      const key = agent['generateKeyFromName']('123 Mixed Content 456!');
      expect(key).toBe('123-mixed-content-456');
    });

    it('should remove special characters from mixed symbols', () => {
      const agent = new MockAgent({ name: 'Test Agent', description: 'Test description' });
      const key = agent['generateKeyFromName']('Mix@of123Symbols$');
      expect(key).toBe('mixof123symbols');
    });
  });

  describe('constructor', () => {
    it('should set the name, id, and description properties correctly', () => {
      const options: AgentOptions = {
        name: 'Test Agent',
        description: 'Test description',
      };
      const agent = new MockAgent(options);
      expect(agent.name).toBe('Test Agent');
      expect(agent.id).toBe('test-agent');
      expect(agent.description).toBe('Test description');
    });
  });

  describe('ProcessRequest', () => {
    it('should return a ConversationMessage with the correct role and content', async () => {
        const userId = 'userId';
        const sessionId = 'sessionId';

        const agent = new MockAgent({ name: 'Test Agent', description: 'Test description' });
        const message: ConversationMessage = {role: ParticipantRole.USER, content: ['Hello']};
        agent.setAgentResponse('This is me');
        const response:any = await agent.processRequest('Hello', userId, sessionId, [message]);
        expect(response.role).toBe(ParticipantRole.ASSISTANT);
        expect(response.content?.[0].text).toBe('This is me');
    });
  })
});
