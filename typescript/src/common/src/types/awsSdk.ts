/**
 * Minimal interface for an AWS SDK v3 client.
 *
 * @internal
 */
interface SdkClient {
    send: (args: unknown) => Promise<unknown>;
    config: {
      serviceId: string;
    };
    middlewareStack: {
      identify: () => string[];
      addRelativeTo: (middleware: unknown, options: unknown) => void;
    };
  }

  /**
   * Minimal type for the arguments passed to a middleware function
   *
   * @internal
   */
  type MiddlewareArgsLike = { request: { headers: { [key: string]: string } } };

  export type { SdkClient, MiddlewareArgsLike };