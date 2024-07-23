export enum ChatMessageType {
  AI = "ai",
  Human = "human",
}

export interface ChatMessage {
  type: ChatMessageType;
  message: string;
  timestamp: number;
}
