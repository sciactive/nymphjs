import type { Request, Response } from 'express';

import { EntityConstructor, EntityInterface } from './Entity.types';
import Nymph from './Nymph';
import Entity from './Entity';

export type NymphEventType =
  | 'connect'
  | 'disconnect'
  | 'query'
  | 'beforeGetEntity'
  | 'beforeGetEntities'
  | 'beforeSaveEntity'
  | 'afterSaveEntity'
  | 'failedSaveEntity'
  | 'beforeDeleteEntity'
  | 'afterDeleteEntity'
  | 'failedDeleteEntity'
  | 'beforeDeleteEntityByID'
  | 'afterDeleteEntityByID'
  | 'failedDeleteEntityByID'
  | 'beforeNewUID'
  | 'afterNewUID'
  | 'failedNewUID'
  | 'beforeSetUID'
  | 'afterSetUID'
  | 'failedSetUID'
  | 'beforeRenameUID'
  | 'afterRenameUID'
  | 'failedRenameUID'
  | 'beforeDeleteUID'
  | 'afterDeleteUID'
  | 'failedDeleteUID'
  | 'beforeStartTransaction'
  | 'afterStartTransaction'
  | 'beforeCommitTransaction'
  | 'afterCommitTransaction'
  | 'beforeRollbackTransaction'
  | 'afterRollbackTransaction';
export type NymphConnectCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
export type NymphDisconnectCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
/**
 * The NymphQueryCallback will be called on both top level and qref queries.
 *
 * This is the only callback that is not asynchronous.
 *
 * This also isn't necessarily run on every "query". It is run before a database
 * query for an entity, but it is not run during PubSub entity change
 * propagation. Therefore, it shouldn't do anything _entity_ specific, instead
 * it should be _query_ specific. For example, throw an error if the user is not
 * permitted to run the query at all.
 */
export type NymphQueryCallback = (
  nymph: Nymph,
  options: Options,
  selectors: FormattedSelector[]
) => void;
export type NymphBeforeGetEntityCallback = (
  nymph: Nymph,
  options: Options,
  selectors: Selector[]
) => Promise<void>;
export type NymphBeforeGetEntitiesCallback = (
  nymph: Nymph,
  options: Options,
  selectors: Selector[]
) => Promise<void>;
export type NymphBeforeSaveEntityCallback = (
  nymph: Nymph,
  entity: EntityInterface
) => Promise<void>;
export type NymphAfterSaveEntityCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
export type NymphFailedSaveEntityCallback = (
  nymph: Nymph,
  error: any
) => Promise<void>;
export type NymphBeforeDeleteEntityCallback = (
  nymph: Nymph,
  entity: EntityInterface
) => Promise<void>;
export type NymphAfterDeleteEntityCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
export type NymphFailedDeleteEntityCallback = (
  nymph: Nymph,
  error: any
) => Promise<void>;
export type NymphBeforeDeleteEntityByIDCallback = (
  nymph: Nymph,
  guid: string,
  className?: string
) => Promise<void>;
export type NymphAfterDeleteEntityByIDCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
export type NymphFailedDeleteEntityByIDCallback = (
  nymph: Nymph,
  error: any
) => Promise<void>;
export type NymphBeforeNewUIDCallback = (
  nymph: Nymph,
  name: string
) => Promise<void>;
export type NymphAfterNewUIDCallback = (
  nymph: Nymph,
  result: Promise<number | null>
) => Promise<void>;
export type NymphFailedNewUIDCallback = (
  nymph: Nymph,
  error: any
) => Promise<void>;
export type NymphBeforeSetUIDCallback = (
  nymph: Nymph,
  name: string,
  value: number
) => Promise<void>;
export type NymphAfterSetUIDCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
export type NymphFailedSetUIDCallback = (
  nymph: Nymph,
  error: any
) => Promise<void>;
export type NymphBeforeRenameUIDCallback = (
  nymph: Nymph,
  oldName: string,
  newName: string
) => Promise<void>;
export type NymphAfterRenameUIDCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
export type NymphFailedRenameUIDCallback = (
  nymph: Nymph,
  error: any
) => Promise<void>;
export type NymphBeforeDeleteUIDCallback = (
  nymph: Nymph,
  name: string
) => Promise<void>;
export type NymphAfterDeleteUIDCallback = (
  nymph: Nymph,
  result: Promise<boolean>
) => Promise<void>;
export type NymphFailedDeleteUIDCallback = (
  nymph: Nymph,
  error: any
) => Promise<void>;
export type NymphBeforeStartTransactionCallback = (
  nymph: Nymph,
  name: string
) => Promise<void>;
export type NymphAfterStartTransactionCallback = (
  nymph: Nymph,
  name: string,
  result: Nymph
) => Promise<void>;
export type NymphBeforeCommitTransactionCallback = (
  nymph: Nymph,
  name: string
) => Promise<void>;
export type NymphAfterCommitTransactionCallback = (
  nymph: Nymph,
  name: string,
  result: boolean
) => Promise<void>;
export type NymphBeforeRollbackTransactionCallback = (
  nymph: Nymph,
  name: string
) => Promise<void>;
export type NymphAfterRollbackTransactionCallback = (
  nymph: Nymph,
  name: string,
  result: boolean
) => Promise<void>;

export type Options<T extends EntityConstructor = EntityConstructor> = {
  class?: T;
  limit?: number;
  offset?: number;
  reverse?: boolean;
  sort?: 'cdate' | 'mdate' | string;
  return?: 'entity' | 'guid' | 'count';
  source?: string;
  skipCache?: boolean;
  skipAc?: boolean;
};

export type Clause<C> = C | Exclude<C, undefined>[];

export type OrWithTime<T> = T | [string, null, string];

type PrimitiveSelector = {
  guid?: string;
  '!guid'?: PrimitiveSelector['guid'];

  tag?: string;
  '!tag'?: PrimitiveSelector['tag'];

  defined?: string;
  '!defined'?: PrimitiveSelector['defined'];

  truthy?: string;
  '!truthy'?: PrimitiveSelector['truthy'];

  equal?: [string, any];
  '!equal'?: PrimitiveSelector['equal'];

  contain?: [string, any];
  '!contain'?: PrimitiveSelector['contain'];

  match?: [string, string];
  '!match'?: PrimitiveSelector['match'];

  imatch?: [string, string];
  '!imatch'?: PrimitiveSelector['imatch'];

  like?: [string, string];
  '!like'?: PrimitiveSelector['like'];

  ilike?: [string, string];
  '!ilike'?: PrimitiveSelector['ilike'];

  gt?: [string, number];
  '!gt'?: PrimitiveSelector['gt'];

  gte?: [string, number];
  '!gte'?: PrimitiveSelector['gte'];

  lt?: [string, number];
  '!lt'?: PrimitiveSelector['lt'];

  lte?: [string, number];
  '!lte'?: PrimitiveSelector['lte'];

  ref?: [string, EntityInterface | string];
  '!ref'?: PrimitiveSelector['ref'];

  qref?: [string, [Options, ...PrimitiveSelector[]]];
  '!qref'?: PrimitiveSelector['qref'];

  selector?: PrimitiveSelector;
  '!selector'?: PrimitiveSelector['selector'];
};

export type Selector = {
  type: '&' | '|' | '!&' | '!|';

  guid?: Clause<PrimitiveSelector['guid']>;
  '!guid'?: Clause<PrimitiveSelector['guid']>;

  tag?: Clause<PrimitiveSelector['tag']>;
  '!tag'?: Clause<PrimitiveSelector['tag']>;

  defined?: Clause<PrimitiveSelector['defined']>;
  '!defined'?: Clause<PrimitiveSelector['defined']>;

  truthy?: Clause<PrimitiveSelector['truthy']>;
  '!truthy'?: Clause<PrimitiveSelector['truthy']>;

  equal?: Clause<OrWithTime<PrimitiveSelector['equal']>>;
  '!equal'?: Clause<OrWithTime<PrimitiveSelector['equal']>>;

  contain?: Clause<OrWithTime<PrimitiveSelector['contain']>>;
  '!contain'?: Clause<OrWithTime<PrimitiveSelector['contain']>>;

  match?: Clause<PrimitiveSelector['match']>;
  '!match'?: Clause<PrimitiveSelector['match']>;

  imatch?: Clause<PrimitiveSelector['imatch']>;
  '!imatch'?: Clause<PrimitiveSelector['imatch']>;

  like?: Clause<PrimitiveSelector['like']>;
  '!like'?: Clause<PrimitiveSelector['like']>;

  ilike?: Clause<PrimitiveSelector['ilike']>;
  '!ilike'?: Clause<PrimitiveSelector['ilike']>;

  gt?: Clause<OrWithTime<PrimitiveSelector['gt']>>;
  '!gt'?: Clause<OrWithTime<PrimitiveSelector['gt']>>;

  gte?: Clause<OrWithTime<PrimitiveSelector['gte']>>;
  '!gte'?: Clause<OrWithTime<PrimitiveSelector['gte']>>;

  lt?: Clause<OrWithTime<PrimitiveSelector['lt']>>;
  '!lt'?: Clause<OrWithTime<PrimitiveSelector['lt']>>;

  lte?: Clause<OrWithTime<PrimitiveSelector['lte']>>;
  '!lte'?: Clause<OrWithTime<PrimitiveSelector['lte']>>;

  ref?: Clause<PrimitiveSelector['ref']>;
  '!ref'?: Clause<PrimitiveSelector['ref']>;

  qref?: Clause<[string, [Options, ...Selector[]]]>;
  '!qref'?: Selector['qref'];

  selector?: Clause<Selector>;
  '!selector'?: Selector['selector'];
};

export type FormattedSelector = {
  type: '&' | '|' | '!&' | '!|';

  guid?: PrimitiveSelector['guid'][][];
  '!guid'?: PrimitiveSelector['guid'][][];

  tag?: PrimitiveSelector['tag'][][];
  '!tag'?: PrimitiveSelector['tag'][][];

  defined?: PrimitiveSelector['defined'][][];
  '!defined'?: PrimitiveSelector['defined'][][];

  truthy?: PrimitiveSelector['truthy'][][];
  '!truthy'?: PrimitiveSelector['truthy'][][];

  equal?: PrimitiveSelector['equal'][];
  '!equal'?: PrimitiveSelector['equal'][];

  contain?: PrimitiveSelector['contain'][];
  '!contain'?: PrimitiveSelector['contain'][];

  match?: PrimitiveSelector['match'][];
  '!match'?: PrimitiveSelector['match'][];

  imatch?: PrimitiveSelector['imatch'][];
  '!imatch'?: PrimitiveSelector['imatch'][];

  like?: PrimitiveSelector['like'][];
  '!like'?: PrimitiveSelector['like'][];

  ilike?: PrimitiveSelector['ilike'][];
  '!ilike'?: PrimitiveSelector['ilike'][];

  gt?: PrimitiveSelector['gt'][];
  '!gt'?: PrimitiveSelector['gt'][];

  gte?: PrimitiveSelector['gte'][];
  '!gte'?: PrimitiveSelector['gte'][];

  lt?: PrimitiveSelector['lt'][];
  '!lt'?: PrimitiveSelector['lt'][];

  lte?: PrimitiveSelector['lte'][];
  '!lte'?: PrimitiveSelector['lte'][];

  ref?: PrimitiveSelector['ref'][];
  '!ref'?: PrimitiveSelector['ref'][];

  qref?: [string, [Options, ...FormattedSelector[]]][];
  '!qref'?: FormattedSelector['qref'];

  selector?: FormattedSelector[];
  '!selector'?: FormattedSelector['selector'];
};

export enum TilmeldAccessLevels {
  NO_ACCESS = 0,
  READ_ACCESS = 1,
  WRITE_ACCESS = 2,
  // Keeping 3 open in case we ever need one between write and full.
  FULL_ACCESS = 4,
}

export interface TilmeldInterface {
  nymph: Nymph;
  currentUser: (UserInterface & UserData) | null;
  User: UserConstructor;
  Group: GroupConstructor;
  request: Request | null;
  response: Response | null;
  clone(): TilmeldInterface;
  init(nymph: Nymph): void;
  gatekeeper(ability?: string): boolean;
  addAccessControlSelectors(
    options: Options,
    selectors: FormattedSelector[]
  ): void;
  checkPermissions(
    entity: EntityInterface & AccessControlData,
    type?: TilmeldAccessLevels,
    user?: (UserInterface & UserData) | false
  ): boolean;
  checkClientUIDPermissions(
    name: string,
    type?: TilmeldAccessLevels,
    user?: (UserInterface & UserData) | false
  ): boolean;
  fillSession(user: UserInterface & UserData): void;
  clearSession(): void;
  extractToken(token: string): Promise<(UserInterface & UserData) | null>;
  authenticate(skipXsrfToken?: boolean): boolean;
  login(
    user: UserInterface & UserData,
    sendAuthHeader: boolean,
    sendCookie?: boolean
  ): boolean;
  loginSwitch(
    user: UserInterface & UserData,
    sendAuthHeader: boolean,
    sendCookie?: boolean
  ): boolean;
  logout(clearCookie?: boolean): void;
  logoutSwitch(clearCookie?: boolean): void;
}

export type AccessControlData = {
  user?: UserInterface & UserData;
  group?: GroupInterface & GroupData;
  acUser?: number;
  acGroup?: number;
  acOther?: number;
  acFull?: ((UserInterface & UserData) | (GroupInterface & GroupData))[];
  acWrite?: ((UserInterface & UserData) | (GroupInterface & GroupData))[];
  acRead?: ((UserInterface & UserData) | (GroupInterface & GroupData))[];
};

export type TilmeldUserEventType =
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
  user: UserInterface & UserData,
  data: { username: string }
) => Promise<{ result: boolean; message?: string }>;

/**
 * Theses are run before the user data checks, so the only checks before are
 * whether registration is allowed and whether the user is already registered.
 */
export type TilmeldBeforeRegisterCallback = (
  user: UserInterface & UserData,
  data: { password: string; additionalData?: { [k: string]: any } }
) => Promise<void>;
export type TilmeldAfterRegisterCallback = (
  user: UserInterface & UserData,
  result: { loggedin: boolean; message: string }
) => Promise<void>;

/**
 * These are run after the authentication checks, but before the login action.
 */
export type TilmeldBeforeLoginCallback = (
  user: UserInterface & UserData,
  data: {
    username: string;
    password: string;
    additionalData?: { [k: string]: any };
  }
) => Promise<void>;

/**
 * This is run before the transaction is committed, and you can perform
 * additional functions on the transaction, which is available in `user.$nymph`.
 */
export type TilmeldAfterLoginCallback = (
  user: UserInterface & UserData
) => Promise<void>;
export type TilmeldBeforeLogoutCallback = (
  user: UserInterface & UserData
) => Promise<void>;
export type TilmeldAfterLogoutCallback = (
  user: UserInterface & UserData
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
  group?: GroupInterface & GroupData;
  /**
   * The user's secondary groups.
   */
  groups?: (GroupInterface & GroupData)[];
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

export interface UserInterface extends Entity<UserData> {
  $originalEmail?: string;
  $login(data: {
    username: string;
    password: string;
    additionalData?: {
      [k: string]: any;
    };
  }): Promise<{
    result: boolean;
    message: any;
  }>;
  $switchUser(data?: {
    additionalData?: {
      [k: string]: any;
    };
  }): Promise<{
    result: boolean;
    message: any;
  }>;
  $logout(): Promise<{
    result: boolean;
    message: any;
  }>;
  $grant(ability: string): void;
  $revoke(ability: string): void;
  $getAvatar(): string;
  $getDescendantGroups(): Promise<(GroupInterface & GroupData)[]>;
  $getDescendantGroupsSync(): (GroupInterface & GroupData)[];
  $updateDataProtection(givenUser?: UserInterface & UserData): void;
  $gatekeeper(ability?: string): boolean;
  $clearCache(): void;
  $sendEmailVerification(): Promise<boolean>;
  $addGroup(
    group: GroupInterface & GroupData
  ): true | (GroupInterface & GroupData)[];
  $checkPassword(password: string): boolean;
  $delGroup(
    group: GroupInterface & GroupData
  ): true | (GroupInterface & GroupData)[];
  $inGroup(group: (GroupInterface & GroupData) | string): boolean;
  $isDescendant(group: (GroupInterface & GroupData) | string): boolean;
  $changePassword(data: {
    newPassword: string;
    currentPassword: string;
  }): Promise<{
    result: boolean;
    message: string;
  }>;
  $password(password: string): string;
  $checkUsername(): Promise<{
    result: boolean;
    message: string;
  }>;
  $checkEmail(): Promise<{
    result: boolean;
    message: string;
  }>;
  $checkPhone(): Promise<{
    result: boolean;
    message: string;
  }>;
  $register(data: {
    password: string;
    additionalData?: {
      [k: string]: any;
    };
  }): Promise<{
    result: boolean;
    loggedin: boolean;
    message: string;
  }>;
  $saveSkipAC(): Promise<boolean>;
}

export type UserConstructor = EntityConstructor &
  (new (...args: any[]) => UserInterface) & {
    tilmeld: TilmeldInterface;
    ETYPE: string;
    class: string;
    clientEnabledStaticMethods: string[];
    searchRestrictedData: string[];
    factory(guid?: string): Promise<UserInterface & UserData>;
    factoryUsername(username?: string): Promise<UserInterface & UserData>;
    factorySync(guid?: string): UserInterface & UserData;
    current(returnObjectIfNotExist: true): UserInterface & UserData;
    current(returnObjectIfNotExist?: false): (UserInterface & UserData) | null;
    sendRecovery(data: {
      recoveryType: 'username' | 'password';
      account: string;
    }): Promise<{
      result: boolean;
      message: string;
    }>;
    recover(data: {
      username: string;
      secret: string;
      password: string;
    }): Promise<{
      result: boolean;
      message: string;
    }>;
    getClientConfig(): {
      regFields: string[];
      userFields: string[];
      emailUsernames: boolean;
      allowRegistration: boolean;
      allowUsernameChange: boolean;
      pwRecovery: boolean;
      verifyEmail: boolean;
      unverifiedAccess: boolean;
    };
    loginUser(data: {
      username: string;
      password: string;
      additionalData?: {
        [k: string]: any;
      };
    }): Promise<{
      result: boolean;
      message: string;
      user?: (UserInterface & UserData) | undefined;
    }>;
    on<T extends TilmeldUserEventType>(
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
        : never
    ): () => boolean;
    off<T extends TilmeldUserEventType>(
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
        : never
    ): boolean;
  };

export type GroupData = {
  /**
   * The abilities granted to the group.
   */
  abilities?: string[];
  /**
   * The group's groupname.
   */
  groupname?: string;
  /**
   * The group's name.
   */
  name?: string;
  /**
   * The group's email address.
   */
  email?: string;
  /**
   * The group's avatar URL. (Use getAvatar() to support Gravatar.)
   */
  avatar?: string;
  /**
   * The group's telephone number.
   */
  phone?: string;
  /**
   * The group's parent.
   */
  parent?: GroupInterface & GroupData;
  /**
   * If generatePrimary is on, this will be the user who generated this group.
   */
  user?: (UserInterface & UserData) | null;

  /**
   * Whether the group can be used.
   */
  enabled?: boolean;
  /**
   * Whether this group is the default primary group for new users.
   */
  defaultPrimary?: boolean;
  /**
   * Whether this group is a default secondary group for new users.
   */
  defaultSecondary?: boolean;
  /**
   * Whether this group is a default secondary group for unverified users.
   */
  unverifiedSecondary?: boolean;
};

export interface GroupInterface extends Entity<GroupData> {
  $grant(ability: string): void;
  $revoke(ability: string): void;
  $getAvatar(): string;
  $updateDataProtection(givenUser?: UserInterface & UserData): void;
  $isDescendant(givenGroup: (GroupInterface & GroupData) | string): boolean;
  $getChildren(): Promise<any[]>;
  $getDescendants(andSelf?: boolean): Promise<(GroupInterface & GroupData)[]>;
  $getDescendantsSync(andSelf?: boolean): (GroupInterface & GroupData)[];
  $getLevel(): number;
  $getUsers(
    descendants?: boolean,
    limit?: number,
    offset?: number
  ): Promise<(UserInterface & UserData)[]>;
  $checkGroupname(): Promise<{
    result: boolean;
    message: string;
  }>;
  $checkEmail(): Promise<{
    result: boolean;
    message: string;
  }>;
  $saveSkipAC(): Promise<boolean>;
}

export type GroupConstructor = EntityConstructor &
  (new (...args: any[]) => GroupInterface) & {
    tilmeld: TilmeldInterface;
    clientEnabledStaticMethods: string[];
    searchRestrictedData: string[];
    factory(guid?: string): Promise<GroupInterface & GroupData>;
    factoryGroupname(groupname?: string): Promise<GroupInterface & GroupData>;
    factorySync(guid?: string): GroupInterface & GroupData;
    getPrimaryGroups(
      options?: Options,
      selectors?: Selector[]
    ): Promise<(GroupInterface & GroupData)[]>;
    getSecondaryGroups(
      options?: Options,
      selectors?: Selector[]
    ): Promise<(GroupInterface & GroupData)[]>;
  };
