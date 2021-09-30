import { TilmeldAccessLevels } from '@nymphjs/nymph';
import Joi from 'joi';

import User from './User';
import Group from './Group';

export default {
  user: Joi.object().instance(User),
  group: Joi.object().instance(Group),
  acUser: Joi.number().valid(
    TilmeldAccessLevels.NO_ACCESS,
    TilmeldAccessLevels.READ_ACCESS,
    TilmeldAccessLevels.WRITE_ACCESS,
    TilmeldAccessLevels.FULL_ACCESS
  ),
  acGroup: Joi.number().valid(
    TilmeldAccessLevels.NO_ACCESS,
    TilmeldAccessLevels.READ_ACCESS,
    TilmeldAccessLevels.WRITE_ACCESS,
    TilmeldAccessLevels.FULL_ACCESS
  ),
  acOther: Joi.number().valid(
    TilmeldAccessLevels.NO_ACCESS,
    TilmeldAccessLevels.READ_ACCESS,
    TilmeldAccessLevels.WRITE_ACCESS,
    TilmeldAccessLevels.FULL_ACCESS
  ),
  acRead: Joi.array().items(
    Joi.alternatives().try(
      Joi.object().instance(User),
      Joi.object().instance(Group)
    )
  ),
  acWrite: Joi.array().items(
    Joi.alternatives().try(
      Joi.object().instance(User),
      Joi.object().instance(Group)
    )
  ),
  acFull: Joi.array().items(
    Joi.alternatives().try(
      Joi.object().instance(User),
      Joi.object().instance(Group)
    )
  ),
};
