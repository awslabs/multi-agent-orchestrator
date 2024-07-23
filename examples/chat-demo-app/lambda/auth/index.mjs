import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { fromBase64 } from "@aws-sdk/util-base64-node";

const client = new SecretsManagerClient({ region: "us-east-1" });
const secretName = "UserPoolSecretConfig";

import * as jose from "jose";
import axios from "axios";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { HttpRequest } from "@aws-sdk/protocol-http";
const { createHash, createHmac } = await import("node:crypto");

const credentialProvider = fromNodeProviderChain();
const credentials = await credentialProvider();

const REGION = "us-east-1";

const getSecrets = async () => {
  try {
    const data = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    if ("SecretString" in data) {
      return JSON.parse(data.SecretString);
    } else if ("SecretBinary" in data) {
      const buff = fromBase64(data.SecretBinary);
      return JSON.parse(buff.toString("ascii"));
    }
  } catch (err) {
    console.error("Error fetching secret:", err);
    throw err;
  }
};

function Sha256(secret) {
  return secret ? createHmac("sha256", secret) : createHash("sha256");
}

async function signRequest(request) {
  let headers = request.headers;

  // remove the x-forwarded-for from the signature
  delete headers["x-forwarded-for"];

  if (!request.origin.hasOwnProperty("custom"))
    throw (
      "Unexpected origin type. Expected 'custom'. Got: " +
      JSON.stringify(request.origin)
    );

  // remove the "behaviour" path from the uri to send to Lambda
  // ex: /updateBook/1234 => /1234
  let uri = request.uri.substring(1);
  let urisplit = uri.split("/");
  urisplit.shift(); // remove the first part (getBooks, createBook, ...)
  uri = "/" + urisplit.join("/");
  request.uri = uri;

  const hostname = headers["host"][0].value;
  const region = hostname.split(".")[2];
  const path =
    request.uri + (request.querystring ? "?" + request.querystring : "");

  // build the request to sign
  const req = new HttpRequest({
    hostname,
    path,
    body:
      request.body && request.body.data
        ? Buffer.from(request.body.data, request.body.encoding)
        : undefined,
    method: request.method,
  });
  for (const header of Object.values(headers)) {
    req.headers[header[0].key] = header[0].value;
  }

  // sign the request with Signature V4 and the credentials of the edge function itself
  const signer = new SignatureV4({
    credentials,
    region,
    service: "lambda",
    sha256: Sha256,
  });

  const signedRequest = await signer.sign(req);

  // reformat the headers for CloudFront
  const signedHeaders = {};
  for (const header in signedRequest.headers) {
    signedHeaders[header.toLowerCase()] = [
      {
        key: header,
        value: signedRequest.headers[header].toString(),
      },
    ];
  }

  return {
    ...request,
    headers: {
      ...request.headers,
      ...signedHeaders,
    },
  };
}

const getToken = async (authorization) => {
  return new Promise((resolve, reject) => {
    try {
      const [, token] = authorization.split(" ");
      resolve(token);
    } catch (error) {
      reject(error);
    }
  });
};

async function verifyToken(authorization) {
  console.log(
    "authorization=" + authorization 
  );

  const token = await getToken(authorization);
  console.log("token="+token);

  const secrets = await getSecrets();
  
  const jwksRes = await axios.get(
    `https://cognito-idp.${REGION}.amazonaws.com/${secrets.UserPoolID}/.well-known/jwks.json`
  );

  const jwk = jose.createLocalJWKSet(jwksRes.data);
  try {
    const { payload } = await jose.jwtVerify(token, jwk, {
      issuer: `https://cognito-idp.${REGION}.amazonaws.com/${secrets.UserPoolID}`,
    });
    if (payload.client_id === secrets.ClientID) {
      return true;
    }
  } catch (err) {
    console.log(`token error: ${err.name} ${err.message}`);
  }

  return false;
}

//exports.handler = async function (event) {
export const handler = async (event) => {
  //console.log("event=" + JSON.stringify(event));

  try {
    const request = event.Records[0].cf.request;

    if(request.method === 'OPTIONS') {
      console.log("OPTIONS call, return cors headers")
      return {
        status: "204",
        headers: {
                'access-control-allow-origin': [{
                    key: 'Access-Control-Allow-Origin',
                    value: "*",
                }],
                 'access-control-request-method': [{
                    key: 'Access-Control-Request-Method',
                    value: "POST, GET, OPTIONS",
                }],
                 'access-control-allow-headers': [{
                    key: 'Access-Control-Allow-Headers',
                    value: "*",
                }]
        },
      }
    }
    //const authorization = request.headers.authorization[0]?.value;
    const authorization = request.headers.authorization && request.headers.authorization[0]?.value;
    //console.log("authorization="+authorization)
    if (authorization) {
      
      const valid = await verifyToken(
        authorization       
      );

      console.log("valid=" + valid);

      if (valid === true) {
        const signedRequest = await signRequest(request);
        console.info("signed request=" + JSON.stringify(signedRequest));
        return signedRequest;
      } else {
        return {
          status: "400",
          statusDescription: "Bad Request",
          body: "Invalid token",
        };
      }
    } else {
      console.log("No token found in Authorization header")
      return {
        status: "400",
        statusDescription: "Bad Request",
        body: "No token found in Authorization header",
      };
    }
  } catch (e) {
    console.log("Unknown error")
    return {
      status: "400",
      statusDescription: "Bad Request",
      body: "Bad request",
    };
  }
};
