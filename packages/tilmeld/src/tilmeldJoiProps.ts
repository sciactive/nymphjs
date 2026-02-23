import { TilmeldAccessLevels } from '@nymphjs/nymph';
import Joi from 'joi';

import User from './User.js';
import Group from './Group.js';

export default {
  user: Joi.object().instance(User),
  group: Joi.object().instance(Group),
  acUser: Joi.number().valid(
    TilmeldAccessLevels.NO_ACCESS,
    TilmeldAccessLevels.READ_ACCESS,
    TilmeldAccessLevels.WRITE_ACCESS,
    TilmeldAccessLevels.FULL_ACCESS,
  ),
  acGroup: Joi.number().valid(
    TilmeldAccessLevels.NO_ACCESS,
    TilmeldAccessLevels.READ_ACCESS,
    TilmeldAccessLevels.WRITE_ACCESS,
    TilmeldAccessLevels.FULL_ACCESS,
  ),
  acOther: Joi.number().valid(
    TilmeldAccessLevels.NO_ACCESS,
    TilmeldAccessLevels.READ_ACCESS,
    TilmeldAccessLevels.WRITE_ACCESS,
    TilmeldAccessLevels.FULL_ACCESS,
  ),
  acRead: Joi.array().items(Joi.string().pattern(/^[0-9a-f]{24}$/i, 'GUID')),
  acWrite: Joi.array().items(Joi.string().pattern(/^[0-9a-f]{24}$/i, 'GUID')),
  acFull: Joi.array().items(Joi.string().pattern(/^[0-9a-f]{24}$/i, 'GUID')),
};
