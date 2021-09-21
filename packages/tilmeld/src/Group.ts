import {
  EntityData,
  EntityInterface,
  EntityJson,
  EntityPatch,
  Options,
  Selector,
  SerializedEntityData,
} from '@nymphjs/nymph';
import md5 from 'crypto-js/md5';
import { difference } from 'lodash';

import AbleObject from './AbleObject';
import {
  BadDataError,
  BadEmailError,
  BadUsernameError,
  CouldNotChangeDefaultPrimaryGroupError,
} from './errors';
import Tilmeld from './Tilmeld';
import User, { UserData } from './User';

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
  parent?: Group & GroupData;
  /**
   * If generatePrimary is on, this will be the user who generated this group.
   */
  user?: (User & UserData) | null;

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

export default class Group extends AbleObject<GroupData> {
  /**
   * The instance of Tilmeld to use for queries.
   */
  public static tilmeld: Tilmeld;
  static ETYPE = 'tilmeld_group';
  static class = 'Group';

  private static DEFAULT_PRIVATE_DATA = ['email', 'phone', 'abilities', 'user'];
  private static DEFAULT_ALLOWLIST_DATA: string[] = [];

  protected $tags = [];
  protected $clientEnabledMethods = [
    '$checkGroupname',
    '$checkEmail',
    '$getAvatar',
    '$getChildren',
    '$getDescendants',
    '$getLevel',
    '$isDescendant',
  ];
  public static clientEnabledStaticMethods = [
    'getPrimaryGroups',
    'getSecondaryGroups',
  ];
  protected $privateData = Group.DEFAULT_PRIVATE_DATA;
  public static searchRestrictedData = Group.DEFAULT_PRIVATE_DATA;
  protected $allowlistData? = Group.DEFAULT_ALLOWLIST_DATA;
  protected $allowlistTags?: string[] = [];

  /**
   * This is explicitly used only during the registration proccess.
   */
  private $skipAcWhenSaving = false;

  static async factory(guid?: string): Promise<Group & GroupData> {
    return (await super.factory(guid)) as Group & GroupData;
  }

  static async factoryGroupname(
    groupname?: string
  ): Promise<Group & GroupData> {
    const entity = new this();
    if (groupname != null) {
      const entity = await this.nymph.getEntity(
        {
          class: this,
        },
        {
          type: '&',
          ilike: ['groupname', groupname.replace(/([\\%_])/g, (s) => `\\${s}`)],
        }
      );
      if (entity != null) {
        return entity;
      }
    }
    return entity;
  }

  static factorySync(guid?: string): Group & GroupData {
    return super.factorySync(guid) as Group & GroupData;
  }

  constructor(guid?: string) {
    super(guid);

    if (this.guid == null) {
      // Defaults.
      this.$data.enabled = true;
      this.$data.abilities = [];
      this.$updateDataProtection();
    }
  }

  /**
   * Get all the groups that can be assigned as primary groups.
   *
   * @param options The options for an optional search query.
   * @param selectors The selectors for an optional search query.
   * @returns An array of the assignable primary groups.
   */
  public static async getPrimaryGroups(
    options?: Options,
    selectors?: Selector[]
  ) {
    if (!this.tilmeld.gatekeeper('tilmeld/admin')) {
      throw new Error("You don't have permission to do that.");
    }

    return await this.getAssignableGroups(
      this.tilmeld.config.highestPrimary,
      { ...options, class: this.tilmeld.Group, return: 'entity' },
      [...(selectors ?? [])]
    );
  }

  /**
   * Get all the groups that can be assigned as secondary groups.
   *
   * @param options The options for an optional search query.
   * @param selectors The selectors for an optional search query.
   * @returns An array of the assignable secondary groups.
   */
  public static async getSecondaryGroups(
    options?: Options,
    selectors?: Selector[]
  ) {
    if (!this.tilmeld.gatekeeper('tilmeld/admin')) {
      throw new Error("You don't have permission to do that.");
    }

    return await this.getAssignableGroups(
      this.tilmeld.config.highestSecondary,
      { ...options, class: this.tilmeld.Group, return: 'entity' },
      [...(selectors ?? [])]
    );
  }

  private static async getAssignableGroups(
    highestParent: string | boolean,
    options: Options<typeof Group>,
    selectors: Selector[]
  ) {
    let assignableGroups: (Group & GroupData)[] = [];

    if (highestParent === false) {
      return assignableGroups;
    }

    assignableGroups = await this.nymph.getEntities(
      { ...options, class: this.tilmeld.Group },
      ...selectors
    );
    if (highestParent !== true) {
      assignableGroups = assignableGroups.filter((group) => {
        let curGroup = group;
        while (curGroup.parent != null && curGroup.parent.cdate != null) {
          if (curGroup.parent.guid === highestParent) {
            return true;
          }
          curGroup = curGroup.parent;
        }
        return false;
      });
    }
    return assignableGroups;
  }

  public $getAvatar() {
    if (this.$data.avatar != null && this.$data.avatar !== '') {
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
        "You don't have the authority to make this group a system admin."
      );
    }

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
        "You don't have the authority to make this group a system admin."
      );
    }

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

    this.$privateData = Group.DEFAULT_PRIVATE_DATA;
    this.$allowlistData = Group.DEFAULT_ALLOWLIST_DATA;

    if (tilmeld.config.emailUsernames) {
      this.$privateData.push('groupname');
    }

    if (
      user != null &&
      ((user.abilities?.indexOf('tilmeld/admin') ?? -1) !== -1 ||
        (user.abilities?.indexOf('system/admin') ?? -1) !== -1)
    ) {
      // Users who can edit groups can see their data.
      this.$privateData = [];
      this.$allowlistData = undefined;
    } else if (
      this.$data.user != null &&
      user != null &&
      this.$data.user.$is(user)
    ) {
      // Users can see their group's data.
      this.$privateData = [];
    }
  }

  /**
   * Check whether the group is a descendant of a group.
   *
   * @param group The group, or the group's GUID.
   * @returns True or false.
   */
  public $isDescendant(givenGroup: (Group & GroupData) | string): boolean {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    let group: Group & GroupData;
    if (typeof givenGroup === 'string') {
      group = tilmeld.Group.factorySync(givenGroup);
    } else {
      group = givenGroup;
    }
    if (group.guid == null) {
      return false;
    }
    // Check to see if the group is a descendant of the given group.
    if (this.$data.parent == null) {
      return false;
    }
    if (this.$data.parent.$is(group)) {
      return true;
    }
    if (this.$data.parent.$isDescendant(group)) {
      return true;
    }
    return false;
  }

  /**
   * Gets an array of the group's child groups.
   *
   * @returns An array of groups.
   */
  public async $getChildren() {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    return await this.$nymph.getEntities(
      { class: tilmeld.Group },
      {
        type: '&',
        equal: ['enabled', true],
        ref: ['parent', this],
      }
    );
  }

  /**
   * Gets an array of the group's descendant groups.
   *
   * @param andSelf Include this group in the returned array.
   * @returns An array of groups.
   */
  public async $getDescendants(
    andSelf = false
  ): Promise<(Group & GroupData)[]> {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    let groups: (Group & GroupData)[] = [];
    const entities = await this.$nymph.getEntities(
      { class: tilmeld.Group },
      {
        type: '&',
        equal: ['enabled', true],
        ref: ['parent', this],
      }
    );
    for (let entity of entities) {
      groups = (await entity.$getDescendants(true)).concat(groups);
    }
    if (andSelf) {
      groups.push(this);
    }
    return groups;
  }

  /**
   * Gets an array of the group's descendant groups.
   *
   * @param andSelf Include this group in the returned array.
   * @returns An array of groups.
   */
  public $getDescendantsSync(andSelf = false): (Group & GroupData)[] {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    let groups: (Group & GroupData)[] = [];
    let entity: EntityInterface | null;
    let offset = 0;
    do {
      entity = this.$nymph.driver.getEntitySync(
        { class: tilmeld.Group, offset },
        {
          type: '&',
          equal: ['enabled', true],
          ref: ['parent', this],
        }
      );
      if (entity != null) {
        groups = entity.$getDescendantsSync(true).concat(groups);
      }
      offset++;
    } while (entity != null);
    if (andSelf) {
      groups.push(this);
    }
    return groups;
  }

  /**
   * Get the number of parents the group has.
   *
   * If the group is a top level group, this will return 0. If it is a child of
   * a top level group, this will return 1. If it is a grandchild of a top level
   * group, this will return 2, and so on.
   *
   * Levels will max out at 1024 to avoid recursive loops.
   *
   * @returns The level of the group.
   */
  public $getLevel() {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    let group = tilmeld.Group.factorySync(this.guid ?? undefined);
    let level = 0;
    while (group.parent != null && group.parent.cdate != null && level < 1024) {
      level++;
      group = group.parent;
    }
    return level;
  }

  /**
   * Gets an array of users in the group.
   *
   * @param descendants Include users in all descendant groups too.
   * @param limit The limit for the query.
   * @param offset The offset for the query.
   * @returns An array of users.
   */
  public async $getUsers(
    descendants = false,
    limit?: number,
    offset?: number
  ): Promise<(User & UserData)[]> {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    let groups: (Group & GroupData)[] = [];
    if (descendants) {
      groups = await this.$getDescendants();
    }
    return await this.$nymph.getEntities(
      {
        class: tilmeld.User,
        limit,
        offset,
      },
      {
        type: '&',
        equal: ['enabled', true],
      },
      {
        type: '|',
        ref: [
          ['group', this],
          ['groups', this],
          ...groups.map((group): [string, Group & GroupData] => [
            'group',
            group,
          ]),
          ...groups.map((group): [string, Group & GroupData] => [
            'groups',
            group,
          ]),
        ],
      }
    );
  }

  /**
   * Check that a groupname is valid.
   *
   * @returns An object with a boolean 'result' entry and a 'message' entry.
   */
  public async $checkGroupname(): Promise<{
    result: boolean;
    message: string;
  }> {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    if (!tilmeld.config.emailUsernames) {
      if (this.$data.groupname == null || !this.$data.groupname.length) {
        return { result: false, message: 'Please specify a groupname.' };
      }
      if (
        tilmeld.config.maxUsernameLength > 0 &&
        this.$data.groupname.length > tilmeld.config.maxUsernameLength
      ) {
        return {
          result: false,
          message:
            'Groupnames must not exceed ' +
            tilmeld.config.maxUsernameLength +
            ' characters.',
        };
      }
      if (
        difference(
          this.$data.groupname.split(''),
          tilmeld.config.validChars.split('')
        ).length
      ) {
        return {
          result: false,
          message: tilmeld.config.validCharsNotice,
        };
      }
      if (!tilmeld.config.validRegex.test(this.$data.groupname)) {
        return {
          result: false,
          message: tilmeld.config.validRegexNotice,
        };
      }

      const selector: Selector = {
        type: '&',
        ilike: [
          'groupname',
          this.$data.groupname.replace(/([\\%_])/g, (s) => `\\${s}`),
        ],
      };
      if (this.guid != null) {
        selector['!guid'] = this.guid;
      }
      const test = await this.$nymph.getEntity(
        { class: tilmeld.Group, skipAc: true },
        selector
      );
      if (test != null) {
        return { result: false, message: 'That groupname is taken.' };
      }

      return {
        result: true,
        message:
          this.guid != null ? 'Groupname is valid.' : 'Groupname is available!',
      };
    } else {
      this.$data.email = this.$data.groupname;
      if (this.$data.groupname == null || !this.$data.groupname.length) {
        return { result: false, message: 'Please specify an email.' };
      }
      if (
        tilmeld.config.maxUsernameLength > 0 &&
        this.$data.groupname.length > tilmeld.config.maxUsernameLength
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
    if (this.$data.email === '') {
      return { result: true, message: '' };
    }
    if (this.$data.email == null) {
      return { result: false, message: 'Please specify a valid email.' };
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
      { class: tilmeld.Group, skipAc: true },
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

  public async $save() {
    const tilmeld = this.$nymph.tilmeld as Tilmeld;
    if (this.$data.groupname == null || !this.$data.groupname.trim().length) {
      return false;
    }

    // Formatting.
    this.$data.groupname = this.$data.groupname.trim();
    if (tilmeld.config.emailUsernames) {
      this.$data.email = this.$data.groupname;
    }
    this.$data.email = (this.$data.email ?? '').trim();
    this.$data.name = (this.$data.name ?? '').trim();
    this.$data.phone = (this.$data.phone ?? '').trim();
    this.$data.enabled = !!this.$data.enabled;

    // Clear empty values.
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
    if (this.$data.parent == null) {
      delete this.$data.parent;
    }
    if (this.$data.user == null) {
      delete this.$data.user;
    }
    if (!this.$data.defaultPrimary) {
      delete this.$data.defaultPrimary;
    }
    if (!this.$data.defaultSecondary) {
      delete this.$data.defaultSecondary;
    }
    if (!this.$data.unverifiedSecondary) {
      delete this.$data.unverifiedSecondary;
    }

    // Groups should never have 'system/admin' or 'tilmeld/admin' abilities.
    this.$data.abilities = difference(this.$data.abilities ?? [], [
      'system/admin',
      'tilmeld/admin',
      null,
      undefined,
    ]) as string[];

    // Verification.
    const unCheck = await this.$checkGroupname();
    if (!unCheck.result) {
      throw new BadUsernameError(unCheck.message);
    }
    if (!tilmeld.config.emailUsernames) {
      const emCheck = await this.$checkEmail();
      if (!emCheck.result) {
        throw new BadEmailError(emCheck.message);
      }
    }

    // Validate group parent. Make sure it's not a descendant of this group.
    if (
      this.$data.parent &&
      (this.$data.parent.cdate == null ||
        this.$is(this.$data.parent) ||
        this.$data.parent.$isDescendant(this))
    ) {
      throw new BadDataError(
        "Group parent can't be itself or descendant of itself."
      );
    }

    try {
      tilmeld.config.validatorGroup(this);
    } catch (e: any) {
      throw new BadDataError(e?.message);
    }

    // Only one default primary group is allowed.
    if (this.$data.defaultPrimary) {
      const currentPrimary = await this.$nymph.getEntity(
        { class: tilmeld.Group },
        { type: '&', truthy: 'defaultPrimary' }
      );
      if (currentPrimary != null && !this.$is(currentPrimary)) {
        currentPrimary.defaultPrimary = false;
        if (!(await currentPrimary.$save())) {
          throw new CouldNotChangeDefaultPrimaryGroupError(
            'Could not change new user primary group from ' +
              `${currentPrimary.groupname}.`
          );
        }
      }
    }

    return await super.$save();
  }

  /*
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
      throw new BadDataError("You don't have the authority to delete groups.");
    }

    const transaction = 'tilmeld-delete-' + this.guid;
    const tnymph = await this.$nymph.startTransaction(transaction);

    // Delete descendants.
    const descendants = await this.$getDescendants();
    if (descendants.length) {
      for (let curGroup of descendants) {
        if (!(await curGroup.$delete())) {
          await tnymph.rollback(transaction);
          return false;
        }
      }
    }

    // Remove users from this primary group.
    const primaryUsers = await tnymph.getEntities(
      {
        class: tilmeld.User,
        skipAc: true,
      },
      {
        type: '&',
        ref: ['group', this],
      }
    );
    for (let user of primaryUsers) {
      delete user.group;
      if (!(await user.$save())) {
        await tnymph.rollback(transaction);
        return false;
      }
    }

    // Remove users from this secondary group.
    const secondaryUsers = await tnymph.getEntities(
      {
        class: tilmeld.User,
        skipAc: true,
      },
      {
        type: '&',
        ref: ['groups', this],
      }
    );
    for (let user of secondaryUsers) {
      user.$delGroup(this);
      if (!(await user.$save())) {
        await tnymph.rollback(transaction);
        return false;
      }
    }

    // Delete the group.
    const success = await super.$delete();
    if (success) {
      await tnymph.commit(transaction);
    } else {
      await tnymph.rollback(transaction);
    }
    return success;
  }
}
