import crypto from 'node:crypto';
import {
  type EntityJson,
  type EntityPatch,
  type Selector,
  type SerializedEntityData,
  transaction,
  transactional,
} from '@nymphjs/nymph';
import { humanSecret, nanoid } from '@nymphjs/guid';
import type { EmailOptions } from 'email-templates';
import { strtotime } from 'locutus/php/datetime/index';
import { difference, xor } from 'lodash-es';
import { TOTP, Secret } from 'otpauth';
import { toDataURL } from 'qrcode';
import { splitn } from '@sciactive/splitn';

import { enforceTilmeld } from './enforceTilmeld.js';
import { AbleObject } from './AbleObject.js';
import { Group as GroupClass } from './Group.js';
import {
  AccessControlError,
  BadDataError,
  BadEmailError,
  BadUsernameError,
  EmailChangeRateLimitExceededError,
} from './errors/index.js';

export type EventType =
  | 'checkUsername'
  | 'beforeRegister'
  | 'afterRegister'
  | 'beforeSave'
  | 'afterSave'
  | 'beforeLogin'
  | 'afterLogin'
  | 'beforeLogout'
  | 'afterLogout'
  | 'beforeDelete'
  | 'afterDelete';
/**
 * This is run when the user has entered an otherwise valid username into the
 * signup form. It should return a result, which when false will stop the
 * process and return the included message, disallowing the username.
 */
export type TilmeldCheckUsernameCallback = (
  user: User,
  data: { username: string },
) => Promise<{ result: boolean; message?: string }>;
/**
 * This is run before the user data checks, so the only checks before are
 * whether registration is allowed and whether the user is already registered.
 */
export type TilmeldBeforeRegisterCallback = (
  user: User,
  data: { password: string; additionalData?: { [k: string]: any } },
) => Promise<void>;
/**
 * This is run before the transaction is committed, and you can perform
 * additional functions on the transaction, which is available in `user.$nymph`.
 */
export type TilmeldAfterRegisterCallback = (
  user: User,
  result: { loggedin: boolean; message: string },
) => Promise<void>;
/**
 * This is run just before the user is saved, so all checks have passed.
 *
 * The transaction is available in `user.$nymph`.
 */
export type TilmeldBeforeSaveCallback = (user: User) => Promise<void>;
/**
 * This is run before the transaction is committed, and you can perform
 * additional functions on the transaction, which is available in `user.$nymph`.
 *
 * This is run after a new email verification email has been sent, so throwing
 * an error will cause confusion for the user if they've changed their email.
 */
export type TilmeldAfterSaveCallback = (user: User) => Promise<void>;
/**
 * This is run after the authentication checks, but before the login action.
 */
export type TilmeldBeforeLoginCallback = (
  user: User,
  data: {
    username: string;
    password: string;
    additionalData?: { [k: string]: any };
  },
) => Promise<void>;
export type TilmeldAfterLoginCallback = (user: User) => Promise<void>;
export type TilmeldBeforeLogoutCallback = (user: User) => Promise<void>;
export type TilmeldAfterLogoutCallback = (user: User) => Promise<void>;
/**
 * This is run before the user is logged out (if the current user is being
 * deleted).
 *
 * The transaction is available in `user.$nymph`.
 */
export type TilmeldBeforeDeleteCallback = (user: User) => Promise<void>;
/**
 * This is run before the transaction is committed, and you can perform
 * additional functions on the transaction, which is available in `user.$nymph`.
 */
export type TilmeldAfterDeleteCallback = (user: User) => Promise<void>;

export interface UserData {
  /**
   * The abilities granted to the user.
   */
  abilities?: string[];
  /**
   * The user's username.
   */
  username?: string;
  /**
   * The user's first name.
   */
  nameFirst?: string;
  /**
   * The user's middle name.
   */
  nameMiddle?: string;
  /**
   * The user's last name.
   */
  nameLast?: string;
  /**
   * The user's full name. This is generated from the first, middle, and last
   * names.
   */
  name?: string;
  /**
   * The user's email address.
   */
  email?: string;
  /**
   * The user's avatar URL. (Use $getAvatar() to support Gravatar.)
   */
  avatar?: string;
  /**
   * The user's telephone number.
   */
  phone?: string;
  /**
   * The user's primary group.
   */
  group?: GroupClass;
  /**
   * The user's secondary groups.
   */
  groups?: GroupClass[];
  /**
   * Whether the user should inherit the abilities of his groups.
   */
  inheritAbilities?: boolean;

  /**
   * Whether the user can log in.
   */
  enabled?: boolean;
  /**
   * A verification secret.
   */
  secret?: string;
  /**
   * The timestamp of when the email address was last changed.
   */
  emailChangeDate?: number;
  /**
   * An email change proceed secret.
   */
  newEmailSecret?: string;
  /**
   * If the user has changed their email address, this is the new one, awaiting
   * verification.
   */
  newEmailAddress?: string;
  /**
   * An email change cancellation secret.
   */
  cancelEmailSecret?: string;
  /**
   * The old email address.
   */
  cancelEmailAddress?: string;
  /**
   * A recovery secret.
   */
  recoverSecret?: string;
  /**
   * The timestamp of when the recovery secret was issued.
   */
  recoverSecretDate?: number;
  /**
   * The password hash salt.
   */
  salt?: string;
  /**
   * The password or password hash.
   */
  password?: string;
  /**
   * Temporary storage for passwords. This will be hashed before going into the
   * database.
   */
  passwordTemp?: string;
  /**
   * If set, this timestamp is the cutoff point for JWT issue dates. Any token
   * issued before this date will not authenticate the user.
   */
  revokeTokenDate?: number;
  /**
   * Two factor auth secret.
   */
  totpSecret?: string;
}

export interface User extends UserData {}

/**
 * A user data model.
 *
 * Written by Hunter Perrin for SciActive.
 *
 * @author Hunter Perrin <hperrin@port87.com>
 * @copyright SciActive Inc
 * @see http://nymph.io/
 */
export class User extends AbleObject<UserData> {
  static ETYPE = 'tilmeld_user';
  static class = 'User';
  private static checkUsernameCallbacks: TilmeldCheckUsernameCallback[] = [];
  private static beforeRegisterCallbacks: TilmeldBeforeRegisterCallback[] = [];
  private static afterRegisterCallbacks: TilmeldAfterRegisterCallback[] = [];
  private static beforeSaveCallbacks: TilmeldBeforeSaveCallback[] = [];
  private static afterSaveCallbacks: TilmeldAfterSaveCallback[] = [];
  private static beforeLoginCallbacks: TilmeldBeforeLoginCallback[] = [];
  private static afterLoginCallbacks: TilmeldAfterLoginCallback[] = [];
  private static beforeLogoutCallbacks: TilmeldBeforeLogoutCallback[] = [];
  private static afterLogoutCallbacks: TilmeldAfterLogoutCallback[] = [];
  private static beforeDeleteCallbacks: TilmeldBeforeDeleteCallback[] = [];
  private static afterDeleteCallbacks: TilmeldAfterDeleteCallback[] = [];

  private static DEFAULT_CLIENT_ENABLED_METHODS = [
    '$checkUsername',
    '$checkEmail',
    '$checkPhone',
    '$getAvatar',
    '$register',
  ];
  private static DEFAULT_PRIVATE_DATA = [
    // The things that are commented are there to show what is _not_ private.
    'abilities',
    // 'username',
    // 'nameFirst',
    // 'nameMiddle',
    // 'nameLast',
    // 'name',
    'email',
    // 'avatar',
    'phone',
    'group',
    'groups',
    'inheritAbilities',
    'enabled',
    'secret',
    'emailChangeDate',
    'newEmailSecret',
    'newEmailAddress',
    'cancelEmailSecret',
    'cancelEmailAddress',
    'recoverSecret',
    'recoverSecretDate',
    'salt',
    'password',
    'passwordTemp',
    'revokeTokenDate',
    'totpSecret',
  ];
  private static DEFAULT_ALLOWLIST_DATA: string[] = [];

  protected $clientEnabledMethods = [...User.DEFAULT_CLIENT_ENABLED_METHODS];
  public static clientEnabledStaticMethods = [
    'current',
    'loginUser',
    'sendRecovery',
    'recover',
    'getClientConfig',
    'getDomainUsers',
  ];
  protected $privateData = [...User.DEFAULT_PRIVATE_DATA];
  public static searchRestrictedData = [...User.DEFAULT_PRIVATE_DATA];
  protected $allowlistData? = [...User.DEFAULT_ALLOWLIST_DATA];
  protected $allowlistTags?: string[] = [];

  /**
   * Gatekeeper ability cache.
   *
   * Gatekeeper will cache the user's abilities that it calculates, so it can
   * check faster if that user has been checked before.
   */
  private $gatekeeperCache?: { [k: string]: true };
  /**
   * This should only be used by the backend.
   */
  private $skipAcWhenSaving = false;
  /**
   * This should only be used by the backend.
   */
  private $skipAcWhenDeleting = false;
  /**
   * The user's group descendants.
   */
  private $descendantGroups?: GroupClass[];
  /**
   * Used to save the current email address to send verification if it changes
   * from the frontend.
   *
   * If you are changing a user's email address and want to bypass email
   * verification, don't set this.
   */
  public $originalEmail?: string;
  /**
   * Used to save the current username for domain admin permissions.
   */
  public $originalUsername?: string;

  public static getFTSText(name: string, value: any) {
    if (
      [
        'abilities',
        'group',
        'groups',
        'inheritAbilities',
        'enabled',
        'secret',
        'emailChangeDate',
        'newEmailSecret',
        'newEmailAddress',
        'cancelEmailSecret',
        'cancelEmailAddress',
        'recoverSecret',
        'recoverSecretDate',
        'salt',
        'password',
        'passwordTemp',
        'revokeTokenDate',
        'totpSecret',
      ].indexOf(name) !== -1
    ) {
      return null;
    }
    return super.getFTSText(name, value);
  }

  static async factoryUsername(username?: string): Promise<User> {
    const entity = new this();
    if (username != null) {
      const entity = await this.nymph.getEntity(
        { class: this },
        {
          type: '&',
          ilike: ['username', username.replace(/([\\%_])/g, (s) => `\\${s}`)],
        },
      );
      if (entity != null) {
        return entity;
      }
    }
    return entity;
  }

  public static current(returnObjectIfNotExist: true): User;
  public static current(returnObjectIfNotExist?: false): User | null;
  public static current(returnObjectIfNotExist?: boolean): User | null {
    const tilmeld = enforceTilmeld(this);
    if (tilmeld.currentUser == null) {
      return returnObjectIfNotExist ? this.factorySync() : null;
    }
    return tilmeld.currentUser;
  }

  /**
   * Send an account recovery link.
   *
   * @param data The input data from the client.
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public static async sendRecovery(data: {
    recoveryType: 'username' | 'password';
    account: string;
  }): Promise<{ result: boolean; message: string }> {
    const tilmeld = enforceTilmeld(this);
    if (!tilmeld.config.pwRecovery) {
      return { result: false, message: 'Account recovery is not allowed.' };
    }

    let user: User;
    const options: EmailOptions = {};

    if (!tilmeld.config.emailUsernames && data.recoveryType === 'username') {
      // Create a username recovery email.

      const getUser = await this.nymph.getEntity(
        { class: tilmeld.User, skipAc: true },
        {
          type: '&',
          ilike: ['email', data.account.replace(/([\\%_])/g, (s) => `\\${s}`)],
        },
      );

      if (getUser == null) {
        return {
          result: false,
          message: 'Requested account is not accessible.',
        };
      }

      // Send the recovery email.
      user = getUser;
      options.template = 'RecoverUsername';
      options.message = {
        to: { name: user.name ?? '', address: user.email ?? '' },
      };
      options.locals = {};
    } else if (data.recoveryType === 'password') {
      // Create a password recovery email.

      const getUser = await tilmeld.User.factoryUsername(data.account);

      if (getUser.guid == null) {
        return {
          result: false,
          message: 'Requested account is not accessible.',
        };
      }

      // Create a unique secret.
      getUser.recoverSecret = humanSecret();
      getUser.recoverSecretDate = Date.now();
      try {
        await getUser.$saveSkipAC();
      } catch (e: any) {
        return { result: false, message: "Couldn't save recovery secret." };
      }

      // Send the recovery email.
      user = getUser;
      options.template = 'RecoverPassword';
      options.message = {
        to: { name: user.name ?? '', address: user.email ?? '' },
      };
      options.locals = {
        recoverCode: getUser.recoverSecret,
        timeLimit: tilmeld.config.pwRecoveryTimeLimit,
      };
    } else {
      return { result: false, message: 'Invalid recovery type.' };
    }

    this.nymph.config.debugLog(
      'tilmeld',
      `User account recovery (${options.template}) request for "${user.username}".`,
    );

    // Send the email.
    if (await tilmeld.config.sendEmail(tilmeld, options, user)) {
      return {
        result: true,
        message:
          "We've sent an email to your registered address. Please " +
          'check your email to continue with account recovery.',
      };
    } else {
      return { result: false, message: "Couldn't send recovery email." };
    }
  }

  /**
   * Recover account details.
   *
   * @param data The input data from the client.
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public static async recover(data: {
    username: string;
    secret: string;
    password: string;
  }): Promise<{ result: boolean; message: string }> {
    const tilmeld = enforceTilmeld(this);
    if (!tilmeld.config.pwRecovery) {
      return { result: false, message: 'Account recovery is not allowed.' };
    }

    const user = await tilmeld.User.factoryUsername(data.username);

    if (
      user.guid == null ||
      user.recoverSecret == null ||
      data.secret !== user.recoverSecret ||
      (strtotime(
        '+' + tilmeld.config.pwRecoveryTimeLimit,
        Math.floor((user.recoverSecretDate ?? 0) / 1000),
      ) || 0) *
        1000 <
        Date.now()
    ) {
      return { result: false, message: 'The secret code does not match.' };
    }

    if (!('password' in data) || !data.password.length) {
      return { result: false, message: 'Password cannot be empty.' };
    }

    this.nymph.config.debugLog(
      'tilmeld',
      `User account recovery for "${user.username}".`,
    );

    user.$password(data.password);
    delete user.recoverSecret;
    delete user.recoverSecretDate;
    try {
      await user.$saveSkipAC();
      return {
        result: true,
        message:
          'Your password has been reset. You can now log in using your new password.',
      };
    } catch (e: any) {
      return { result: false, message: 'Error saving new password.' };
    }
  }

  public static getClientConfig() {
    const tilmeld = enforceTilmeld(this);
    return {
      regFields: tilmeld.config.regFields,
      userFields: tilmeld.config.userFields,
      emailUsernames: tilmeld.config.emailUsernames,
      domainSupport: tilmeld.config.domainSupport,
      allowRegistration: tilmeld.config.allowRegistration,
      allowUsernameChange: tilmeld.config.allowUsernameChange,
      pwRecovery: tilmeld.config.pwRecovery,
      verifyEmail: tilmeld.config.verifyEmail,
      unverifiedAccess: tilmeld.config.unverifiedAccess,
    };
  }

  public static async loginUser(data: {
    username: string;
    password: string;
    code?: string;
    additionalData?: { [k: string]: any };
  }) {
    const tilmeld = enforceTilmeld(this);
    if (!('username' in data) || !data.username.length) {
      return { result: false, message: 'Incorrect login/password.' };
    }
    const user = await tilmeld.User.factoryUsername(data.username);
    const result: { result: boolean; message: string; user?: User } =
      await user.$login(data);
    if (result.result) {
      user.$updateDataProtection();
      result.user = user;
    }
    return result;
  }

  /**
   * Get the users in a domain. This is only accessible to the domain's admins.
   */
  public static async getDomainUsers(
    domain: string,
    options?: {
      limit?: number;
      offset?: number;
      sort?: string;
      reverse?: boolean;
    },
  ) {
    const tilmeld = enforceTilmeld(this);

    if (!tilmeld.config.domainSupport) {
      throw new AccessControlError('Domain support is not enabled.');
    }

    if (!domain) {
      throw new BadDataError('Domain is required.');
    }

    domain = domain.toLowerCase();
    if (!tilmeld.config.validDomainRegex.test(domain)) {
      throw new BadDataError(tilmeld.config.validDomainRegexNotice);
    }

    if (!tilmeld.gatekeeper(`tilmeld/domain/${domain}/admin`)) {
      throw new AccessControlError(
        'You do not have the authority to manage this domain.',
      );
    }

    return await this.nymph.getEntities(
      {
        class: this.nymph.getEntityClass(User),
        ...(options?.limit != null ? { limit: options.limit } : {}),
        ...(options?.offset != null ? { offset: options.offset } : {}),
        ...(options?.sort != null ? { sort: options.sort } : {}),
        ...(options?.reverse != null ? { reverse: options.reverse } : {}),
      },
      {
        type: '&',
        like: ['username', `%@${domain.replace(/([\\%_])/g, (s) => `\\${s}`)}`],
      },
    );
  }

  constructor() {
    super();

    // Defaults.
    this.enabled = true;
    this.abilities = [];
    this.groups = [];
    this.inheritAbilities = true;
    this.$updateDataProtection();
  }

  async $getUniques(): Promise<string[]> {
    const tilmeld = enforceTilmeld(this);
    const uniques = [`u:${this.username}`];
    if (
      !tilmeld.config.emailUsernames &&
      tilmeld.config.userFields.includes('email')
    ) {
      uniques.push(`e:${this.email}`);

      if (this.newEmailAddress != null) {
        uniques.push(`e:${this.newEmailAddress}`);
      }
    }
    return uniques;
  }

  public async $login(data: {
    username: string;
    password: string;
    code?: string;
    additionalData?: { [k: string]: any };
  }) {
    const tilmeld = enforceTilmeld(this);
    if (this.guid == null) {
      await tilmeld.config.failedLoginAttempt(null, data);
      return { result: false, message: 'Incorrect login/password.' };
    }
    if (!this.$checkPassword(data.password)) {
      await tilmeld.config.failedLoginAttempt(this, data);
      return { result: false, message: 'Incorrect login/password.' };
    }
    if (!this.enabled) {
      return { result: false, message: 'Your account is disabled.' };
    }
    if (await this.$gatekeeper()) {
      return { result: true, message: 'You are already logged in.' };
    }

    if (this.totpSecret != null) {
      if (
        data.code == null ||
        typeof data.code !== 'string' ||
        data.code.length !== 6
      ) {
        return {
          result: false,
          needTOTP: true,
          message: 'You need to provide a 2FA code.',
        };
      }

      if (!this.$checkTOTPCode(data.code)) {
        await tilmeld.config.failedLoginAttempt(this, data);
        return { result: false, message: 'Incorrect 2FA code.' };
      }
    }

    try {
      for (let callback of (this.constructor as typeof User)
        .beforeLoginCallbacks) {
        if (callback) {
          await callback(this, data);
        }
      }
    } catch (e: any) {
      return { result: false, message: e.message };
    }

    this.$nymph.config.debugLog(
      'tilmeld',
      `User login for "${this.username}".`,
    );

    // Authentication was successful, attempt to login.
    if (!(await tilmeld.login(this, true))) {
      return { result: false, message: 'Incorrect login/password.' };
    }

    for (let callback of (this.constructor as typeof User)
      .afterLoginCallbacks) {
      if (callback) {
        await callback(this);
      }
    }

    // Login was successful.
    return { result: true, message: 'You are logged in.' };
  }

  public async $switchUser(data?: {
    additionalData?: { [k: string]: any };
  }): Promise<{ result: boolean; message: string }> {
    const tilmeld = enforceTilmeld(this);
    if (this.guid == null) {
      return { result: false, message: 'Incorrect login/password.' };
    }

    let user = tilmeld.User.current();

    if (!user || user.guid == null) {
      return { result: false, message: "You're not logged in." };
    }

    const isCurrentUser = user != null && user.$is(this);

    if (isCurrentUser) {
      return { result: false, message: "You can't switch to yourself." };
    }

    const toAbilities = this.abilities || [];
    const fromAbilities = user.abilities || [];

    if (
      !fromAbilities.includes('tilmeld/switch') &&
      !fromAbilities.includes('system/admin')
    ) {
      return {
        result: false,
        message: "You don't have permission to switch users.",
      };
    }

    if (
      toAbilities.includes('system/admin') ||
      toAbilities.includes('tilmeld/admin')
    ) {
      return { result: false, message: "You can't switch to an admin." };
    }

    try {
      for (let callback of (this.constructor as typeof User)
        .beforeLoginCallbacks) {
        if (callback) {
          await callback(this, {
            username: this.username || '',
            password: '',
            ...(data || {}),
          });
        }
      }
    } catch (e: any) {
      return { result: false, message: e.message };
    }

    this.$nymph.config.debugLog(
      'tilmeld',
      `User login switch for "${user.username}" to "${this.username}".`,
    );

    // Authentication was successful, attempt to login.
    if (!(await tilmeld.loginSwitch(this, true))) {
      return { result: false, message: 'Incorrect login/password.' };
    }

    for (let callback of (this.constructor as typeof User)
      .afterLoginCallbacks) {
      if (callback) {
        await callback(this);
      }
    }

    // Login was successful.
    return { result: true, message: 'You are logged in.' };
  }

  /**
   * Log a user out of the system.
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public async $logout(): Promise<{ result: boolean; message: string }> {
    const tilmeld = enforceTilmeld(this);

    try {
      for (let callback of (this.constructor as typeof User)
        .beforeLogoutCallbacks) {
        if (callback) {
          await callback(this);
        }
      }
    } catch (e: any) {
      return { result: false, message: e.message };
    }

    this.$nymph.config.debugLog(
      'tilmeld',
      `User logout for "${this.username}".`,
    );

    await tilmeld.logout();

    for (let callback of (this.constructor as typeof User)
      .afterLogoutCallbacks) {
      if (callback) {
        await callback(this);
      }
    }

    return { result: true, message: 'You have been logged out.' };
  }

  public $getAvatar(): string {
    if (this.avatar != null && this.avatar !== '') {
      return this.avatar;
    }
    if (this.email == null || this.email === '') {
      return 'https://secure.gravatar.com/avatar/?d=mm&s=40';
    }
    return (
      'https://secure.gravatar.com/avatar/' +
      crypto
        .createHash('sha256')
        .update(this.email.trim().toLowerCase())
        .digest('hex')
        .toLowerCase() +
      '?d=identicon&s=40'
    );
  }

  public $getGid() {
    if (this.group) {
      return this.group.guid;
    }
    return null;
  }

  public $getGids() {
    if (this.groups) {
      return this.groups
        .map((group) => group.guid)
        .filter((guid) => guid != null) as string[];
    }
    return null;
  }

  /**
   * Get the user's group descendants.
   */
  public async $getDescendantGroups(): Promise<GroupClass[]> {
    if (this.$descendantGroups == null) {
      this.$descendantGroups = [];
      if (this.group != null) {
        await this.group.$wake();
        this.$descendantGroups = await this.group.$getDescendants();
      }
      await Promise.all(this.groups?.map((e) => e.$wake()) || []);
      for (let curGroup of this.groups ?? []) {
        this.$descendantGroups = this.$descendantGroups?.concat(
          await curGroup.$getDescendants(),
        );
      }
    }
    return this.$descendantGroups;
  }

  public $jsonAcceptData(input: EntityJson, allowConflict = false) {
    const tilmeld = enforceTilmeld(this);
    this.$check();

    if ('abilities' in input.data) {
      this.$checkIncomingAbilities(input.data.abilities);
    }

    // If the user is a new domain user, the data protection needs to be updated
    // before the data is accepted, or else some things won't be accepted
    // correctly (enabled, passwordTemp).
    let reloadDataProtection = false;
    if (tilmeld.config.domainSupport) {
      let [_username, domain] = splitn(input.data.username ?? '', '@', 2);
      // Lowercase the domain part.
      if (domain) {
        domain = domain.toLowerCase();
      }
      const user = tilmeld.User.current();
      const isCurrentUser = user != null && user.$is(this);
      // While loading, accessing abilities on the current user will infinitely
      // loop, but if this is the current user, we can use its abilities.
      const abilities =
        (isCurrentUser || user == null ? this.abilities : user?.abilities) ??
        [];
      const isNewUser = input.guid == null;
      const isDomainUser =
        !isCurrentUser &&
        user != null &&
        domain &&
        abilities.includes(`tilmeld/domain/${domain}/admin`);

      reloadDataProtection = !!(isNewUser && isDomainUser);
    }

    super.$jsonAcceptData(input, allowConflict);

    if (reloadDataProtection) {
      // Load it again after data protection is run.
      this.$updateDataProtection();
      super.$jsonAcceptData(input, allowConflict);
    }
  }

  public $jsonAcceptPatch(patch: EntityPatch, allowConflict = false) {
    this.$check();

    if ('abilities' in patch.set) {
      this.$checkIncomingAbilities(patch.set.abilities);
    }

    super.$jsonAcceptPatch(patch, allowConflict);
  }

  private $checkIncomingAbilities(incoming: any) {
    const tilmeld = enforceTilmeld(this);

    if (
      !Array.isArray(incoming) ||
      incoming.find((ability) => typeof ability !== 'string')
    ) {
      throw new BadDataError('Abilities must be an array of strings.');
    }

    if (
      incoming.includes('system/admin') !==
        this.abilities?.includes('system/admin') &&
      (!tilmeld.currentUser ||
        !tilmeld.currentUser.abilities?.includes('system/admin'))
    ) {
      throw new BadDataError(
        "You don't have the authority to grant or revoke system/admin.",
      );
    }

    if (
      incoming.includes('tilmeld/admin') !==
        this.abilities?.includes('tilmeld/admin') &&
      (!tilmeld.currentUser ||
        !tilmeld.currentUser.abilities?.includes('system/admin'))
    ) {
      throw new BadDataError(
        "You don't have the authority to grant or revoke tilmeld/admin.",
      );
    }

    if (
      incoming.includes('tilmeld/switch') !==
        this.abilities?.includes('tilmeld/switch') &&
      (!tilmeld.currentUser ||
        !tilmeld.currentUser.abilities?.includes('system/admin'))
    ) {
      throw new BadDataError(
        "You don't have the authority to grant or revoke tilmeld/switch.",
      );
    }

    if (
      xor(
        incoming.filter((ability: string) => ability.startsWith('tilmeld/')),
        this.abilities?.filter((ability: string) =>
          ability.startsWith('tilmeld/'),
        ) ?? [],
      ).length &&
      (!tilmeld.currentUser ||
        (!tilmeld.currentUser.abilities?.includes('system/admin') &&
          !tilmeld.currentUser.abilities?.includes('tilmeld/admin')))
    ) {
      throw new BadDataError(
        "You don't have the authority to grant or revoke Tilmeld abilities.",
      );
    }
  }

  public $putData(
    data: UserData,
    sdata?: SerializedEntityData,
    source?: 'server',
  ) {
    super.$putData(data, sdata, source);
    // TODO: Fix these being added by the drivers.
    // @ts-ignore
    delete this.acRead;
    // @ts-ignore
    delete this.acWrite;
    // @ts-ignore
    delete this.acFull;
    if (source === 'server') {
      this.$originalEmail = this.email;
      this.$originalUsername = this.username;
    }
    this.$updateDataProtection();
  }

  /**
   * Update the data protection arrays for a user.
   *
   * @param givenUser User to update protection for. If undefined, will use the currently logged in user.
   */
  public $updateDataProtection(givenUser?: User) {
    const tilmeld = enforceTilmeld(this);
    let user = givenUser ?? tilmeld.User.current();
    let [_username, domain] = tilmeld.config.domainSupport
      ? splitn(this.$originalUsername ?? this.username ?? '', '@', 2)
      : [this.$originalUsername ?? this.username, null];
    // Lowercase the domain part.
    if (domain) {
      domain = domain.toLowerCase();
    }

    this.$clientEnabledMethods = [...User.DEFAULT_CLIENT_ENABLED_METHODS];
    this.$privateData = [...User.DEFAULT_PRIVATE_DATA];
    this.$allowlistData = [...User.DEFAULT_ALLOWLIST_DATA];

    if (tilmeld.config.emailUsernames) {
      this.$privateData.push('username');
    }

    const isCurrentUser = user != null && user.$is(this);
    // While loading, accessing abilities on the current user will infinitely
    // loop, but if this is the current user, we can use its abilities.
    const abilities =
      (isCurrentUser || user == null ? this.abilities : user?.abilities) ?? [];
    const isNewUser = this.guid == null;
    const isDomainUser =
      tilmeld.config.domainSupport &&
      !isCurrentUser &&
      user != null &&
      domain &&
      abilities.includes(`tilmeld/domain/${domain}/admin`);

    if (isCurrentUser) {
      // Users can check to see what abilities they have.
      this.$clientEnabledMethods.push('$gatekeeper');
      this.$clientEnabledMethods.push('$changePassword');
      this.$clientEnabledMethods.push('$revokeCurrentTokens');
      this.$clientEnabledMethods.push('$logout');
      this.$clientEnabledMethods.push('$hasTOTPSecret');
      this.$clientEnabledMethods.push('$getNewTOTPSecret');
      this.$clientEnabledMethods.push('$saveTOTPSecret');
      this.$clientEnabledMethods.push('$removeTOTPSecret');
    }

    if (isDomainUser) {
      // Domain admins can check to see what abilities their users have.
      this.$clientEnabledMethods.push('$gatekeeper');
      this.$clientEnabledMethods.push('$changePassword');
      this.$clientEnabledMethods.push('$revokeCurrentTokens');
      this.$clientEnabledMethods.push('$hasTOTPSecret');
      this.$clientEnabledMethods.push('$getNewTOTPSecret');
      this.$clientEnabledMethods.push('$saveTOTPSecret');
      this.$clientEnabledMethods.push('$removeTOTPSecret');
    }

    if (
      user != null &&
      (abilities.includes('tilmeld/admin') ||
        abilities.includes('system/admin'))
    ) {
      // Users who can edit other users can see most of their data.
      this.$privateData = ['password', 'salt', 'totpSecret'];
      this.$clientEnabledMethods.push('$hasTOTPSecret');
      this.$clientEnabledMethods.push('$removeTOTPSecret');
      this.$allowlistData = undefined;
    } else if (isDomainUser) {
      // Domain admins can see their users' data, and edit some of it.
      if (tilmeld.config.allowUsernameChange || isNewUser) {
        this.$allowlistData.push('username');
      }
      this.$allowlistData.push('avatar');
      if (tilmeld.config.userFields.includes('name')) {
        this.$allowlistData.push('nameFirst');
        this.$allowlistData.push('nameMiddle');
        this.$allowlistData.push('nameLast');
        this.$allowlistData.push('name');
      }
      if (tilmeld.config.userFields.includes('email')) {
        this.$allowlistData.push('email');
      }
      if (tilmeld.config.userFields.includes('phone')) {
        this.$allowlistData.push('phone');
      }
      this.$allowlistData.push('enabled');
      this.$allowlistData.push('passwordTemp');
      this.$privateData = [
        // The things commented are there to show what is _not_ private.
        // 'abilities',
        // 'username',
        // 'nameFirst',
        // 'nameMiddle',
        // 'nameLast',
        // 'name',
        // 'email',
        // 'avatar',
        // 'phone',
        // 'group',
        // 'groups',
        // 'inheritAbilities',
        // 'enabled',
        'secret',
        'emailChangeDate',
        'newEmailSecret',
        // 'newEmailAddress',
        'cancelEmailSecret',
        'cancelEmailAddress',
        'recoverSecret',
        'recoverSecretDate',
        'salt',
        'password',
        // 'passwordTemp',
        // 'revokeTokenDate',
        'totpSecret',
      ];
    } else if (isCurrentUser || isNewUser) {
      // Users can see their own data, and edit some of it.
      if (tilmeld.config.allowUsernameChange || isNewUser) {
        this.$allowlistData.push('username');
      }
      this.$allowlistData.push('avatar');
      if (tilmeld.config.userFields.includes('name')) {
        this.$allowlistData.push('nameFirst');
        this.$allowlistData.push('nameMiddle');
        this.$allowlistData.push('nameLast');
        this.$allowlistData.push('name');
      }
      if (tilmeld.config.userFields.includes('email')) {
        this.$allowlistData.push('email');
      }
      if (tilmeld.config.userFields.includes('phone')) {
        this.$allowlistData.push('phone');
      }
      this.$privateData = [
        // The things commented are there to show what is _not_ private.
        // 'abilities',
        // 'username',
        // 'nameFirst',
        // 'nameMiddle',
        // 'nameLast',
        // 'name',
        // 'email',
        // 'avatar',
        // 'phone',
        // 'group',
        // 'groups',
        // 'inheritAbilities',
        'enabled',
        'secret',
        'emailChangeDate',
        'newEmailSecret',
        // 'newEmailAddress',
        'cancelEmailSecret',
        'cancelEmailAddress',
        'recoverSecret',
        'recoverSecretDate',
        'salt',
        'password',
        'passwordTemp',
        // 'revokeTokenDate',
        'totpSecret',
      ];
    }

    if (
      user != null &&
      !isCurrentUser &&
      (abilities.includes('tilmeld/switch') ||
        abilities.includes('system/admin'))
    ) {
      // Users with this ability can switch to other users.
      this.$clientEnabledMethods.push('$switchUser');
    }
  }

  public $updateGroupDataProtection() {
    if (this.group != null && !this.group.$asleep()) {
      this.group.$updateDataProtection();
    }
    for (let group of this.groups ?? []) {
      if (!group.$asleep()) {
        group.$updateDataProtection();
      }
    }
  }

  /**
   * Check to see if a user has an ability.
   *
   * This function will check both user and group abilities, if the user is
   * marked to inherit the abilities of its group.
   *
   * If `ability` is undefined, it will check to see if the user is currently
   * logged in.
   *
   * If the user has the "system/admin" ability, this function will return true.
   *
   * @param ability The ability.
   * @returns True or false.
   */
  public async $gatekeeper(ability?: string): Promise<boolean> {
    await this.$wake();
    const tilmeld = enforceTilmeld(this);
    if (ability == null) {
      return tilmeld.User.current()?.$is(this) ?? false;
    }
    // Check the cache to see if we've already checked this user.
    if (this.$gatekeeperCache == null) {
      this.$gatekeeperCache = await this.$getGatekeeperCache();
    }
    return (
      (ability in this.$gatekeeperCache && !!this.$gatekeeperCache[ability]) ||
      !!this.abilities?.includes('system/admin')
    );
  }

  /**
   * Build a gatekeeper cache object.
   */
  public async $getGatekeeperCache() {
    await this.$wake();
    let abilities = this.abilities ?? [];
    if (this.inheritAbilities) {
      await Promise.all(this.groups?.map((e) => e.$wake()) || []);
      for (let curGroup of this.groups ?? []) {
        if (curGroup.enabled) {
          abilities = abilities.concat(curGroup.abilities ?? []);
        }
      }
      await this.group?.$wake();
      const group = this.group;
      if (group != null && group.cdate != null && group.enabled) {
        abilities = abilities.concat(group.abilities ?? []);
      }
    }
    return Object.fromEntries(
      abilities.map((ability) => [ability, true as true]),
    );
  }

  public $clearCache() {
    const ret = super.$clearCache();
    this.$descendantGroups = undefined;
    this.$gatekeeperCache = undefined;
    return ret;
  }

  /**
   * Send the user email verification/change/cancellation links.
   *
   * @returns True on success, false on failure.
   */
  public async $sendEmailVerification(): Promise<boolean> {
    const tilmeld = enforceTilmeld(this);
    if (this.guid == null) {
      return false;
    }
    let success = true;

    const verifyUrl = `${tilmeld.config.appUrl.replace(/\/$/, () => '')}${
      tilmeld.config.setupPath
    }/verify`;

    if (this.secret != null) {
      const link = `${verifyUrl}?action=verify&id=${encodeURIComponent(
        this.guid,
      )}&secret=${encodeURIComponent(this.secret)}`;
      success =
        success &&
        (await tilmeld.config.sendEmail(
          tilmeld,
          {
            template: 'VerifyEmail',
            message: {
              to: {
                name: this.name ?? '',
                address: this.email ?? '',
              },
            },
            locals: { verifyLink: link },
          },
          this,
        ));
    }

    if (this.newEmailSecret != null) {
      const link = `${verifyUrl}?action=verifychange&id=${encodeURIComponent(
        this.guid,
      )}&secret=${encodeURIComponent(this.newEmailSecret)}`;
      success =
        success &&
        (await tilmeld.config.sendEmail(
          tilmeld,
          {
            template: 'VerifyEmailChange',
            message: {
              to: {
                name: this.name ?? '',
                address: this.newEmailAddress ?? '',
              },
            },
            locals: {
              verifyLink: link,
              oldEmail: this.cancelEmailAddress,
              newEmail: this.newEmailAddress,
            },
          },
          this,
        ));
    }

    if (this.cancelEmailSecret != null) {
      const link = `${verifyUrl}?action=cancelchange&id=${encodeURIComponent(
        this.guid,
      )}&secret=${encodeURIComponent(this.cancelEmailSecret)}`;
      success =
        success &&
        (await tilmeld.config.sendEmail(
          tilmeld,
          {
            template: 'CancelEmailChange',
            message: {
              to: {
                name: this.name ?? '',
                address: this.cancelEmailAddress ?? '',
              },
            },
            locals: {
              cancelLink: link,
              oldEmail: this.cancelEmailAddress,
              newEmail: this.newEmailAddress ?? this.email,
            },
          },
          this,
        ));
    }

    return success;
  }

  /**
   * Add the user to a (secondary) group.
   *
   * @param group The group.
   * @returns True if the user is already in the group. The resulting array of groups if the user was not.
   */
  public async $addGroup(group: GroupClass) {
    await Promise.all(this.groups?.map((e) => e.$wake()) || []);
    let groups = this.groups;
    if (groups == null) {
      groups = [];
    }
    if (!group.$inArray(groups)) {
      groups.push(group);
      this.groups = groups;
      return groups;
    }
    return true;
  }

  /**
   * Check the given password against the user's.
   *
   * @param password The password in question.
   * @returns True if the passwords match, otherwise false.
   */
  public $checkPassword(password: string) {
    const tilmeld = enforceTilmeld(this);
    switch (tilmeld.config.pwMethod) {
      case 'plain':
        return this.password === password;
      case 'digest':
        return (
          this.password ===
          crypto.createHash('sha256').update(password).digest('base64')
        );
      case 'salt':
      default:
        return (
          this.password ===
          crypto
            .createHash('sha256')
            .update(password + this.salt)
            .digest('base64')
        );
    }
  }

  /**
   * Remove the user from a (secondary) group.
   *
   * @param group The group.
   * @returns True if the user wasn't in the group. The resulting array of groups if the user was.
   */
  public async $delGroup(group: GroupClass) {
    await Promise.all(this.groups?.map((e) => e.$wake()) || []);
    let groups = this.groups || [];
    if (this.groups != null && group.$inArray(groups)) {
      const newGroups: GroupClass[] = [];
      for (let curGroup of groups) {
        if (!group.$is(curGroup)) {
          newGroups.push(curGroup);
        }
      }
      this.groups = newGroups;
      return this.groups;
    }
    return true;
  }

  /**
   * Check whether the user is in a (primary or secondary) group.
   *
   * @param group The group, or the group's GUID.
   * @returns True or false.
   */
  public async $inGroup(group: GroupClass | string) {
    if (typeof group === 'string') {
      if (this.group?.guid === group) {
        return true;
      }
      for (let curGroup of this.groups ?? []) {
        if (curGroup.guid === group) {
          return true;
        }
      }
      return false;
    }
    return group.$is(this.group) || group.$inArray(this.groups ?? []);
  }

  /**
   * Check whether the user is a descendant of a group.
   *
   * @param group The group, or the group's GUID.
   * @returns True or false.
   */
  public async $isDescendant(group: GroupClass | string) {
    // Check to see if the user is in a descendant group of the given group.
    await this.group?.$wake();
    if (
      this.group != null &&
      this.group?.cdate != null &&
      (await this.group?.$isDescendant(group))
    ) {
      return true;
    }
    await Promise.all(this.groups?.map((e) => e.$wake()) || []);
    for (let curGroup of this.groups ?? []) {
      if (await curGroup.$isDescendant(group)) {
        return true;
      }
    }
    return false;
  }

  /**
   * A frontend accessible method to change the user's password.
   *
   * @param data The input data from the client.
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public async $changePassword(data: {
    newPassword: string;
    currentPassword: string;
    revokeCurrentTokens?: boolean;
  }): Promise<{ result: boolean; message: string }> {
    this.$nymph.config.debugLog(
      'tilmeld',
      `Password change request for "${this.username}".`,
    );
    if (!('newPassword' in data) || !data.newPassword.length) {
      return { result: false, message: 'Please specify a password.' };
    }
    if (!this.$checkPassword(data.currentPassword ?? '')) {
      this.$nymph.config.debugLog(
        'tilmeld',
        `Incorrect password for change request for "${this.username}".`,
      );
      return { result: false, message: 'Incorrect password.' };
    }
    this.passwordTemp = data.newPassword;
    if (data.revokeCurrentTokens) {
      this.revokeTokenDate = Date.now();
    }
    try {
      await this.$save();
      if (data.revokeCurrentTokens) {
        const tilmeld = enforceTilmeld(this);
        await tilmeld.login(this, true);
      }
      return { result: true, message: 'Your password has been changed.' };
    } catch (e: any) {
      return { result: false, message: "Couldn't save new password." };
    }
  }

  /**
   * Change the user's password.
   *
   * @param password The new password.
   * @returns The resulting password or hash which is stored in the entity.
   */
  public $password(password: string) {
    const tilmeld = enforceTilmeld(this);
    switch (tilmeld.config.pwMethod) {
      case 'plain':
        delete this.salt;
        this.password = password;
        break;
      case 'digest':
        delete this.salt;
        this.password = crypto
          .createHash('sha256')
          .update(password)
          .digest('base64');
        break;
      case 'salt':
      default:
        this.salt = nanoid();
        this.password = crypto
          .createHash('sha256')
          .update(password + this.salt)
          .digest('base64');
        break;
    }
    return this.password;
  }

  /**
   * A frontend accessible method to revoke all currently issued tokens.
   *
   * @param data The input data from the client.
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public async $revokeCurrentTokens(data: {
    password: string;
  }): Promise<{ result: boolean; message: string }> {
    if (!this.$checkPassword(data.password ?? '')) {
      return { result: false, message: 'Incorrect password.' };
    }

    this.revokeTokenDate = Date.now();

    try {
      await this.$save();
      const tilmeld = enforceTilmeld(this);
      await tilmeld.login(this, true);
      return {
        result: true,
        message: 'You have logged out of all other sessions.',
      };
    } catch (e: any) {
      return { result: false, message: "Couldn't save revocation date." };
    }
  }

  public $hasTOTPSecret(): boolean {
    return this.totpSecret != null;
  }

  /**
   * Check the given code against the user's TOTP secret.
   *
   * @param code The code in question.
   * @returns True if the code is valid, otherwise false.
   */
  public $checkTOTPCode(code: string) {
    if (this.totpSecret == null) {
      return false;
    }

    const tilmeld = enforceTilmeld(this);

    const totp = new TOTP({
      issuer: tilmeld.config.appName,
      label: this.username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: this.totpSecret,
    });

    return totp.validate({ token: code, window: 2 }) != null;
  }

  /**
   * A frontend accessible method to generate a new TOTP secret.
   *
   * @returns An object with 'uri', 'qrcode', and 'secret'.
   */
  public async $getNewTOTPSecret(): Promise<{
    uri: string;
    qrcode: string;
    secret: string;
  }> {
    const tilmeld = enforceTilmeld(this);

    if (this.totpSecret != null) {
      throw new BadDataError('You already have a 2FA secret.');
    }

    const secret = new Secret();

    const totp = new TOTP({
      issuer: tilmeld.config.appName,
      label: this.username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const uri = totp.toString();

    const qrcode = await toDataURL(uri);

    return { uri, qrcode, secret: secret.base32 };
  }

  /**
   * A frontend accessible method to save a TOTP secret into the user's account.
   *
   * @param data The input data from the client.
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public async $saveTOTPSecret(data: {
    password: string;
    secret: string;
    code: string;
  }): Promise<{ result: boolean; message: string }> {
    if (!this.$checkPassword(data.password ?? '')) {
      return { result: false, message: 'Incorrect password.' };
    }

    if (this.totpSecret != null) {
      return { result: false, message: 'You already have a 2FA secret.' };
    }

    if (
      data.secret == null ||
      typeof data.secret !== 'string' ||
      data.secret === ''
    ) {
      return { result: false, message: '2FA secret is invalid.' };
    }

    if (
      data.code == null ||
      typeof data.code !== 'string' ||
      data.code.length !== 6
    ) {
      return { result: false, message: '2FA code is invalid.' };
    }

    const tilmeld = enforceTilmeld(this);

    const totp = new TOTP({
      issuer: tilmeld.config.appName,
      label: this.username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: data.secret,
    });

    if (totp.validate({ token: data.code, window: 2 }) == null) {
      return { result: false, message: '2FA code is incorrect.' };
    }

    this.totpSecret = data.secret;

    try {
      await this.$save();
      return { result: true, message: 'Your two factor secret is now set.' };
    } catch (e: any) {
      return { result: false, message: "Couldn't save two factor secret." };
    }
  }

  /**
   * A frontend accessible method to remove the TOTP secret from the user's
   * account.
   *
   * @param data The input data from the client.
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public async $removeTOTPSecret(data?: {
    password: string;
    code: string;
  }): Promise<{ result: boolean; message: string }> {
    const tilmeld = enforceTilmeld(this);

    if (data) {
      if (!this.$checkPassword(data.password ?? '')) {
        return { result: false, message: 'Incorrect password.' };
      }

      if (
        data.code == null ||
        typeof data.code !== 'string' ||
        data.code.length !== 6
      ) {
        return { result: false, message: '2FA code is invalid.' };
      }

      if (this.totpSecret == null) {
        return { result: false, message: "You don't have a 2FA secret." };
      }

      const totp = new TOTP({
        issuer: tilmeld.config.appName,
        label: this.username,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: this.totpSecret,
      });

      if (totp.validate({ token: data.code, window: 2 }) == null) {
        return { result: false, message: '2FA code is incorrect.' };
      }
    } else if (!tilmeld.gatekeeper('tilmeld/admin')) {
      return {
        result: false,
        message: 'You must provide your password and 2FA code.',
      };
    }

    delete this.totpSecret;

    try {
      await this.$save();
      return { result: true, message: 'Two factor secret has been removed.' };
    } catch (e: any) {
      return { result: false, message: "Couldn't remove two factor secret." };
    }
  }

  /**
   * Check that a username is valid.
   *
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public async $checkUsername(): Promise<{ result: boolean; message: string }> {
    const tilmeld = enforceTilmeld(this);

    this.$nymph.config.debugInfo(
      'tilmeld',
      `Username check "${this.username}".`,
    );

    if (!tilmeld.config.emailUsernames) {
      let [username, domain] = tilmeld.config.domainSupport
        ? splitn(this.username ?? '', '@', 2)
        : [this.username, null];

      // Lowercase the domain part.
      if (domain) {
        domain = domain.toLowerCase();
        this.username = `${username}@${domain}`;
      }

      if (
        this.username == null ||
        !this.username.length ||
        username == null ||
        !username.length
      ) {
        return { result: false, message: 'Please specify a username.' };
      }
      if (username.length < tilmeld.config.minUsernameLength) {
        return {
          result: false,
          message:
            'Usernames must be at least ' +
            tilmeld.config.minUsernameLength +
            ' characters.',
        };
      }
      if (username.length > tilmeld.config.maxUsernameLength) {
        return {
          result: false,
          message:
            'Usernames must not exceed ' +
            tilmeld.config.maxUsernameLength +
            ' characters.',
        };
      }

      if (
        difference(username.split(''), tilmeld.config.validChars.split(''))
          .length
      ) {
        return { result: false, message: tilmeld.config.validCharsNotice };
      }
      if (!tilmeld.config.validRegex.test(username)) {
        return { result: false, message: tilmeld.config.validRegexNotice };
      }
      if (domain != null) {
        if (!tilmeld.config.validDomainRegex.test(domain)) {
          return {
            result: false,
            message: tilmeld.config.validDomainRegexNotice,
          };
        }
        if (
          !this.$skipAcWhenSaving &&
          !this.$is(tilmeld.currentUser) &&
          !tilmeld.gatekeeper(`tilmeld/domain/${domain}/admin`)
        ) {
          return {
            result: false,
            message:
              "You don't have the authority to manage users on this domain.",
          };
        }
      }

      const selector: Selector = {
        type: '&',
        ilike: [
          'username',
          this.username.replace(/([\\%_])/g, (s) => `\\${s}`),
        ],
      };
      if (this.guid != null) {
        selector['!guid'] = this.guid;
      }
      const test = await this.$nymph.getEntity(
        { class: tilmeld.User, skipAc: true },
        selector,
      );
      if (test != null) {
        return { result: false, message: 'That username is taken.' };
      }

      for (let callback of (this.constructor as typeof User)
        .checkUsernameCallbacks) {
        if (callback) {
          const result = await callback(this, {
            username: this.username,
          });
          if (!result.result) {
            return { message: 'Username is not available.', ...result };
          }
        }
      }

      return {
        result: true,
        message:
          this.guid != null ? 'Username is valid.' : 'Username is available!',
      };
    } else {
      this.email = this.username;
      if (this.username == null || !this.username.length) {
        return { result: false, message: 'Please specify an email.' };
      }
      if (this.username.length < tilmeld.config.minUsernameLength) {
        return {
          result: false,
          message:
            'Emails must be at least ' +
            tilmeld.config.minUsernameLength +
            ' characters.',
        };
      }
      if (this.username.length > tilmeld.config.maxUsernameLength) {
        return {
          result: false,
          message:
            'Emails must not exceed ' +
            tilmeld.config.maxUsernameLength +
            ' characters.',
        };
      }

      return await this.$checkEmail();
    }
  }

  /**
   * Check that an email is unique.
   *
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public async $checkEmail(): Promise<{ result: boolean; message: string }> {
    const tilmeld = enforceTilmeld(this);

    this.$nymph.config.debugInfo('tilmeld', `Email check "${this.email}".`);

    if (this.email == null || !this.email.length) {
      if (tilmeld.config.verifyEmail) {
        return { result: false, message: 'Please specify an email.' };
      } else {
        return { result: true, message: '' };
      }
    }
    if (!tilmeld.config.validEmailRegex.test(this.email)) {
      return { result: false, message: tilmeld.config.validEmailRegexNotice };
    }
    const selector: Selector = {
      type: '&',
      ilike: ['email', this.email.replace(/([\\%_])/g, (s) => `\\${s}`)],
    };
    if (this.guid != null) {
      selector['!guid'] = this.guid;
    }
    const test = await this.$nymph.getEntity(
      { class: tilmeld.User, skipAc: true },
      selector,
    );
    if (test != null) {
      return {
        result: false,
        message: 'That email address is already registered.',
      };
    }

    return {
      result: true,
      message:
        this.guid != null ? 'Email is valid.' : 'Email address is valid!',
    };
  }

  /**
   * Check that a phone number is unique.
   *
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public async $checkPhone(): Promise<{ result: boolean; message: string }> {
    const tilmeld = enforceTilmeld(this);

    this.$nymph.config.debugInfo('tilmeld', `Phone check "${this.phone}".`);

    if (this.phone == null || !this.phone.length) {
      return { result: false, message: 'Please specify a phone number.' };
    }

    const stripToDigits = this.phone.replace(/\D/g, () => '');
    if (!/\d{10}/.test(stripToDigits)) {
      return {
        result: false,
        message:
          'Phone must contain at least 10 digits, but formatting does not matter.',
      };
    }
    const selector: Selector = {
      type: '&',
      equal: ['phone', stripToDigits],
    };
    if (this.guid != null) {
      selector['!guid'] = this.guid;
    }
    const test = await this.$nymph.getEntity(
      { class: tilmeld.User, skipAc: true },
      selector,
    );
    if (test != null) {
      return { result: false, message: 'Phone number is in use.' };
    }

    return {
      result: true,
      message:
        this.guid != null ? 'Phone number is valid.' : 'Phone number is valid!',
    };
  }

  public async $register(data: {
    password: string;
    additionalData?: { [k: string]: any };
  }): Promise<{ result: boolean; loggedin: boolean; message: string }> {
    let tilmeld = enforceTilmeld(this);
    if (!tilmeld.config.allowRegistration) {
      return {
        result: false,
        loggedin: false,
        message: 'Registration is not allowed.',
      };
    }
    if (this.guid != null) {
      return {
        result: false,
        loggedin: false,
        message: 'This is already a registered user.',
      };
    }

    if (!('password' in data) || !data.password.length) {
      return {
        result: false,
        loggedin: false,
        message: 'Password is a required field.',
      };
    }
    const unCheck = await this.$checkUsername();
    if (!unCheck.result) {
      return { ...unCheck, loggedin: false };
    }

    this.$password(data.password);
    if (tilmeld.config.regFields.includes('name')) {
      this.name =
        this.nameFirst +
        (this.nameMiddle == null ? '' : ' ' + this.nameMiddle) +
        (this.nameLast == null ? '' : ' ' + this.nameLast);
      if (this.name === '') {
        this.name = this.username;
      }
    }
    if (tilmeld.config.emailUsernames) {
      this.email = this.username;
    }

    try {
      const result = await transaction(
        this.$nymph,
        'tilmeld-register-' + nanoid(),
        async (nymph) => {
          this.$setNymph(nymph);
          const tilmeld = enforceTilmeld(this);

          let message = '';
          let loggedin = false;

          for (let callback of (this.constructor as typeof User)
            .beforeRegisterCallbacks) {
            if (callback) {
              await callback(this, data);
            }
          }

          if (
            tilmeld.config.userFields.includes('email') &&
            tilmeld.config.verifyEmail
          ) {
            // The user will be enabled after verifying their e-mail address.
            if (!tilmeld.config.unverifiedAccess) {
              this.enabled = false;
            }
          } else {
            this.enabled = true;
          }

          // If createAdmin is true and there are no other users, grant
          // "system/admin".
          let madeAdmin = false;
          if (tilmeld.config.createAdmin) {
            const otherUsers = await this.$nymph.getEntities({
              class: tilmeld.User,
              skipAc: true,
              limit: 1,
              return: 'guid',
            });
            // Make sure it's not just null, cause that means an error.
            if (otherUsers == null) {
              throw new Error('An error occurred.');
            }
            if (!otherUsers.length) {
              this.$grant('system/admin');
              this.enabled = true;
              madeAdmin = true;
            }
          }

          this.$nymph.config.debugLog(
            'tilmeld',
            `Registering new user "${this.username}".`,
          );

          await this.$saveSkipAC();

          // Finish up.
          if (
            tilmeld.config.verifyEmail &&
            !tilmeld.config.unverifiedAccess &&
            !madeAdmin &&
            tilmeld.config.userFields.includes('email')
          ) {
            message +=
              `Almost there. An email has been sent to ${this.email} ` +
              'with a verification link for you to finish registration.';
          } else if (
            tilmeld.config.verifyEmail &&
            tilmeld.config.unverifiedAccess &&
            !madeAdmin &&
            tilmeld.config.userFields.includes('email')
          ) {
            if (!(await tilmeld.login(this, true))) {
              throw new Error('An error occurred trying to log you in.');
            }
            message +=
              "You're now logged in! An email has been sent to " +
              `${this.email} with a verification link for you to finish ` +
              'registration.';
            loggedin = true;
          } else {
            if (!(await tilmeld.login(this, true))) {
              throw new Error('An error occurred trying to log you in.');
            }
            message += "You're now registered and logged in!";
            loggedin = true;
          }

          for (let callback of (this.constructor as typeof User)
            .afterRegisterCallbacks) {
            if (callback) {
              await callback(this, { loggedin, message });
            }
          }

          return { result: true, loggedin, message };
        },
        async (nymph) => {
          this.$setNymph(nymph);
        },
      );

      // Send the new user registered email.
      if (tilmeld.config.userRegisteredRecipient != null) {
        try {
          if (
            !(await tilmeld.config.sendEmail(
              tilmeld,
              {
                template: 'UserRegistered',
                message: { to: tilmeld.config.userRegisteredRecipient },
                locals: {
                  userUsername: this.username,
                  userName: this.name,
                  userFirstName: this.nameFirst,
                  userLastName: this.nameLast,
                  userEmail: this.email,
                  userPhone: this.phone,
                },
              },
              this,
            ))
          ) {
            throw new Error('Failed to send.');
          }
        } catch (e: any) {
          this.$nymph.config.debugError(
            'tilmeld',
            `Couldn't send new user registered email for "${this.username}": ${e.message}`,
          );
        }
      }

      if (result.loggedin) {
        try {
          await this.$nymph.tilmeld?.fillSession(this);
        } catch (e: any) {
          return {
            result: true,
            loggedin: false,
            message: `You are registered, but an error occurred logging you in: ${e.message}`,
          };
        }
      }

      return result;
    } catch (e: any) {
      return { result: false, loggedin: false, message: e.message };
    }
  }

  public async $save() {
    let tilmeld = enforceTilmeld(this);
    if (this.username == null || !this.username.trim().length) {
      throw new BadUsernameError('Username must not be empty.');
    }

    if (
      !this.$skipAcWhenSaving &&
      tilmeld.gatekeeper('tilmeld/admin') &&
      !tilmeld.gatekeeper('system/admin') &&
      this.abilities?.includes('system/admin')
    ) {
      throw new AccessControlError(
        "You don't have the authority to modify system admins.",
      );
    }

    // Lowercase the domain part.
    if (tilmeld.config.domainSupport) {
      const [username, domain] = splitn(this.username ?? '', '@', 2);
      if (domain) {
        this.username = `${username}@${domain.toLowerCase()}`;
      }
    }

    if (tilmeld.config.domainSupport) {
      const [_username, domain] = splitn(this.username ?? '', '@', 2);
      const [_originalUsername, originalDomain] = splitn(
        this.$originalUsername ?? '',
        '@',
        2,
      );

      if (
        this.guid != null &&
        ((originalDomain == null && domain != null) ||
          (domain == null && originalDomain != null))
      ) {
        throw new AccessControlError(
          "Users can't switch to or from having a domain once created.",
        );
      }

      if (
        !this.$skipAcWhenSaving &&
        !tilmeld.gatekeeper('tilmeld/admin') &&
        !tilmeld.gatekeeper('system/admin')
      ) {
        if (
          domain != null &&
          !this.$is(tilmeld.currentUser) &&
          !tilmeld.gatekeeper(`tilmeld/domain/${domain}/admin`)
        ) {
          throw new AccessControlError(
            "You don't have the authority to modify users on this domain.",
          );
        }
        if (
          originalDomain != null &&
          originalDomain !== domain &&
          (!tilmeld.gatekeeper(`tilmeld/domain/${domain}/admin`) ||
            !tilmeld.gatekeeper(`tilmeld/domain/${originalDomain}/admin`))
        ) {
          throw new AccessControlError(
            "You don't have the authority to modify users on this domain.",
          );
        }
      }
    }

    let sendVerification = false;

    // Formatting.
    this.username = this.username.trim();
    if (tilmeld.config.emailUsernames) {
      this.email = this.username;
    }
    this.nameFirst = (this.nameFirst ?? '').trim();
    this.nameMiddle = (this.nameMiddle ?? '').trim();
    this.nameLast = (this.nameLast ?? '').trim();
    this.phone = (this.phone ?? '').trim();
    this.name =
      this.nameFirst +
      (this.nameMiddle ? ' ' + this.nameMiddle : '') +
      (this.nameLast ? ' ' + this.nameLast : '');
    this.enabled = !!this.enabled;

    // Clear empty values.
    if (this.nameFirst === '' || !tilmeld.config.userFields.includes('name')) {
      delete this.nameFirst;
    }
    if (this.nameMiddle === '' || !tilmeld.config.userFields.includes('name')) {
      delete this.nameMiddle;
    }
    if (this.nameLast === '' || !tilmeld.config.userFields.includes('name')) {
      delete this.nameLast;
    }
    if (this.name === '' || !tilmeld.config.userFields.includes('name')) {
      delete this.name;
    }
    if (this.email === '' || !tilmeld.config.userFields.includes('email')) {
      delete this.email;
    }
    if (this.avatar === '') {
      delete this.avatar;
    }
    if (this.phone === '' || !tilmeld.config.userFields.includes('phone')) {
      delete this.phone;
    }
    if (this.secret === '' || !tilmeld.config.userFields.includes('email')) {
      delete this.secret;
    }
    if (
      this.emailChangeDate === 0 ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.emailChangeDate;
    }
    if (
      this.newEmailSecret === '' ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.newEmailSecret;
    }
    if (
      this.newEmailAddress === '' ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.newEmailAddress;
    }
    if (
      this.cancelEmailSecret === '' ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.cancelEmailSecret;
    }
    if (
      this.cancelEmailAddress === '' ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.cancelEmailAddress;
    }
    if (
      this.recoverSecret === '' ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.recoverSecret;
    }
    if (
      this.recoverSecretDate === 0 ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.recoverSecretDate;
    }
    if (this.password === '') {
      delete this.password;
    }
    if (this.passwordTemp === '') {
      delete this.passwordTemp;
    }
    if (this.inheritAbilities === false) {
      delete this.inheritAbilities;
    }

    // Verification.
    const unCheck = await this.$checkUsername();
    if (!unCheck.result) {
      throw new BadUsernameError(unCheck.message);
    }
    if (
      !tilmeld.config.emailUsernames &&
      tilmeld.config.userFields.includes('email')
    ) {
      const emCheck = await this.$checkEmail();
      if (!emCheck.result) {
        throw new BadEmailError(emCheck.message);
      }
    }

    // Email changes.
    if (
      !tilmeld.gatekeeper('tilmeld/admin') &&
      tilmeld.config.userFields.includes('email')
    ) {
      // The user isn't an admin, so email address changes should contain some
      // security measures.
      if (tilmeld.config.verifyEmail) {
        // The user needs to verify this new email address.
        if (this.guid == null) {
          // If this is the first user, they'll be made an admin, so they don't
          // need to verify.
          if (!this.abilities?.includes('system/admin')) {
            this.secret = nanoid();
            sendVerification = true;
          }
        } else if (
          this.$originalEmail != null &&
          this.$originalEmail !== this.email
        ) {
          // The user already has an old email address.
          if (
            tilmeld.config.emailRateLimit !== '' &&
            this.emailChangeDate != null &&
            this.emailChangeDate >=
              (strtotime('-' + tilmeld.config.emailRateLimit) || 0) * 1000
          ) {
            throw new EmailChangeRateLimitExceededError(
              'You already changed your email address recently. Please wait until ' +
                new Date(
                  (strtotime(
                    '+' + tilmeld.config.emailRateLimit,
                    Math.floor(this.emailChangeDate / 1000),
                  ) || 0) * 1000,
                ).toString() +
                ' to change your email address again.',
            );
          } else {
            if (
              this.newEmailSecret == null &&
              tilmeld.config.emailRateLimit !== '' &&
              // Make sure the user has at least the rate limit time to cancel
              // an email change.
              (this.emailChangeDate == null ||
                this.emailChangeDate <
                  (strtotime('-' + tilmeld.config.emailRateLimit) || 0) * 1000)
            ) {
              // Save the old email in case the cancel change link is clicked.
              this.cancelEmailAddress = this.$originalEmail;
              this.cancelEmailSecret = nanoid();
              this.emailChangeDate = Date.now();
            }
            // Save the new address and reset to the old one (until they verify
            // it).
            this.newEmailAddress = this.email;
            this.email = this.$originalEmail;
            if (tilmeld.config.emailUsernames) {
              this.username = this.email;
            }
            this.newEmailSecret = nanoid();
            sendVerification = true;
          }
        }
      } else if (
        this.guid != null &&
        this.$originalEmail != null &&
        this.$originalEmail !== this.email &&
        // Make sure the user has at least the rate limit time to cancel an
        // email change.
        (this.emailChangeDate == null ||
          this.emailChangeDate <
            (strtotime('-' + tilmeld.config.emailRateLimit) || 0) * 1000)
      ) {
        // The user doesn't need to verify their new email address, but should
        // be able to cancel the email change from their old address.
        this.cancelEmailAddress = this.$originalEmail;
        this.cancelEmailSecret = nanoid();
        sendVerification = true;
      }
    }

    if (this.passwordTemp != null) {
      this.$password(this.passwordTemp);
    }
    delete this.passwordTemp;

    if (this.password == null) {
      throw new BadDataError('A password is required.');
    }

    let preGuid = this.guid;
    let preCdate = this.cdate;
    let preMdate = this.mdate;
    return await transaction(
      this.$nymph,
      'tilmeld-save-user-' + (this.guid || nanoid()),
      async (nymph) => {
        this.$setNymph(nymph);
        const tilmeld = enforceTilmeld(this);
        const Group = this.$nymph.getEntityClass(GroupClass);

        let group = this.group;
        if (group != null) {
          // Make sure to get fresh group data.
          if (group.$asleep()) {
            await group.$wake();
          } else {
            if (!(await group.$refresh())) {
              throw new Error("Couldn't retrieve primary group info.");
            }
          }
        }
        if (group == null && this.guid == null) {
          if (tilmeld.config.generatePrimary) {
            // Generate a new primary group for the user.
            group = await Group.factory();
            group.user = this;
            const parent = await this.$nymph.getEntity(
              { class: Group },
              { type: '&', equal: ['defaultPrimary', true] },
            );
            if (parent != null) {
              group.parent = parent;
            }
          } else {
            // Add the default primary.
            const group = await this.$nymph.getEntity(
              { class: Group },
              { type: '&', equal: ['defaultPrimary', true] },
            );
            if (group != null) {
              this.group = group;
            }
          }
        }
        if (group != null && group.user != null && this.$is(group.user)) {
          // Update the user's generated primary group.
          let changed = false;
          if (group.groupname !== this.username) {
            group.groupname = this.username;
            changed = true;
          }
          if (group.avatar !== this.avatar) {
            group.avatar = this.avatar;
            changed = true;
          }
          if (
            tilmeld.config.userFields.includes('email') &&
            group.email !== this.email
          ) {
            group.email = this.email;
            changed = true;
          }
          if (
            tilmeld.config.userFields.includes('name') &&
            group.name !== this.name
          ) {
            group.name = this.name;
            changed = true;
          }
          if (
            tilmeld.config.userFields.includes('phone') &&
            group.phone !== this.phone
          ) {
            group.phone = this.phone;
            changed = true;
          }
          if (changed || group.guid == null) {
            await group.$saveSkipAC();
          }
          this.group = group;
        }

        if (this.groups == null || this.groups.length === 0) {
          // Add secondary groups.
          if (
            tilmeld.config.userFields.includes('email') &&
            tilmeld.config.verifyEmail &&
            tilmeld.config.unverifiedAccess &&
            this.secret != null
          ) {
            // Add the default secondaries for unverified users.
            this.groups = await this.$nymph.getEntities(
              { class: Group },
              { type: '&', equal: ['unverifiedSecondary', true] },
            );
          } else {
            // Add the default secondaries.
            this.groups = await this.$nymph.getEntities(
              { class: Group },
              { type: '&', equal: ['defaultSecondary', true] },
            );
          }
        }

        try {
          tilmeld.config.validatorUser(tilmeld, this);
        } catch (e: any) {
          throw new BadDataError(e?.message);
        }

        for (let callback of (this.constructor as typeof User)
          .beforeSaveCallbacks) {
          if (callback) {
            await callback(this);
          }
        }

        await super.$save();

        if (sendVerification) {
          // The email has changed, so send a new verification email.
          if (!(await this.$sendEmailVerification())) {
            throw new Error("Couldn't send verification email.");
          }
        }

        this.$descendantGroups = undefined;
        this.$gatekeeperCache = undefined;

        for (let callback of (this.constructor as typeof User)
          .afterSaveCallbacks) {
          if (callback) {
            await callback(this);
          }
        }
      },
      async (nymph, committed) => {
        this.$setNymph(nymph);

        if (committed) {
          this.$originalEmail = this.email;
          this.$originalUsername = this.username;

          try {
            const tilmeld = enforceTilmeld(nymph);

            if (tilmeld.User.current(true).$is(this)) {
              // Update the user in the session cache.
              await tilmeld.fillSession(this);
            }
          } catch (e: any) {
            // Ignore.
          }
        } else {
          this.guid = preGuid;
          this.cdate = preCdate;
          this.mdate = preMdate;
        }
      },
    );
  }

  /**
   * This should *never* be accessible on the client.
   */
  public async $saveSkipAC() {
    this.$skipAcWhenSaving = true;
    await this.$save();
  }

  public $tilmeldSaveSkipAC() {
    if (this.$skipAcWhenSaving) {
      this.$skipAcWhenSaving = false;
      return true;
    }
    return false;
  }

  @transactional
  public async $delete() {
    const tilmeld = enforceTilmeld(this);
    if (!this.$skipAcWhenDeleting && !tilmeld.gatekeeper('tilmeld/admin')) {
      throw new AccessControlError(
        "You don't have the authority to delete users.",
      );
    }
    if (
      !this.$skipAcWhenDeleting &&
      !tilmeld.gatekeeper('system/admin') &&
      this.abilities?.includes('system/admin')
    ) {
      throw new AccessControlError(
        "You don't have the authority to delete system admins.",
      );
    }
    if (this.username !== this.$originalUsername) {
      throw new AccessControlError(
        "You can't delete a user while switching their username.",
      );
    }

    if (!(await this.$refresh())) {
      throw new BadDataError('User could not be refreshed.');
    }

    if (this.group != null) {
      if (this.group.$asleep()) {
        await this.group.$wake();
      } else {
        if (!(await this.group.$refresh())) {
          throw new BadDataError('Group could not be refreshed.');
        }
      }
    }

    for (let callback of (this.constructor as typeof User)
      .beforeDeleteCallbacks) {
      if (callback) {
        await callback(this);
      }
    }

    if (tilmeld.User.current(true).$is(this)) {
      await this.$logout();
    }

    if (this.group != null && this.$is(this.group.user)) {
      // Read the skip ac value here, because super.$delete changes it.
      const $skipAcWhenDeleting = this.$skipAcWhenDeleting;

      // Delete the user.
      await super.$delete();
      // Delete the generated group.
      if ($skipAcWhenDeleting) {
        await this.group.$deleteSkipAC();
      } else {
        await this.group.$delete();
      }
    } else {
      await super.$delete();
    }

    for (let callback of (this.constructor as typeof User)
      .afterDeleteCallbacks) {
      if (callback) {
        await callback(this);
      }
    }
  }

  /*
   * This should *never* be accessible on the client.
   */
  async $deleteSkipAC() {
    this.$skipAcWhenDeleting = true;
    await this.$delete();
  }

  $tilmeldDeleteSkipAC() {
    if (this.$skipAcWhenDeleting) {
      this.$skipAcWhenDeleting = false;
      return true;
    }
    return false;
  }

  public static on<T extends EventType>(
    event: T,
    callback: T extends 'checkUsername'
      ? TilmeldCheckUsernameCallback
      : T extends 'beforeRegister'
        ? TilmeldBeforeRegisterCallback
        : T extends 'afterRegister'
          ? TilmeldAfterRegisterCallback
          : T extends 'beforeSave'
            ? TilmeldBeforeSaveCallback
            : T extends 'afterSave'
              ? TilmeldAfterSaveCallback
              : T extends 'beforeLogin'
                ? TilmeldBeforeLoginCallback
                : T extends 'afterLogin'
                  ? TilmeldAfterLoginCallback
                  : T extends 'beforeLogout'
                    ? TilmeldBeforeLogoutCallback
                    : T extends 'afterLogout'
                      ? TilmeldAfterLogoutCallback
                      : T extends 'beforeDelete'
                        ? TilmeldBeforeDeleteCallback
                        : T extends 'afterDelete'
                          ? TilmeldAfterDeleteCallback
                          : never,
  ) {
    const prop = (event + 'Callbacks') as T extends 'checkUsername'
      ? 'checkUsernameCallbacks'
      : T extends 'beforeRegister'
        ? 'beforeRegisterCallbacks'
        : T extends 'afterRegister'
          ? 'afterRegisterCallbacks'
          : T extends 'beforeSave'
            ? 'beforeSaveCallbacks'
            : T extends 'afterSave'
              ? 'afterSaveCallbacks'
              : T extends 'beforeLogin'
                ? 'beforeLoginCallbacks'
                : T extends 'afterLogin'
                  ? 'afterLoginCallbacks'
                  : T extends 'beforeLogout'
                    ? 'beforeLogoutCallbacks'
                    : T extends 'afterLogout'
                      ? 'afterLogoutCallbacks'
                      : T extends 'beforeDelete'
                        ? 'beforeDeleteCallbacks'
                        : T extends 'afterDelete'
                          ? 'afterDeleteCallbacks'
                          : never;
    if (!(prop in this)) {
      throw new Error('Invalid event type.');
    }
    // @ts-ignore: The callback should always be the right type here.
    this[prop].push(callback);
    return () => this.off(event, callback);
  }

  public static off<T extends EventType>(
    event: T,
    callback: T extends 'checkUsername'
      ? TilmeldCheckUsernameCallback
      : T extends 'beforeRegister'
        ? TilmeldBeforeRegisterCallback
        : T extends 'afterRegister'
          ? TilmeldAfterRegisterCallback
          : T extends 'beforeSave'
            ? TilmeldBeforeSaveCallback
            : T extends 'afterSave'
              ? TilmeldAfterSaveCallback
              : T extends 'beforeLogin'
                ? TilmeldBeforeLoginCallback
                : T extends 'afterLogin'
                  ? TilmeldAfterLoginCallback
                  : T extends 'beforeLogout'
                    ? TilmeldBeforeLogoutCallback
                    : T extends 'afterLogout'
                      ? TilmeldAfterLogoutCallback
                      : T extends 'beforeDelete'
                        ? TilmeldBeforeDeleteCallback
                        : T extends 'afterDelete'
                          ? TilmeldAfterDeleteCallback
                          : never,
  ) {
    const prop = (event + 'Callbacks') as T extends 'checkUsername'
      ? 'checkUsernameCallbacks'
      : T extends 'beforeRegister'
        ? 'beforeRegisterCallbacks'
        : T extends 'afterRegister'
          ? 'afterRegisterCallbacks'
          : T extends 'beforeSave'
            ? 'beforeSaveCallbacks'
            : T extends 'afterSave'
              ? 'afterSaveCallbacks'
              : T extends 'beforeLogin'
                ? 'beforeLoginCallbacks'
                : T extends 'afterLogin'
                  ? 'afterLoginCallbacks'
                  : T extends 'beforeLogout'
                    ? 'beforeLogoutCallbacks'
                    : T extends 'afterLogout'
                      ? 'afterLogoutCallbacks'
                      : T extends 'beforeDelete'
                        ? 'beforeDeleteCallbacks'
                        : T extends 'afterDelete'
                          ? 'afterDeleteCallbacks'
                          : never;
    if (!(prop in this)) {
      return false;
    }
    // @ts-ignore: The callback should always be the right type here.
    const i = this[prop].indexOf(callback);
    if (i > -1) {
      // @ts-ignore: The callback should always be the right type here.
      this[prop].splice(i, 1);
    }
    return true;
  }
}
