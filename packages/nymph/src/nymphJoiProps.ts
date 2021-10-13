import Joi from 'joi';

export default {
  guid: Joi.alternatives()
    .try(
      Joi.any().only().allow(null),
      Joi.string().trim(false).length(24).hex()
    )
    .required(),
  cdate: Joi.alternatives()
    .try(Joi.any().only().allow(null), Joi.number())
    .required(),
  mdate: Joi.alternatives()
    .try(Joi.any().only().allow(null), Joi.number())
    .required(),
  tags: Joi.array()
    .items(
      Joi.string().pattern(/[[\x01-\x1F\x7F]]/, {
        name: 'control characters',
        invert: true,
      })
    )
    .required(),
};
