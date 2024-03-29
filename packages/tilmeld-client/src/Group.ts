import { Entity, Options, Selector } from '@nymphjs/client';

import type User from './User';
import type { CurrentUserData } from './User';

export type GroupData = {
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
  parent?: Group & GroupData;

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

export type CurrentGroupData = GroupData & {
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
};

export type AdminGroupData = CurrentGroupData;

export default class Group extends Entity<GroupData> {
  // The name of the server class
  public static class = 'Group';

  constructor() {
    super();

    this.$data.enabled = true;
    (this.$data as CurrentGroupData).abilities = [];
  }

  static async factory(guid?: string): Promise<Group & GroupData> {
    return (await super.factory(guid)) as Group & GroupData;
  }

  static factorySync(): Group & GroupData {
    return super.factorySync() as Group & GroupData;
  }

  public async $checkGroupname(): Promise<{
    result: boolean;
    message: string;
  }> {
    return await this.$serverCall('$checkGroupname', [], true);
  }

  public async $checkEmail(): Promise<{ result: boolean; message: string }> {
    return await this.$serverCall('$checkEmail', [], true);
  }

  public async $getAvatar(): Promise<string> {
    return await this.$serverCall('$getAvatar', [], true);
  }

  public async $getChildren(): Promise<(Group & GroupData)[]> {
    return await this.$serverCall('$getChildren', [], true);
  }

  public async $getDescendants(
    andSelf = false,
  ): Promise<(Group & GroupData)[]> {
    return await this.$serverCall('$getDescendants', [andSelf], true);
  }

  public async $getLevel(): Promise<number> {
    return await this.$serverCall('$getLevel', [], true);
  }

  public async $isDescendant(
    givenGroup: (Group & GroupData) | string,
  ): Promise<boolean> {
    return await this.$serverCall('$isDescendant', [givenGroup], true);
  }

  public static async getPrimaryGroups(
    options?: Options,
    selectors?: Selector[],
  ): Promise<(Group & GroupData)[]> {
    return await this.serverCallStatic('getPrimaryGroups', [
      { options, class: this.class },
      selectors,
    ]);
  }

  public static async getSecondaryGroups(
    options?: Options,
    selectors?: Selector[],
  ): Promise<(Group & GroupData)[]> {
    return await this.serverCallStatic('getSecondaryGroups', [
      { options, class: this.class },
      selectors,
    ]);
  }
}
