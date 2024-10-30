import { getAwsExports } from './amplifyConfig';
import { fetchAuthSession } from "aws-amplify/auth";

class ApiClientBase {

  async getHeaders(): Promise<Record<string, string>> {
    return {
      Authorization: `Bearer ${await this.getAccessToken()}`,
      "Content-Type": "application/json",
    };
  }

  async getAccessToken(): Promise<string | undefined> {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString();
  }

  async callStreamingAPI(resource: string, method: string = "GET", body: any = null): Promise<Response> {
    const awsExports = await getAwsExports();
    if (!awsExports) {
      throw new Error("AWS exports not available");
    }
    const url = `${awsExports.domainName}/${resource}`;
    try {
      const headers = await this.getHeaders();
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
      });
      if (!response.ok) {
        const errorResponse = await response.json();
        throw new Error(errorResponse.message || "Network response was not ok");
      }
      return response;
    } catch (error) {
      throw error;
    }
  }
}

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