import crypto from 'node:crypto';
import type {
  Nymph,
  EntityData,
  EntityJson,
  EntityPatch,
  Selector,
  SerializedEntityData,
} from '@nymphjs/nymph';
import { humanSecret, nanoid } from '@nymphjs/guid';
import type { EmailOptions } from 'email-templates';
import strtotime from 'locutus/php/datetime/strtotime.js';
import { difference } from 'lodash-es';
import { TOTP, Secret } from 'otpauth';
import { toDataURL } from 'qrcode';

import { enforceTilmeld } from './enforceTilmeld.js';
import AbleObject from './AbleObject.js';
import type Group from './Group.js';
import type { GroupData } from './Group.js';
import {
  BadDataError,
  BadEmailError,
  BadUsernameError,
  EmailChangeRateLimitExceededError,
} from './errors/index.js';

export type EventType =
  | 'checkUsername'
  | 'beforeRegister'
  | 'afterRegister'
  | 'beforeLogin'
  | 'afterLogin'
  | 'beforeLogout'
  | 'afterLogout';
/**
 * This is run when the user has entered an otherwise valid username into the
 * signup form. It should return a result, which when false will stop the
 * process and return the included message, disallowing the username.
 */
export type TilmeldCheckUsernameCallback = (
  user: User & UserData,
  data: { username: string },
) => Promise<{ result: boolean; message?: string }>;
/**
 * Theses are run before the user data checks, so the only checks before are
 * whether registration is allowed and whether the user is already registered.
 */
export type TilmeldBeforeRegisterCallback = (
  user: User & UserData,
  data: { password: string; additionalData?: { [k: string]: any } },
) => Promise<void>;
export type TilmeldAfterRegisterCallback = (
  user: User & UserData,
  result: { loggedin: boolean; message: string },
) => Promise<void>;
/**
 * These are run after the authentication checks, but before the login action.
 */
export type TilmeldBeforeLoginCallback = (
  user: User & UserData,
  data: {
    username: string;
    password: string;
    additionalData?: { [k: string]: any };
  },
) => Promise<void>;
/**
 * This is run before the transaction is committed, and you can perform
 * additional functions on the transaction, which is available in `user.$nymph`.
 */
export type TilmeldAfterLoginCallback = (
  user: User & UserData,
) => Promise<void>;
export type TilmeldBeforeLogoutCallback = (
  user: User & UserData,
) => Promise<void>;
export type TilmeldAfterLogoutCallback = (
  user: User & UserData,
) => Promise<void>;

export type UserData = {
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
  group?: Group & GroupData;
  /**
   * The user's secondary groups.
   */
  groups?: (Group & GroupData)[];
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
};

/**
 * A user data model.
 *
 * Written by Hunter Perrin for SciActive.
 *
 * @author Hunter Perrin <hperrin@gmail.com>
 * @copyright SciActive Inc
 * @see http://nymph.io/
 */
export default class User extends AbleObject<UserData> {
  /**
   * The instance of Tilmeld to use for queries.
   */
  static ETYPE = 'tilmeld_user';
  static class = 'User';
  private static checkUsernameCallbacks: TilmeldCheckUsernameCallback[] = [];
  private static beforeRegisterCallbacks: TilmeldBeforeRegisterCallback[] = [];
  private static afterRegisterCallbacks: TilmeldAfterRegisterCallback[] = [];
  private static beforeLoginCallbacks: TilmeldBeforeLoginCallback[] = [];
  private static afterLoginCallbacks: TilmeldAfterLoginCallback[] = [];
  private static beforeLogoutCallbacks: TilmeldBeforeLogoutCallback[] = [];
  private static afterLogoutCallbacks: TilmeldAfterLogoutCallback[] = [];

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
  private $descendantGroups?: (Group & GroupData)[];
  /**
   * Used to save the current email address to send verification if it changes
   * from the frontend.
   *
   * If you are changing a user's email address and want to bypass email
   * verification, don't set this.
   */
  public $originalEmail?: string;

  static async factoryUsername(username?: string): Promise<User & UserData> {
    const entity = new this();
    if (username != null) {
      const entity = await this.nymph.getEntity(
        {
          class: this,
        },
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

  public static current(returnObjectIfNotExist: true): User & UserData;
  public static current(
    returnObjectIfNotExist?: false,
  ): (User & UserData) | null;
  public static current(
    returnObjectIfNotExist?: boolean,
  ): (User & UserData) | null {
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
      return {
        result: false,
        message: 'Account recovery is not allowed.',
      };
    }

    let user: User & UserData;
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
        to: {
          name: user.name ?? '',
          address: user.email ?? '',
        },
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
      if (!(await getUser.$saveSkipAC())) {
        return { result: false, message: "Couldn't save recovery secret." };
      }

      // Send the recovery email.
      user = getUser;
      options.template = 'RecoverPassword';
      options.message = {
        to: {
          name: user.name ?? '',
          address: user.email ?? '',
        },
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
      return {
        result: false,
        message: 'Account recovery is not allowed.',
      };
    }

    const user = await tilmeld.User.factoryUsername(data.username);

    if (
      user.guid == null ||
      user.recoverSecret == null ||
      data.secret !== user.recoverSecret ||
      strtotime(
        '+' + tilmeld.config.pwRecoveryTimeLimit,
        Math.floor((user.recoverSecretDate ?? 0) / 1000),
      ) *
        1000 <
        Date.now()
    ) {
      return {
        result: false,
        message: 'The secret code does not match.',
      };
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
    if (await user.$saveSkipAC()) {
      return {
        result: true,
        message:
          'Your password has been reset. You can now log in using your new password.',
      };
    } else {
      return { result: false, message: 'Error saving new password.' };
    }
  }

  public static getClientConfig() {
    const tilmeld = enforceTilmeld(this);
    return {
      regFields: tilmeld.config.regFields,
      userFields: tilmeld.config.userFields,
      emailUsernames: tilmeld.config.emailUsernames,
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
    const result: { result: boolean; message: string; user?: User & UserData } =
      await user.$login(data);
    if (result.result) {
      user.$updateDataProtection();
      result.user = user;
    }
    return result;
  }

  constructor() {
    super();

    // Defaults.
    this.$data.enabled = true;
    this.$data.abilities = [];
    this.$data.groups = [];
    this.$data.inheritAbilities = true;
    this.$updateDataProtection();
  }

  $setNymph(nymph: Nymph) {
    this.$nymph = nymph;
    if (!this.$asleep()) {
      if (this.$data.group && this.$data.group.$nymph !== nymph) {
        this.$data.group.$setNymph(nymph);
      }
      for (const group of this.$data.groups ?? []) {
        if (group && group.$nymph !== nymph) {
          group.$setNymph(nymph);
        }
      }
    }
  }

  async $getUniques(): Promise<string[]> {
    const tilmeld = enforceTilmeld(this);
    const uniques = [`u:${this.$data.username}`];
    if (
      !tilmeld.config.emailUsernames &&
      tilmeld.config.userFields.includes('email')
    ) {
      uniques.push(`e:${this.$data.email}`);

      if (this.$data.newEmailAddress != null) {
        uniques.push(`e:${this.$data.newEmailAddress}`);
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
      return { result: false, message: 'Incorrect login/password.' };
    }
    if (!this.$data.enabled) {
      return { result: false, message: 'This user is disabled.' };
    }
    if (await this.$gatekeeper()) {
      return { result: true, message: 'You are already logged in.' };
    }
    if (!this.$checkPassword(data.password)) {
      return { result: false, message: 'Incorrect login/password.' };
    }

    if (this.$data.totpSecret != null) {
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
      return {
        result: false,
        message: e.message,
      };
    }

    this.$nymph.config.debugLog(
      'tilmeld',
      `User login for "${this.$data.username}".`,
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

  public async $switchUser(data?: { additionalData?: { [k: string]: any } }) {
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

    const toAbilities = this.$data.abilities || [];
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
            username: this.$data.username || '',
            password: '',
            ...(data || {}),
          });
        }
      }
    } catch (e: any) {
      return {
        result: false,
        message: e.message,
      };
    }

    this.$nymph.config.debugLog(
      'tilmeld',
      `User login switch for "${user.username}" to "${this.$data.username}".`,
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
  public async $logout() {
    const tilmeld = enforceTilmeld(this);

    try {
      for (let callback of (this.constructor as typeof User)
        .beforeLogoutCallbacks) {
        if (callback) {
          await callback(this);
        }
      }
    } catch (e: any) {
      return {
        result: false,
        message: e.message,
      };
    }

    this.$nymph.config.debugLog(
      'tilmeld',
      `User logout for "${this.$data.username}".`,
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

  public $getAvatar() {
    if (this.$data.avatar != null && this.$data.avatar !== '') {
      return this.$data.avatar;
    }
    if (this.$data.email == null || this.$data.email === '') {
      return 'https://secure.gravatar.com/avatar/?d=mm&s=40';
    }
    return (
      'https://secure.gravatar.com/avatar/' +
      crypto
        .createHash('sha256')
        .update(this.$data.email.trim().toLowerCase())
        .digest('hex')
        .toLowerCase() +
      '?d=identicon&s=40'
    );
  }

  public $getGid() {
    if (this.$data.group) {
      return this.$data.group.guid;
    }
    return null;
  }

  public $getGids() {
    if (this.$data.groups) {
      return this.$data.groups
        .map((group) => group.guid)
        .filter((guid) => guid != null) as string[];
    }
    return null;
  }

  /**
   * Get the user's group descendants.
   */
  public async $getDescendantGroups(): Promise<(Group & GroupData)[]> {
    if (this.$descendantGroups == null) {
      this.$descendantGroups = [];
      if (this.$data.group != null) {
        await this.$data.group.$wake();
        this.$descendantGroups = await this.$data.group.$getDescendants();
      }
      await Promise.all(this.$data.groups?.map((e) => e.$wake()) || []);
      for (let curGroup of this.$data.groups ?? []) {
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

    if (
      'abilities' in input.data &&
      input.data.abilities?.includes('system/admin') !==
        this.$data.abilities?.includes('system/admin') &&
      (!tilmeld.currentUser ||
        !tilmeld.currentUser.abilities?.includes('system/admin'))
    ) {
      throw new BadDataError(
        "You don't have the authority to grant or revoke system/admin.",
      );
    }

    if (
      'abilities' in input.data &&
      input.data.abilities?.includes('tilmeld/admin') !==
        this.$data.abilities?.includes('tilmeld/admin') &&
      (!tilmeld.currentUser ||
        !tilmeld.currentUser.abilities?.includes('system/admin'))
    ) {
      throw new BadDataError(
        "You don't have the authority to grant or revoke tilmeld/admin.",
      );
    }

    if (
      'abilities' in input.data &&
      input.data.abilities?.includes('tilmeld/switch') !==
        this.$data.abilities?.includes('tilmeld/switch') &&
      (!tilmeld.currentUser ||
        !tilmeld.currentUser.abilities?.includes('system/admin'))
    ) {
      throw new BadDataError(
        "You don't have the authority to grant or revoke tilmeld/switch.",
      );
    }

    this.$originalEmail = this.$data.email;
    super.$jsonAcceptData(input, allowConflict);
  }

  public $jsonAcceptPatch(patch: EntityPatch, allowConflict = false) {
    const tilmeld = enforceTilmeld(this);
    this.$check();

    if (
      'abilities' in patch.set &&
      patch.set.abilities?.includes('system/admin') !==
        this.$data.abilities?.includes('system/admin') &&
      (!tilmeld.currentUser ||
        !tilmeld.currentUser.abilities?.includes('system/admin'))
    ) {
      throw new BadDataError(
        "You don't have the authority to grant or revoke system/admin.",
      );
    }

    if (
      'abilities' in patch.set &&
      patch.set.abilities?.includes('tilmeld/admin') !==
        this.$data.abilities?.includes('tilmeld/admin') &&
      (!tilmeld.currentUser ||
        !tilmeld.currentUser.abilities?.includes('system/admin'))
    ) {
      throw new BadDataError(
        "You don't have the authority to grant or revoke tilmeld/admin.",
      );
    }

    if (
      'abilities' in patch.set &&
      patch.set.abilities?.includes('tilmeld/switch') !==
        this.$data.abilities?.includes('tilmeld/switch') &&
      (!tilmeld.currentUser ||
        !tilmeld.currentUser.abilities?.includes('system/admin'))
    ) {
      throw new BadDataError(
        "You don't have the authority to grant or revoke tilmeld/switch.",
      );
    }

    this.$originalEmail = this.$data.email;
    super.$jsonAcceptPatch(patch, allowConflict);
  }

  public $putData(data: EntityData, sdata?: SerializedEntityData) {
    super.$putData(data, sdata);
    this.$updateDataProtection();
  }

  /**
   * Update the data protection arrays for a user.
   *
   * @param givenUser User to update protection for. If undefined, will use the currently logged in user.
   */
  public $updateDataProtection(givenUser?: User & UserData) {
    const tilmeld = enforceTilmeld(this);
    let user = givenUser ?? tilmeld.User.current();

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
      (isCurrentUser || user == null
        ? this.$data.abilities
        : user?.abilities) ?? [];
    const isNewUser = this.guid == null;

    if (isCurrentUser) {
      // Users can check to see what abilities they have.
      this.$clientEnabledMethods.push('$gatekeeper');
      this.$clientEnabledMethods.push('$changePassword');
      this.$clientEnabledMethods.push('$revokeCurrentTokens');
      this.$clientEnabledMethods.push('$logout');
      this.$clientEnabledMethods.push('$sendEmailVerification');
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
        // The things that are commented are there to show what is _not_ private.
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
    if (this.$data.group != null && !this.$data.group.$asleep()) {
      this.$data.group.$updateDataProtection();
    }
    for (let group of this.$data.groups ?? []) {
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
      !!this.$data.abilities?.includes('system/admin')
    );
  }

  /**
   * Build a gatekeeper cache object.
   */
  public async $getGatekeeperCache() {
    await this.$wake();
    let abilities = this.$data.abilities ?? [];
    if (this.$data.inheritAbilities) {
      await Promise.all(this.$data.groups?.map((e) => e.$wake()) || []);
      for (let curGroup of this.$data.groups ?? []) {
        if (curGroup.enabled) {
          abilities = abilities.concat(curGroup.abilities ?? []);
        }
      }
      await this.$data.group?.$wake();
      const group = this.$data.group;
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
  public async $sendEmailVerification() {
    const tilmeld = enforceTilmeld(this);
    if (this.guid == null) {
      return false;
    }
    let success = true;

    const verifyUrl = `${tilmeld.config.appUrl.replace(/\/$/, () => '')}${
      tilmeld.config.setupPath
    }/verify`;

    if (this.$data.secret != null) {
      const link = `${verifyUrl}?action=verify&id=${encodeURIComponent(
        this.guid,
      )}&secret=${encodeURIComponent(this.$data.secret)}`;
      success =
        success &&
        (await tilmeld.config.sendEmail(
          tilmeld,
          {
            template: 'VerifyEmail',
            message: {
              to: {
                name: this.$data.name ?? '',
                address: this.$data.email ?? '',
              },
            },
            locals: {
              verifyLink: link,
            },
          },
          this,
        ));
    }

    if (this.$data.newEmailSecret != null) {
      const link = `${verifyUrl}?action=verifychange&id=${encodeURIComponent(
        this.guid,
      )}&secret=${encodeURIComponent(this.$data.newEmailSecret)}`;
      success =
        success &&
        (await tilmeld.config.sendEmail(
          tilmeld,
          {
            template: 'VerifyEmailChange',
            message: {
              to: {
                name: this.$data.name ?? '',
                address: this.$data.newEmailAddress ?? '',
              },
            },
            locals: {
              verifyLink: link,
              oldEmail: this.$data.cancelEmailAddress,
              newEmail: this.$data.newEmailAddress,
            },
          },
          this,
        ));
    }

    if (this.$data.cancelEmailSecret != null) {
      const link = `${verifyUrl}?action=cancelchange&id=${encodeURIComponent(
        this.guid,
      )}&secret=${encodeURIComponent(this.$data.cancelEmailSecret)}`;
      success =
        success &&
        (await tilmeld.config.sendEmail(
          tilmeld,
          {
            template: 'CancelEmailChange',
            message: {
              to: {
                name: this.$data.name ?? '',
                address: this.$data.cancelEmailAddress ?? '',
              },
            },
            locals: {
              cancelLink: link,
              oldEmail: this.$data.cancelEmailAddress,
              newEmail: this.$data.newEmailAddress ?? this.$data.email,
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
  public async $addGroup(group: Group & GroupData) {
    await Promise.all(this.$data.groups?.map((e) => e.$wake()) || []);
    let groups = this.$data.groups;
    if (groups == null) {
      groups = [];
    }
    if (!group.$inArray(groups)) {
      groups.push(group);
      this.$data.groups = groups;
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
        return this.$data.password === password;
      case 'digest':
        return (
          this.$data.password ===
          crypto.createHash('sha256').update(password).digest('base64')
        );
      case 'salt':
      default:
        return (
          this.$data.password ===
          crypto
            .createHash('sha256')
            .update(password + this.$data.salt)
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
  public async $delGroup(group: Group & GroupData) {
    await Promise.all(this.$data.groups?.map((e) => e.$wake()) || []);
    let groups = this.$data.groups || [];
    if (this.$data.groups != null && group.$inArray(groups)) {
      const newGroups: (Group & GroupData)[] = [];
      for (let curGroup of groups) {
        if (!group.$is(curGroup)) {
          newGroups.push(curGroup);
        }
      }
      this.$data.groups = newGroups;
      return this.$data.groups;
    }
    return true;
  }

  /**
   * Check whether the user is in a (primary or secondary) group.
   *
   * @param group The group, or the group's GUID.
   * @returns True or false.
   */
  public async $inGroup(group: (Group & GroupData) | string) {
    if (typeof group === 'string') {
      if (this.$data.group?.guid === group) {
        return true;
      }
      for (let curGroup of this.$data.groups ?? []) {
        if (curGroup.guid === group) {
          return true;
        }
      }
      return false;
    }
    return (
      group.$is(this.$data.group) || group.$inArray(this.$data.groups ?? [])
    );
  }

  /**
   * Check whether the user is a descendant of a group.
   *
   * @param group The group, or the group's GUID.
   * @returns True or false.
   */
  public async $isDescendant(group: (Group & GroupData) | string) {
    // Check to see if the user is in a descendant group of the given group.
    await this.$data.group?.$wake();
    if (
      this.$data.group != null &&
      this.$data.group?.cdate != null &&
      (await this.$data.group?.$isDescendant(group))
    ) {
      return true;
    }
    await Promise.all(this.$data.groups?.map((e) => e.$wake()) || []);
    for (let curGroup of this.$data.groups ?? []) {
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
      `Password change request for "${this.$data.username}".`,
    );
    if (!('newPassword' in data) || !data.newPassword.length) {
      return { result: false, message: 'Please specify a password.' };
    }
    if (!this.$checkPassword(data.currentPassword ?? '')) {
      this.$nymph.config.debugLog(
        'tilmeld',
        `Incorrect password for change request for "${this.$data.username}".`,
      );
      return { result: false, message: 'Incorrect password.' };
    }
    this.$data.passwordTemp = data.newPassword;
    if (data.revokeCurrentTokens) {
      this.$data.revokeTokenDate = Date.now();
    }
    if (await this.$save()) {
      if (data.revokeCurrentTokens) {
        const tilmeld = enforceTilmeld(this);
        await tilmeld.login(this, true);
      }
      return { result: true, message: 'Your password has been changed.' };
    } else {
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
        delete this.$data.salt;
        this.$data.password = password;
        break;
      case 'digest':
        delete this.$data.salt;
        this.$data.password = crypto
          .createHash('sha256')
          .update(password)
          .digest('base64');
        break;
      case 'salt':
      default:
        this.$data.salt = nanoid();
        this.$data.password = crypto
          .createHash('sha256')
          .update(password + this.$data.salt)
          .digest('base64');
        break;
    }
    return this.$data.password;
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

    this.$data.revokeTokenDate = Date.now();

    if (await this.$save()) {
      const tilmeld = enforceTilmeld(this);
      await tilmeld.login(this, true);
      return {
        result: true,
        message: 'You have logged out of all other sessions.',
      };
    } else {
      return { result: false, message: "Couldn't save revocation date." };
    }
  }

  public async $hasTOTPSecret() {
    return this.$data.totpSecret != null;
  }

  /**
   * Check the given code against the user's TOTP secret.
   *
   * @param code The code in question.
   * @returns True if the code is valid, otherwise false.
   */
  public $checkTOTPCode(code: string) {
    if (this.$data.totpSecret == null) {
      return false;
    }

    const tilmeld = enforceTilmeld(this);

    const totp = new TOTP({
      issuer: tilmeld.config.appName,
      label: this.$data.username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: this.$data.totpSecret,
    });

    return totp.validate({ token: code, window: 2 }) != null;
  }

  /**
   * A frontend accessible method to generate a new TOTP secret.
   *
   * @returns An object with 'uri', 'qrcode', and 'secret'.
   */
  public async $getNewTOTPSecret() {
    const tilmeld = enforceTilmeld(this);

    if (this.$data.totpSecret != null) {
      throw new BadDataError('You already have a 2FA secret.');
    }

    const secret = new Secret();

    const totp = new TOTP({
      issuer: tilmeld.config.appName,
      label: this.$data.username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const uri = totp.toString();

    const qrcode = await toDataURL(uri);

    return {
      uri,
      qrcode,
      secret: secret.base32,
    };
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

    if (this.$data.totpSecret != null) {
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
      label: this.$data.username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: data.secret,
    });

    if (totp.validate({ token: data.code, window: 2 }) == null) {
      return { result: false, message: '2FA code is incorrect.' };
    }

    this.$data.totpSecret = data.secret;

    if (await this.$save()) {
      return { result: true, message: 'Your two factor secret is now set.' };
    } else {
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

      if (this.$data.totpSecret == null) {
        return { result: false, message: "You don't have a 2FA secret." };
      }

      const totp = new TOTP({
        issuer: tilmeld.config.appName,
        label: this.$data.username,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: this.$data.totpSecret,
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

    delete this.$data.totpSecret;

    if (await this.$save()) {
      return {
        result: true,
        message: 'Two factor secret has been removed.',
      };
    } else {
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
      `Username check "${this.$data.username}".`,
    );

    if (!tilmeld.config.emailUsernames) {
      if (this.$data.username == null || !this.$data.username.length) {
        return { result: false, message: 'Please specify a username.' };
      }
      if (this.$data.username.length < tilmeld.config.minUsernameLength) {
        return {
          result: false,
          message:
            'Usernames must be at least ' +
            tilmeld.config.minUsernameLength +
            ' characters.',
        };
      }
      if (this.$data.username.length > tilmeld.config.maxUsernameLength) {
        return {
          result: false,
          message:
            'Usernames must not exceed ' +
            tilmeld.config.maxUsernameLength +
            ' characters.',
        };
      }

      if (
        difference(
          this.$data.username.split(''),
          tilmeld.config.validChars.split(''),
        ).length
      ) {
        return {
          result: false,
          message: tilmeld.config.validCharsNotice,
        };
      }
      if (!tilmeld.config.validRegex.test(this.$data.username)) {
        return {
          result: false,
          message: tilmeld.config.validRegexNotice,
        };
      }

      const selector: Selector = {
        type: '&',
        ilike: [
          'username',
          this.$data.username.replace(/([\\%_])/g, (s) => `\\${s}`),
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
            username: this.$data.username,
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
      this.$data.email = this.$data.username;
      if (this.$data.username == null || !this.$data.username.length) {
        return { result: false, message: 'Please specify an email.' };
      }
      if (this.$data.username.length < tilmeld.config.minUsernameLength) {
        return {
          result: false,
          message:
            'Emails must be at least ' +
            tilmeld.config.minUsernameLength +
            ' characters.',
        };
      }
      if (this.$data.username.length > tilmeld.config.maxUsernameLength) {
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

    this.$nymph.config.debugInfo(
      'tilmeld',
      `Email check "${this.$data.email}".`,
    );

    if (this.$data.email == null || !this.$data.email.length) {
      if (tilmeld.config.verifyEmail) {
        return { result: false, message: 'Please specify an email.' };
      } else {
        return { result: true, message: '' };
      }
    }
    if (!tilmeld.config.validEmailRegex.test(this.$data.email)) {
      return {
        result: false,
        message: tilmeld.config.validEmailRegexNotice,
      };
    }
    const selector: Selector = {
      type: '&',
      ilike: ['email', this.$data.email.replace(/([\\%_])/g, (s) => `\\${s}`)],
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

    this.$nymph.config.debugInfo(
      'tilmeld',
      `Phone check "${this.$data.phone}".`,
    );

    if (this.$data.phone == null || !this.$data.phone.length) {
      return { result: false, message: 'Please specify a phone number.' };
    }

    const stripToDigits = this.$data.phone.replace(/\D/g, () => '');
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
      this.$data.name =
        this.$data.nameFirst +
        (this.$data.nameMiddle == null ? '' : ' ' + this.$data.nameMiddle) +
        (this.$data.nameLast == null ? '' : ' ' + this.$data.nameLast);
      if (this.$data.name === '') {
        this.$data.name = this.$data.username;
      }
    }
    if (tilmeld.config.emailUsernames) {
      this.$data.email = this.$data.username;
    }

    // Start transaction.
    const transaction = 'tilmeld-register-' + nanoid();
    const nymph = this.$nymph;
    const tnymph = await this.$nymph.startTransaction(transaction);
    this.$setNymph(tnymph);
    tilmeld = enforceTilmeld(this);

    let message = '';
    let loggedin = false;

    try {
      try {
        for (let callback of (this.constructor as typeof User)
          .beforeRegisterCallbacks) {
          if (callback) {
            await callback(this, data);
          }
        }
      } catch (e: any) {
        await tnymph.rollback(transaction);
        this.$setNymph(nymph);
        return {
          result: false,
          loggedin: false,
          message: e.message,
        };
      }

      if (
        tilmeld.config.userFields.includes('email') &&
        tilmeld.config.verifyEmail
      ) {
        // The user will be enabled after verifying their e-mail address.
        if (!tilmeld.config.unverifiedAccess) {
          this.$data.enabled = false;
        }
      } else {
        this.$data.enabled = true;
      }

      // If createAdmin is true and there are no other users, grant
      // "system/admin".
      let madeAdmin = false;
      if (tilmeld.config.createAdmin) {
        const otherUsers = await tnymph.getEntities({
          class: tilmeld.User,
          skipAc: true,
          limit: 1,
          return: 'guid',
        });
        // Make sure it's not just null, cause that means an error.
        if (!otherUsers.length) {
          this.$grant('system/admin');
          this.$data.enabled = true;
          madeAdmin = true;
        }
      }

      this.$nymph.config.debugLog(
        'tilmeld',
        `Registering new user "${this.$data.username}".`,
      );
      if (await this.$saveSkipAC()) {
        this.$nymph.config.debugLog(
          'tilmeld',
          `New user registered "${this.$data.username}".`,
        );
        // Send the new user registered email.
        if (tilmeld.config.userRegisteredRecipient != null) {
          await tilmeld.config.sendEmail(
            tilmeld,
            {
              template: 'UserRegistered',
              message: {
                to: tilmeld.config.userRegisteredRecipient,
              },
              locals: {
                userUsername: this.$data.username,
                userName: this.$data.name,
                userFirstName: this.$data.nameFirst,
                userLastName: this.$data.nameLast,
                userEmail: this.$data.email,
                userPhone: this.$data.phone,
              },
            },
            this,
          );
        }

        // Finish up.
        if (
          tilmeld.config.verifyEmail &&
          !tilmeld.config.unverifiedAccess &&
          !madeAdmin &&
          tilmeld.config.userFields.includes('email')
        ) {
          message +=
            `Almost there. An email has been sent to ${this.$data.email} ` +
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
            `${this.$data.email} with a verification link for you to finish ` +
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
            await callback(this, {
              loggedin,
              message,
            });
          }
        }
      } else {
        this.$nymph.config.debugError(
          'tilmeld',
          `Error registering new user "${this.$data.username}".`,
        );
        await tnymph.rollback(transaction);
        this.$setNymph(nymph);
        return {
          result: false,
          loggedin: false,
          message: 'Error registering user.',
        };
      }
    } catch (e: any) {
      this.$nymph.config.debugError(
        'tilmeld',
        `Error registering new user "${this.$data.username}": ${e}`,
      );
      await tnymph.rollback(transaction);
      this.$setNymph(nymph);
      throw e;
    }

    try {
      await tnymph.commit(transaction);
      this.$setNymph(nymph);
      await this.$nymph.tilmeld?.fillSession(this);
    } catch (e: any) {
      throw e;
    }

    return {
      result: true,
      loggedin,
      message,
    };
  }

  public async $save() {
    let tilmeld = enforceTilmeld(this);
    if (this.$data.username == null || !this.$data.username.trim().length) {
      return false;
    }

    if (
      !this.$skipAcWhenSaving &&
      tilmeld.gatekeeper('tilmeld/admin') &&
      !tilmeld.gatekeeper('system/admin') &&
      this.$data.abilities?.includes('system/admin')
    ) {
      throw new BadDataError(
        "You don't have the authority to modify system admins.",
      );
    }

    let sendVerification = false;

    // Formatting.
    this.$data.username = this.$data.username.trim();
    if (tilmeld.config.emailUsernames) {
      this.$data.email = this.$data.username;
    }
    this.$data.nameFirst = (this.$data.nameFirst ?? '').trim();
    this.$data.nameMiddle = (this.$data.nameMiddle ?? '').trim();
    this.$data.nameLast = (this.$data.nameLast ?? '').trim();
    this.$data.phone = (this.$data.phone ?? '').trim();
    this.$data.name =
      this.$data.nameFirst +
      (this.$data.nameMiddle ? ' ' + this.$data.nameMiddle : '') +
      (this.$data.nameLast ? ' ' + this.$data.nameLast : '');
    this.$data.enabled = !!this.$data.enabled;

    // Clear empty values.
    if (
      this.$data.nameFirst === '' ||
      !tilmeld.config.userFields.includes('name')
    ) {
      delete this.$data.nameFirst;
    }
    if (
      this.$data.nameMiddle === '' ||
      !tilmeld.config.userFields.includes('name')
    ) {
      delete this.$data.nameMiddle;
    }
    if (
      this.$data.nameLast === '' ||
      !tilmeld.config.userFields.includes('name')
    ) {
      delete this.$data.nameLast;
    }
    if (this.$data.name === '' || !tilmeld.config.userFields.includes('name')) {
      delete this.$data.name;
    }
    if (
      this.$data.email === '' ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.$data.email;
    }
    if (this.$data.avatar === '') {
      delete this.$data.avatar;
    }
    if (
      this.$data.phone === '' ||
      !tilmeld.config.userFields.includes('phone')
    ) {
      delete this.$data.phone;
    }
    if (
      this.$data.secret === '' ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.$data.secret;
    }
    if (
      this.$data.emailChangeDate === 0 ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.$data.emailChangeDate;
    }
    if (
      this.$data.newEmailSecret === '' ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.$data.newEmailSecret;
    }
    if (
      this.$data.newEmailAddress === '' ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.$data.newEmailAddress;
    }
    if (
      this.$data.cancelEmailSecret === '' ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.$data.cancelEmailSecret;
    }
    if (
      this.$data.cancelEmailAddress === '' ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.$data.cancelEmailAddress;
    }
    if (
      this.$data.recoverSecret === '' ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.$data.recoverSecret;
    }
    if (
      this.$data.recoverSecretDate === 0 ||
      !tilmeld.config.userFields.includes('email')
    ) {
      delete this.$data.recoverSecretDate;
    }
    if (this.$data.password === '') {
      delete this.$data.password;
    }
    if (this.$data.passwordTemp === '') {
      delete this.$data.passwordTemp;
    }
    if (this.$data.inheritAbilities === false) {
      delete this.$data.inheritAbilities;
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
          if (!this.$data.abilities?.includes('system/admin')) {
            this.$data.secret = nanoid();
            sendVerification = true;
          }
        } else if (
          this.$originalEmail != null &&
          this.$originalEmail !== this.$data.email
        ) {
          // The user already has an old email address.
          if (
            tilmeld.config.emailRateLimit !== '' &&
            this.$data.emailChangeDate != null &&
            this.$data.emailChangeDate >=
              strtotime('-' + tilmeld.config.emailRateLimit) * 1000
          ) {
            throw new EmailChangeRateLimitExceededError(
              'You already changed your email address recently. Please wait until ' +
                new Date(
                  strtotime(
                    '+' + tilmeld.config.emailRateLimit,
                    Math.floor(this.$data.emailChangeDate / 1000),
                  ) * 1000,
                ).toString() +
                ' to change your email address again.',
            );
          } else {
            if (
              this.$data.newEmailSecret == null &&
              tilmeld.config.emailRateLimit !== '' &&
              // Make sure the user has at least the rate limit time to cancel
              // an email change.
              (this.$data.emailChangeDate == null ||
                this.$data.emailChangeDate <
                  strtotime('-' + tilmeld.config.emailRateLimit) * 1000)
            ) {
              // Save the old email in case the cancel change link is clicked.
              this.$data.cancelEmailAddress = this.$originalEmail;
              this.$data.cancelEmailSecret = nanoid();
              this.$data.emailChangeDate = Date.now();
            }
            // Save the new address and reset to the old one (until they verify
            // it).
            this.$data.newEmailAddress = this.$data.email;
            this.$data.email = this.$originalEmail;
            if (tilmeld.config.emailUsernames) {
              this.$data.username = this.$data.email;
            }
            this.$data.newEmailSecret = nanoid();
            sendVerification = true;
          }
        }
      } else if (
        this.guid != null &&
        this.$originalEmail != null &&
        this.$originalEmail !== this.$data.email &&
        // Make sure the user has at least the rate limit time to cancel an
        // email change.
        (this.$data.emailChangeDate == null ||
          this.$data.emailChangeDate <
            strtotime('-' + tilmeld.config.emailRateLimit) * 1000)
      ) {
        // The user doesn't need to verify their new email address, but should
        // be able to cancel the email change from their old address.
        this.$data.cancelEmailAddress = this.$originalEmail;
        this.$data.cancelEmailSecret = nanoid();
        sendVerification = true;
      }
    }

    if (this.$data.passwordTemp != null) {
      this.$password(this.$data.passwordTemp);
    }
    delete this.$data.passwordTemp;

    if (this.$data.password == null) {
      throw new BadDataError('A password is required.');
    }

    // Start transaction.
    const transaction = 'tilmeld-save-' + nanoid();
    const nymph = this.$nymph;
    const tnymph = await this.$nymph.startTransaction(transaction);
    this.$setNymph(tnymph);
    tilmeld = enforceTilmeld(this);

    // If the primary group is generated now, the user assigned to it won't have
    // a guid yet, so it needs to be assigned after the user is saved.
    let saveGeneratedPrimaryGroupAgain = false;

    try {
      let group = this.$data.group;
      await group?.$wake();
      if (group == null && this.guid == null) {
        if (tilmeld.config.generatePrimary) {
          // Generate a new primary group for the user.
          group = await tilmeld.Group.factory();
          // This user doesn't have a guid yet, so that's why we set
          // saveGeneratedPrimaryGroupAgain.
          group.user = this;
          saveGeneratedPrimaryGroupAgain = true;
          const parent = await tnymph.getEntity(
            { class: tilmeld.Group },
            {
              type: '&',
              equal: ['defaultPrimary', true],
            },
          );
          if (parent != null) {
            group.parent = parent;
          }
        } else {
          // Add the default primary.
          const group = await tnymph.getEntity(
            { class: tilmeld.Group },
            {
              type: '&',
              equal: ['defaultPrimary', true],
            },
          );
          if (group != null) {
            this.$data.group = group;
          }
        }
      }
      if (group != null && group.user != null && this.$is(group.user)) {
        // Update the user's generated primary group.
        let changed = false;
        if (group.groupname !== this.$data.username) {
          group.groupname = this.$data.username;
          changed = true;
        }
        if (group.avatar !== this.$data.avatar) {
          group.avatar = this.$data.avatar;
          changed = true;
        }
        if (
          tilmeld.config.userFields.includes('email') &&
          group.email !== this.$data.email
        ) {
          group.email = this.$data.email;
          changed = true;
        }
        if (
          tilmeld.config.userFields.includes('name') &&
          group.name !== this.$data.name
        ) {
          group.name = this.$data.name;
          changed = true;
        }
        if (
          tilmeld.config.userFields.includes('phone') &&
          group.phone !== this.$data.phone
        ) {
          group.phone = this.$data.phone;
          changed = true;
        }
        if (changed) {
          if (!(await group.$saveSkipAC())) {
            throw Error('Error updating primary group for user.');
          }
        }
        this.$data.group = group;
      }

      if (this.$data.groups == null || this.$data.groups.length === 0) {
        // Add secondary groups.
        if (
          tilmeld.config.userFields.includes('email') &&
          tilmeld.config.verifyEmail &&
          tilmeld.config.unverifiedAccess &&
          this.$data.secret != null
        ) {
          // Add the default secondaries for unverified users.
          this.$data.groups = await tnymph.getEntities(
            { class: tilmeld.Group },
            {
              type: '&',
              equal: ['unverifiedSecondary', true],
            },
          );
        } else {
          // Add the default secondaries.
          this.$data.groups = await tnymph.getEntities(
            { class: tilmeld.Group },
            {
              type: '&',
              equal: ['defaultSecondary', true],
            },
          );
        }
      }

      try {
        tilmeld.config.validatorUser(tilmeld, this);
      } catch (e: any) {
        throw new BadDataError(e?.message);
      }
    } catch (e: any) {
      await tnymph.rollback(transaction);
      this.$setNymph(nymph);
      throw e;
    }

    let ret: boolean;
    let preGuid = this.guid;
    let preCdate = this.cdate;
    let preMdate = this.mdate;

    try {
      ret = await super.$save();

      if (ret && saveGeneratedPrimaryGroupAgain) {
        const group = this.$data.group;
        if (group == null) {
          throw Error('Generated primary group not found.');
        }
        await group.$wake();
        // Now this user has a GUID, so saving it on the group will succeed.
        group.user = this;
        if (!(await group.$saveSkipAC())) {
          throw Error("Generated primary group couldn't be saved.");
        }
        this.$data.group = group;
      }
    } catch (e: any) {
      await tnymph.rollback(transaction);
      this.$setNymph(nymph);
      throw e;
    }

    if (ret) {
      if (sendVerification) {
        // The email has changed, so send a new verification email.
        if (!(await this.$sendEmailVerification())) {
          await tnymph.rollback(transaction);
          this.guid = preGuid;
          this.cdate = preCdate;
          this.mdate = preMdate;
          this.$setNymph(nymph);
          throw new Error("Couldn't send verification email.");
        }
      }

      this.$descendantGroups = undefined;
      this.$gatekeeperCache = undefined;
      await tnymph.commit(transaction);

      const tilmeld = enforceTilmeld(nymph);

      if (tilmeld.User.current(true).$is(this)) {
        // Update the user in the session cache.
        await tilmeld.fillSession(this);
      }
    } else {
      await tnymph.rollback(transaction);
    }
    this.$setNymph(nymph);
    return ret;
  }

  /**
   * This should *never* be accessible on the client.
   */
  public async $saveSkipAC() {
    this.$skipAcWhenSaving = true;
    return await this.$save();
  }

  public $tilmeldSaveSkipAC() {
    if (this.$skipAcWhenSaving) {
      this.$skipAcWhenSaving = false;
      return true;
    }
    return false;
  }

  public async $delete() {
    const tilmeld = enforceTilmeld(this);
    if (!this.$skipAcWhenDeleting && !tilmeld.gatekeeper('tilmeld/admin')) {
      throw new BadDataError("You don't have the authority to delete users.");
    }
    if (
      !this.$skipAcWhenDeleting &&
      !tilmeld.gatekeeper('system/admin') &&
      this.$data.abilities?.includes('system/admin')
    ) {
      throw new BadDataError(
        "You don't have the authority to delete system admins.",
      );
    }
    if (tilmeld.User.current(true).$is(this)) {
      await this.$logout();
    }
    return await super.$delete();
  }

  /*
   * This should *never* be accessible on the client.
   */
  async $deleteSkipAC() {
    this.$skipAcWhenDeleting = true;
    return await this.$delete();
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
          : T extends 'beforeLogin'
            ? TilmeldBeforeLoginCallback
            : T extends 'afterLogin'
              ? TilmeldAfterLoginCallback
              : T extends 'beforeLogout'
                ? TilmeldBeforeLogoutCallback
                : T extends 'afterLogout'
                  ? TilmeldAfterLogoutCallback
                  : never,
  ) {
    const prop = (event + 'Callbacks') as T extends 'checkUsername'
      ? 'checkUsernameCallbacks'
      : T extends 'beforeRegister'
        ? 'beforeRegisterCallbacks'
        : T extends 'afterRegister'
          ? 'afterRegisterCallbacks'
          : T extends 'beforeLogin'
            ? 'beforeLoginCallbacks'
            : T extends 'afterLogin'
              ? 'afterLoginCallbacks'
              : T extends 'beforeLogout'
                ? 'beforeLogoutCallbacks'
                : T extends 'afterLogout'
                  ? 'afterLogoutCallbacks'
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
          : T extends 'beforeLogin'
            ? TilmeldBeforeLoginCallback
            : T extends 'afterLogin'
              ? TilmeldAfterLoginCallback
              : T extends 'beforeLogout'
                ? TilmeldBeforeLogoutCallback
                : T extends 'afterLogout'
                  ? TilmeldAfterLogoutCallback
                  : never,
  ) {
    const prop = (event + 'Callbacks') as T extends 'checkUsername'
      ? 'checkUsernameCallbacks'
      : T extends 'beforeRegister'
        ? 'beforeRegisterCallbacks'
        : T extends 'afterRegister'
          ? 'afterRegisterCallbacks'
          : T extends 'beforeLogin'
            ? 'beforeLoginCallbacks'
            : T extends 'afterLogin'
              ? 'afterLoginCallbacks'
              : T extends 'beforeLogout'
                ? 'beforeLogoutCallbacks'
                : T extends 'afterLogout'
                  ? 'afterLogoutCallbacks'
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
