import AbleObject from './AbleObject';
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
};

export default class Group extends AbleObject<GroupData> {
  static ETYPE = 'tilmeld_group';
  static class = 'Group';

  // protected $privateData = ['boolean'];
  // public static searchRestrictedData = ['fish'];
  // protected $allowlistData? = ['string', 'array', 'mdate'];
  // protected $protectedTags = ['test', 'notag'];
  // protected $allowlistTags? = ['newtag'];

  static async factory(guid?: string): Promise<Group & GroupData> {
    return (await super.factory(guid)) as Group & GroupData;
  }

  static factorySync(guid?: string): Group & GroupData {
    return super.factorySync(guid) as Group & GroupData;
  }

  constructor(guid?: string) {
    super(guid);

    if (this.guid == null) {
      // this.$addTag('test');
      // this.$data.boolean = true;
    }
  }

  public $updateDataProtection(user?: User & UserData) {
    return;
  }

  public $getDescendants(): (Group & GroupData)[] {
    return [];
  }

  public $isDescendant(group: (Group & GroupData) | string): boolean {
    return true;
  }
}
