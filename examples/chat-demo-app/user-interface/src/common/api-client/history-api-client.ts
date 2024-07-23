import { get } from "aws-amplify/api";
import { ChatMessage } from "../../components/chat-ui/types";
import { API_NAME } from "../constants";
import { ApiClientBase } from "./api-client-base";

export class HistoryApiClient extends ApiClientBase {
  async getHistory(sessionId:string): Promise<ChatMessage[]> {
    const headers = await this.getHeaders();
    const restOperation = get({
      apiName: API_NAME,
      path: `/history/${sessionId}`,
      options: {
        headers,
      },
    });

    const response = await restOperation.response;
    const { data = [] } = (await response.body.json()) as any;

    return data;
  }
}
