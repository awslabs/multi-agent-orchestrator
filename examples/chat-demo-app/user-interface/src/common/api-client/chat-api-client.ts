// import { post } from "aws-amplify/api";
import { ChatResponse } from "../types";
// import { API_NAME } from "../constants";
import { ApiClientBase } from "./api-client-base";

export class ChatApiClient extends ApiClientBase {
  async query(path: string, message: string): Promise<Response> {
    const body = {
      'query': message,
      'sessionId': localStorage.getItem('sessionId'),
      'userId': localStorage.getItem('sessionId')
    };
    return this.callStreamingAPI(path, "POST", body);
  }

}
