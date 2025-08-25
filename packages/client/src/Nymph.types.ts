import { EntityConstructor, EntityInterface } from './Entity.types.js';

export type NymphOptions = {
  /**
   * The URL of your Nymph REST server.
   */
  restUrl: string;
  /**
   * The URL of your Nymph PubSub server.
   */
  pubsubUrl?: string;
  /**
   * A fetch implementation.
   */
  fetch?: WindowOrWorkerGlobalScope['fetch'];
  /**
   * A WebSocket implementation.
   */
  WebSocket?: typeof WebSocket;
  /**
   * Return `null` or empty array instead of error when entity/ies not found.
   */
  returnNullOnNotFound?: boolean;
  /**
   * Whether to not output status messages to the console.
   */
  noConsole?: boolean;
  /**
   * Don't automatically try to connect to PubSub server.
   */
  noAutoconnect?: boolean;
  /**
   * Use a WeakRef based cache of entities.
   *
   * This ensures all entities returned are the same instance if they have the
   * same class and GUID. This also means that whenever an entity is returned
   * from the server, the single instance in memory will be refreshed. This
   * could have annoying results, like destroying dirty data (the dreaded
   * triple-D).
   *
   * This could also be a potential source of memory leaks. Although the
   * entities themselves are referenced weakly so they get garbage collected,
   * the GUID used as a key and the WeakRef object itself are not weak
   * references, so not destroyed when the instance is garbage collected.
   *
   * However, even with these caveats, this might help you if you have a big app
   * with the same entities stored in several different places in memory. This
   * can help to synchronize them correctly and avoid data conflicts.
   */
  weakCache?: boolean;
  /**
   * Whether to renew tokens when a request is made.
   *
   * If you turn this off, the client will request that the server not renew an
   * authentication token, even if it is within the renewal time of the
   * expiration date.
   *
   * This defaults to true.
   */
  renewTokens?: boolean;
};

export type EventType = 'request' | 'response';

export type RequestCallback = (url: string, options: RequestInit) => void;

export type ResponseCallback = (response: Response, text: string) => void;

export type Options<T extends EntityConstructor = EntityConstructor> = {
  /**
   * The Entity class to query.
   */
  class: T;
  /**
   * The limit of entities to be returned. Not needed when using `getEntity`, as
   * it always returns only one.
   */
  limit?: number;
  /**
   * The offset from the first matching entity, in order, to start retrieving.
   */
  offset?: number;
  /**
   * If true, entities will be retrieved from newest to oldest/largest to
   * smallest (with regard to `sort`).
   */
  reverse?: boolean;
  /**
   * How to sort the entities. Should be "cdate", "mdate", or the name of a
   * property.
   */
  sort?: 'cdate' | 'mdate' | string;
  /**
   * What to return, the entities with their data, just the GUIDs, or just a
   * count.
   */
  return?: 'entity' | 'guid' | 'count';
  /**
   * If true, Nymph will skip the cache and retrieve the entity from the DB.
   */
  skipCache?: boolean;
};

export type Clause<C> = C | Exclude<C, undefined>[];

export type OrWithTime<T> = T | [string, null, string];

type PrimitiveSelector = {
  guid?: string;
  '!guid'?: PrimitiveSelector['guid'];

  tag?: string;
  '!tag'?: PrimitiveSelector['tag'];

  defined?: string;
  '!defined'?: PrimitiveSelector['defined'];

  truthy?: string;
  '!truthy'?: PrimitiveSelector['truthy'];

  equal?: [string, any];
  '!equal'?: PrimitiveSelector['equal'];

  contain?: [string, any];
  '!contain'?: PrimitiveSelector['contain'];

  match?: [string, string];
  '!match'?: PrimitiveSelector['match'];

  imatch?: [string, string];
  '!imatch'?: PrimitiveSelector['imatch'];

  like?: [string, string];
  '!like'?: PrimitiveSelector['like'];

  ilike?: [string, string];
  '!ilike'?: PrimitiveSelector['ilike'];

  gt?: [string, number];
  '!gt'?: PrimitiveSelector['gt'];

  gte?: [string, number];
  '!gte'?: PrimitiveSelector['gte'];

  lt?: [string, number];
  '!lt'?: PrimitiveSelector['lt'];

  lte?: [string, number];
  '!lte'?: PrimitiveSelector['lte'];

  ref?: [string, EntityInterface | string];
  '!ref'?: PrimitiveSelector['ref'];

  qref?: [string, [Options, ...PrimitiveSelector[]]];
  '!qref'?: PrimitiveSelector['qref'];

  selector?: PrimitiveSelector;
  '!selector'?: PrimitiveSelector['selector'];
};

export type Selector = {
  type: '&' | '|' | '!&' | '!|';

  guid?: Clause<PrimitiveSelector['guid']>;
  '!guid'?: Clause<PrimitiveSelector['guid']>;

  tag?: Clause<PrimitiveSelector['tag']>;
  '!tag'?: Clause<PrimitiveSelector['tag']>;

  defined?: Clause<PrimitiveSelector['defined']>;
  '!defined'?: Clause<PrimitiveSelector['defined']>;

  truthy?: Clause<PrimitiveSelector['truthy']>;
  '!truthy'?: Clause<PrimitiveSelector['truthy']>;

  equal?: Clause<OrWithTime<PrimitiveSelector['equal']>>;
  '!equal'?: Clause<OrWithTime<PrimitiveSelector['equal']>>;

  contain?: Clause<OrWithTime<PrimitiveSelector['contain']>>;
  '!contain'?: Clause<OrWithTime<PrimitiveSelector['contain']>>;

  match?: Clause<PrimitiveSelector['match']>;
  '!match'?: Clause<PrimitiveSelector['match']>;

  imatch?: Clause<PrimitiveSelector['imatch']>;
  '!imatch'?: Clause<PrimitiveSelector['imatch']>;

  like?: Clause<PrimitiveSelector['like']>;
  '!like'?: Clause<PrimitiveSelector['like']>;

  ilike?: Clause<PrimitiveSelector['ilike']>;
  '!ilike'?: Clause<PrimitiveSelector['ilike']>;

  gt?: Clause<OrWithTime<PrimitiveSelector['gt']>>;
  '!gt'?: Clause<OrWithTime<PrimitiveSelector['gt']>>;

  gte?: Clause<OrWithTime<PrimitiveSelector['gte']>>;
  '!gte'?: Clause<OrWithTime<PrimitiveSelector['gte']>>;

  lt?: Clause<OrWithTime<PrimitiveSelector['lt']>>;
  '!lt'?: Clause<OrWithTime<PrimitiveSelector['lt']>>;

  lte?: Clause<OrWithTime<PrimitiveSelector['lte']>>;
  '!lte'?: Clause<OrWithTime<PrimitiveSelector['lte']>>;

  ref?: Clause<PrimitiveSelector['ref']>;
  '!ref'?: Clause<PrimitiveSelector['ref']>;

  qref?: Clause<[string, [Options, ...Selector[]]]>;
  '!qref'?: Selector['qref'];

  selector?: Clause<Selector>;
  '!selector'?: Selector['selector'];
};
