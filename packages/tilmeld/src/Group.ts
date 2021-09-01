import Nymph, {
  EntityData,
  EntityInterface,
  EntityJson,
  EntityPatch,
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
};

export default class Group extends AbleObject<GroupData> {
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
      const entity = await Nymph.getEntity(
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
   * @param search A search query. If undefined, all will be returned. Uses ilike on name and groupname.
   * @returns An array of the assignable primary groups.
   */
  public static async getPrimaryGroups(search?: string) {
    return await this.getAssignableGroups(
      Tilmeld.config.highestPrimary,
      search
    );
  }

  /**
   * Get all the groups that can be assigned as secondary groups.
   *
   * @param search A search query. If null, all will be returned. Uses ilike on name and groupname.
   * @returns An array of the assignable secondary groups.
   */
  public static async getSecondaryGroups(search?: string) {
    return await this.getAssignableGroups(
      Tilmeld.config.highestSecondary,
      search
    );
  }

  private static async getAssignableGroups(
    highestParent: string | boolean,
    search?: string
  ) {
    let assignableGroups: (Group & GroupData)[] = [];

    if (highestParent === false) {
      return assignableGroups;
    }

    if (search != null) {
      assignableGroups = await Nymph.getEntities(
        { class: Group },
        {
          type: '&',
          equal: ['enabled', true],
        },
        {
          type: '|',
          ilike: [
            ['name', search],
            ['groupname', search],
          ],
        }
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
    } else {
      if (highestParent === true) {
        assignableGroups = await Nymph.getEntities(
          { class: Group },
          {
            type: '&',
            equal: ['enabled', true],
          }
        );
      } else {
        const parent = await Group.factory(highestParent);
        if (parent.guid != null) {
          assignableGroups = await parent.$getDescendants();
        }
      }
    }
    return assignableGroups;
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

  public $jsonAcceptData(input: EntityJson, allowConflict = false) {
    this.$referenceWake();

    if (
      Tilmeld.gatekeeper('tilmeld/admin') &&
      !Tilmeld.gatekeeper('system/admin') &&
      input.data.abilities.indexOf('system/admin') !== -1 &&
      this.$data.abilities?.indexOf('system/admin') === -1
    ) {
      throw new BadDataError(
        "You don't have the authority to make this group a system admin."
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
    let user = givenUser ?? User.current();

    this.$privateData = Group.DEFAULT_PRIVATE_DATA;
    this.$allowlistData = Group.DEFAULT_ALLOWLIST_DATA;

    if (Tilmeld.config.emailUsernames) {
      this.$privateData.push('groupname');
    }

    if (
      user != null &&
      (user.abilities?.indexOf('tilmeld/admin') ?? -1) !== -1
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
    let group: Group & GroupData;
    if (typeof givenGroup === 'string') {
      group = Group.factorySync(givenGroup);
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
    return await Nymph.getEntities(
      { class: Group },
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
    let groups: (Group & GroupData)[] = [];
    const entities = await Nymph.getEntities(
      { class: Group },
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
    let groups: (Group & GroupData)[] = [];
    let entity: EntityInterface | null;
    let offset = 0;
    do {
      entity = Nymph.driver.getEntitySync(
        { class: Group, offset },
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
    let group = Group.factorySync(this.guid ?? undefined);
    let level = 0;
    while (group.parent != null && group.parent.enabled && level < 1024) {
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
    let groups: (Group & GroupData)[] = [];
    if (descendants) {
      groups = await this.$getDescendants();
    }
    return await Nymph.getEntities(
      {
        class: User,
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
    if (!Tilmeld.config.emailUsernames) {
      if (this.$data.groupname == null || !this.$data.groupname.length) {
        return { result: false, message: 'Please specify a groupname.' };
      }
      if (
        Tilmeld.config.maxUsernameLength > 0 &&
        this.$data.groupname.length > Tilmeld.config.maxUsernameLength
      ) {
        return {
          result: false,
          message:
            'Groupnames must not exceed ' +
            Tilmeld.config.maxUsernameLength +
            ' characters.',
        };
      }
      if (
        difference(
          this.$data.groupname.split(''),
          Tilmeld.config.validChars.split('')
        ).length
      ) {
        return {
          result: false,
          message: Tilmeld.config.validCharsNotice,
        };
      }
      if (!Tilmeld.config.validRegex.test(this.$data.groupname)) {
        return {
          result: false,
          message: Tilmeld.config.validRegexNotice,
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
      const test = await Nymph.getEntity(
        { class: Group, skipAc: true },
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
      this.$data.groupname = this.$data.email;
      if (this.$data.groupname == null || !this.$data.groupname.length) {
        return { result: false, message: 'Please specify an email.' };
      }
      if (
        Tilmeld.config.maxUsernameLength > 0 &&
        this.$data.groupname.length > Tilmeld.config.maxUsernameLength
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
    if (this.$data.email === '') {
      return { result: true, message: '' };
    }
    if (this.$data.email == null) {
      return { result: false, message: 'Please specify a valid email.' };
    }
    if (!Tilmeld.config.validEmailRegex.test(this.$data.email)) {
      return {
        result: false,
        message: Tilmeld.config.validEmailRegexNotice,
      };
    }
    const selector: Selector = {
      type: '&',
      ilike: ['email', this.$data.email.replace(/([\\%_])/g, (s) => `\\${s}`)],
    };
    if (this.guid != null) {
      selector['!guid'] = this.guid;
    }
    const test = await Nymph.getEntity(
      { class: Group, skipAc: true },
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
    if (this.$data.groupname == null || !this.$data.groupname.length) {
      return false;
    }

    // Formatting.
    this.$data.groupname = this.$data.groupname.trim();
    if (Tilmeld.config.emailUsernames) {
      this.$data.email = this.$data.groupname;
    }
    this.$data.email = (this.$data.email ?? '').trim();
    this.$data.name = (this.$data.name ?? '').trim();
    this.$data.phone = (this.$data.phone ?? '').trim();

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
    if (!Tilmeld.config.emailUsernames) {
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
      Tilmeld.config.validatorGroup(this);
    } catch (e) {
      throw new BadDataError(e.message);
    }

    // Only one default primary group is allowed.
    if (this.$data.defaultPrimary) {
      const currentPrimary = await Nymph.getEntity(
        { class: Group },
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
    if (!Tilmeld.gatekeeper('tilmeld/admin')) {
      throw new BadDataError("You don't have the authority to delete groups.");
    }

    const transaction = 'tilmeld-delete-' + this.guid;
    await Nymph.startTransaction(transaction);

    // Delete descendants.
    const descendants = await this.$getDescendants();
    if (descendants.length) {
      for (let curGroup of descendants) {
        if (!(await curGroup.$delete())) {
          await Nymph.rollback(transaction);
          return false;
        }
      }
    }

    // Remove users from this primary group.
    const primaryUsers = await Nymph.getEntities(
      {
        class: User,
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
        await Nymph.rollback(transaction);
        return false;
      }
    }

    // Remove users from this secondary group.
    const secondaryUsers = await Nymph.getEntities(
      {
        class: User,
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
        await Nymph.rollback(transaction);
        return false;
      }
    }

    // Delete the group.
    const success = await super.$delete();
    if (success) {
      await Nymph.commit(transaction);
    } else {
      await Nymph.rollback(transaction);
    }
    return success;
  }
}

Nymph.setEntityClass(Group.class, Group);
