import { Entity, Options, Selector } from '@nymphjs/client';

import type { User, CurrentUserData } from './User.js';

export interface GroupData {
  /**
   * The group's groupname.
   */
  groupname?: string;
  /**
   * The group's name.
   */
  name?: string;
  /**
   * The group's avatar URL. (Use getAvatar() to support Gravatar.)
   */
  avatar?: string;
  /**
   * The group's parent.
   */
  parent?: Group;

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
}

export interface CurrentGroupData extends GroupData {
  /**
   * The abilities granted to the group.
   */
  abilities?: string[];
  /**
   * The group's email address.
   */
  email?: string;
  /**
   * The group's telephone number.
   */
  phone?: string;
  /**
   * If generatePrimary is on, this will be the user who generated this group.
   */
  user?: (User & CurrentUserData) | null;
}

export interface AdminGroupData extends CurrentGroupData {}

export interface Group extends GroupData {}

export class Group extends Entity<GroupData> {
  // The name of the server class
  public static class = 'Group';

  static async factoryGroupname(groupname?: string): Promise<Group> {
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

  constructor() {
    super();

    this.enabled = true;
    (this as CurrentGroupData).abilities = [];
  }

  public async $checkGroupname(): Promise<{
    result: boolean;
    message: string;
  }> {
    return await this.$serverCall('$checkGroupname', [], {
      pushState: true,
    });
  }

  public async $checkEmail(): Promise<{ result: boolean; message: string }> {
    return await this.$serverCall('$checkEmail', [], {
      pushState: true,
    });
  }

  public async $getAvatar(): Promise<string> {
    return await this.$serverCall('$getAvatar', [], {
      pushState: true,
    });
  }

  public async $getChildren(
    limit?: number,
    offset?: number,
    reverse?: boolean,
    sort?: string,
  ): Promise<Group[]> {
    return await this.$serverCall('$getChildren', [
      limit,
      offset,
      reverse,
      sort,
    ]);
  }

  public async $getDescendants(andSelf = false): Promise<Group[]> {
    return await this.$serverCall('$getDescendants', [andSelf]);
  }

  public async $getLevel(): Promise<number> {
    return await this.$serverCall('$getLevel', []);
  }

  public async $isDescendant(givenGroup: Group | string): Promise<boolean> {
    return await this.$serverCall('$isDescendant', [givenGroup]);
  }

  public async $getUsers(
    descendants = false,
    limit?: number,
    offset?: number,
    reverse?: boolean,
    sort?: string,
    enabled?: boolean,
  ): Promise<User[]> {
    return await this.$serverCall('$getUsers', [
      descendants,
      limit,
      offset,
      reverse,
      sort,
      enabled,
    ]);
  }

  public static async getPrimaryGroups(
    options?: Options,
    selectors?: Selector[],
  ): Promise<Group[]> {
    return await this.serverCallStatic('getPrimaryGroups', [
      { ...options, class: this.class },
      selectors,
    ]);
  }

  public static async getSecondaryGroups(
    options?: Options,
    selectors?: Selector[],
  ): Promise<Group[]> {
    return await this.serverCallStatic('getSecondaryGroups', [
      { ...options, class: this.class },
      selectors,
    ]);
  }
}
