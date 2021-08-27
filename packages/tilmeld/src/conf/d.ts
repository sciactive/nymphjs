import { EmailOptions } from 'email-templates';
import Group, { GroupData } from '../Group';
import User, { UserData } from '../User';

/**
 * Tilmeld Config
 */
export interface Config {
  /**
   * The name of the app. Used in emails sent to users.
   */
  appName: string;
  /**
   * The URL of the app. Used to define cookie domain, path, and security. Must be accessible to the
   * Tilmeld client JS. (Note, cookies are not specific to individual ports, so tokens will be sent
   * to any port running on this host.)
   */
  appUrl: string;
  /**
   * The domain of the auth cookie.
   */
  cookieDomain: string;
  /**
   * The path of the auth cookie.
   */
  cookiePath: string;
  /**
   * The path (with leading slash) where the setup utility is accessible. This is also used for
   * email address verification.
   *
   * ***********************************************************************************************
   * This portion of the app will **not** check for the XSRF token, so make sure your REST endpoint
   * is **not** under this URL.
   * ***********************************************************************************************
   */
  setupPath: string;
  /**
   * Allow the creation of an admin user. When a user is created, if there are no other users in the
   * system, they will be granted all abilities.
   */
  createAdmin: boolean;
  /**
   * Instead of a "username", a user logs in and is referred to by their email address. Enabling
   * this after many users have been created can be messy. Make sure they all have email addresses
   * first.
   */
  emailUsernames: boolean;
  /**
   * Allow users to register.
   */
  allowRegistration: boolean;
  /**
   * Whether frontend can search users. (Probably not a good idea if privacy is a concern.)
   */
  enableUserSearch: boolean;
  /**
   * Whether frontend can search groups. (Probably not a good idea if privacy is a concern. Same
   * risks as user search if generatePrimary is true.)
   */
  enableGroupSearch: boolean;
  /**
   * These will be the available fields for users. (Some fields, like username, can't be excluded.)
   */
  userFields: string[];
  /**
   * These fields will be available for the user to fill in when they register.
   */
  regFields: string[];
  /**
   * Verify users' email addresses upon registration/email change before allowing them to log
   * in/change it.
   */
  verifyEmail: boolean;
  /**
   * After the user verifies their address, redirect them to this URL.
   */
  verifyRedirect: string;
  /**
   * Unverified users will be able to log in, but will only have the "unverified users" secondary
   * group(s) until they verify their email. If set to false, their account will instead be disabled
   * until they verify.
   */
  unverifiedAccess: boolean;
  /**
   * Don't let users change their email address more often than this. You can enter one value and
   * one unit of time, such as "2 weeks". Leave blank to disable rate limiting.
   */
  emailRateLimit: string;
  /**
   * Allow users to recover their username and/or password through their registered email.
   */
  pwRecovery: boolean;
  /**
   * How long a recovery request is valid.
   */
  pwRecoveryTimeLimit: string;
  /**
   * Method used to store passwords. Salt is more secure if the database is compromised. Plain:
   * store the password in plaintext. Digest: store the password's digest (hash). Salt: store the
   * password's digest using a complex, unique salt.
   *
   * Digests are SHA-256, so a salt probably isn't necessary, but who knows.
   *
   * Options are: "plain", "digest", "salt"
   */
  pwMethod: 'plain' | 'digest' | 'salt';
  /**
   * Whether to create a new primary group for every user who registers. This can be useful for
   * providing access to entities the user creates.
   *
   * In the case this is set, the default primary group, rather than being assigned to the user, is
   * assigned as the parent of the generated group.
   */
  generatePrimary: boolean;
  /**
   * The GUID of the group above the highest groups allowed to be assigned as primary groups. True
   * means all groups, and false means no groups.
   */
  highestPrimary: string | boolean;
  /**
   * The GUID of the group above the highest groups allowed to be assigned as secondary groups.
   * True means all groups, and false means no groups.
   */
  highestSecondary: string | boolean;
  /**
   * Only these characters can be used when creating usernames and groupnames. (Doesn't apply to
   * emails as usernames.)
   */
  validChars: string;
  /**
   * When a user enters an invalid name, this message will be displayed.
   */
  validCharsNotice: string;
  /**
   * Usernames and groupnames must match this regular expression. (Doesn't apply to emails as
   * usernames.) By default, this ensures that the name begins and ends with an alphanumeric. (To
   * allow anything, use .* inside the slashes.)
   */
  validRegex: RegExp;
  /**
   * When a user enters a name that doesn't match the regex, this message will be displayed.
   */
  validRegexNotice: string;
  /**
   * The maximum length for usernames. Infinity for unlimited.
   */
  maxUsernameLength: number;
  /**
   * The secret used to sign the JWT. Should be a 256 bit string.
   */
  jwtSecret: string;
  /**
   * How long from current time, in seconds, the JWT token expires.
   */
  jwtExpire: number;
  /**
   * How long, in seconds, before the JWT token expires to give the user a new one.
   */
  jwtRenew: number;
  /**
   * Function to build the JWT for user sessions.
   */
  jwtBuilder: (user: User) => string;
  /**
   * Function to verify that a JWT was signed with the secret key, vaildate its data, validate the
   * XSRF token, and extract the GUID.
   *
   * If no XSRF token is supplied, ignore it.
   *
   * Return false if the JWT is not valid, or an array of GUID and expire timestamp otherwise.
   */
  jwtExtract: (
    token: string,
    xsrfToken?: string
  ) => { guid: string; expire: Date } | null;
  sendEmail: (config: EmailOptions, user: User & UserData) => Promise<boolean>;
  /**
   * The address you'd like to receive a notification of registered users, if any.
   */
  userRegisteredRecipient: string | null;
  /**
   * The validator used to check groups before saving.
   */
  validatorGroup: (group: Group & GroupData) => void;
  /**
   * The validator used to check users before saving.
   */
  validatorUser: (user: User & UserData) => void;
}