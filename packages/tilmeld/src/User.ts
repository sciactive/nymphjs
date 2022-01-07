import {
  EntityData,
  EntityJson,
  EntityPatch,
  Selector,
  SerializedEntityData,
} from '@nymphjs/nymph';
import { EmailOptions } from 'email-templates';
import strtotime from 'locutus/php/datetime/strtotime';
import { nanoid, customAlphabet } from 'nanoid';
import { nolookalikesSafe } from 'nanoid-dictionary';
import Base64 from 'crypto-js/enc-base64';
import sha256 from 'crypto-js/sha256';
import md5 from 'crypto-js/md5';
import { difference } from 'lodash';

import type Tilmeld from './Tilmeld';
import AbleObject from './AbleObject';
import Group, { GroupData } from './Group';
import {
  BadDataError,
  BadEmailError,
  BadUsernameError,
  EmailChangeRateLimitExceededError,
} from './errors';

export type EventType =
  | 'beforeRegister'
  | 'afterRegister'
  | 'beforeLogin'
  | 'afterLogin'
  | 'beforeLogout'
  | 'afterLogout';
/**
 * Theses are run before the user data checks, so the only checks before are
 * whether registration is allowed and whether the user is already registered.
 */
export type TilmeldBeforeRegisterCallback = (
  user: User & UserData,
  data: { password: string; additionalData?: { [k: string]: any } }
) => void;
export type TilmeldAfterRegisterCallback = (
  user: User & UserData,
  result: { loggedin: boolean; message: string }
) => void;
/**
 * These are run after the authentication checks, but before the login action.
 */
export type TilmeldBeforeLoginCallback = (
  user: User & UserData,
  data: {
    username: string;
    password: string;
    additionalData?: { [k: string]: any };
  }
) => void;
/**
 * This is run before the transaction is committed, and you can perform
 * additional functions on the transaction, which is available in `user.$nymph`.
 */
export type TilmeldAfterLoginCallback = (user: User & UserData) => void;
export type TilmeldBeforeLogoutCallback = (user: User & UserData) => void;
export type TilmeldAfterLogoutCallback = (user: User & UserData) => void;

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
   * The new email address.
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
  static tilmeld: Tilmeld;
  static ETYPE = 'tilmeld_user';
  static class = 'User';
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
    'email',
    'originalEmail',
    'phone',
    'group',
    'groups',
    'abilities',
    'inheritAbilities',
    'recoverSecret',
    'recoverSecretDate',
    'password',
    'salt',
    'secret',
    'newEmailAddress',
    'newEmailSecret',
    'cancelEmailAddress',
    'cancelEmailSecret',
    'emailChangeDate',
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
   * This is explicitly used only during the registration proccess.
   */
  private $skipAcWhenSaving = false;
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

  static async factory(guid?: string): Promise<User & UserData> {
    return (await super.factory(guid)) as User & UserData;
  }

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
        }
      );
      if (entity != null) {
        return entity;
      }
    }
    return entity;
  }

  static factorySync(guid?: string): User & UserData {
    return super.factorySync(guid) as User & UserData;
  }

  constructor(guid?: string) {
    super(guid);

    if (this.guid == null) {
      // Defaults.
      this.$data.enabled = true;
      this.$data.abilities = [];
      this.$data.groups = [];
      this.$data.inheritAbilities = true;
      this.$updateDataProtection();
    }
  }

  public static current(returnObjectIfNotExist: true): User & UserData;
  public static current(
    returnObjectIfNotExist?: false
  ): (User & UserData) | null;
  public static current(
    returnObjectIfNotExist?: boolean
  ): (User & UserData) | null {
    if (this.tilmeld.currentUser == null) {
      return returnObjectIfNotExist ? this.factorySync() : null;
    }
    return this.tilmeld.currentUser;
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
    if (!this.tilmeld.config.pwRecovery) {
      return {
        result: false,
        message: 'Account recovery is not allowed.',
      };
    }

    let user: User & UserData;
    const options: EmailOptions = {};

    if (
      !this.tilmeld.config.emailUsernames &&
      data.recoveryType === 'username'
    ) {
      // Create a username recovery email.

      const getUser = await this.nymph.getEntity(
        { class: this.tilmeld.User, skipAc: true },
        {
          type: '&',
          ilike: ['email', data.account.replace(/([\\%_])/g, (s) => `\\${s}`)],
        }
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

      const getUser = await this.tilmeld.User.factoryUsername(data.account);

      if (getUser.guid == null) {
        return {
          result: false,
          message: 'Requested account is not accessible.',
        };
      }

      // Create a unique secret.
      getUser.recoverSecret = customAlphabet(nolookalikesSafe, 10)();
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
        timeLimit: this.tilmeld.config.pwRecoveryTimeLimit,
      };
    } else {
      return { result: false, message: 'Invalid recovery type.' };
    }

    // Send the email.
    if (await this.tilmeld.config.sendEmail(this.tilmeld, options, user)) {
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
    if (!this.tilmeld.config.pwRecovery) {
      return {
        result: false,
        message: 'Account recovery is not allowed.',
      };
    }

    const user = await this.tilmeld.User.factoryUsername(data.username);

    if (
      user.guid == null ||
      user.recoverSecret == null ||
      data.secret !== user.recoverSecret ||
      strtotime(
        '+' + this.tilmeld.config.pwRecoveryTimeLimit,
        Math.floor((user.recoverSecretDate ?? 0) / 1000)
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
    return {
      regFields: this.tilmeld.config.regFields,
      userFields: this.tilmeld.config.userFields,
      emailUsernames: this.tilmeld.config.emailUsernames,
      allowRegistration: this.tilmeld.config.allowRegistration,
      allowUsernameChange: this.tilmeld.config.allowUsernameChange,
      pwRecovery: this.tilmeld.config.pwRecovery,
      verifyEmail: this.tilmeld.config.verifyEmail,
      unverifiedAccess: this.tilmeld.config.unverifiedAccess,
    };
  }

  public static async loginUser(data: {
    username: string;
    password: string;
    additionalData?: { [k: string]: any };
  }) {
    if (!('username' in data) || !data.username.length) {
      return { result: false, message: 'Incorrect login/password.' };
    }
    const user = await this.tilmeld.User.factoryUsername(data.username);
    const result: { result: boolean; message: string; user?: User & UserData } =
      user.$login(data);
    if (result.result) {
      user.$updateDataProtection();
      result.user = user;
    }
    return result;
  }

  public $login(data: {
    username: string;
    password: string;
    additionalData?: { [k: string]: any };
  }) {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    if (this.guid == null) {
      return { result: false, message: 'Incorrect login/password.' };
    }
    if (!this.$data.enabled) {
      return { result: false, message: 'This user is disabled.' };
    }
    if (this.$gatekeeper()) {
      return { result: true, message: 'You are already logged in.' };
    }
    if (!this.$checkPassword(data.password)) {
      return { result: false, message: 'Incorrect login/password.' };
    }

    try {
      for (let callback of (this.constructor as typeof User)
        .beforeLoginCallbacks) {
        if (callback) {
          callback(this, data);
        }
      }
    } catch (e: any) {
      return {
        result: false,
        message: e.message,
      };
    }

    // Authentication was successful, attempt to login.
    if (!tilmeld.login(this, true)) {
      return { result: false, message: 'Incorrect login/password.' };
    }

    for (let callback of (this.constructor as typeof User)
      .afterLoginCallbacks) {
      if (callback) {
        callback(this);
      }
    }

    // Login was successful.
    return { result: true, message: 'You are logged in.' };
  }

  /**
   * Log a user out of the system.
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public $logout() {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;

    try {
      for (let callback of (this.constructor as typeof User)
        .beforeLogoutCallbacks) {
        if (callback) {
          callback(this);
        }
      }
    } catch (e: any) {
      return {
        result: false,
        message: e.message,
      };
    }

    tilmeld.logout();

    for (let callback of (this.constructor as typeof User)
      .afterLogoutCallbacks) {
      if (callback) {
        callback(this);
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
      md5(this.$data.email.trim().toLowerCase()).toString() +
      '?d=identicon&s=40'
    );
  }

  /**
   * Get the user's group descendants.
   */
  public async $getDescendantGroups(): Promise<(Group & GroupData)[]> {
    if (this.$descendantGroups == null) {
      this.$descendantGroups = [];
      if (this.$data.group != null) {
        this.$descendantGroups = await this.$data.group.$getDescendants();
      }
      for (let curGroup of this.$data.groups ?? []) {
        this.$descendantGroups = this.$descendantGroups?.concat(
          await curGroup.$getDescendants()
        );
      }
    }
    return this.$descendantGroups;
  }

  /**
   * Get the user's group descendants.
   */
  public $getDescendantGroupsSync(): (Group & GroupData)[] {
    if (this.$descendantGroups == null) {
      this.$descendantGroups = [];
      if (this.$data.group != null) {
        this.$descendantGroups = this.$data.group.$getDescendantsSync();
      }
      for (let curGroup of this.$data.groups ?? []) {
        this.$descendantGroups = this.$descendantGroups?.concat(
          curGroup.$getDescendantsSync()
        );
      }
    }
    return this.$descendantGroups;
  }

  public $jsonAcceptData(input: EntityJson, allowConflict = false) {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    this.$referenceWake();

    if (
      input.data.abilities?.indexOf('system/admin') !== -1 &&
      this.$data.abilities?.indexOf('system/admin') === -1 &&
      tilmeld.gatekeeper('tilmeld/admin') &&
      !tilmeld.gatekeeper('system/admin')
    ) {
      throw new BadDataError(
        "You don't have the authority to make this user a system admin."
      );
    }

    this.$originalEmail = this.$data.email;
    super.$jsonAcceptData(input, allowConflict);
  }

  public $jsonAcceptPatch(patch: EntityPatch, allowConflict = false) {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    this.$referenceWake();

    if (
      patch.set.abilities?.indexOf('system/admin') !== -1 &&
      this.$data.abilities?.indexOf('system/admin') === -1 &&
      tilmeld.gatekeeper('tilmeld/admin') &&
      !tilmeld.gatekeeper('system/admin')
    ) {
      throw new BadDataError(
        "You don't have the authority to make this user a system admin."
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
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
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
      this.$clientEnabledMethods.push('$logout');
      this.$clientEnabledMethods.push('$sendEmailVerification');
    }

    if (
      user != null &&
      (abilities.indexOf('tilmeld/admin') !== -1 ||
        abilities.indexOf('system/admin') !== -1)
    ) {
      // Users who can edit other users can see most of their data.
      this.$privateData = ['password', 'salt'];
      this.$allowlistData = undefined;
    } else if (isCurrentUser || isNewUser) {
      // Users can see their own data, and edit some of it.
      if (tilmeld.config.allowUsernameChange || isNewUser) {
        this.$allowlistData.push('username');
      }
      this.$allowlistData.push('avatar');
      if (tilmeld.config.userFields.indexOf('name') !== -1) {
        this.$allowlistData.push('nameFirst');
        this.$allowlistData.push('nameMiddle');
        this.$allowlistData.push('nameLast');
        this.$allowlistData.push('name');
      }
      if (tilmeld.config.userFields.indexOf('email') !== -1) {
        this.$allowlistData.push('email');
      }
      if (tilmeld.config.userFields.indexOf('phone') !== -1) {
        this.$allowlistData.push('phone');
      }
      this.$privateData = [
        'secret',
        'newEmailSecret',
        'cancelEmailAddress',
        'cancelEmailSecret',
        'emailChangeDate',
        'recoverSecret',
        'recoverSecretDate',
        'password',
        'salt',
      ];
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
  public $gatekeeper(ability?: string): boolean {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    if (ability == null) {
      return tilmeld.User.current()?.$is(this) ?? false;
    }
    // Check the cache to see if we've already checked this user.
    if (this.$gatekeeperCache == null) {
      let abilities = this.$data.abilities ?? [];
      if (this.$data.inheritAbilities) {
        for (let curGroup of this.$data.groups ?? []) {
          if (curGroup.enabled) {
            abilities = abilities.concat(curGroup.abilities ?? []);
          }
        }
        if (
          this.$data.group != null &&
          this.$data.group.cdate != null &&
          this.$data.group.enabled
        ) {
          abilities = abilities.concat(this.$data.group.abilities ?? []);
        }
      }
      this.$gatekeeperCache = Object.fromEntries(
        abilities.map((ability) => [ability, true])
      );
    }
    return (
      (ability in this.$gatekeeperCache && !!this.$gatekeeperCache[ability]) ||
      !!this.$gatekeeperCache['system/admin']
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
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    if (this.guid == null) {
      return false;
    }
    let success = true;

    const verifyUrl = `${tilmeld.config.appUrl.replace(/\/$/, () => '')}${
      tilmeld.config.setupPath
    }/verify`;

    if (this.$data.secret != null) {
      const link = `${verifyUrl}?action=verify&id=${encodeURIComponent(
        this.guid
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
          this
        ));
    }

    if (this.$data.newEmailSecret != null) {
      const link = `${verifyUrl}?action=verifychange&id=${encodeURIComponent(
        this.guid
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
          this
        ));
    }

    if (this.$data.cancelEmailSecret != null) {
      const link = `${verifyUrl}?action=cancelchange&id=${encodeURIComponent(
        this.guid
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
          this
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
  public $addGroup(group: Group & GroupData) {
    if (this.$data.groups == null) {
      this.$data.groups = [];
    }
    if (!group.$inArray(this.$data.groups)) {
      this.$data.groups.push(group);
      return this.$data.groups;
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
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    switch (tilmeld.config.pwMethod) {
      case 'plain':
        return this.$data.password === password;
      case 'digest':
        return this.$data.password === sha256(password).toString(Base64);
      case 'salt':
      default:
        return (
          this.$data.password ===
          sha256(password + this.$data.salt).toString(Base64)
        );
    }
  }

  /**
   * Remove the user from a (secondary) group.
   *
   * @param group The group.
   * @returns True if the user wasn't in the group. The resulting array of groups if the user was.
   */
  public $delGroup(group: Group & GroupData) {
    if (this.$data.groups != null && group.$inArray(this.$data.groups)) {
      const newGroups: (Group & GroupData)[] = [];
      for (let curGroup of this.$data.groups) {
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
  public $inGroup(group: (Group & GroupData) | string) {
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
  public $isDescendant(group: (Group & GroupData) | string) {
    // Check to see if the user is in a descendant group of the given group.
    if (
      this.$data.group?.cdate != null &&
      this.$data.group.$isDescendant(group)
    ) {
      return true;
    }
    for (let curGroup of this.$data.groups ?? []) {
      if (curGroup.$isDescendant(group)) {
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
  }): Promise<{ result: boolean; message: string }> {
    if (!('newPassword' in data) || !data.newPassword.length) {
      return { result: false, message: 'Please specify a password.' };
    }
    if (!this.$checkPassword(data.currentPassword ?? '')) {
      return { result: false, message: 'Incorrect password.' };
    }
    this.$data.passwordTemp = data.newPassword;
    if (await this.$save()) {
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
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    switch (tilmeld.config.pwMethod) {
      case 'plain':
        delete this.$data.salt;
        this.$data.password = password;
        break;
      case 'digest':
        delete this.$data.salt;
        this.$data.password = sha256(password).toString(Base64);
        break;
      case 'salt':
      default:
        this.$data.salt = nanoid();
        this.$data.password = sha256(password + this.$data.salt).toString(
          Base64
        );
        break;
    }
    return this.$data.password;
  }

  /**
   * Check that a username is valid.
   *
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public async $checkUsername(): Promise<{ result: boolean; message: string }> {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    if (!tilmeld.config.emailUsernames) {
      if (this.$data.username == null || !this.$data.username.length) {
        return { result: false, message: 'Please specify a username.' };
      }
      if (
        tilmeld.config.maxUsernameLength > 0 &&
        this.$data.username.length > tilmeld.config.maxUsernameLength
      ) {
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
          tilmeld.config.validChars.split('')
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
        selector
      );
      if (test != null) {
        return { result: false, message: 'That username is taken.' };
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
      if (
        tilmeld.config.maxUsernameLength > 0 &&
        this.$data.username.length > tilmeld.config.maxUsernameLength
      ) {
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
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
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
      selector
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
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
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
      selector
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
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
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

    try {
      for (let callback of (this.constructor as typeof User)
        .beforeRegisterCallbacks) {
        if (callback) {
          callback(this, data);
        }
      }
    } catch (e: any) {
      return {
        result: false,
        loggedin: false,
        message: e.message,
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
    if (tilmeld.config.regFields.indexOf('name') !== -1) {
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
    this.$nymph = tnymph;

    try {
      // Add primary group.
      let generatedPrimaryGroup: (Group & GroupData) | null = null;
      if (tilmeld.config.generatePrimary) {
        // Generate a new primary group for the user.
        generatedPrimaryGroup = await tilmeld.Group.factory();
        generatedPrimaryGroup.groupname = this.$data.username;
        generatedPrimaryGroup.avatar = this.$data.avatar;
        generatedPrimaryGroup.name = this.$data.name;
        generatedPrimaryGroup.email = this.$data.email;
        const parent = await tnymph.getEntity(
          { class: tilmeld.Group },
          {
            type: '&',
            equal: ['defaultPrimary', true],
          }
        );
        if (parent != null) {
          generatedPrimaryGroup.parent = parent;
        }
        if (!(await generatedPrimaryGroup.$saveSkipAC())) {
          await tnymph.rollback(transaction);
          this.$nymph = nymph;
          return {
            result: false,
            loggedin: false,
            message: 'Error creating primary group for user.',
          };
        }
        this.$data.group = generatedPrimaryGroup;
      } else {
        // Add the default primary.
        const group = await tnymph.getEntity(
          { class: tilmeld.Group },
          {
            type: '&',
            equal: ['defaultPrimary', true],
          }
        );
        if (group != null) {
          this.$data.group = group;
        }
      }

      // Add secondary groups.
      if (tilmeld.config.verifyEmail && tilmeld.config.unverifiedAccess) {
        // Add the default secondaries for unverified users.
        this.$data.groups = await tnymph.getEntities(
          { class: tilmeld.Group },
          {
            type: '&',
            equal: ['unverifiedSecondary', true],
          }
        );
      } else {
        // Add the default secondaries.
        this.$data.groups = await tnymph.getEntities(
          { class: tilmeld.Group },
          {
            type: '&',
            equal: ['defaultSecondary', true],
          }
        );
      }

      if (tilmeld.config.verifyEmail) {
        // The user will be enabled after verifying their e-mail address.
        if (!tilmeld.config.unverifiedAccess) {
          this.$data.enabled = false;
        }
      } else {
        this.$data.enabled = true;
      }

      // If create_admin is true and there are no other users, grant
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

      if (await this.$saveSkipAC()) {
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
            this
          );
        }

        let message = '';
        let loggedin = false;

        // Save the primary group.
        if (generatedPrimaryGroup != null) {
          generatedPrimaryGroup.user = this;
          if (!(await generatedPrimaryGroup.$saveSkipAC())) {
            await tnymph.rollback(transaction);
            this.$nymph = nymph;
            return {
              result: false,
              loggedin: false,
              message:
                'Your primary group could not be assigned. Please try again later.',
            };
          }
        }

        // Finish up.
        if (
          tilmeld.config.verifyEmail &&
          !tilmeld.config.unverifiedAccess &&
          !madeAdmin
        ) {
          message +=
            `Almost there. An email has been sent to ${this.$data.email} ` +
            'with a verification link for you to finish registration.';
        } else if (
          tilmeld.config.verifyEmail &&
          tilmeld.config.unverifiedAccess &&
          !madeAdmin
        ) {
          tilmeld.login(this, true);
          message +=
            "You're now logged in! An email has been sent to " +
            `${this.$data.email} with a verification link for you to finish ` +
            'registration.';
          loggedin = true;
        } else {
          tilmeld.login(this, true);
          message += "You're now registered and logged in!";
          loggedin = true;
        }

        for (let callback of (this.constructor as typeof User)
          .afterRegisterCallbacks) {
          if (callback) {
            callback(this, {
              loggedin,
              message,
            });
          }
        }

        await tnymph.commit(transaction);
        this.$nymph = nymph;

        return {
          result: true,
          loggedin,
          message,
        };
      } else {
        await tnymph.rollback(transaction);
        this.$nymph = nymph;
        return {
          result: false,
          loggedin: false,
          message: 'Error registering user.',
        };
      }
    } catch (e: any) {
      await tnymph.rollback(transaction);
      this.$nymph = nymph;
      throw e;
    }
  }

  public async $save() {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    if (this.$data.username == null || !this.$data.username.trim().length) {
      return false;
    }

    if (
      tilmeld.gatekeeper('tilmeld/admin') &&
      !tilmeld.gatekeeper('system/admin') &&
      this.$gatekeeper('system/admin')
    ) {
      throw new BadDataError(
        "You don't have the authority to modify system admins."
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
    if (this.$data.nameFirst === '') {
      delete this.$data.nameFirst;
    }
    if (this.$data.nameMiddle === '') {
      delete this.$data.nameMiddle;
    }
    if (this.$data.nameLast === '') {
      delete this.$data.nameLast;
    }
    if (this.$data.name === '') {
      delete this.$data.name;
    }
    if (this.$data.email === '') {
      delete this.$data.email;
    }
    if (this.$data.avatar === '') {
      delete this.$data.avatar;
    }
    if (this.$data.phone === '') {
      delete this.$data.phone;
    }
    if (this.$data.secret === '') {
      delete this.$data.secret;
    }
    if (this.$data.emailChangeDate === 0) {
      delete this.$data.emailChangeDate;
    }
    if (this.$data.newEmailSecret === '') {
      delete this.$data.newEmailSecret;
    }
    if (this.$data.newEmailAddress === '') {
      delete this.$data.newEmailAddress;
    }
    if (this.$data.cancelEmailSecret === '') {
      delete this.$data.cancelEmailSecret;
    }
    if (this.$data.cancelEmailAddress === '') {
      delete this.$data.cancelEmailAddress;
    }
    if (this.$data.recoverSecret === '') {
      delete this.$data.recoverSecret;
    }
    if (this.$data.recoverSecretDate === 0) {
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
    if (!tilmeld.config.emailUsernames) {
      const emCheck = await this.$checkEmail();
      if (!emCheck.result) {
        throw new BadEmailError(emCheck.message);
      }
    }

    // Email changes.
    if (!tilmeld.gatekeeper('tilmeld/admin')) {
      // The user isn't an admin, so email address changes should contain some
      // security measures.
      if (tilmeld.config.verifyEmail) {
        // The user needs to verify this new email address.
        if (this.guid == null) {
          // If this is the first user, they'll be made an admin, so they don't
          // need to verify.
          if ((this.$data.abilities?.indexOf('system/admin') ?? -1) === -1) {
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
                    Math.floor(this.$data.emailChangeDate / 1000)
                  ) * 1000
                ).toString() +
                ' to change your email address again.'
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

    try {
      tilmeld.config.validatorUser(this);
    } catch (e: any) {
      throw new BadDataError(e?.message);
    }

    // Start transaction.
    const transaction = 'tilmeld-save-' + nanoid();
    const nymph = this.$nymph;
    const tnymph = await this.$nymph.startTransaction(transaction);
    this.$nymph = tnymph;

    if (
      this.$data.group != null &&
      this.$data.group.user != null &&
      this.$is(this.$data.group.user)
    ) {
      try {
        // Update the user's generated primary group.
        this.$data.group.groupname = this.$data.username;
        this.$data.group.avatar = this.$data.avatar;
        this.$data.group.email = this.$data.email;
        this.$data.group.name = this.$data.name;
        this.$data.group.phone = this.$data.phone;
        await this.$data.group.$saveSkipAC();
      } catch (e: any) {
        await tnymph.rollback(transaction);
        this.$nymph = nymph;
        throw e;
      }
    }

    let ret: boolean;
    let preGuid = this.guid;
    let preCdate = this.cdate;
    let preMdate = this.mdate;

    try {
      ret = await super.$save();
    } catch (e: any) {
      await tnymph.rollback(transaction);
      this.$nymph = nymph;
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
          this.$nymph = nymph;
          throw new Error("Couldn't send verification email.");
        }
      }

      if (tilmeld.User.current(true).$is(this)) {
        // Update the user in the session cache.
        tilmeld.fillSession(this);
      }

      this.$descendantGroups = undefined;
      this.$gatekeeperCache = undefined;
      await tnymph.commit(transaction);
    } else {
      await tnymph.rollback(transaction);
    }
    this.$nymph = nymph;
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
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    if (!tilmeld.gatekeeper('tilmeld/admin')) {
      throw new BadDataError("You don't have the authority to delete users.");
    }
    if (
      !tilmeld.gatekeeper('system/admin') &&
      this.$gatekeeper('system/admin')
    ) {
      throw new BadDataError(
        "You don't have the authority to delete system admins."
      );
    }
    if (tilmeld.User.current(true).$is(this)) {
      this.$logout();
    }
    return await super.$delete();
  }

  public static on<T extends EventType>(
    event: T,
    callback: T extends 'beforeRegister'
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
      : never
  ) {
    const prop = (event + 'Callbacks') as T extends 'beforeRegister'
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
    callback: T extends 'beforeRegister'
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
      : never
  ) {
    const prop = (event + 'Callbacks') as T extends 'beforeRegister'
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
