/**
 * Nymph Config
 */
export interface Config {
  /**
   * Cache recently retrieved entities to speed up database queries. Uses more
   * memory.
   */
  cache: boolean;
  /**
   * Cache entities after they're accessed this many times.
   */
  cacheThreshold: number;
  /**
   * The number of recently retrieved entities to cache. If you're running out
   * of memory, try lowering this value. 0 means unlimited.
   */
  cacheLimit: number;
  /**
   * When querying for multiple entities with NymphREST, if the list is empty,
   * return a 404 error.
   */
  emptyListError: boolean;
  /**
   * A function to log info messages. By default, uses the `debug` package.
   */
  debugInfo: (source: string, message: string) => void;
  /**
   * A function to log debug messages. By default, uses the `debug` package.
   */
  debugLog: (source: string, message: string) => void;
  /**
   * A function to log error messages. By default, uses the `debug` package.
   */
  debugError: (source: string, message: string) => void;
}
