import path from 'path';
import { URL } from 'url';
import jwt from 'jsonwebtoken';
import Email from 'email-templates';
import Joi from 'joi';
import { nanoid } from '@nymphjs/guid';
import { nymphJoiProps } from '@nymphjs/nymph';

import { Config } from './d';
import User from '../User';
import Group from '../Group';

export default {
  appName: 'My Nymph App',
  appUrl: 'http://localhost:8080/',
  cookieDomain: 'localhost',
  cookiePath: '/',
  setupPath: '/tilmeld',
  createAdmin: true,
  emailUsernames: true,
  allowRegistration: true,
  allowUsernameChange: true,
  enableUserSearch: false,
  enableGroupSearch: false,
  clientReadableUIDs: [],
  clientEnabledUIDs: [],
  clientSetabledUIDs: [],
  userFields: ['name', 'email', 'phone'],
  regFields: ['name', 'email'],
  verifyEmail: true,
  verifyRedirect: 'http://localhost:8080/',
  verifyChangeRedirect: 'http://localhost:8080/',
  cancelChangeRedirect: 'http://localhost:8080/',
  unverifiedAccess: true,
  emailRateLimit: '1 day',
  pwRecovery: true,
  pwRecoveryTimeLimit: '12 hours',
  pwMethod: 'salt',
  generatePrimary: true,
  highestPrimary: true,
  highestSecondary: true,
  validChars:
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-.',
  validCharsNotice:
    'Usernames and groupnames can only contain letters, numbers, underscore, dash, and period.',
  validRegex: /^[a-zA-Z0-9].*[a-zA-Z0-9]$/,
  validRegexNotice:
    'Usernames and groupnames must begin and end with a letter or number.',
  validEmailRegex:
    /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
  validEmailRegexNotice: 'Email must be a correctly formatted address.',
  minUsernameLength: 1,
  maxUsernameLength: 128,
  jwtSecret: '',
  jwtExpire: 60 * 60 * 24 * 7 * 24, // 24 weeks(ish) (6 months)
  jwtSwitchExpire: 60 * 60 * 6, // 6 hours
  jwtRenew: 60 * 60 * 24 * 7 * 12, // 12 weeks(ish) (3 months)
  jwtBuilder: (config, user, switchToken) => {
    const secret = config.jwtSecret;
    if (secret === '') {
      throw new Error('JWT secret is not configured.');
    }

    return jwt.sign(
      {
        iss: config.appUrl,
        nbf: Math.floor(Date.now() / 1000),
        exp:
          Math.floor(Date.now() / 1000) +
          (switchToken ? config.jwtSwitchExpire : config.jwtExpire),
        guid: user.guid,
        xsrfToken: 'TILMELDXSRF-' + nanoid(),
      },
      secret,
    );
  },
  jwtExtract: (config, token, xsrfToken?) => {
    const secret = config.jwtSecret;
    if (secret === '') {
      throw new Error('JWT secret is not configured.');
    }

    try {
      const payload = jwt.verify(token, secret, {
        issuer: config.appUrl,
        clockTolerance: 60,
      });

      if (typeof payload === 'string') {
        return null;
      }

      const { guid, xsrfToken: jwtXsrfToken, exp, nbf } = payload;

      if (xsrfToken != null && xsrfToken !== jwtXsrfToken) {
        return null;
      }

      if (typeof guid !== 'string' || guid.length !== 24) {
        return null;
      }

      if (nbf == null) {
        return null;
      }

      const issued = new Date(nbf * 1000);

      if (exp == null) {
        return null;
      }

      const expire = new Date(exp * 1000);

      return { guid, issued, expire };
    } catch (e: any) {
      return null;
    }
  },
  emailTemplateDir: path.join(__dirname, '..', '..', 'emails'),
  configEmail: async (tilmeld, _options, _user) => {
    const appUrl = new URL(tilmeld.config.appUrl);
    return {
      message: {
        from: {
          name: tilmeld.config.appName,
          address: `noreply@${appUrl.hostname}`,
        },
      },
    };
  },
  sendEmail: async (tilmeld, options, user) => {
    const email = new Email(
      await tilmeld.config.configEmail(tilmeld, options, user),
    );
    try {
      const result = await email.send({
        ...options,
        template: path.join(
          tilmeld.config.emailTemplateDir,
          options.template ?? '.',
        ),
        locals: {
          // System
          siteName: tilmeld.config.appName,
          siteLink: tilmeld.config.appUrl,
          // Recipient
          toUsername: user.username ?? '',
          toName: user.name ?? '',
          toFirstName: user.nameFirst ?? '',
          toLastName: user.nameLast ?? '',
          toEmail: user.email ?? '',
          toPhone: user.phone ?? '',
          // Current User with Tilmeld.
          ...(tilmeld.User.current()
            ? {
                username: tilmeld.User.current(true).username,
                name: tilmeld.User.current(true).name,
                firstName: tilmeld.User.current(true).nameFirst,
                lastName: tilmeld.User.current(true).nameLast,
                email: tilmeld.User.current(true).email,
              }
            : {}),
          ...options.locals,
        },
      });
      return !!result;
    } catch (e: any) {
      tilmeld.nymph.config.debugError('tilmeld', `Failed to send email: ${e}`);
      return false;
    }
  },
  userRegisteredRecipient: null,
  validatorGroup: (tilmeld, group) => {
    const nameFields = tilmeld.config.userFields.includes('name')
      ? {
          name: Joi.string()
            .trim(false)
            .pattern(/[\x01-\x1F\x7F]/, {
              name: 'control characters',
              invert: true,
            })
            .max(512)
            .required(),
        }
      : {};
    const emailFields = tilmeld.config.userFields.includes('email')
      ? {
          email: Joi.string()
            .trim(false)
            .email({ minDomainSegments: 1, tlds: false })
            .required(),
        }
      : {};
    const phoneFields = tilmeld.config.userFields.includes('phone')
      ? {
          phone: Joi.string()
            .trim(false)
            .pattern(/^[0-9]+$/, 'numbers'),
        }
      : {};
    Joi.attempt(
      group.$getValidatable(),
      Joi.object().keys({
        ...nymphJoiProps,
        ...nameFields,
        ...emailFields,
        ...phoneFields,
        groupname: Joi.string().trim(false).required(),
        enabled: Joi.boolean().required(),
        avatar: Joi.string()
          .trim(false)
          .uri()
          .pattern(/[\x01-\x1F\x7F]/, {
            name: 'control characters',
            invert: true,
          })
          .max(1024),
        parent: Joi.object().instance(Group),
        user: Joi.object().instance(User),
        abilities: Joi.array().items(
          Joi.string()
            .pattern(/[\x01-\x1F\x7F]/, {
              name: 'control characters',
              invert: true,
            })
            .max(256),
        ),
        defaultPrimary: Joi.boolean(),
        defaultSecondary: Joi.boolean(),
        unverifiedSecondary: Joi.boolean(),
      }),
      'Invalid Group: ',
    );
  },
  validatorUser: (tilmeld, user) => {
    const nameFields = tilmeld.config.userFields.includes('name')
      ? {
          nameFirst: Joi.string()
            .trim(false)
            .pattern(/[\x01-\x1F\x7F]/, {
              name: 'control characters',
              invert: true,
            })
            .max(512)
            .required(),
          nameMiddle: Joi.string()
            .trim(false)
            .pattern(/[\x01-\x1F\x7F]/, {
              name: 'control characters',
              invert: true,
            })
            .max(512),
          nameLast: Joi.string()
            .trim(false)
            .pattern(/[\x01-\x1F\x7F]/, {
              name: 'control characters',
              invert: true,
            })
            .max(512),
          name: Joi.string()
            .trim(false)
            .pattern(/[\x01-\x1F\x7F]/, {
              name: 'control characters',
              invert: true,
            })
            .max(512)
            .required(),
        }
      : {};
    const emailFields = tilmeld.config.userFields.includes('email')
      ? {
          email: Joi.string()
            .trim(false)
            .email({ minDomainSegments: 1, tlds: false })
            .required(),
          secret: Joi.string()
            .trim(false)
            .pattern(/[\x01-\x1F\x7F]/, {
              name: 'control characters',
              invert: true,
            })
            .length(21),
          emailChangeDate: Joi.number(),
          newEmailSecret: Joi.string()
            .trim(false)
            .pattern(/[\x01-\x1F\x7F]/, {
              name: 'control characters',
              invert: true,
            })
            .length(21),
          newEmailAddress: Joi.string()
            .trim(false)
            .email({ minDomainSegments: 1, tlds: false }),
          cancelEmailSecret: Joi.string()
            .trim(false)
            .pattern(/[\x01-\x1F\x7F]/, {
              name: 'control characters',
              invert: true,
            })
            .length(21),
          cancelEmailAddress: Joi.string()
            .trim(false)
            .email({ minDomainSegments: 1, tlds: false }),
          recoverSecret: Joi.string()
            .trim(false)
            .pattern(/[\x01-\x1F\x7F]/, {
              name: 'control characters',
              invert: true,
            })
            .length(10),
          recoverSecretDate: Joi.number(),
        }
      : {};
    const phoneFields = tilmeld.config.userFields.includes('phone')
      ? {
          phone: Joi.string()
            .trim(false)
            .pattern(/^[0-9]+$/, 'numbers'),
        }
      : {};
    Joi.attempt(
      user.$getValidatable(),
      Joi.object().keys({
        ...nymphJoiProps,
        ...nameFields,
        ...emailFields,
        ...phoneFields,
        username: Joi.string().trim(false).required(),
        enabled: Joi.boolean().required(),
        avatar: Joi.string()
          .trim(false)
          .uri()
          .pattern(/[\x01-\x1F\x7F]/, {
            name: 'control characters',
            invert: true,
          })
          .max(1024),
        group: Joi.object().instance(Group),
        groups: Joi.array().items(Joi.object().instance(Group)).required(),
        abilities: Joi.array().items(
          Joi.string()
            .pattern(/[\x01-\x1F\x7F]/, {
              name: 'control characters',
              invert: true,
            })
            .max(256),
        ),
        inheritAbilities: Joi.boolean(),
        salt: Joi.string().trim(false),
        password: Joi.string().trim(false).required(),
        revokeTokenDate: Joi.number(),
        totpSecret: Joi.string()
          .trim(false)
          .min(24)
          .max(40)
          .pattern(/^[A-Z234567]+$/, 'base32 encoded unpadded'),
      }),
      'Invalid User: ',
    );
  },
} as Config;
