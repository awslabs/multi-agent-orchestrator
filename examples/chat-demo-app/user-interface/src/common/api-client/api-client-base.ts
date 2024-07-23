import { fetchAuthSession } from "aws-amplify/auth";

export abstract class ApiClientBase {
  protected async getHeaders() {
    return {
      Authorization: `Bearer ${await this.getAccessToken()}`,
      "Content-Type": "application/json",
    };
  }

  protected async getIdToken() {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString();
  }
  protected async getAccessToken() {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString();
  }

  public async callAPI(resource: string, method: string = "GET", body: any = null): Promise<any> {
    const result = await fetch("/aws-exports.json");
    const awsExports = await result.json();

    const url = `${awsExports.domainName}/${resource}`;
    const headers = await this.getHeaders();
    console.log(headers);
    
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null,
      });
      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

  public async callStreamingAPI(resource: string, method: string = "GET", body: any = null): Promise<Response> {
    const result = await fetch("/aws-exports.json");
    const awsExports = await result.json();
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

      return response; // Return the response directly, without creating a new ReadableStream
    } catch (error) {
      throw error;
    }
  }

}
