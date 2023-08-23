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
  /**
   * If the user has changed their email address, this is the new one, awaiting
   * verification.
   */
  newEmailAddress?: string;
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
  /**
   * If set, this timestamp is the cutoff point for JWT issue dates. Any token
   * issued before this date will not authenticate the user.
   */
  revokeTokenDate?: number;
};

let currentToken: string | null = null;

type InstanceStore = {
  registerCallbacks: RegisterCallback[];
  loginCallbacks: LoginCallback[];
  logoutCallbacks: LogoutCallback[];
  clientConfig?: ClientConfig;
  clientConfigPromise?: Promise<ClientConfig>;
  removeNymphResponseListener?: () => void;
};

export default class User extends Entity<UserData> {
  protected static stores = new WeakMap<Nymph, InstanceStore>();

  // The name of the server class
  public static class = 'User';

  public static init(nymph: Nymph) {
    let store: InstanceStore = {
      registerCallbacks: [],
      loginCallbacks: [],
      logoutCallbacks: [],
    };

    if (User.stores.has(nymph)) {
      const storeVal = User.stores.get(nymph);

      if (storeVal) {
        store = storeVal;
      }
    }

    User.stores.set(nymph, store);

    if (store.removeNymphResponseListener) {
      store.removeNymphResponseListener();
    }
    store.removeNymphResponseListener = nymph.on('response', (response) =>
      this.handleToken(response)
    );
    this.handleToken();
  }

  constructor() {
    super();

    this.$data.enabled = true;
    (this.$data as CurrentUserData).abilities = [];
    (this.$data as CurrentUserData).groups = [];
    (this.$data as CurrentUserData).inheritAbilities = true;
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

  static factorySync(): User & UserData {
    return super.factorySync() as User & UserData;
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
    const store = User.stores.get(this.$nymph);
    if (store == null) {
      throw new Error(
        'This user class was never initialized with an instance of Nymph'
      );
    }

    const response = await this.$serverCall('$register', [data]);
    if (response.result) {
      for (let i = 0; i < store.registerCallbacks.length; i++) {
        store.registerCallbacks[i] && store.registerCallbacks[i](this);
      }
    }
    if (response.loggedin) {
      (this.constructor as typeof User).handleToken();
      for (let i = 0; i < store.loginCallbacks.length; i++) {
        store.loginCallbacks[i] && store.loginCallbacks[i](this);
      }
    }
    return response;
  }

  public async $switchUser(data?: {
    additionalData?: { [k: string]: any };
  }): Promise<{
    result: boolean;
    message: string;
  }> {
    const store = User.stores.get(this.$nymph);
    if (store == null) {
      throw new Error(
        'This user class was never initialized with an instance of Nymph'
      );
    }

    const response = await this.$serverCall('$switchUser', [data]);
    if (response.result) {
      (this.constructor as typeof User).handleToken();
      for (let i = 0; i < store.loginCallbacks.length; i++) {
        store.loginCallbacks[i] && store.loginCallbacks[i](this);
      }
    }
    return response;
  }

  public async $logout(): Promise<{ result: boolean; message: string }> {
    const store = User.stores.get(this.$nymph);
    if (store == null) {
      throw new Error(
        'This user class was never initialized with an instance of Nymph'
      );
    }

    const response = await this.$serverCall('$logout', []);
    if (response.result) {
      (this.constructor as typeof User).handleToken();
      for (let i = 0; i < store.logoutCallbacks.length; i++) {
        store.logoutCallbacks[i] && store.logoutCallbacks[i](this);
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
    revokeCurrentTokens?: boolean;
  }): Promise<{ result: boolean; message: string }> {
    return await this.$serverCall('$changePassword', [data]);
  }

  public async $revokeCurrentTokens(data: {
    password: string;
  }): Promise<{ result: boolean; message: string }> {
    return await this.$serverCall('$revokeCurrentTokens', [data]);
  }

  public async $hasTOTPSecret(): Promise<boolean> {
    return await this.$serverCall('$hasTOTPSecret', [], true);
  }

  public async $getNewTOTPSecret(): Promise<{
    uri: string;
    qrcode: string;
    secret: string;
  }> {
    return await this.$serverCall('$getNewTOTPSecret', [], true);
  }

  public async $saveTOTPSecret(data: {
    password: string;
    secret: string;
    code: string;
  }): Promise<{ result: boolean; message: string }> {
    return await this.$serverCall('$saveTOTPSecret', [data]);
  }

  public async $removeTOTPSecret(data?: {
    password: string;
    code: string;
  }): Promise<{ result: boolean; message: string }> {
    return await this.$serverCall('$removeTOTPSecret', [
      ...(data ? [data] : []),
    ]);
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
    code?: string;
    additionalData?: { [k: string]: any };
  }): Promise<{
    result: boolean;
    message: string;
    needTOTP?: true;
    user?: User & CurrentUserData;
  }> {
    const store = User.stores.get(this.nymph);
    if (store == null) {
      throw new Error(
        'This user class was never initialized with an instance of Nymph'
      );
    }

    const response = await this.serverCallStatic('loginUser', [data]);
    if (response.result) {
      this.handleToken();
      for (let i = 0; i < store.loginCallbacks.length; i++) {
        store.loginCallbacks[i] && store.loginCallbacks[i](response.user);
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
    const store = User.stores.get(this.nymph);
    if (store == null) {
      throw new Error(
        'This user class was never initialized with an instance of Nymph'
      );
    }

    if (store.clientConfig) {
      return store.clientConfig;
    }
    if (!store.clientConfigPromise) {
      store.clientConfigPromise = this.serverCallStatic(
        'getClientConfig',
        []
      ).then((config) => {
        store.clientConfig = config;
        store.clientConfigPromise = undefined;
        return config;
      });
    }
    return await store.clientConfigPromise;
  }

  private static handleToken(response?: Response) {
    let token: string | null = null;
    let switchToken: string | null = null;
    const authCookiePattern =
      /(?:(?:^|.*;\s*)TILMELDAUTH\s*=\s*([^;]*).*$)|^.*$/;
    const switchCookiePattern =
      /(?:(?:^|.*;\s*)TILMELDSWITCH\s*=\s*([^;]*).*$)|^.*$/;
    if (response && response.headers.has('X-TILMELDAUTH')) {
      token = response.headers.get('X-TILMELDAUTH');
      switchToken = response.headers.get('X-TILMELDSWITCH');
    } else if (
      typeof document !== 'undefined' &&
      document.cookie.match(authCookiePattern)
    ) {
      token = document.cookie.replace(authCookiePattern, '$1');
      switchToken = document.cookie.replace(switchCookiePattern, '$1');
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
          this.nymph.pubsub.setToken(token, switchToken);
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
    const store = User.stores.get(this.nymph);
    if (store == null) {
      throw new Error(
        'This user class was never initialized with an instance of Nymph'
      );
    }

    const prop = (event + 'Callbacks') as T extends 'register'
      ? 'registerCallbacks'
      : T extends 'login'
      ? 'loginCallbacks'
      : T extends 'logout'
      ? 'logoutCallbacks'
      : never;
    if (!(prop in store)) {
      throw new Error('Invalid event type.');
    }
    // @ts-ignore: The callback should always be the right type here.
    store[prop].push(callback);
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
    const store = User.stores.get(this.nymph);
    if (store == null) {
      throw new Error(
        'This user class was never initialized with an instance of Nymph'
      );
    }

    const prop = (event + 'Callbacks') as T extends 'register'
      ? 'registerCallbacks'
      : T extends 'login'
      ? 'loginCallbacks'
      : T extends 'logout'
      ? 'logoutCallbacks'
      : never;
    if (!(prop in store)) {
      return false;
    }
    // @ts-ignore: The callback should always be the right type here.
    const i = store[prop].indexOf(callback);
    if (i > -1) {
      // @ts-ignore: The callback should always be the right type here.
      store[prop].splice(i, 1);
    }
    return true;
  }
}
