import { EntityConstructor, EntityInterface } from './Entity.d';

export type Options<T extends EntityConstructor = EntityConstructor> = {
  class?: T;
  limit?: number;
  offset?: number;
  reverse?: boolean;
  sort?: 'guid' | 'cdate' | 'mdate';
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

  equal?: OrWithTime<[string, any]>;
  '!equal'?: PrimitiveSelector['equal'];

  array?: OrWithTime<[string, any]>;
  '!array'?: PrimitiveSelector['array'];

  contains?: OrWithTime<[string, any]>;
  '!contains'?: PrimitiveSelector['contains'];

  match?: [string, string];
  '!match'?: PrimitiveSelector['match'];

  imatch?: [string, string];
  '!imatch'?: PrimitiveSelector['imatch'];

  like?: [string, string];
  '!like'?: PrimitiveSelector['like'];

  ilike?: [string, string];
  '!ilike'?: PrimitiveSelector['ilike'];

  gt?: OrWithTime<[string, number]>;
  '!gt'?: PrimitiveSelector['gt'];

  gte?: OrWithTime<[string, number]>;
  '!gte'?: PrimitiveSelector['gte'];

  lt?: OrWithTime<[string, number]>;
  '!lt'?: PrimitiveSelector['lt'];

  lte?: OrWithTime<[string, number]>;
  '!lte'?: PrimitiveSelector['lte'];

  ref?: [string, Entity | string];
  '!ref'?: PrimitiveSelector['ref'];

  qref?: [string, [Options, ...PrimitiveSelector]];
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

  equal?: Clause<PrimitiveSelector['equal']>;
  '!equal'?: Clause<PrimitiveSelector['equal']>;

  array?: Clause<PrimitiveSelector['array']>;
  '!array'?: Clause<PrimitiveSelector['array']>;

  contains?: Clause<PrimitiveSelector['contains']>;
  '!contains'?: Clause<PrimitiveSelector['contains']>;

  match?: Clause<PrimitiveSelector['match']>;
  '!match'?: Clause<PrimitiveSelector['match']>;

  imatch?: Clause<PrimitiveSelector['imatch']>;
  '!imatch'?: Clause<PrimitiveSelector['imatch']>;

  like?: Clause<PrimitiveSelector['like']>;
  '!like'?: Clause<PrimitiveSelector['like']>;

  ilike?: Clause<PrimitiveSelector['ilike']>;
  '!ilike'?: Clause<PrimitiveSelector['ilike']>;

  gt?: Clause<PrimitiveSelector['gt']>;
  '!gt'?: Clause<PrimitiveSelector['gt']>;

  gte?: Clause<PrimitiveSelector['gte']>;
  '!gte'?: Clause<PrimitiveSelector['gte']>;

  lt?: Clause<PrimitiveSelector['lt']>;
  '!lt'?: Clause<PrimitiveSelector['lt']>;

  lte?: Clause<PrimitiveSelector['lte']>;
  '!lte'?: Clause<PrimitiveSelector['lte']>;

  ref?: Clause<PrimitiveSelector['ref']>;
  '!ref'?: Clause<PrimitiveSelector['ref']>;

  qref?: [string, [Options, ...Selector]];
  '!qref'?: Selector['qref'];

  selector?: Selector;
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

  array?: PrimitiveSelector['array'][];
  '!array'?: PrimitiveSelector['array'][];

  contains?: PrimitiveSelector['contains'][];
  '!contains'?: PrimitiveSelector['contains'][];

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

  qref?: [string, [Options, ...FormattedSelector]][];
  '!qref'?: FormattedSelector['qref'];

  selector?: FormattedSelector[];
  '!selector'?: FormattedSelector['selector'];
};
