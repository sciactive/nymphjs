/**
 * Nymph Config
 */
export interface Config {
  /**
   * PubSub Enabled
   * Whether Nymph should use the PubSub functionality. This requires the
   * nymphjs/pubsub package.
   */
  pubsub: boolean;
  /**
   * Cache Entities
   * Cache recently retrieved entities to speed up database queries. Uses more
   * memory.
   */
  cache: boolean;
  /**
   * Cache Threshold
   * Cache entities after they're accessed this many times.
   */
  cacheThreshold: number;
  /**
   * Cache Limit
   * The number of recently retrieved entities to cache. If you're running out
   * of memory, try lowering this value. 0 means unlimited.
   */
  cacheLimit: number;
  /**
   * Empty List Returns an Error
   * When querying for multiple entities with NymphREST, if the list is empty,
   * return a 404 error.
   */
  emptyListError: boolean;
}
