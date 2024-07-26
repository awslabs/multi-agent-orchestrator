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
