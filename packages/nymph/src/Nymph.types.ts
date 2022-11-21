import { EntityConstructor, EntityInterface } from './Entity.types';
import Nymph from './Nymph';

export type NymphEventType =
  | 'connect'
  | 'disconnect'
  | 'query'
  | 'beforeGetEntity'
  | 'beforeGetEntities'
  | 'beforeSaveEntity'
  | 'afterSaveEntity'
  | 'beforeDeleteEntity'
  | 'afterDeleteEntity'
  | 'beforeDeleteEntityByID'
  | 'afterDeleteEntityByID'
  | 'beforeNewUID'
  | 'afterNewUID'
  | 'beforeSetUID'
  | 'afterSetUID'
  | 'beforeRenameUID'
  | 'afterRenameUID'
  | 'beforeDeleteUID'
  | 'afterDeleteUID';
export type NymphConnectCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
export type NymphDisconnectCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
/**
 * The NymphQueryCallback will be called on both top level and qref queries.
 *
 * This is the only callback that is not asynchronous.
 *
 * This also isn't necessarily run on every "query". It is run before a database
 * query for an entity, but it is not run during PubSub entity change
 * propagation. Therefore, it shouldn't do anything _entity_ specific, instead
 * it should be _query_ specific. For example, throw an error if the user is not
 * permitted to run the query at all.
 */
export type NymphQueryCallback = (
  nymph: Nymph,
  options: Options,
  selectors: FormattedSelector[]
) => void;
export type NymphBeforeGetEntityCallback = (
  nymph: Nymph,
  options: Options,
  selectors: Selector[]
) => Promise<void>;
export type NymphBeforeGetEntitiesCallback = (
  nymph: Nymph,
  options: Options,
  selectors: Selector[]
) => Promise<void>;
export type NymphBeforeSaveEntityCallback = (
  nymph: Nymph,
  entity: EntityInterface
) => Promise<void>;
export type NymphAfterSaveEntityCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
export type NymphBeforeDeleteEntityCallback = (
  nymph: Nymph,
  entity: EntityInterface
) => Promise<void>;
export type NymphAfterDeleteEntityCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
export type NymphBeforeDeleteEntityByIDCallback = (
  nymph: Nymph,
  guid: string,
  className?: string
) => Promise<void>;
export type NymphAfterDeleteEntityByIDCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
export type NymphBeforeNewUIDCallback = (
  nymph: Nymph,
  name: string
) => Promise<void>;
export type NymphAfterNewUIDCallback = (
  nymph: Nymph,
  result: Promise<number | null>
) => Promise<void>;
export type NymphBeforeSetUIDCallback = (
  nymph: Nymph,
  name: string,
  value: number
) => Promise<void>;
export type NymphAfterSetUIDCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
export type NymphBeforeRenameUIDCallback = (
  nymph: Nymph,
  oldName: string,
  newName: string
) => Promise<void>;
export type NymphAfterRenameUIDCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
export type NymphBeforeDeleteUIDCallback = (
  nymph: Nymph,
  name: string
) => Promise<void>;
export type NymphAfterDeleteUIDCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;

export type Options<T extends EntityConstructor = EntityConstructor> = {
  class?: T;
  limit?: number;
  offset?: number;
  reverse?: boolean;
  sort?: 'cdate' | 'mdate';
  return?: 'entity' | 'guid' | 'count';
  source?: string;
  skipCache?: boolean;
  skipAc?: boolean;
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

export type FormattedSelector = {
  type: '&' | '|' | '!&' | '!|';

  guid?: PrimitiveSelector['guid'][][];
  '!guid'?: PrimitiveSelector['guid'][][];

  tag?: PrimitiveSelector['tag'][][];
  '!tag'?: PrimitiveSelector['tag'][][];

  defined?: PrimitiveSelector['defined'][][];
  '!defined'?: PrimitiveSelector['defined'][][];

  truthy?: PrimitiveSelector['truthy'][][];
  '!truthy'?: PrimitiveSelector['truthy'][][];

  equal?: PrimitiveSelector['equal'][];
  '!equal'?: PrimitiveSelector['equal'][];

  contain?: PrimitiveSelector['contain'][];
  '!contain'?: PrimitiveSelector['contain'][];

  match?: PrimitiveSelector['match'][];
  '!match'?: PrimitiveSelector['match'][];

  imatch?: PrimitiveSelector['imatch'][];
  '!imatch'?: PrimitiveSelector['imatch'][];

  like?: PrimitiveSelector['like'][];
  '!like'?: PrimitiveSelector['like'][];

  ilike?: PrimitiveSelector['ilike'][];
  '!ilike'?: PrimitiveSelector['ilike'][];

  gt?: PrimitiveSelector['gt'][];
  '!gt'?: PrimitiveSelector['gt'][];

  gte?: PrimitiveSelector['gte'][];
  '!gte'?: PrimitiveSelector['gte'][];

  lt?: PrimitiveSelector['lt'][];
  '!lt'?: PrimitiveSelector['lt'][];

  lte?: PrimitiveSelector['lte'][];
  '!lte'?: PrimitiveSelector['lte'][];

  ref?: PrimitiveSelector['ref'][];
  '!ref'?: PrimitiveSelector['ref'][];

  qref?: [string, [Options, ...FormattedSelector[]]][];
  '!qref'?: FormattedSelector['qref'];

  selector?: FormattedSelector[];
  '!selector'?: FormattedSelector['selector'];
};

export enum TilmeldAccessLevels {
  NO_ACCESS = 0,
  READ_ACCESS = 1,
  WRITE_ACCESS = 2,
  // Keeping 3 open in case we ever need one between write and full.
  FULL_ACCESS = 4,
}

export interface TilmeldInterface {
  nymph: Nymph;
  request: any;
  response: any;
  init(nymph: Nymph): void;
  clone(): TilmeldInterface;
  gatekeeper(ability?: string): boolean;
  authenticate(): void;
  clearSession(): void;
  extractToken(token: string): Promise<any>;
  fillSession(user: any): void;
  checkClientUIDPermissions(name: string, type?: TilmeldAccessLevels): boolean;
}
