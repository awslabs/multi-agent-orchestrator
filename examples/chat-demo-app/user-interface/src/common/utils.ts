export abstract class Utils {
  static promiseSetTimeout(duration: number) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve("Done");
      }, duration);
    });
  }

  static urlSearchParamsToRecord(
    params: URLSearchParams
  ): Record<string, string> {
    const record: Record<string, string> = {};

    for (const [key, value] of params.entries()) {
      record[key] = value;
    }

    return record;
  }

  static isFunction(value: unknown): value is Function {
    return typeof value === "function";
  }
}
