import { Amplify, ResourcesConfig } from 'aws-amplify';
import { fetchAuthSession } from 'aws-amplify/auth';

interface ExtendedResourcesConfig extends ResourcesConfig {
  region: string;
  domainName: string;
}


let awsExports: ExtendedResourcesConfig;

export async function configureAmplify(): Promise<void> {
  if (!awsExports) {
    try {
      const awsExportsUrl = new URL('/aws-exports.json', window.location.href).toString();
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

  if (!awsExports) {
    throw new Error("AWS exports configuration is not available");
  }

  Amplify.configure(awsExports);
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

export async function getAwsExports(): Promise<ExtendedResourcesConfig> {
  if (!awsExports) {
    await configureAmplify();
  }
  return awsExports;
}