import { TilmeldAccessLevels } from '@nymphjs/nymph';
import * as v from 'valibot';

import { User } from './User.js';
import { Group } from './Group.js';

export const tilmeldRequiredOwnershipValibotProps = {
  user: v.lazy(() => v.instance(User)),
  group: v.lazy(() => v.instance(Group)),
};

export const tilmeldOptionalOwnershipValibotProps = {
  user: v.exactOptional(v.lazy(() => v.instance(User))),
  group: v.exactOptional(v.lazy(() => v.instance(Group))),
};

export const tilmeldRequiredAccessValibotProps = {
  acUser: v.enum(TilmeldAccessLevels),
  acGroup: v.enum(TilmeldAccessLevels),
  acOther: v.enum(TilmeldAccessLevels),
  acRead: v.array(v.pipe(v.string(), v.length(24), v.hexadecimal())),
  acWrite: v.array(v.pipe(v.string(), v.length(24), v.hexadecimal())),
  acFull: v.array(v.pipe(v.string(), v.length(24), v.hexadecimal())),
};

export const tilmeldOptionalAccessValibotProps = {
  acUser: v.exactOptional(v.enum(TilmeldAccessLevels)),
  acGroup: v.exactOptional(v.enum(TilmeldAccessLevels)),
  acOther: v.exactOptional(v.enum(TilmeldAccessLevels)),
  acRead: v.exactOptional(
    v.array(v.pipe(v.string(), v.length(24), v.hexadecimal())),
  ),
  acWrite: v.exactOptional(
    v.array(v.pipe(v.string(), v.length(24), v.hexadecimal())),
  ),
  acFull: v.exactOptional(
    v.array(v.pipe(v.string(), v.length(24), v.hexadecimal())),
  ),
};

export const tilmeldOptionalValibotProps = {
  ...tilmeldOptionalOwnershipValibotProps,
  ...tilmeldOptionalAccessValibotProps,
};

export const tilmeldRequiredValibotProps = {
  ...tilmeldRequiredOwnershipValibotProps,
  ...tilmeldRequiredAccessValibotProps,
};

export const tilmeldValibotProps = tilmeldOptionalValibotProps;
