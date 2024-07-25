import { Agent, AgentOptions } from '../../src/agents/agent'
import { ConversationMessage, ParticipantRole } from '../../src/types'

/**
 * This class defines an agent that can be used for unit testing.
 */
export class MockAgent extends Agent {
    private agentResponse: string;

    constructor(options: AgentOptions) {
        super(options);
        this.description = options.description;
      }

/**
 * This method sets the agent response.
 * @param response 
 */
    public setAgentResponse(response:string){
        this.agentResponse = response;
    }
/**
   * Abstract method to process a request.
   * This method must be implemented by all concrete agent classes.
   *
   * @param inputText - The user input as a string.
   * @param chatHistory - An array of Message objects representing the conversation history.
   * @param additionalParams - Optional additional parameters as key-value pairs.
   * @returns A Promise that resolves to a Message object containing the agent's response.
   */
  /* eslint-disable @typescript-eslint/no-unused-vars */
  async processRequest(
    inputText: string,
    userId: string,
    sessionId: string,
    chatHistory: ConversationMessage[],
    additionalParams?: Record<string, string>
  ): Promise<ConversationMessage | AsyncIterable<any>> {
    return Promise.resolve({ role: ParticipantRole.ASSISTANT, content: [{ text: this.agentResponse }] });
  }
}
