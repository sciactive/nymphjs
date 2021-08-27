import jwt from 'jsonwebtoken';
import { nanoid } from 'nanoid';
import Email, { EmailOptions } from 'email-templates';

import Tilmeld from '../Tilmeld';
import { Config } from './d';
import User, { UserData } from '../User';

export default {
  appName: 'My Nymph App',
  appUrl: 'http://localhost:8080/',
  cookieDomain: 'localhost',
  cookiePath: '/',
  setupPath: '/tilmeld/',
  createAdmin: true,
  emailUsernames: true,
  allowRegistration: true,
  enableUserSearch: false,
  enableGroupSearch: false,
  userFields: ['name', 'email', 'phone', 'timezone'],
  regFields: ['name', 'email'],
  verifyEmail: true,
  verifyRedirect: 'http://localhost:8080/',
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
  maxUsernameLength: 128,
  jwtSecret: '',
  jwtExpire: 60 * 60 * 24 * 7 * 8, // 8 weeks(ish)
  jwtRenew: 60 * 60 * 24 * 7 * 2, // 2 weeks(ish)
  jwtBuilder: (user) => {
    const secret = Tilmeld.config.jwtSecret;
    if (secret === '') {
      throw new Error('JWT secret is not configured.');
    }

    return jwt.sign(
      {
        iss: Tilmeld.config.appUrl,
        nbf: Date.now() / 1000,
        guid: user.guid,
        xsrfToken: 'TILMELDXSRF-' + nanoid(),
      },
      secret,
      { expiresIn: Tilmeld.config.jwtExpire }
    );
  },
  jwtExtract: (token, xsrfToken?) => {
    const secret = Tilmeld.config.jwtSecret;
    if (secret === '') {
      throw new Error('JWT secret is not configured.');
    }

    try {
      const payload = jwt.verify(token, secret, {
        issuer: Tilmeld.config.appUrl,
        clockTolerance: 10,
      });

      if (typeof payload === 'string') {
        return null;
      }

      const { guid, xsrfToken: jwtXsrfToken, exp } = payload;

      if (xsrfToken != null && xsrfToken !== jwtXsrfToken) {
        return null;
      }

      if (typeof guid !== 'string' || guid.length !== 24) {
        return null;
      }

      if (exp == null) {
        return null;
      }

      const expire = new Date(exp * 1000);

      return { guid, expire };
    } catch (e) {
      return null;
    }
  },
  sendEmail: async (options: EmailOptions, user: User & UserData) => {
    const appUrl = new URL(Tilmeld.config.appUrl);
    const email = new Email({
      message: {
        from: {
          name: Tilmeld.config.appName,
          address: `noreply@${appUrl.hostname}`,
        },
      },
    });
    const result = await email.send({
      ...options,
      locals: {
        // System
        siteName: Tilmeld.config.appName,
        siteLink: Tilmeld.config.appUrl,
        // Recipient
        toUsername: user.username ?? '',
        toName: user.name ?? '',
        toFirstName: user.nameFirst ?? '',
        toLastName: user.nameLast ?? '',
        toEmail: user.email ?? '',
        toPhone: user.phone ?? '',
        // Current User with Tilmeld.
        ...(User.current()
          ? {
              username: User.current(true).username,
              name: User.current(true).name,
              firstName: User.current(true).nameFirst,
              lastName: User.current(true).nameLast,
              email: User.current(true).email,
            }
          : {}),
        ...options.locals,
      },
    });
    return !!result;
  },
  userRegisteredRecipient: null,
  validatorGroup: (group) => {
    // v::notEmpty()
    // ->attribute('groupname', v::stringType()->notBlank()->length(1, null))
    // ->attribute('enabled', v::boolType())
    // ->attribute('email', v::optional(v::email()), false)
    // ->attribute('name', v::stringType()->notBlank()->prnt()->length(1, 256))
    // ->attribute('avatar', v::optional(v::stringType()->url()->prnt()->length(1, 256)), false)
    // ->attribute('phone', v::optional(v::phone()), false)
    // ->attribute('parent', v::when(v::nullType(), v::alwaysValid(), v::instance('\Tilmeld\Entities\Group')), false)
    // ->attribute('user', v::when(v::nullType(), v::alwaysValid(), v::instance('\Tilmeld\Entities\User')), false)
    // ->attribute('abilities', v::arrayType()->each(v::stringType()->notBlank()->prnt()->length(1, 256)))
    // ->attribute('defaultPrimary', v::when(v::nullType(), v::alwaysValid(), v::boolType()), false)
    // ->attribute('defaultSecondary', v::when(v::nullType(), v::alwaysValid(), v::boolType()), false)
    // ->setName('group object')
  },
  validatorUser: (user) => {
    // v::notEmpty()
    // ->attribute('username', v::stringType()->notBlank()->length(1, null))
    // ->attribute('enabled', v::boolType())
    // ->attribute('email', v::optional(v::email()), false)
    // ->attribute('nameFirst', v::stringType()->notBlank()->prnt()->length(1, 256))
    // ->attribute('nameMiddle', v::optional(v::stringType()->notBlank()->prnt()->length(1, 256)), false)
    // ->attribute('nameLast', v::optional(v::stringType()->notBlank()->prnt()->length(1, 256)), false)
    // ->attribute('name', v::stringType()->notBlank()->prnt()->length(1, 256))
    // ->attribute('avatar', v::optional(v::stringType()->url()->prnt()->length(1, 256)), false)
    // ->attribute('phone', v::optional(v::phone()), false)
    // ->attribute('timezone', v::optional(v::in(\DateTimeZone::listIdentifiers())), false)
    // ->attribute('group', v::when(v::nullType(), v::alwaysValid(), v::instance('\Tilmeld\Entities\Group')))
    // ->attribute('groups', v::arrayType()->each(v::instance('\Tilmeld\Entities\Group')))
    // ->attribute('abilities', v::arrayType()->each(v::stringType()->notBlank()->prnt()->length(1, 256)))
    // ->attribute('inheritAbilities', v::boolType())
    // ->attribute('password', v::stringType()->notBlank()->length(1, 1024))
    // ->setName('user object')
  },
} as Config;
