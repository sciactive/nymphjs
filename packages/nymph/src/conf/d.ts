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
   * Whether to update the mdate property when saving an entity.
   *
   * You should probably only set this to false if you're doing migrations. Some
   * things depend on having updated mdates (like conflict detection to avoid
   * lost updates).
   *
   * If you set this to a number, that amount of milliseconds will be added to
   * the mdate on any entities that are saved. This should solve the lost update
   * problem when set to a small number (~1000), and keep mdates relatively
   * unchanged.
   */
  updateMDate: boolean | number;
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
