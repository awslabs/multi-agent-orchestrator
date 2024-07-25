import { MultiAgentOrchestrator } from "../src/orchestrator";
import { MockAgent } from "./mock/mockAgent";
import { Classifier } from '../src/classifiers/classifier';
import { ParticipantRole, ConversationMessage } from '../src/types';
import { BedrockLLMAgent } from '../src/agents/bedrockLLMAgent';

describe("Classifier", () => {
  
    let orchestrator: MultiAgentOrchestrator;

    beforeEach(() => {
        orchestrator = new MultiAgentOrchestrator({
            config: {
              LOG_AGENT_CHAT: true,
              LOG_CLASSIFIER_CHAT: true,
              LOG_CLASSIFIER_RAW_OUTPUT: true,
              LOG_CLASSIFIER_OUTPUT: true,
              LOG_EXECUTION_TIMES: true,
              MAX_MESSAGE_PAIRS_PER_AGENT:10
        
            },
        
          });

          orchestrator.addAgent(new MockAgent({
            name: 'Health Agent',
            description: 'Focuses on health and medical topics such as general wellness, nutrition, diseases, treatments, mental health, fitness, healthcare systems, and medical terminology or concepts.'
          }));

          orchestrator.addAgent(new MockAgent({
            name: 'Math Agent',
            description: 'Math agent is able to performa mathemical computation.'
          }));

          orchestrator.addAgent(new MockAgent({
            name: 'Tech Agent',
            description: 'Specializes in technology areas including software development, hardware, AI, cybersecurity, blockchain, cloud computing, emerging tech innovations, and pricing/costs related to technology products and services.'
          }));

          orchestrator.addAgent(new MockAgent({
            name: 'AirlinesBot',
            description: 'Helps users book and manage their flight reservation'
          }));
    });

    test("Classify test output", async () => {

        let response = await orchestrator.classifier.classify("What is aws lambda", []);    
        expect(response.selectedAgent?.name).toBe('Tech Agent');

        response = await orchestrator.classifier.classify("What is an aspirin", []);    
        expect(response.selectedAgent?.name).toBe('Health Agent');

        response = await orchestrator.classifier.classify("book a flight", []);   
        expect(response.selectedAgent?.name).toBe('AirlinesBot'); 

        response = await orchestrator.classifier.classify("3+5", []);   
        expect(response.selectedAgent?.name).toBe('Math Agent'); 
      }, 15000);

});


describe('Classifier', () => {
  class MockClassifier extends Classifier {
    /* eslint-disable @typescript-eslint/no-unused-vars */
    processRequest(
      inputText: string,
      chatHistory: ConversationMessage[]
    ): Promise<any> {
      throw new Error('Method not implemented.');
    }

    public getAgents(){
      return this.agents;
    }

    public getAgentDescriptions(){
      return this.agentDescriptions;
    }

    public getHistory(){
      return this.history;
    }

    public getPromptTemplate(){
      return this.promptTemplate;
    }

    public getCustomVariables(){
      return this.customVariables;
    }

    public getSystemPrompt(){
      return this.systemPrompt; 
    }

  }

  let classifier: MockClassifier;
  const mockAgent1 = new BedrockLLMAgent({
    name: "BILLING",
    streaming: true,
    description: 'Billing agent',
  });
  const mockAgent2 = new BedrockLLMAgent({
    name: "TECHNICAL",
    streaming: true,
    description: 'Technical agent',
  });

  beforeEach(() => {
    classifier = new MockClassifier();
  });

  describe('setAgents', () => {
    it('should set the agents and agentDescriptions correctly', () => {
      const agents = {
        [mockAgent1.id]: mockAgent1,
        [mockAgent2.id]: mockAgent2,
      };
      classifier.setAgents(agents);
      expect(classifier.getAgents()).toEqual(agents);
      expect(classifier.getAgentDescriptions()).toBe(
        `${mockAgent1.id}:${mockAgent1.description}\n\n${mockAgent2.id}:${mockAgent2.description}`
      );
    });
  });

  describe('setHistory', () => {
    it('should set the history correctly', () => {
      const messages: ConversationMessage[] = [
        { role: ParticipantRole.USER, content: [{ text: 'Hello' }] },
        { role: ParticipantRole.ASSISTANT, content: [{ text: 'Hi there!' }] },
      ];
      classifier.setHistory(messages);
      expect(classifier.getHistory()).toBe('user: Hello\nassistant: Hi there!');
    });
  });

  describe('setSystemPrompt', () => {
    it('should set the promptTemplate and customVariables correctly', () => {
      const template = 'This is a custom template';
      const variables = { key1: 'value1', key2: 'value2' };
      classifier.setSystemPrompt(template, variables);
      expect(classifier.getPromptTemplate()).toBe(template);
      expect(classifier.getCustomVariables()).toEqual(variables);
    });
  });

  describe('formatMessages', () => {
    it('should format the messages correctly', () => {
      const messages: ConversationMessage[] = [
        { role: ParticipantRole.USER, content: [{ text: 'Hello' }] },
        { role: ParticipantRole.ASSISTANT, content: [{ text: 'Hi' }, { text: 'there!' }] },
      ];
      const formattedMessages = classifier['formatMessages'](messages);
      expect(formattedMessages).toBe('user: Hello\nassistant: Hi there!');
    });
  });

  describe('updateSystemPrompt', () => {
    it('should update the systemPrompt correctly', () => {
      const agents = {
        [mockAgent1.id]: mockAgent1,
        [mockAgent2.id]: mockAgent2,
      };
      classifier.setAgents(agents);
      const messages: ConversationMessage[] = [
        { role: ParticipantRole.USER, content: [{ text: 'Hello' }] },
        { role: ParticipantRole.ASSISTANT, content: [{ text: 'Hi there!' }] },
      ];
      classifier.setHistory(messages);
      classifier['updateSystemPrompt']();
      const expectedPrompt = classifier.getPromptTemplate()
        .replace('{{AGENT_DESCRIPTIONS}}', classifier.getAgentDescriptions())
        .replace('{{HISTORY}}', classifier.getHistory());
      expect(classifier.getSystemPrompt()).toBe(expectedPrompt);
    });
  });
});
