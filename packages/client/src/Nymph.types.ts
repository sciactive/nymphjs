import { EntityConstructor, EntityInterface } from './Entity.types';

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
   * Whether to not output status messages to the console.
   */
  noConsole?: boolean;
};

export type EventType = 'request' | 'response';

export type RequestCallback = (url: string, options: RequestInit) => void;

export type ResponseCallback = (response: Response) => void;

export type Options<T extends EntityConstructor = EntityConstructor> = {
  class: T;
  limit?: number;
  offset?: number;
  reverse?: boolean;
  sort?: 'cdate' | 'mdate';
  return?: 'entity' | 'guid';
  skipCache?: boolean;
};

export type Clause<C> = C | C[];

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
