import { HistoryApiClient } from "./history-api-client"
import { ChatApiClient } from "./chat-api-client";

export class ApiClient {
  private __historyClient: HistoryApiClient | undefined;
  private __chatClient: ChatApiClient | undefined;

  public get history() {
    if (!this.__historyClient) {
      this.__historyClient = new HistoryApiClient();
    }

    return this.__historyClient;
  }

  public get chat() {
    if (!this.__chatClient) {
      this.__chatClient = new ChatApiClient();
    }
    return this.__chatClient
  }
}
