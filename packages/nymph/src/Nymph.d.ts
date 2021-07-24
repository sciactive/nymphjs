import { EntityInterface } from './Entity.d';

export type Options<
  T extends new () => EntityInterface = new () => EntityInterface
> = {
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

export type Selector = {
  type: '&' | '|' | '!&' | '!|';

  guid?: Clause<string>;
  '!guid'?: Selector['guid'];

  tag?: Clause<string>;
  '!tag'?: Selector['tag'];

  defined?: Clause<string>;
  '!defined'?: Selector['defined'];

  truthy?: Clause<string>;
  '!truthy'?: Selector['truthy'];

  equal?: Clause<OrWithTime<[string, any]>>;
  '!equal'?: Selector['equal'];

  array?: Clause<OrWithTime<[string, any]>>;
  '!array'?: Selector['array'];

  contains?: Clause<OrWithTime<[string, any]>>;
  '!contains'?: Selector['contains'];

  match?: Clause<[string, string]>;
  '!match'?: Selector['match'];

  imatch?: Clause<[string, string]>;
  '!imatch'?: Selector['imatch'];

  like?: Clause<[string, string]>;
  '!like'?: Selector['like'];

  ilike?: Clause<[string, string]>;
  '!ilike'?: Selector['ilike'];

  gt?: Clause<OrWithTime<[string, number]>>;
  '!gt'?: Selector['gt'];

  gte?: Clause<OrWithTime<[string, number]>>;
  '!gte'?: Selector['gte'];

  lt?: Clause<OrWithTime<[string, number]>>;
  '!lt'?: Selector['lt'];

  lte?: Clause<OrWithTime<[string, number]>>;
  '!lte'?: Selector['lte'];

  ref?: Clause<[string, Entity | string]>;
  '!ref'?: Selector['ref'];

  qref?: Clause<[string, [Options, ...Selector]]>;
  '!qref'?: Selector['qref'];

  selector?: Clause<Selector>;
  '!selector'?: Selector['selector'];
};
