import { SQSEvent, SQSHandler } from 'aws-lambda';
import axios from 'axios';
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { HttpRequest } from "@aws-sdk/protocol-http";
const APPSYNC_API_URL = process.env.APPSYNC_API_URL;
const REGION = process.env.REGION;

if (!APPSYNC_API_URL) {
  throw new Error("APPSYNC_API_URL environment variable is not set");
}

if (!REGION) {
  throw new Error("AWS_REGION environment variable is not set");
}

const sendResponseMutation = `
  mutation SendResponse($destination: String!, $message: String!) {
    sendResponse(destination: $destination, message: $message) {
      destination
      message
    }
  }
`;

const signer = new SignatureV4({
  credentials: defaultProvider(),
  region: REGION,
  service: 'appsync',
  sha256: Sha256
});

async function sendSignedRequest(variables: { destination: string; message: string }) {
  const endpoint = new URL(APPSYNC_API_URL!);

  const request = new HttpRequest({
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      host: endpoint.hostname
    },
    hostname: endpoint.hostname,
    path: endpoint.pathname,
    body: JSON.stringify({
      query: sendResponseMutation,
      variables: variables
    })
  });

  console.log('Request before signing:', JSON.stringify(request, null, 2));

  const signedRequest = await signer.sign(request);

  console.log('Signed request:', JSON.stringify(signedRequest, null, 2));

  try {
    const response = await axios({
      method: signedRequest.method,
      url: APPSYNC_API_URL,
      headers: signedRequest.headers,
      data: signedRequest.body
    });

    console.log('AppSync response:', JSON.stringify(response.data, null, 2));
    return response;
  } catch (error) {
    console.error('Error details:', error.response?.data);
    throw error;
  }
}


export const handler: SQSHandler = async (event: SQSEvent) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      console.log('Processing message:', body);

      const variables = {
        destination: body.destination,
        message: body.message
      };

      const response = await sendSignedRequest(variables);

      console.log('AppSync response:', JSON.stringify(response.data, null, 2));

      if (response.data.errors) {
        console.error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
        // Log the error but don't throw, allowing the message to be deleted from SQS
      }
    } catch (error) {
      console.error('Error processing SQS message:', error);
      // Log the error but don't throw, allowing the message to be deleted from SQS
    }
  }

  console.log('All messages processed');
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Messages processed'
    })
  };
};