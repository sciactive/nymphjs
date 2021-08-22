/**
 * Nymph PubSub Config
 */
export interface Config {
  /**
   * The URLs of the Nymph-PubSub servers to directly publish to. These servers
   * are how this host will enter the PubSub network. If you only have one
   * PubSub server, it needs to be listed here.
   */
  entries: string[];
  /**
   * The URLs of additional Nymph-PubSub servers to relay publishes to. If this
   * host is a PubSub server, these servers are how it will continue into your
   * PubSub network.
   */
  relays: string[];
  /**
   * Allow clients to request to be notified when other clients subscribe to the
   * same queries.
   */
  broadcastCounts: boolean;
}
