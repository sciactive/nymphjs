import { EntityConstructor, EntityInterface } from './Entity.types';

export type Options<T extends EntityConstructor = EntityConstructor> = {
  class?: T;
  limit?: number;
  offset?: number;
  reverse?: boolean;
  sort?: 'cdate' | 'mdate';
  return?: 'entity' | 'guid';
  source?: string;
  skipCache?: boolean;
  skipAc?: boolean;
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

  qref?: [string, [Options, ...Selector[]]];
  '!qref'?: Selector['qref'];

  selector?: Clause<Selector>;
  '!selector'?: Selector['selector'];
};

export type FormattedSelector = {
  type: '&' | '|' | '!&' | '!|';

  guid?: PrimitiveSelector['guid'][];
  '!guid'?: PrimitiveSelector['guid'][];

  tag?: PrimitiveSelector['tag'][];
  '!tag'?: PrimitiveSelector['tag'][];

  defined?: PrimitiveSelector['defined'][];
  '!defined'?: PrimitiveSelector['defined'][];

  truthy?: PrimitiveSelector['truthy'][];
  '!truthy'?: PrimitiveSelector['truthy'][];

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