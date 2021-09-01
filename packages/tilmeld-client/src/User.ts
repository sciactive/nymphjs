import { Nymph, Entity, PubSub } from '@nymphjs/client';

import Group, { GroupData } from './Group';

export type EventType = 'register' | 'login' | 'logout';
export type RegisterCallback = (user: User & CurrentUserData) => void;
export type LoginCallback = (user: User & CurrentUserData) => void;
export type LogoutCallback = (user: User & UserData) => void;

export type ClientConfig = {
  regFields: string[];
  emailUsernames: boolean;
  allowRegistration: boolean;
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
  group?: Group & GroupData;
  /**
   * The user's secondary groups.
   */
  groups?: (Group & GroupData)[];
  /**
   * Whether the user should inherit the abilities of his groups.
   */
  inheritAbilities?: boolean;
};

export type AdminUserData = CurrentUserData & {
  /**
   * Used to save the current email to send verification if it changes.
   */
  originalEmail?: string;

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
};

let currentToken: string | null = null;

export default class User extends Entity<UserData> {
  // The name of the server class
  public static class = 'User';
  private static registerCallbacks: RegisterCallback[] = [];
  private static loginCallbacks: LoginCallback[] = [];
  private static logoutCallbacks: LogoutCallback[] = [];
  private static clientConfig?: ClientConfig;
  private static clientConfigPromise?: Promise<ClientConfig>;
  private static currentUser?: User & CurrentUserData;
  private static currentUserPromise?: Promise<(User & CurrentUserData) | null>;
  private static removeNymphResponseListener?: () => void;

  /**
   * No need to call this function yourself. It is called when the class is
   * loaded. It adds listeners to Nymph to handle authentication changes.
   */
  public static init() {
    if (this.removeNymphResponseListener) {
      this.removeNymphResponseListener();
    }
    this.removeNymphResponseListener = Nymph.on('response', (response) =>
      User.handleToken(response)
    );
    User.handleToken();
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
  }): Promise<{ result: boolean; loggedin: boolean; message: string }> {
    const response = await this.$serverCall('$register', [data]);
    if (response.result) {
      for (let i = 0; i < User.registerCallbacks.length; i++) {
        User.registerCallbacks[i] && User.registerCallbacks[i](this);
      }
    }
    if (response.loggedin) {
      User.currentUser = this;
      User.handleToken();
      for (let i = 0; i < User.loginCallbacks.length; i++) {
        User.loginCallbacks[i] && User.loginCallbacks[i](this);
      }
    }
    return response;
  }

  public async $logout(): Promise<{ result: boolean; message: string }> {
    const response = await this.$serverCall('$logout', []);
    if (response.result) {
      User.currentUser = undefined;
      User.handleToken();
      for (let i = 0; i < User.logoutCallbacks.length; i++) {
        User.logoutCallbacks[i] && User.logoutCallbacks[i](this);
      }
    }
    return response;
  }

  public async $gatekeeper(ability?: string): Promise<boolean> {
    return await this.$serverCall('$gatekeeper', [ability], true);
  }

  public async $changePassword(data: {
    password: string;
    oldPassword: string;
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
    if (User.currentUser !== undefined) {
      return User.currentUser;
    }
    if (!User.currentUserPromise) {
      User.currentUserPromise = User.serverCallStatic('current', [false]).then(
        (user: (User & CurrentUserData) | null) => {
          User.currentUser = user ?? undefined;
          User.currentUserPromise = undefined;
          return user;
        }
      );
    }
    await User.currentUserPromise;
    if (User.currentUser == null) {
      return returnObjectIfNotExist ? User.factorySync() : null;
    }
    return User.currentUser;
  }

  public static async loginUser(data: {
    username: string;
    password: string;
  }): Promise<{
    result: boolean;
    message: string;
    user?: User & CurrentUserData;
  }> {
    const response = await User.serverCallStatic('loginUser', [data]);
    if (response.result) {
      User.currentUser = response.user;
      User.handleToken();
      for (let i = 0; i < User.loginCallbacks.length; i++) {
        User.loginCallbacks[i] && User.loginCallbacks[i](response.user);
      }
    }
    return response;
  }

  public static async sendRecoveryLink(data: {
    recoveryType: 'username' | 'password';
    account: string;
  }): Promise<{ result: boolean; message: string }> {
    return await User.serverCallStatic('sendRecoveryLink', [data]);
  }

  public static async recover(data: {
    username: string;
    secret: string;
    password: string;
  }): Promise<{ result: boolean; message: string }> {
    return await User.serverCallStatic('recover', [data]);
  }

  public static async getClientConfig(): Promise<ClientConfig> {
    if (User.clientConfig) {
      return User.clientConfig;
    }
    if (!User.clientConfigPromise) {
      User.clientConfigPromise = User.serverCallStatic(
        'getClientConfig',
        []
      ).then((config) => {
        User.clientConfig = config;
        User.clientConfigPromise = undefined;
        return config;
      });
    }
    return await User.clientConfigPromise;
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
          Nymph.setXsrfToken(null);
          if (PubSub.isConfigured()) {
            PubSub.setToken(null);
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
        Nymph.setXsrfToken(jwt.xsrfToken);
        if (PubSub.isConfigured()) {
          PubSub.setToken(token);
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
    if (!this.hasOwnProperty(prop)) {
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
    if (!this.hasOwnProperty(prop)) {
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

Nymph.setEntityClass(User.class, User);

User.init();
