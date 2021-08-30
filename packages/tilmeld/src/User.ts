import Nymph, {
  EntityData,
  EntityJson,
  EntityPatch,
  Selector,
  SerializedEntityData,
} from '@nymphjs/nymph';
import { EmailOptions } from 'email-templates';
import strtotime from 'locutus/php/datetime/strtotime';
import { nanoid } from 'nanoid';
import CryptoJS from 'crypto-js';
import sha256 from 'crypto-js/sha256';
import md5 from 'crypto-js/md5';
import { difference } from 'lodash';

import AbleObject from './AbleObject';
import Group, { GroupData } from './Group';
import Tilmeld from './Tilmeld';
import {
  BadDataError,
  BadEmailError,
  BadUsernameError,
  EmailChangeRateLimitExceededError,
} from './errors';

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
   * The user's full name.
   */
  name?: string;
  /**
   * The user's email address.
   */
  email?: string;
  /**
   * Used to save the current email to send verification if it changes.
   */
  originalEmail?: string;
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
  recoverSecretTime?: number;
  /**
   * The password hash salt.
   */
  salt?: string;
  /**
   * The password or password hash.
   */
  password?: string;
};

export default class User extends AbleObject<UserData> {
  static ETYPE = 'tilmeld_user';
  static class = 'User';

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
    'recoverSecretTime',
    'password',
    'salt',
    'secret',
    'cancelEmailAddress',
    'cancelEmailSecret',
    'emailChangeDate',
  ];
  private static DEFAULT_ALLOWLIST_DATA: string[] = [];

  protected $clientEnabledMethods = User.DEFAULT_CLIENT_ENABLED_METHODS;
  public static clientEnabledStaticMethods = [
    'current',
    'loginUser',
    'sendRecoveryLink',
    'recover',
    'getClientConfig',
  ];
  protected $privateData = User.DEFAULT_PRIVATE_DATA;
  public static searchRestrictedData = User.DEFAULT_PRIVATE_DATA;
  protected $allowlistData? = User.DEFAULT_ALLOWLIST_DATA;
  protected $allowlistTags?: string[] = [];

  /**
   * Gatekeeper ability cache.
   *
   * Gatekeeper will cache the user's abilities that it calculates, so it can check faster if that
   * user has been checked before.
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
   * Temporary storage for passwords. This will be hashed before going into the database.
   */
  private $passwordTemp?: string;

  static async factory(guid?: string): Promise<User & UserData> {
    return (await super.factory(guid)) as User & UserData;
  }

  static async factoryUsername(username?: string): Promise<User & UserData> {
    const entity = new this();
    if (username != null) {
      const entity = await Nymph.getEntity(
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
    if (Tilmeld.currentUser == null) {
      return returnObjectIfNotExist ? this.factorySync() : null;
    }
    return Tilmeld.currentUser;
  }

  /**
   * Send an account recovery link.
   *
   * @param data The input data from the client.
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public static async sendRecoveryLink(data: {
    recoveryType: 'username' | 'password';
    account: string;
  }): Promise<{ result: boolean; message: string }> {
    if (!Tilmeld.config.pwRecovery) {
      return {
        result: false,
        message: 'Account recovery is not allowed.',
      };
    }

    let user: User & UserData;
    const options: EmailOptions = {};

    if (!Tilmeld.config.emailUsernames && data.recoveryType === 'username') {
      // Create a username recovery email.

      const getUser = await Nymph.getEntity(
        { class: User, skipAc: true },
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

      const getUser = await User.factoryUsername(data.account);

      if (getUser.guid == null) {
        return {
          result: false,
          message: 'Requested account is not accessible.',
        };
      }

      // Create a unique secret.
      getUser.recoverSecret = nanoid();
      getUser.recoverSecretTime = Date.now();
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
        timeLimit: Tilmeld.config.pwRecoveryTimeLimit,
      };
    } else {
      return { result: false, message: 'Invalid recovery type.' };
    }

    // Send the email.
    if (await Tilmeld.config.sendEmail(options, user)) {
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
    if (!Tilmeld.config.pwRecovery) {
      return {
        result: false,
        message: 'Account recovery is not allowed.',
      };
    }

    const user = await User.factoryUsername(data.username);

    if (
      user.guid == null ||
      user.recoverSecret == null ||
      data.secret !== user.recoverSecret ||
      strtotime(
        '+' + Tilmeld.config.pwRecoveryTimeLimit,
        Math.floor((user.recoverSecretTime ?? 0) / 1000)
      ) < Date.now()
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
    delete user.recoverSecretTime;
    if (user.$saveSkipAC()) {
      return {
        result: true,
        message:
          'Your password has been reset. You can now log in using ' +
          'your new password.',
      };
    } else {
      return { result: false, message: 'Error saving new password.' };
    }
  }

  public static getClientConfig() {
    return {
      regFields: Tilmeld.config.regFields,
      emailUsernames: Tilmeld.config.emailUsernames,
      allowRegistration: Tilmeld.config.allowRegistration,
      pwRecovery: Tilmeld.config.pwRecovery,
      verifyEmail: Tilmeld.config.verifyEmail,
      unverifiedAccess: Tilmeld.config.unverifiedAccess,
    };
  }

  public static async loginUser(data: { username: string; password: string }) {
    if (!('username' in data) || !data.username.length) {
      return { result: false, message: 'Incorrect login/password.' };
    }
    const user = await User.factoryUsername(data.username);
    const result: { result: boolean; message: string; user?: User & UserData } =
      user.$login(data);
    if (result.result) {
      user.$updateDataProtection();
      result.user = user;
    }
    return result;
  }

  public $login(data: { username: string; password: string }) {
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

    // Authentication was successful, attempt to login.
    if (!Tilmeld.login(this, true)) {
      return { result: false, message: 'Incorrect login/password.' };
    }

    // Login was successful.
    return { result: true, message: 'You are logged in.' };
  }

  /**
   * Log a user out of the system.
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public $logout() {
    Tilmeld.logout();
    return { result: true, message: 'You have been logged out.' };
  }

  public $getAvatar() {
    if (this.$data.avatar != null) {
      return this.$data.avatar;
    }
    if (this.$data.email == null || !this.$data.email.length) {
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
    this.$referenceWake();

    if (
      Tilmeld.gatekeeper('tilmeld/admin') &&
      !Tilmeld.gatekeeper('system/admin') &&
      input.data.abilities.indexOf('system/admin') !== -1 &&
      this.$data.abilities?.indexOf('system/admin') === -1
    ) {
      throw new BadDataError(
        "You don't have the authority to make this user a system admin."
      );
    }

    super.$jsonAcceptData(input, allowConflict);
  }

  public $jsonAcceptPatch(patch: EntityPatch, allowConflict = false) {
    this.$referenceWake();

    if (
      Tilmeld.gatekeeper('tilmeld/admin') &&
      !Tilmeld.gatekeeper('system/admin') &&
      patch.set.abilities.indexOf('system/admin') !== -1 &&
      this.$data.abilities?.indexOf('system/admin') === -1
    ) {
      throw new BadDataError(
        "You don't have the authority to make this user a system admin."
      );
    }

    super.$jsonAcceptPatch(patch, allowConflict);
  }

  public $putData(data: EntityData, sdata?: SerializedEntityData) {
    super.$putData(data, sdata);

    if (
      this.$data.secret == null &&
      (this.$data.emailChangeDate == null ||
        this.$data.emailChangeDate <
          strtotime('-' + Tilmeld.config.emailRateLimit) * 1000)
    ) {
      this.$data.originalEmail = this.$data.email;
    }

    this.$updateDataProtection();
  }

  /**
   * Update the data protection arrays for a user.
   *
   * @param givenUser User to update protection for. If undefined, will use the currently logged in user.
   */
  public $updateDataProtection(givenUser?: User & UserData) {
    let user = givenUser ?? User.current();

    this.$clientEnabledMethods = User.DEFAULT_CLIENT_ENABLED_METHODS;
    this.$privateData = User.DEFAULT_PRIVATE_DATA;
    this.$allowlistData = User.DEFAULT_ALLOWLIST_DATA;

    if (Tilmeld.config.emailUsernames) {
      this.$privateData.push('username');
    }

    const isCurrentUser = user != null && this.$is(user);
    const isNewUser = this.guid == null;

    if (isCurrentUser) {
      // Users can check to see what abilities they have.
      this.$clientEnabledMethods.push('$gatekeeper');
      this.$clientEnabledMethods.push('$changePassword');
      this.$clientEnabledMethods.push('$logout');
      this.$clientEnabledMethods.push('$sendEmailVerification');
    }

    if (user != null && user.$gatekeeper('tilmeld/admin')) {
      // Users who can edit other users can see most of their data.
      this.$privateData = ['password', 'salt'];
      this.$allowlistData = undefined;
    } else if (isCurrentUser || isNewUser) {
      // Users can see their own data, and edit some of it.
      this.$allowlistData.push('username');
      this.$allowlistData.push('avatar');
      if (Tilmeld.config.userFields.indexOf('name') !== -1) {
        this.$allowlistData.push('nameFirst');
        this.$allowlistData.push('nameMiddle');
        this.$allowlistData.push('nameLast');
        this.$allowlistData.push('name');
      }
      if (Tilmeld.config.userFields.indexOf('email') !== -1) {
        this.$allowlistData.push('email');
      }
      if (Tilmeld.config.userFields.indexOf('phone') !== -1) {
        this.$allowlistData.push('phone');
      }
      this.$privateData = [
        'originalEmail',
        'secret',
        'cancelEmailAddress',
        'cancelEmailSecret',
        'emailChangeDate',
        'recoverSecret',
        'recoverSecretTime',
        'password',
        'salt',
      ];
    }
  }

  /**
   * Check to see if a user has an ability.
   *
   * This function will check both user and group abilities, if the user is marked to inherit the
   * abilities of its group.
   *
   * If `ability` is undefined, it will check to see if the user is currently logged in.
   *
   * If the user has the "system/admin" ability, this function will return true.
   *
   * @param ability The ability.
   * @returns True or false.
   */
  public $gatekeeper(ability?: string) {
    if (ability == null) {
      return User.current(true).$is(this);
    }
    // Check the cache to see if we've already checked this user.
    if (this.$gatekeeperCache == null) {
      let abilities = this.$data.abilities ?? [];
      if (this.$data.inheritAbilities) {
        for (let curGroup of this.$data.groups ?? []) {
          if (curGroup.guid == null) {
            continue;
          }
          abilities = abilities.concat(curGroup.abilities ?? []);
        }
        if (this.$data.group != null && this.$data.group.guid != null) {
          abilities = abilities.concat(this.$data.group.abilities ?? []);
        }
      }
      this.$gatekeeperCache = Object.fromEntries(
        abilities.map((ability) => [ability, true])
      );
    }
    return (
      (ability in this.$gatekeeperCache && this.$gatekeeperCache[ability]) ||
      this.$gatekeeperCache['system/admin']
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
    if (this.guid == null) {
      return false;
    }
    let success = true;

    const setupUrl = `${Tilmeld.config.appUrl.replace(/\/$/, () => '')}${
      Tilmeld.config.setupPath
    }`;

    if (this.$data.secret != null && this.$data.cancelEmailSecret == null) {
      const link = `${setupUrl}${
        setupUrl.match(/\?/) ? '&' : '?'
      }action=verifyemail&id=${encodeURIComponent(
        this.guid
      )}&secret=${encodeURIComponent(this.$data.secret)}`;
      success =
        success &&
        (await Tilmeld.config.sendEmail(
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

    if (this.$data.secret != null && this.$data.cancelEmailSecret != null) {
      // phpcs:ignore Generic.Files.LineLength.TooLong
      const link = `${setupUrl}${
        setupUrl.match(/\?/) ? '&' : '?'
      }action=verifyemailchange&id=${encodeURIComponent(
        this.guid
      )}&secret=${encodeURIComponent(this.$data.secret)}`;
      success =
        success &&
        (await Tilmeld.config.sendEmail(
          {
            template: 'VerifyEmailChange',
            message: {
              to: {
                name: this.$data.name ?? '',
                address: this.$data.email ?? '',
              },
            },
            locals: {
              verifyLink: link,
              oldEmail: this.$data.cancelEmailAddress,
              newEmail: this.$data.email,
            },
          },
          this
        ));
    }

    if (this.$data.cancelEmailSecret != null) {
      const link = `${setupUrl}${
        setupUrl.match(/\?/) ? '&' : '?'
      }action=cancelemailchange&id=${encodeURIComponent(
        this.guid
      )}&secret=${encodeURIComponent(this.$data.cancelEmailSecret)}`;
      success =
        success &&
        (await Tilmeld.config.sendEmail(
          {
            template: 'CancelEmailChange',
            message: {
              to: {
                name: this.$data.name ?? '',
                address: this.$data.email ?? '',
              },
            },
            locals: {
              cancelLink: link,
              oldEmail: this.$data.cancelEmailAddress,
              newEmail: this.$data.email,
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
    switch (Tilmeld.config.pwMethod) {
      case 'plain':
        return this.$data.password === password;
      case 'digest':
        return (
          this.$data.password == sha256(password).toString(CryptoJS.enc.Utf16)
        );
      case 'salt':
      default:
        return (
          this.$data.password ==
          sha256(password + this.$data.salt).toString(CryptoJS.enc.Utf16)
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
   * @param mixed $group The group, or the group's GUID.
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
      this.$data.group?.guid != null &&
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
    password: string;
    oldPassword: string;
  }): Promise<{ result: boolean; message: string }> {
    if ('password' in data || !data.password.length) {
      return { result: false, message: 'Please specify a password.' };
    }
    if (!this.$checkPassword(data.oldPassword ?? '')) {
      return { result: false, message: 'Incorrect password.' };
    }
    this.$passwordTemp = data.password;
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
    switch (Tilmeld.config.pwMethod) {
      case 'plain':
        delete this.$data.salt;
        this.$data.password = password;
        break;
      case 'digest':
        delete this.$data.salt;
        this.$data.password = sha256(password).toString(CryptoJS.enc.Utf16);
        break;
      case 'salt':
      default:
        this.$data.salt = nanoid();
        this.$data.password = sha256(password + this.$data.salt).toString(
          CryptoJS.enc.Utf16
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
    if (!Tilmeld.config.emailUsernames) {
      if (this.$data.username == null || !this.$data.username.length) {
        return { result: false, message: 'Please specify a username.' };
      }
      if (
        Tilmeld.config.maxUsernameLength > 0 &&
        this.$data.username.length > Tilmeld.config.maxUsernameLength
      ) {
        return {
          result: false,
          message:
            'Usernames must not exceed ' +
            Tilmeld.config.maxUsernameLength +
            ' characters.',
        };
      }
      if (
        difference(
          this.$data.username.split(''),
          Tilmeld.config.validChars.split('')
        )
      ) {
        return {
          result: false,
          message: Tilmeld.config.validCharsNotice,
        };
      }
      if (!Tilmeld.config.validRegex.test(this.$data.username)) {
        return {
          result: false,
          message: Tilmeld.config.validRegexNotice,
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
      const test = await Nymph.getEntity(
        { class: User, skipAc: true },
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
      this.$data.username = this.$data.email;
      if (this.$data.username == null || !this.$data.username.length) {
        return { result: false, message: 'Please specify an email.' };
      }
      if (
        Tilmeld.config.maxUsernameLength > 0 &&
        this.$data.username.length > Tilmeld.config.maxUsernameLength
      ) {
        return {
          result: false,
          message:
            'Emails must not exceed ' +
            Tilmeld.config.maxUsernameLength +
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
    if (this.$data.email == null || !this.$data.email.length) {
      if (Tilmeld.config.verifyEmail) {
        return { result: false, message: 'Please specify an email.' };
      } else {
        return { result: true, message: '' };
      }
    }
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(this.$data.email)) {
      return {
        result: false,
        message: 'Email must be a correctly formatted address.',
      };
    }
    const selector: Selector = {
      type: '&',
      ilike: ['email', this.$data.email.replace(/([\\%_])/g, (s) => `\\${s}`)],
    };
    if (this.guid != null) {
      selector['!guid'] = this.guid;
    }
    const test = await Nymph.getEntity({ class: User, skipAc: true }, selector);
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
    const test = await Nymph.getEntity({ class: User, skipAc: true }, selector);
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
  }): Promise<{ result: boolean; loggedin: boolean; message: string }> {
    if (!Tilmeld.config.allowRegistration) {
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
    if (Tilmeld.config.regFields.indexOf('name') !== -1) {
      this.$data.name =
        this.$data.nameFirst +
        (!this.$data.nameMiddle == null ? '' : ' ' + this.$data.nameMiddle) +
        (!this.$data.nameLast == null ? '' : ' ' + this.$data.nameLast);
      if (this.$data.name === '') {
        this.$data.name = this.$data.username;
      }
    }
    if (Tilmeld.config.emailUsernames) {
      this.$data.email = this.$data.username;
    }

    // Start transaction.
    if ((await Nymph.inTransaction()) || !(await Nymph.startTransaction())) {
      return {
        result: false,
        loggedin: false,
        message: 'Error starting database transaction.',
      };
    }

    // Add primary group.
    let generatedPrimaryGroup: (Group & GroupData) | null = null;
    if (Tilmeld.config.generatePrimary) {
      // Generate a new primary group for the user.
      generatedPrimaryGroup = await Group.factory();
      generatedPrimaryGroup.groupname = this.$data.username;
      generatedPrimaryGroup.avatar = this.$data.avatar;
      generatedPrimaryGroup.name = this.$data.name;
      generatedPrimaryGroup.email = this.$data.email;
      const parent = await Nymph.getEntity(
        { class: Group },
        {
          type: '&',
          equal: ['defaultPrimary', true],
        }
      );
      if (parent != null) {
        generatedPrimaryGroup.parent = parent;
      }
      if (!(await generatedPrimaryGroup.$saveSkipAC())) {
        await Nymph.rollback();
        return {
          result: false,
          loggedin: false,
          message: 'Error creating primary group for user.',
        };
      }
      this.$data.group = generatedPrimaryGroup;
    } else {
      // Add the default primary.
      const group = await Nymph.getEntity(
        { class: Group },
        {
          type: '&',
          equal: ['defaultPrimary', true],
        }
      );
      if (group != null) {
        this.$data.group = group;
      }
    }

    try {
      // Add secondary groups.
      if (Tilmeld.config.verifyEmail && Tilmeld.config.unverifiedAccess) {
        // Add the default secondaries for unverified users.
        this.$data.groups = await Nymph.getEntities(
          { class: Group },
          {
            type: '&',
            equal: ['unverifiedSecondary', true],
          }
        );
      } else {
        // Add the default secondaries.
        this.$data.groups = await Nymph.getEntities(
          { class: Group },
          {
            type: '&',
            equal: ['defaultSecondary', true],
          }
        );
      }

      if (Tilmeld.config.verifyEmail) {
        // The user will be enabled after verifying their e-mail address.
        if (!Tilmeld.config.unverifiedAccess) {
          this.$data.enabled = false;
        }
      } else {
        this.$data.enabled = true;
      }

      // If create_admin is true and there are no other users, grant
      // "system/admin".
      if (Tilmeld.config.createAdmin) {
        const otherUsers = await Nymph.getEntities({
          class: User,
          skipAc: true,
          limit: 1,
        });
        // Make sure it's not just null, cause that means an error.
        if (!otherUsers.length) {
          this.$grant('system/admin');
          this.$data.enabled = true;
        }
      }

      if (this.$saveSkipAC()) {
        // Send the new user registered email.
        if (Tilmeld.config.userRegisteredRecipient != null) {
          await Tilmeld.config.sendEmail(
            {
              template: 'UserRegistered',
              message: {
                to: Tilmeld.config.userRegisteredRecipient,
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
          if (!generatedPrimaryGroup.$saveSkipAC()) {
            await Nymph.rollback();
            return {
              result: false,
              loggedin: false,
              message:
                'Your primary group could not be assigned. Please try again later.',
            };
          }
        }

        // Finish up.
        if (Tilmeld.config.verifyEmail && !Tilmeld.config.unverifiedAccess) {
          message +=
            `Almost there. An email has been sent to ${this.$data.email} ` +
            'with a verification link for you to finish registration.';
        } else if (
          Tilmeld.config.verifyEmail &&
          Tilmeld.config.unverifiedAccess
        ) {
          Tilmeld.login(this, true);
          message +=
            "You're now logged in! An email has been sent to " +
            `${this.$data.email} with a verification link for you to finish ` +
            'registration.';
          loggedin = true;
        } else {
          Tilmeld.login(this, true);
          message += "You're now registered and logged in!";
          loggedin = true;
        }
        await Nymph.commit();
        return {
          result: true,
          loggedin,
          message,
        };
      } else {
        await Nymph.rollback();
        return {
          result: false,
          loggedin: false,
          message: 'Error registering user.',
        };
      }
    } catch (e) {
      await Nymph.rollback();
      throw e;
    }
  }

  public async $save() {
    if (this.$data.username == null || !this.$data.username.length) {
      return false;
    }

    if (
      Tilmeld.gatekeeper('tilmeld/admin') &&
      !Tilmeld.gatekeeper('system/admin') &&
      this.$gatekeeper('system/admin')
    ) {
      throw new BadDataError(
        "You don't have the authority to modify system admins."
      );
    }

    let sendVerification = false;

    // Formatting.
    this.$data.username = this.$data.username.trim();
    if (!Tilmeld.config.emailUsernames) {
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

    // Verification.
    const unCheck = await this.$checkUsername();
    if (!unCheck.result) {
      throw new BadUsernameError(unCheck.message);
    }
    if (!Tilmeld.config.emailUsernames) {
      const emCheck = await this.$checkEmail();
      if (!emCheck.result) {
        throw new BadEmailError(emCheck.message);
      }
    }

    // Email changes.
    if (!Tilmeld.gatekeeper('tilmeld/admin')) {
      // The user isn't an admin, so email address changes should contain some security measures.
      if (Tilmeld.config.verifyEmail) {
        // The user needs to verify this new email address.
        if (this.guid == null) {
          this.$data.secret = nanoid();
          sendVerification = true;
        } else if (
          this.$data.originalEmail != null &&
          this.$data.originalEmail !== this.$data.email
        ) {
          // The user already has an old email address.
          if (
            Tilmeld.config.emailRateLimit !== '' &&
            this.$data.emailChangeDate != null &&
            this.$data.emailChangeDate >
              strtotime('-' + Tilmeld.config.emailRateLimit) * 1000
          ) {
            throw new EmailChangeRateLimitExceededError(
              'You already changed your email address recently. Please wait until ' +
                new Date(
                  strtotime(
                    '+' + Tilmeld.config.emailRateLimit,
                    Math.floor(this.$data.emailChangeDate / 1000)
                  )
                ).toLocaleString() +
                ' to change your email address again.'
            );
          } else {
            if (
              this.$data.secret == null &&
              // Make sure the user has at least the rate limit time to cancel an email change.
              (this.$data.emailChangeDate == null ||
                this.$data.emailChangeDate <
                  strtotime('-' + Tilmeld.config.emailRateLimit) * 1000)
            ) {
              // Save the old email in case the cancel change link is clicked.
              this.$data.cancelEmailAddress = this.$data.originalEmail;
              this.$data.cancelEmailSecret = nanoid();
              this.$data.emailChangeDate = Date.now();
            }
            this.$data.secret = nanoid();
            sendVerification = true;
          }
        }
      } else if (
        this.guid != null &&
        this.$data.originalEmail != null &&
        this.$data.originalEmail !== this.$data.email &&
        // Make sure the user has at least the rate limit time to cancel an email change.
        (this.$data.emailChangeDate == null ||
          this.$data.emailChangeDate <
            strtotime('-' + Tilmeld.config.emailRateLimit) * 1000)
      ) {
        // The user doesn't need to verify their new email address, but should be able to cancel the
        // email change from their old address.
        this.$data.cancelEmailAddress = this.$data.originalEmail;
        this.$data.cancelEmailSecret = nanoid();
        sendVerification = true;
      }
    }

    if (
      (this.$data.password == null || this.$data.password === '') &&
      (this.$passwordTemp == null || this.$passwordTemp === '')
    ) {
      throw new BadDataError('A password is required.');
    }

    if (this.$passwordTemp != null && this.$passwordTemp !== '') {
      this.$password(this.$passwordTemp);
    }
    delete this.$passwordTemp;

    try {
      Tilmeld.config.validatorUser(this);
    } catch (e) {
      throw new BadDataError(e.message);
    }

    if (!(await Nymph.startTransaction())) {
      return false;
    }

    if (
      this.$data.group &&
      this.$data.group.user &&
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
      } catch (e) {
        await Nymph.rollback();
        throw e;
      }
    }

    let ret: boolean;

    try {
      ret = await super.$save();
    } catch (e) {
      await Nymph.rollback();
      throw e;
    }
    if (ret) {
      if (sendVerification) {
        // The email has changed, so send a new verification email.
        await this.$sendEmailVerification();
      }

      if (User.current(true).$is(this)) {
        // Update the user in the session cache.
        Tilmeld.fillSession(this);
      }

      this.$descendantGroups = undefined;
      this.$gatekeeperCache = undefined;
      await Nymph.commit();
    } else {
      await Nymph.rollback();
    }
    return ret;
  }

  /**
   * This should *never* be accessible on the client.
   */
  public $saveSkipAC() {
    this.$skipAcWhenSaving = true;
    return this.$save();
  }

  public $tilmeldSaveSkipAC() {
    if (this.$skipAcWhenSaving) {
      this.$skipAcWhenSaving = false;
      return true;
    }
    return false;
  }

  public async $delete() {
    if (!Tilmeld.gatekeeper('tilmeld/admin')) {
      throw new BadDataError("You don't have the authority to delete users.");
    }
    if (
      !Tilmeld.gatekeeper('system/admin') &&
      this.$gatekeeper('system/admin')
    ) {
      throw new BadDataError(
        "You don't have the authority to delete system admins."
      );
    }
    if (User.current(true).$is(this)) {
      this.$logout();
    }
    return await super.$delete();
  }
}

Nymph.setEntityClass(User.class, User);
