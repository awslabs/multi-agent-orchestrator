export interface NavigationPanelState {
  collapsed?: boolean;
  collapsedSections?: Record<number, boolean>;
}


export interface MultiAgentResponse {
  intent: string;
  agentId: string;
  agentName: string;
  response: string;
  language: string;
  languageConfidence: number;
  userInput: string;
  userId: string;
  sessionId: string;
  additionalParams: any;
}

export interface ChatResponse {
  error: boolean;
  response: MultiAgentResponse;
}


export interface AgentProcessingResult {
  userInput: string;
  agentId: string;
  agentName: string;
  language: string;
  languageConfidence: number;
  userId: string;
  sessionId: string;
  additionalParams: Record<string, any>;
}


export type AgentResponse = {
  metadata: any;
  output: any;
  streaming: boolean;
};
