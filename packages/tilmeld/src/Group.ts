import crypto from 'node:crypto';
import type {
  Nymph,
  EntityData,
  EntityJson,
  EntityPatch,
  Options,
  Selector,
  SerializedEntityData,
} from '@nymphjs/nymph';
import { difference, xor } from 'lodash-es';
import { splitn } from '@sciactive/splitn';

import { enforceTilmeld } from './enforceTilmeld.js';
import AbleObject from './AbleObject.js';
import {
  AccessControlError,
  BadDataError,
  BadEmailError,
  BadUsernameError,
  CouldNotChangeDefaultPrimaryGroupError,
} from './errors/index.js';
import UserClass from './User.js';
import type { UserData } from './User.js';

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
  user?: (UserClass & UserData) | null;

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

/**
 * A user group data model.
 *
 * Written by Hunter Perrin for SciActive.
 *
 * @author Hunter Perrin <hperrin@gmail.com>
 * @copyright SciActive Inc
 * @see http://nymph.io/
 */
export default class Group extends AbleObject<GroupData> {
  /**
   * The instance of Tilmeld to use for queries.
   */
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
  protected $privateData = [...Group.DEFAULT_PRIVATE_DATA];
  public static searchRestrictedData = [...Group.DEFAULT_PRIVATE_DATA];
  protected $allowlistData? = [...Group.DEFAULT_ALLOWLIST_DATA];
  protected $allowlistTags?: string[] = [];

  /**
   * This should only be used by the backend.
   */
  private $skipAcWhenSaving = false;
  /**
   * This should only be used by the backend.
   */
  private $skipAcWhenDeleting = false;
  /**
   * Used to save the current groupname for domain admin permissions.
   */
  public $originalGroupname?: string;

  static async factoryGroupname(
    groupname?: string,
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
        },
      );
      if (entity != null) {
        return entity;
      }
    }
    return entity;
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
    selectors?: Selector[],
  ) {
    const tilmeld = enforceTilmeld(this);
    if (!tilmeld.gatekeeper('tilmeld/admin')) {
      throw new Error("You don't have permission to do that.");
    }

    return await this.getAssignableGroups(
      tilmeld.config.highestPrimary,
      { ...options, class: tilmeld.Group, return: 'entity' },
      [...(selectors ?? [])],
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
    selectors?: Selector[],
  ) {
    const tilmeld = enforceTilmeld(this);
    if (!tilmeld.gatekeeper('tilmeld/admin')) {
      throw new Error("You don't have permission to do that.");
    }

    return await this.getAssignableGroups(
      tilmeld.config.highestSecondary,
      { ...options, class: tilmeld.Group, return: 'entity' },
      [...(selectors ?? [])],
    );
  }

  private static async getAssignableGroups(
    highestParent: string | boolean,
    options: Options<typeof Group>,
    selectors: Selector[],
  ) {
    const tilmeld = enforceTilmeld(this);
    let assignableGroups: (Group & GroupData)[] = [];

    if (highestParent === false) {
      return assignableGroups;
    }

    assignableGroups = await this.nymph.getEntities(
      { ...options, class: tilmeld.Group },
      ...selectors,
    );
    if (highestParent !== true) {
      assignableGroups = (
        await Promise.all(
          assignableGroups.map(async (group) => {
            let curGroup = group;
            let parent = curGroup.parent;
            await parent?.$wake();
            while (parent != null && parent?.cdate != null) {
              if (parent?.guid === highestParent) {
                return group;
              }
              curGroup = parent;
              parent = curGroup.parent;
              await parent?.$wake();
            }
            return null;
          }),
        )
      ).filter((group) => group != null) as (Group & GroupData)[];
    }
    return assignableGroups;
  }

  constructor() {
    super();

    // Defaults.
    this.$data.enabled = true;
    this.$data.abilities = [];
    this.$updateDataProtection();
  }

  $setNymph(nymph: Nymph) {
    this.$nymph = nymph;
    if (!this.$asleep()) {
      if (this.$data.user && this.$data.user.$nymph !== nymph) {
        this.$data.user.$setNymph(nymph);
      }
      if (this.$data.parent && this.$data.parent.$nymph !== nymph) {
        this.$data.parent.$setNymph(nymph);
      }
    }
  }

  async $getUniques(): Promise<string[]> {
    const tilmeld = enforceTilmeld(this);
    const uniques = [`u:${this.$data.groupname}`];
    if (
      !tilmeld.config.emailUsernames &&
      tilmeld.config.userFields.includes('email')
    ) {
      uniques.push(`e:${this.$data.email}`);
    }
    if (this.$data.defaultPrimary) {
      uniques.push(`o:default-primary`);
    }
    return uniques;
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
      crypto
        .createHash('sha256')
        .update(this.$data.email.trim().toLowerCase())
        .digest('hex')
        .toLowerCase() +
      '?d=identicon&s=40'
    );
  }

  public $jsonAcceptData(input: EntityJson, allowConflict = false) {
    this.$check();

    if ('abilities' in input.data) {
      this.$checkIncomingAbilities(input.data.abilities);
    }

    super.$jsonAcceptData(input, allowConflict);
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
        this.$data.abilities?.includes('system/admin') &&
      (!tilmeld.currentUser ||
        !tilmeld.currentUser.abilities?.includes('system/admin'))
    ) {
      throw new BadDataError(
        "You don't have the authority to grant or revoke system/admin.",
      );
    }

    if (
      incoming.includes('tilmeld/admin') !==
        this.$data.abilities?.includes('tilmeld/admin') &&
      (!tilmeld.currentUser ||
        !tilmeld.currentUser.abilities?.includes('system/admin'))
    ) {
      throw new BadDataError(
        "You don't have the authority to grant or revoke tilmeld/admin.",
      );
    }

    if (
      incoming.includes('tilmeld/switch') !==
        this.$data.abilities?.includes('tilmeld/switch') &&
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
        this.$data.abilities?.filter((ability: string) =>
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
    data: EntityData,
    sdata?: SerializedEntityData,
    source?: 'server',
  ) {
    super.$putData(data, sdata, source);
    if (source === 'server') {
      this.$originalGroupname = this.$data.groupname;
    }
    this.$updateDataProtection();
  }

  /**
   * Update the data protection arrays for a user.
   *
   * @param givenUser User to update protection for. If undefined, will use the currently logged in user.
   */
  public $updateDataProtection(givenUser?: UserClass & UserData) {
    const tilmeld = enforceTilmeld(this);
    let user = givenUser ?? tilmeld.User.current();
    let [_groupname, domain] = tilmeld.config.domainSupport
      ? splitn(this.$data.groupname ?? '', '@', 2)
      : [this.$data.groupname, null];
    // Lowercase the domain part.
    if (domain) {
      domain = domain.toLowerCase();
    }

    this.$privateData = [...Group.DEFAULT_PRIVATE_DATA];
    this.$allowlistData = [...Group.DEFAULT_ALLOWLIST_DATA];

    if (tilmeld.config.emailUsernames) {
      this.$privateData.push('groupname');
    }

    if (
      user != null &&
      (user.abilities?.includes('tilmeld/admin') ||
        user.abilities?.includes('system/admin'))
    ) {
      // Users who can edit groups can see their data.
      this.$privateData = [];
      this.$allowlistData = undefined;
    } else if (
      this.$data.user != null &&
      user != null &&
      this.$data.user.guid === user.guid
    ) {
      // Users can see their group's data.
      this.$privateData = [];
    } else if (
      user != null &&
      tilmeld.config.domainSupport &&
      domain &&
      user.abilities?.includes(`tilmeld/domain/${domain}/admin`)
    ) {
      // Domain admins can see their groups' data.
      this.$privateData = [];
    }
  }

  /**
   * Check whether the group is a descendant of a group.
   *
   * @param group The group, or the group's GUID.
   * @returns True or false.
   */
  public async $isDescendant(
    givenGroup: (Group & GroupData) | string,
  ): Promise<boolean> {
    const tilmeld = enforceTilmeld(this);
    let group: Group & GroupData;
    if (typeof givenGroup === 'string') {
      group = await tilmeld.Group.factory(givenGroup);
    } else {
      group = givenGroup;
    }
    if (group.guid == null) {
      return false;
    }
    // Check to see if the group is a descendant of the given group.
    const parent = this.$data.parent;
    await parent?.$wake();
    if (parent == null) {
      return false;
    }
    if (parent.$is(group)) {
      return true;
    }
    if (await parent.$isDescendant(group)) {
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
    const tilmeld = enforceTilmeld(this);
    return await this.$nymph.getEntities(
      { class: tilmeld.Group },
      {
        type: '&',
        equal: ['enabled', true],
        ref: ['parent', this],
      },
    );
  }

  /**
   * Gets an array of the group's descendant groups.
   *
   * @param andSelf Include this group in the returned array.
   * @returns An array of groups.
   */
  public async $getDescendants(
    andSelf = false,
  ): Promise<(Group & GroupData)[]> {
    const tilmeld = enforceTilmeld(this);
    let groups: (Group & GroupData)[] = [];
    const entities = await this.$nymph.getEntities(
      { class: tilmeld.Group },
      {
        type: '&',
        equal: ['enabled', true],
        ref: ['parent', this],
      },
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
  public async $getLevel() {
    const tilmeld = enforceTilmeld(this);
    let group = await tilmeld.Group.factory(this.guid ?? undefined);
    let parent = group.parent;
    await parent?.$wake();
    let level = 0;
    while (parent != null && parent.cdate != null && level < 1024) {
      level++;
      group = parent;
      parent = group.parent;
      await parent?.$wake();
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
    offset?: number,
  ): Promise<(UserClass & UserData)[]> {
    const tilmeld = enforceTilmeld(this);
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
      },
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
    const tilmeld = enforceTilmeld(this);
    if (!tilmeld.config.emailUsernames) {
      let [groupname, domain] = tilmeld.config.domainSupport
        ? splitn(this.$data.groupname ?? '', '@', 2)
        : [this.$data.groupname, null];

      // Lowercase the domain part.
      if (domain) {
        domain = domain.toLowerCase();
        this.$data.groupname = `${groupname}@${domain}`;
      }

      if (
        this.$data.groupname == null ||
        !this.$data.groupname.length ||
        groupname == null ||
        !groupname.length
      ) {
        return { result: false, message: 'Please specify a groupname.' };
      }
      if (groupname.length < tilmeld.config.minUsernameLength) {
        return {
          result: false,
          message:
            'Groupnames must be at least ' +
            tilmeld.config.minUsernameLength +
            ' characters.',
        };
      }
      if (groupname.length > tilmeld.config.maxUsernameLength) {
        return {
          result: false,
          message:
            'Groupnames must not exceed ' +
            tilmeld.config.maxUsernameLength +
            ' characters.',
        };
      }
      if (
        difference(groupname.split(''), tilmeld.config.validChars.split(''))
          .length
      ) {
        return {
          result: false,
          message: tilmeld.config.validCharsNotice,
        };
      }
      if (!tilmeld.config.validRegex.test(groupname)) {
        return {
          result: false,
          message: tilmeld.config.validRegexNotice,
        };
      }
      if (domain != null) {
        if (!tilmeld.config.validDomainRegex.test(domain)) {
          return {
            result: false,
            message: tilmeld.config.validDomainRegexNotice,
          };
        }
        if (
          !this.$is(tilmeld.currentUser?.group) &&
          !tilmeld.gatekeeper(`tilmeld/domain/${domain}/admin`)
        ) {
          return {
            result: false,
            message:
              "You don't have the authority to manage groups on this domain.",
          };
        }
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
        selector,
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
      if (this.$data.groupname.length < tilmeld.config.minUsernameLength) {
        return {
          result: false,
          message:
            'Emails must be at least ' +
            tilmeld.config.minUsernameLength +
            ' characters.',
        };
      }
      if (this.$data.groupname.length > tilmeld.config.maxUsernameLength) {
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

  public async $save() {
    const tilmeld = enforceTilmeld(this);
    if (this.$data.groupname == null || !this.$data.groupname.trim().length) {
      return false;
    }

    // Lowercase the domain part.
    if (tilmeld.config.domainSupport) {
      const [groupname, domain] = splitn(this.$data.groupname ?? '', '@', 2);
      if (domain) {
        this.$data.groupname = `${groupname}@${domain.toLowerCase()}`;
      }
    }

    if (tilmeld.config.domainSupport) {
      const [_groupname, domain] = splitn(this.$data.groupname ?? '', '@', 2);
      const [_originalGroupname, originalDomain] = splitn(
        this.$originalGroupname ?? '',
        '@',
        2,
      );

      if (
        this.guid != null &&
        ((originalDomain == null && domain != null) ||
          (domain == null && originalDomain != null))
      ) {
        throw new AccessControlError(
          "Groups can't switch to or from having a domain once created.",
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
            "You don't have the authority to modify groups on this domain.",
          );
        }
        if (
          originalDomain != null &&
          originalDomain !== domain &&
          (!tilmeld.gatekeeper(`tilmeld/domain/${domain}/admin`) ||
            !tilmeld.gatekeeper(`tilmeld/domain/${originalDomain}/admin`))
        ) {
          throw new AccessControlError(
            "You don't have the authority to modify groups on this domain.",
          );
        }
      }
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

    // Groups should never have 'system/admin', 'tilmeld/admin',
    // 'tilmeld/switch', or domain admin abilities.
    this.$data.abilities = (this.$data.abilities ?? []).filter((ability) => {
      if (
        ['system/admin', 'tilmeld/admin', 'tilmeld/switch'].indexOf(ability) !==
        -1
      ) {
        return false;
      }
      if (ability == null) {
        return false;
      }
      if (ability.startsWith('tilmeld/domain/') && ability.endsWith('/admin')) {
        return false;
      }
      return true;
    }) as string[];

    // Verification.
    const unCheck = await this.$checkGroupname();
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

    // Validate group parent. Make sure it's not a descendant of this group.
    const parent = this.$data.parent;
    await parent?.$wake();
    if (
      parent &&
      (parent.cdate == null ||
        this.$is(parent) ||
        (await parent.$isDescendant(this)))
    ) {
      throw new BadDataError(
        "Group parent can't be itself or descendant of itself.",
      );
    }

    try {
      tilmeld.config.validatorGroup(tilmeld, this);
    } catch (e: any) {
      throw new BadDataError(e?.message);
    }

    // Only one default primary group is allowed.
    if (this.$data.defaultPrimary) {
      const currentPrimary = await this.$nymph.getEntity(
        { class: tilmeld.Group },
        { type: '&', truthy: 'defaultPrimary' },
      );
      if (currentPrimary != null && !this.$is(currentPrimary)) {
        currentPrimary.defaultPrimary = false;
        if (
          this.$skipAcWhenSaving
            ? !(await currentPrimary.$saveSkipAC())
            : !(await currentPrimary.$save())
        ) {
          throw new CouldNotChangeDefaultPrimaryGroupError(
            'Could not change new user primary group from ' +
              `${currentPrimary.groupname}.`,
          );
        }
      }
    }

    const ret = await super.$save();
    if (ret) {
      this.$originalGroupname = this.$data.groupname;
    }
    return ret;
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
    let tilmeld = enforceTilmeld(this);
    if (!this.$skipAcWhenDeleting && !tilmeld.gatekeeper('tilmeld/admin')) {
      throw new AccessControlError(
        "You don't have the authority to delete groups.",
      );
    }
    if (this.$data.groupname !== this.$originalGroupname) {
      throw new AccessControlError(
        "You can't delete a group while switching its groupname.",
      );
    }

    const transaction = 'tilmeld-delete-' + this.guid;
    const nymph = this.$nymph;
    const tnymph = await nymph.startTransaction(transaction);
    this.$setNymph(tnymph);
    tilmeld = enforceTilmeld(this);
    const User = tnymph.getEntityClass(UserClass);

    try {
      // Delete descendants.
      const descendants = await this.$getDescendants();
      if (descendants.length) {
        for (let curGroup of descendants) {
          if (
            this.$skipAcWhenDeleting
              ? !(await curGroup.$deleteSkipAC())
              : !(await curGroup.$delete())
          ) {
            await tnymph.rollback(transaction);
            this.$setNymph(nymph);
            return false;
          }
        }
      }

      // Remove users from this primary group.
      const primaryUsers = await tnymph.getEntities(
        {
          class: User,
          skipAc: true,
        },
        {
          type: '&',
          ref: ['group', this],
        },
      );
      for (let user of primaryUsers) {
        delete user.group;
        if (
          this.$skipAcWhenDeleting
            ? !(await user.$saveSkipAC())
            : !(await user.$save())
        ) {
          await tnymph.rollback(transaction);
          this.$setNymph(nymph);
          return false;
        }
      }

      // Remove users from this secondary group.
      const secondaryUsers = await tnymph.getEntities(
        {
          class: User,
          skipAc: true,
        },
        {
          type: '&',
          ref: ['groups', this],
        },
      );
      for (let user of secondaryUsers) {
        user.$delGroup(this);
        if (
          this.$skipAcWhenDeleting
            ? !(await user.$saveSkipAC())
            : !(await user.$save())
        ) {
          await tnymph.rollback(transaction);
          return false;
        }
      }

      // Delete the group.
      let success = await super.$delete();
      if (success) {
        success = await tnymph.commit(transaction);
      } else {
        await tnymph.rollback(transaction);
      }
      this.$setNymph(nymph);
      return success;
    } catch (e: any) {
      await tnymph.rollback(transaction);
      this.$setNymph(nymph);
      throw e;
    }
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
}
