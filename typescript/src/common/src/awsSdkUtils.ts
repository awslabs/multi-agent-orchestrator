import type { MiddlewareArgsLike, SdkClient } from './types/awsSdk';
import { MAOTS_VERSION } from './version';

const EXEC_ENV = process.env.AWS_EXECUTION_ENV || 'NA';
const middlewareOptions = {
  relation: 'after',
  toMiddleware: 'getUserAgentMiddleware',
  name: 'addMaoToUserAgent',
  tags: ['MAOTS', 'USER_AGENT'],
};

/**
 * Type guard to check if the client provided is a valid AWS SDK v3 client.
 *
 * @internal
 */
const isSdkClient = (client: unknown): client is SdkClient =>
  typeof client === 'object' &&
  client !== null &&
  'send' in client &&
  typeof client.send === 'function' &&
  'config' in client &&
  client.config !== undefined &&
  typeof client.config === 'object' &&
  client.config !== null &&
  'middlewareStack' in client &&
  client.middlewareStack !== undefined &&
  typeof client.middlewareStack === 'object' &&
  client.middlewareStack !== null &&
  'identify' in client.middlewareStack &&
  typeof client.middlewareStack.identify === 'function' &&
  'addRelativeTo' in client.middlewareStack &&
  typeof client.middlewareStack.addRelativeTo === 'function';

/**
 * Helper function to create a custom user agent middleware for the AWS SDK v3 clients.
 *
 * The middleware will append the provided feature name and the current version of
 * the Mao for AWS Lambda library to the user agent string.
 *
 * @example "MAOTS/Bedrock-classifier/2.1.0 PTEnv/nodejs20x"
 *
 * @param feature The feature name to be added to the user agent
 *
 * @internal
 */
const customUserAgentMiddleware = (feature: string) => {
  return <T extends MiddlewareArgsLike>(next: (arg0: T) => Promise<T>) =>
    async (args: T) => {
      const existingUserAgent = args.request.headers['user-agent'] || '';
      if (existingUserAgent.includes('MAOTS/NO-OP')) {
        const featureSpecificUserAgent = existingUserAgent.replace(
          'MAOTS/NO-OP',
          `MAOTS/${feature}/${MAOTS_VERSION} MAOTSEnv/${EXEC_ENV}`
        );

        args.request.headers['user-agent'] = featureSpecificUserAgent;
        return await next(args);
      }
      if (existingUserAgent.includes('MAOTS/')) {
        return await next(args);
      }
      args.request.headers['user-agent'] =
        existingUserAgent === ''
          ? `MAOTS/${feature}/${MAOTS_VERSION} MAOTSEnv/${EXEC_ENV}`
          : `${existingUserAgent} MAOTS/${feature}/${MAOTS_VERSION} MAOTSEnv/${EXEC_ENV}`;

      return await next(args);
    };
};

/**
 * Check if the provided middleware stack already has the Mao for AWS Lambda
 * user agent middleware.
 *
 * @param middlewareStack The middleware stack to check
 *
 * @internal
 */
const hasMao = (middlewareStack: string[]): boolean => {
  let found = false;
  for (const middleware of middlewareStack) {
    if (middleware.includes('addMaoToUserAgent')) {
      found = true;
    }
  }

  return found;
};

/**
 * Add the MAo for AWS Lambda user agent middleware to the
 * AWS SDK v3 client provided.
 *
 * We use this middleware to unbotrusively track the usage of the library
 * and secure continued investment in the project.
 *
 * @param client The AWS SDK v3 client to add the middleware to
 * @param feature The feature name to be added to the user agent
 */
const addUserAgentMiddleware = (client: unknown, feature: string): void => {
  try {
    if (isSdkClient(client)) {
      if (hasMao(client.middlewareStack.identify())) {
        return;
      }
      client.middlewareStack.addRelativeTo(
        customUserAgentMiddleware(feature),
        middlewareOptions
      );
    } else {
      throw new Error(
        'The client provided does not match the expected interface'
      );
    }
  } catch (error) {
    console.warn('Failed to add user agent middleware', error);
  }
};

export { customUserAgentMiddleware, addUserAgentMiddleware, isSdkClient };