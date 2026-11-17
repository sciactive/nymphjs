import { Entity, Options, Selector } from '@nymphjs/client';

import type { AdminGroupData, Group, Group as GroupClass } from './Group.js';
import type { AdminUserData, User } from './User.js';
import { AccessControlData } from './Tilmeld.types.js';

export type RawLDAPBinaryData = {
  base64: string;
};
export type RawLDAPEntry = {
  dn: string;
  [index: string]: RawLDAPBinaryData | RawLDAPBinaryData[] | string[] | string;
};
export type RawLDAPSearchResult = RawLDAPEntry[];

export interface LDAPSourceData extends AccessControlData {
  /**
   * The host of the server.
   */
  host: string;
  /**
   * The port on the server. Default is 389 for plain/StartTLS, 636 for LDAPS.
   */
  port?: number;
  /**
   * The encryption type.
   */
  encryption: 'none' | 'starttls' | 'ldaps';
  /**
   * Whether to ignore SSL certificate errors.
   *
   * This is not secure, and should not be used in production environments.
   */
  ignoreCertificateErrors: boolean;
  /**
   * The Distinguished Name or User Principal Name of a service account.
   *
   * This account will be used to search the directory. Leave empty for
   * anonymous bind.
   */
  bindUsername: string;
  /**
   * The password for the bind account.
   */
  bindPassword: string;
  /**
   * The base Distinguished Name used to search for user entries.
   */
  searchBase: string;
  /**
   * The LDAP search filter used to find all users.
   *
   * Use `(objectClass=organizationalPerson)` for most directories.
   */
  userFilter: string;
  /**
   * The LDAP search filter used to find the user.
   *
   * Use `{0}` as a placeholder for the username.
   *
   * Use `(sAMAccountName={0})` for Active Directory. Use `(uid={0})` for
   * OpenLDAP. Use `(userPrincipalName={0})` if usernames in the directory are
   * stored under the "userPrincipalName" attribute.
   */
  userSearchFilter: string;
  /**
   * The user attribute listing group memberships.
   *
   * Use `memberOf` for Active Directory.
   */
  groupAttributeOnUser?: string;
  /**
   * The group attribute listing member users.
   *
   * Use `uniqueMember` for LDAP. Empty for Active Directory.
   */
  groupAttributeOnGroup?: string;
  /**
   * Restrict user registration only to users belonging to a mapped group.
   *
   * If you set this to true and don't map any groups, no users will be able to
   * register an account through this LDAP source.
   */
  restrictRegistrationToMappedUsers: boolean;
  /**
   * A map of remote groups to their local group equivalents.
   *
   * An LDAP user's group membership in these groups will be synced every time
   * they log in.
   */
  groupMap: {
    remoteDN: string;
    localGroup: GroupClass & AdminGroupData;
  }[];
  /**
   * The mapping of attributes from Nymph to LDAP.
   *
   * The only required attribute is username.
   */
  attributeMap: {
    nameFirst?: string;
    nameMiddle?: string;
    nameLast?: string;
    name?: string;
    phone?: string;
    email?: string;
    username: string;
    avatar?: string;
    enabled?: string;
  };
  /**
   * Whether users from this LDAP Source are synced and enabled.
   */
  enabled: boolean;
}

export interface LDAPSource extends LDAPSourceData {}

export class LDAPSource extends Entity<LDAPSourceData> {
  // The name of the server class
  public static class = 'LDAPSource';

  constructor() {
    super();

    // Defaults.
    this.host = '';
    this.encryption = 'starttls';
    this.ignoreCertificateErrors = false;
    this.bindUsername = '';
    this.bindPassword = '';
    this.searchBase = 'DC=example,DC=com';
    this.userFilter = '(objectClass=organizationalPerson)';
    this.userSearchFilter = '(sAMAccountName={0})';
    this.groupAttributeOnUser = 'memberOf';
    this.restrictRegistrationToMappedUsers = false;
    this.groupMap = [];
    this.attributeMap = {
      nameFirst: 'givenName',
      nameMiddle: 'initials',
      nameLast: 'sn',
      name: 'displayName',
      phone: 'telephoneNumber',
      email: 'mail',
      username: 'sAMAccountName',
      // AD stores this as a bitmask. We store it as a boolean.
      // 512 = normal user
      // 2 = disabled
      enabled:
        '(userAccountControl & 512) == 512 && (userAccountControl & 2) == 0',
    };
    this.enabled = true;
  }

  public $fillWithTestServer(source: 'forumsys' | 'freeipa') {
    if (source === 'forumsys') {
      this.host = 'ldap.forumsys.com';
      this.bindUsername = 'cn=read-only-admin,dc=example,dc=com';
      this.bindPassword = 'password';
      this.searchBase = 'dc=example,dc=com';
      this.userFilter = '(objectClass=organizationalPerson)';
      this.userSearchFilter = '(uid={0})';
      this.groupAttributeOnUser = '';
      this.groupAttributeOnGroup = 'uniqueMember';
      this.attributeMap = {
        nameFirst: '',
        nameMiddle: '',
        nameLast: 'sn',
        name: 'cn',
        phone: 'telephoneNumber',
        email: 'mail',
        username: 'uid',
        avatar: '',
        enabled: 'true',
      };
    } else {
      this.host = 'ipa.demo1.freeipa.org';
      this.bindUsername =
        'uid=admin,cn=users,cn=accounts,dc=demo1,dc=freeipa,dc=org';
      this.bindPassword = 'Secret123';
      this.searchBase = 'cn=users,cn=accounts,dc=demo1,dc=freeipa,dc=org';
      this.userFilter = '(objectClass=inetuser)';
      this.userSearchFilter = '(uid={0})';
      this.groupAttributeOnUser = 'memberOf';
      this.groupAttributeOnGroup = '';
      this.attributeMap = {
        nameFirst: 'givenName',
        nameMiddle: '',
        nameLast: 'sn',
        name: 'cn',
        phone: '',
        email: 'mail || uid+"@demo1.freeipa.org"',
        username: 'uid',
        avatar: '',
        enabled: 'objectClass =~ /(^|,)posixaccount(,|$)/',
      };
    }
    this.port = 389;
    this.encryption = 'none';
    this.ignoreCertificateErrors = false;
    this.restrictRegistrationToMappedUsers = false;
    this.groupMap = [];
    this.enabled = true;
  }

  public async $testBind(): Promise<void> {
    return await this.$serverCall('$testBind', [], {
      pushState: true,
    });
  }

  public async $testList(): Promise<RawLDAPSearchResult> {
    return await this.$serverCall('$testList', [], {
      pushState: true,
    });
  }

  public async $testMapping(
    username: string,
  ): Promise<(User & AdminUserData) | null> {
    return await this.$serverCall('$testMapping', [username], {
      pushState: true,
    });
  }

  public async $testSearch(username: string): Promise<RawLDAPEntry | null> {
    return await this.$serverCall('$testSearch', [username], {
      pushState: true,
    });
  }

  public async $getUsers(
    limit?: number,
    offset?: number,
    reverse?: boolean,
    sort?: string,
    enabled?: boolean,
  ): Promise<{ entities: User[]; count: number }> {
    return await this.$serverCall('$getUsers', [
      limit,
      offset,
      reverse,
      sort,
      enabled,
    ]);
  }

  public static async getMappableGroups(
    options?: Options,
    selectors?: Selector[],
  ): Promise<Group[]> {
    return await this.serverCallStatic('getMappableGroups', [
      { ...options, class: this.class },
      selectors,
    ]);
  }
}
