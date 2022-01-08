import { Nymph, Entity } from '@nymphjs/client';

import type Group from './Group';
import type { AdminGroupData, CurrentGroupData } from './Group';

export type EventType = 'register' | 'login' | 'logout';
export type RegisterCallback = (user: User & CurrentUserData) => void;
export type LoginCallback = (user: User & CurrentUserData) => void;
export type LogoutCallback = (user: User & UserData) => void;

export type ClientConfig = {
  regFields: string[];
  userFields: string[];
  emailUsernames: boolean;
  allowRegistration: boolean;
  allowUsernameChange: boolean;
  pwRecovery: boolean;
  verifyEmail: boolean;
  unverifiedAccess: boolean;
};

export type UserData = {
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
   * The user's avatar URL. (Use $getAvatar() to support Gravatar.)
   */
  avatar?: string;

  /**
   * Whether the user can log in.
   */
  enabled?: boolean;
};

export type CurrentUserData = UserData & {
  /**
   * The abilities granted to the user.
   */
  abilities?: string[];
  /**
   * The user's email address.
   */
  email?: string;
  /**
   * The user's telephone number.
   */
  phone?: string;
  /**
   * The user's primary group.
   */
  group?: Group & CurrentGroupData;
  /**
   * The user's secondary groups.
   */
  groups?: (Group & CurrentGroupData)[];
  /**
   * Whether the user should inherit the abilities of his groups.
   */
  inheritAbilities?: boolean;
};

export type AdminUserData = CurrentUserData & {
  /**
   * The user's primary group.
   */
  group?: Group & AdminGroupData;
  /**
   * The user's secondary groups.
   */
  groups?: (Group & AdminGroupData)[];
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
   * Used by admins to change a user's password. Not saved to the database.
   */
  passwordTemp?: string;
};

let currentToken: string | null = null;

export default class User extends Entity<UserData> {
  /**
   * Adds listeners to Nymph to handle authentication changes.
   */
  public static set nymph(value: Nymph) {
    this.nymphValue = value;

    if (this.removeNymphResponseListener) {
      this.removeNymphResponseListener();
    }
    this.removeNymphResponseListener = this.nymph.on('response', (response) =>
      this.handleToken(response)
    );
    this.handleToken();
  }
  public static get nymph() {
    return this.nymphValue;
  }
  protected static nymphValue: Nymph;
  // The name of the server class
  public static class = 'User';
  protected static registerCallbacks: RegisterCallback[] = [];
  protected static loginCallbacks: LoginCallback[] = [];
  protected static logoutCallbacks: LogoutCallback[] = [];
  protected static clientConfig?: ClientConfig;
  protected static clientConfigPromise?: Promise<ClientConfig>;
  protected static removeNymphResponseListener?: () => void;

  public static clone(): typeof User {
    class UserClone extends User {
      public static set nymph(value: Nymph) {
        this.nymphValue = value;

        if (this.removeNymphResponseListener) {
          this.removeNymphResponseListener();
        }
        this.removeNymphResponseListener = this.nymph.on(
          'response',
          (response) => this.handleToken(response)
        );
        this.handleToken();
      }
      public static get nymph() {
        return this.nymphValue;
      }
      protected static nymphValue: Nymph;
      protected static registerCallbacks: RegisterCallback[] = [];
      protected static loginCallbacks: LoginCallback[] = [];
      protected static logoutCallbacks: LogoutCallback[] = [];
      protected static clientConfig?: ClientConfig;
      protected static clientConfigPromise?: Promise<ClientConfig>;
      protected static removeNymphResponseListener?: () => void;
    }

    return UserClone;
  }

  constructor(guid?: string) {
    super(guid);

    if (guid == null) {
      this.$data.enabled = true;
      (this.$data as CurrentUserData).abilities = [];
      (this.$data as CurrentUserData).groups = [];
      (this.$data as CurrentUserData).inheritAbilities = true;
    }
  }

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

  public async $checkUsername(): Promise<{
    result: boolean;
    message: string;
  }> {
    return await this.$serverCall('$checkUsername', [], true);
  }

  public async $checkEmail(): Promise<{
    result: boolean;
    message: string;
  }> {
    return await this.$serverCall('$checkEmail', [], true);
  }

  public async $checkPhone(): Promise<{
    result: boolean;
    message: string;
  }> {
    return await this.$serverCall('$checkPhone', [], true);
  }

  public async $getAvatar(): Promise<string> {
    return await this.$serverCall('$getAvatar', [], true);
  }

  public async $register(data: {
    password: string;
    additionalData?: { [k: string]: any };
  }): Promise<{ result: boolean; loggedin: boolean; message: string }> {
    const UserClass = this.constructor as typeof User;
    const response = await this.$serverCall('$register', [data]);
    if (response.result) {
      for (let i = 0; i < UserClass.registerCallbacks.length; i++) {
        UserClass.registerCallbacks[i] && UserClass.registerCallbacks[i](this);
      }
    }
    if (response.loggedin) {
      UserClass.handleToken();
      for (let i = 0; i < UserClass.loginCallbacks.length; i++) {
        UserClass.loginCallbacks[i] && UserClass.loginCallbacks[i](this);
      }
    }
    return response;
  }

  public async $logout(): Promise<{ result: boolean; message: string }> {
    const UserClass = this.constructor as typeof User;
    const response = await this.$serverCall('$logout', []);
    if (response.result) {
      UserClass.handleToken();
      for (let i = 0; i < UserClass.logoutCallbacks.length; i++) {
        UserClass.logoutCallbacks[i] && UserClass.logoutCallbacks[i](this);
      }
    }
    return response;
  }

  public async $gatekeeper(ability?: string): Promise<boolean> {
    return await this.$serverCall('$gatekeeper', [ability], true);
  }

  public async $changePassword(data: {
    newPassword: string;
    currentPassword: string;
  }): Promise<{ result: boolean; message: string }> {
    return await this.$serverCall('$changePassword', [data]);
  }

  public static async current(
    returnObjectIfNotExist: true
  ): Promise<User & CurrentUserData>;
  public static async current(
    returnObjectIfNotExist?: false
  ): Promise<(User & CurrentUserData) | null>;
  public static async current(
    returnObjectIfNotExist?: boolean
  ): Promise<(User & CurrentUserData) | null> {
    const currentUser = await this.serverCallStatic('current', [false]);
    if (currentUser == null) {
      return returnObjectIfNotExist ? this.factorySync() : null;
    }
    return currentUser;
  }

  public static async loginUser(data: {
    username: string;
    password: string;
    additionalData?: { [k: string]: any };
  }): Promise<{
    result: boolean;
    message: string;
    user?: User & CurrentUserData;
  }> {
    const response = await this.serverCallStatic('loginUser', [data]);
    if (response.result) {
      this.handleToken();
      for (let i = 0; i < this.loginCallbacks.length; i++) {
        this.loginCallbacks[i] && this.loginCallbacks[i](response.user);
      }
    }
    return response;
  }

  public static async sendRecovery(data: {
    recoveryType: 'username' | 'password';
    account: string;
  }): Promise<{ result: boolean; message: string }> {
    return await this.serverCallStatic('sendRecovery', [data]);
  }

  public static async recover(data: {
    username: string;
    secret: string;
    password: string;
  }): Promise<{ result: boolean; message: string }> {
    return await this.serverCallStatic('recover', [data]);
  }

  public static async getClientConfig(): Promise<ClientConfig> {
    if (this.clientConfig) {
      return this.clientConfig;
    }
    if (!this.clientConfigPromise) {
      this.clientConfigPromise = this.serverCallStatic(
        'getClientConfig',
        []
      ).then((config) => {
        this.clientConfig = config;
        this.clientConfigPromise = undefined;
        return config;
      });
    }
    return await this.clientConfigPromise;
  }

  private static handleToken(response?: Response) {
    let token: string | null = null;
    const authCookiePattern =
      /(?:(?:^|.*;\s*)TILMELDAUTH\s*=\s*([^;]*).*$)|^.*$/;
    if (response && response.headers.has('X-TILMELDAUTH')) {
      token = response.headers.get('X-TILMELDAUTH');
    } else if (
      typeof document !== 'undefined' &&
      document.cookie.match(authCookiePattern)
    ) {
      token = document.cookie.replace(authCookiePattern, '$1');
    } else {
      return;
    }
    if (currentToken !== token) {
      if (token == null || token === '') {
        if (currentToken != null) {
          this.nymph.setXsrfToken(null);
          if (this.nymph.pubsub) {
            this.nymph.pubsub.setToken(null);
          }
          currentToken = null;
        }
      } else {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const json =
          typeof atob === 'undefined'
            ? Buffer.from(base64, 'base64').toString('binary') // node
            : atob(base64); // browser
        const jwt = JSON.parse(json);
        this.nymph.setXsrfToken(jwt.xsrfToken);
        if (this.nymph.pubsub) {
          this.nymph.pubsub.setToken(token);
        }
        currentToken = token;
      }
    }
  }

  public static on<T extends EventType>(
    event: T,
    callback: T extends 'register'
      ? RegisterCallback
      : T extends 'login'
      ? LoginCallback
      : T extends 'logout'
      ? LogoutCallback
      : never
  ) {
    const prop = (event + 'Callbacks') as T extends 'register'
      ? 'registerCallbacks'
      : T extends 'login'
      ? 'loginCallbacks'
      : T extends 'logout'
      ? 'logoutCallbacks'
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
    callback: T extends 'register'
      ? RegisterCallback
      : T extends 'login'
      ? LoginCallback
      : T extends 'logout'
      ? LogoutCallback
      : never
  ) {
    const prop = (event + 'Callbacks') as T extends 'register'
      ? 'registerCallbacks'
      : T extends 'login'
      ? 'loginCallbacks'
      : T extends 'logout'
      ? 'logoutCallbacks'
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
