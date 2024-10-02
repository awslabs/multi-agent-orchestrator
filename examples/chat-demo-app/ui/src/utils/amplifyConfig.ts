import { Amplify } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';

interface AwsExports {
  Auth: {
    Cognito: {
      userPoolId: string;
      userPoolClientId: string;
      identityPoolId: string;
    }
  };
  domainName: string;
  region: string;
}

let awsExports: AwsExports | null = null;

export async function configureAmplify(awsExportsUrl: string, preloadedConfig: AwsExports | null = null): Promise<void> {
  if (!awsExports) {
    if (preloadedConfig) {
      awsExports = preloadedConfig;
    } else {
      try {
        console.log("Fetching from:", awsExportsUrl);
        const response = await fetch(awsExportsUrl);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        awsExports = await response.json();
        console.log("Fetched AWS exports:", awsExports);
      } catch (error) {
        console.error("Failed to fetch aws-exports.json:", error);
        throw error;
      }
    }
  }

  const config = {
    Auth: {
      Cognito: {
        userPoolId: awsExports.Auth.Cognito.userPoolId,
        userPoolClientId: awsExports.Auth.Cognito.userPoolClientId,
        identityPoolId: awsExports.Auth.Cognito.identityPoolId,
      }
    },
    API: {
      REST: {
        MyAPI: {
          endpoint: awsExports.domainName,
          region: awsExports.region
        },
      }
    }
  };

  Amplify.configure(config);
}

export async function getAuthToken(): Promise<string | undefined> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString();
  } catch (error) {
    console.error("Error getting auth token:", error);
    throw error;
  }
}

export async function getAwsExports(): Promise<AwsExports | null> {
  return awsExports;
}