import {
  acceptStateFromClient,
  clearSearchRestrictedData,
  Entity,
  EntityConstructor,
  nymphValibotProps,
  type Options,
  type Selector,
  type SerializedEntityData,
  transaction,
  transactional,
} from '@nymphjs/nymph';
import { nanoid } from '@nymphjs/guid';
import {
  Client,
  ClientOptions,
  type Entry,
  Filter,
  InvalidCredentialsError,
} from 'ldapts';
import { fileTypeFromBuffer } from 'file-type';
import * as v from 'valibot';
import * as evalEstreeExpression from 'eval-estree-expression';
import * as whence from 'whence';

import { enforceTilmeld } from './enforceTilmeld.js';
import {
  AccessControlError,
  AmbiguousUserError,
  BadDataError,
} from './errors/index.js';
import { User as UserClass } from './User.js';
import { Group as GroupClass } from './Group.js';
import { tilmeldValibotProps } from './tilmeldValibotProps.js';

export type RawLDAPBinaryData = {
  base64: string;
};
export type RawLDAPEntry = {
  dn: string;
  [index: string]: RawLDAPBinaryData | RawLDAPBinaryData[] | string[] | string;
};
export type RawLDAPSearchResult = RawLDAPEntry[];

export type LDAPSourceEventType =
  'beforeSave' | 'afterSave' | 'beforeDelete' | 'afterDelete';
/**
 * This is run just before the ldapsource is saved, so all checks have passed.
 *
 * The transaction is available in `ldapsource.$nymph`.
 */
export type TilmeldBeforeLDAPSourceSaveCallback = (
  ldapsource: LDAPSource,
) => Promise<void>;
/**
 * This is run before the transaction is committed, and you can perform
 * additional functions on the transaction, which is available in
 * `ldapsource.$nymph`.
 */
export type TilmeldAfterLDAPSourceSaveCallback = (
  ldapsource: LDAPSource,
) => Promise<void>;
/**
 * The transaction is available in `ldapsource.$nymph`.
 */
export type TilmeldBeforeLDAPSourceDeleteCallback = (
  ldapsource: LDAPSource,
) => Promise<void>;
/**
 * This is run before the transaction is committed, and you can perform
 * additional functions on the transaction, which is available in
 * `ldapsource.$nymph`.
 */
export type TilmeldAfterLDAPSourceDeleteCallback = (
  ldapsource: LDAPSource,
) => Promise<void>;

const LDAPSourceSchema = v.strictObject({
  ...nymphValibotProps,
  ...tilmeldValibotProps,

  /**
   * The host of the server.
   */
  host: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.regex(
      /^(?!.*[\x00-\x1F\x7F]).*$/,
      'String must not contain control characters.',
    ),
    v.check(
      (input) => input === input.trim(),
      'String must not contain leading or trailing whitespace.',
    ),
  ),
  /**
   * The port on the server. Default is 389 for plain/StartTLS, 636 for LDAPS.
   */
  port: v.exactOptional(v.pipe(v.number(), v.minValue(1), v.maxValue(65535))),
  /**
   * The encryption type.
   */
  encryption: v.picklist(['none', 'starttls', 'ldaps']),
  /**
   * Whether to ignore SSL certificate errors.
   *
   * This is not secure, and should not be used in production environments.
   */
  ignoreCertificateErrors: v.boolean(),
  /**
   * The Distinguished Name or User Principal Name of a service account.
   *
   * This account will be used to search the directory. Leave null for anonymous
   * bind.
   */
  bindUsername: v.pipe(
    v.string(),
    v.regex(
      /^(?!.*[\x00-\x1F\x7F]).*$/,
      'String must not contain control characters.',
    ),
    v.check(
      (input) => input === input.trim(),
      'String must not contain leading or trailing whitespace.',
    ),
  ),

  /**
   * The password for the bind account.
   */
  bindPassword: v.pipe(
    v.string(),
    v.regex(
      /^(?!.*[\x00-\x1F\x7F]).*$/,
      'String must not contain control characters.',
    ),
    v.check(
      (input) => input === input.trim(),
      'String must not contain leading or trailing whitespace.',
    ),
  ),

  /**
   * The base Distinguished Name used to search for user entries.
   */
  searchBase: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.regex(
      /^(?!.*[\x00-\x1F\x7F]).*$/,
      'String must not contain control characters.',
    ),
    v.check(
      (input) => input === input.trim(),
      'String must not contain leading or trailing whitespace.',
    ),
  ),
  /**
   * The LDAP search filter used to find all users.
   *
   * Use `(objectClass=organizationalPerson)` for most directories.
   */
  userFilter: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.regex(
      /^(?!.*[\x00-\x1F\x7F]).*$/,
      'String must not contain control characters.',
    ),
    v.check(
      (input) => input === input.trim(),
      'String must not contain leading or trailing whitespace.',
    ),
  ),
  /**
   * The LDAP search filter used to find the user.
   *
   * Use `{0}` as a placeholder for the username.
   *
   * Use `(sAMAccountName={0})` for Active Directory. Use `(uid={0})` for
   * OpenLDAP. Use `(userPrincipalName={0})` if usernames in the directory are
   * stored under the "userPrincipalName" attribute.
   */
  userSearchFilter: v.pipe(
    v.string(),
    v.nonEmpty(),
    v.regex(
      /^(?!.*[\x00-\x1F\x7F]).*$/,
      'String must not contain control characters.',
    ),
    v.check(
      (input) => input === input.trim(),
      'String must not contain leading or trailing whitespace.',
    ),
  ),
  /**
   * The user attribute listing group memberships.
   *
   * Use `memberOf` for Active Directory.
   */
  groupAttributeOnUser: v.exactOptional(
    v.pipe(
      v.string(),
      v.nonEmpty(),
      v.regex(
        /^(?!.*[\x00-\x1F\x7F]).*$/,
        'String must not contain control characters.',
      ),
      v.check(
        (input) => input === input.trim(),
        'String must not contain leading or trailing whitespace.',
      ),
    ),
  ),
  /**
   * The group attribute listing member users.
   *
   * Use `uniqueMember` for LDAP. Empty for Active Directory.
   */
  groupAttributeOnGroup: v.exactOptional(
    v.pipe(
      v.string(),
      v.nonEmpty(),
      v.regex(
        /^(?!.*[\x00-\x1F\x7F]).*$/,
        'String must not contain control characters.',
      ),
      v.check(
        (input) => input === input.trim(),
        'String must not contain leading or trailing whitespace.',
      ),
    ),
  ),
  /**
   * Restrict user registration only to users belonging to a mapped group.
   *
   * If you set this to true and don't map any groups, no users will be able to
   * register an account through this LDAP source.
   */
  restrictRegistrationToMappedUsers: v.boolean(),
  /**
   * A map of remote groups to their local group equivalents.
   *
   * An LDAP user's group membership in these groups will be synced every time
   * they log in.
   */
  groupMap: v.array(
    v.strictObject({
      remoteDN: v.pipe(
        v.string(),
        v.nonEmpty(),
        v.regex(
          /^(?!.*[\x00-\x1F\x7F]).*$/,
          'String must not contain control characters.',
        ),
        v.check(
          (input) => input === input.trim(),
          'String must not contain leading or trailing whitespace.',
        ),
      ),
      localGroup: v.lazy(() => v.instance(GroupClass)),
    }),
  ),
  /**
   * The mapping of attributes from Nymph to LDAP.
   *
   * The only required attribute is username.
   */
  attributeMap: v.strictObject({
    nameFirst: v.exactOptional(
      v.pipe(
        v.string(),
        v.nonEmpty(),
        v.regex(
          /^(?!.*[\x00-\x1F\x7F]).*$/,
          'String must not contain control characters.',
        ),
        v.check(
          (input) => input === input.trim(),
          'String must not contain leading or trailing whitespace.',
        ),
      ),
    ),
    nameMiddle: v.exactOptional(
      v.pipe(
        v.string(),
        v.nonEmpty(),
        v.regex(
          /^(?!.*[\x00-\x1F\x7F]).*$/,
          'String must not contain control characters.',
        ),
        v.check(
          (input) => input === input.trim(),
          'String must not contain leading or trailing whitespace.',
        ),
      ),
    ),
    nameLast: v.exactOptional(
      v.pipe(
        v.string(),
        v.nonEmpty(),
        v.regex(
          /^(?!.*[\x00-\x1F\x7F]).*$/,
          'String must not contain control characters.',
        ),
        v.check(
          (input) => input === input.trim(),
          'String must not contain leading or trailing whitespace.',
        ),
      ),
    ),
    name: v.exactOptional(
      v.pipe(
        v.string(),
        v.nonEmpty(),
        v.regex(
          /^(?!.*[\x00-\x1F\x7F]).*$/,
          'String must not contain control characters.',
        ),
        v.check(
          (input) => input === input.trim(),
          'String must not contain leading or trailing whitespace.',
        ),
      ),
    ),
    phone: v.exactOptional(
      v.pipe(
        v.string(),
        v.nonEmpty(),
        v.regex(
          /^(?!.*[\x00-\x1F\x7F]).*$/,
          'String must not contain control characters.',
        ),
        v.check(
          (input) => input === input.trim(),
          'String must not contain leading or trailing whitespace.',
        ),
      ),
    ),
    email: v.exactOptional(
      v.pipe(
        v.string(),
        v.nonEmpty(),
        v.regex(
          /^(?!.*[\x00-\x1F\x7F]).*$/,
          'String must not contain control characters.',
        ),
        v.check(
          (input) => input === input.trim(),
          'String must not contain leading or trailing whitespace.',
        ),
      ),
    ),
    username: v.pipe(
      v.string(),
      v.nonEmpty(),
      v.regex(
        /^(?!.*[\x00-\x1F\x7F]).*$/,
        'String must not contain control characters.',
      ),
      v.check(
        (input) => input === input.trim(),
        'String must not contain leading or trailing whitespace.',
      ),
    ),
    avatar: v.exactOptional(
      v.pipe(
        v.string(),
        v.nonEmpty(),
        v.regex(
          /^(?!.*[\x00-\x1F\x7F]).*$/,
          'String must not contain control characters.',
        ),
        v.check(
          (input) => input === input.trim(),
          'String must not contain leading or trailing whitespace.',
        ),
      ),
    ),
    enabled: v.exactOptional(
      v.pipe(
        v.string(),
        v.nonEmpty(),
        v.regex(
          /^(?!.*[\x00-\x1F\x7F]).*$/,
          'String must not contain control characters.',
        ),
        v.check(
          (input) => input === input.trim(),
          'String must not contain leading or trailing whitespace.',
        ),
      ),
    ),
  }),

  /**
   * Whether users and groups from this LDAP Source are synced and enabled.
   */
  enabled: v.boolean(),
});

type LDAPSourceData = Omit<
  v.InferInput<typeof LDAPSourceSchema>,
  keyof typeof nymphValibotProps
>;

export interface LDAPSource extends LDAPSourceData {}

/**
 * An LDAP source data model.
 *
 * LDAP authentication is a two step process. First, Nymph will bind to the
 * server with the service account to look up the user, then Nymph will rebind
 * to the server as the user to validate their credentials.
 *
 * Local users will take precendence over LDAP users, so if a new LDAP user
 * tries to log in, and their username is already taken by a local user, they
 * will not be able to log in.
 *
 * LDAP users are synchronized with the server every time they log in. If you
 * need to force a synchronization, you can expire the user's auth tokens to
 * force them to log in again, which will synchronize their account.
 *
 * Two factor authentication is managed by Nymph. LDAP users can configure two
 * factor authentication for their account, but that will only be enforced by
 * Nymph; it does not get synchronized with the LDAP server.
 *
 * LDAP users' groups cannot be managed locally. Their primary group exists
 * locally, but all of their secondary groups only come from the group mapping.
 * Remember that a user must log in again to synchronize their group membership
 * after it is changed on the LDAP server.
 *
 * Written by Hunter Perrin for SciActive.
 *
 * @author Hunter Perrin <hperrin@port87.com>
 * @copyright SciActive Inc
 * @see http://nymph.io/
 */
export class LDAPSource extends Entity<LDAPSourceData> {
  static ETYPE = 'tilmeld_ldapsource';
  static class = 'LDAPSource';
  private static beforeSaveCallbacks: TilmeldBeforeLDAPSourceSaveCallback[] =
    [];
  private static afterSaveCallbacks: TilmeldAfterLDAPSourceSaveCallback[] = [];
  private static beforeDeleteCallbacks: TilmeldBeforeLDAPSourceDeleteCallback[] =
    [];
  private static afterDeleteCallbacks: TilmeldAfterLDAPSourceDeleteCallback[] =
    [];

  private static DEFAULT_PRIVATE_DATA = [
    // By default, all data is private. Regular users shouldn't have access.
    'host',
    'port',
    'encryption',
    'ignoreCertificateErrors',
    'bindUsername',
    'bindPassword',
    'searchBase',
    'userFilter',
    'userSearchFilter',
    'groupAttributeOnUser',
    'groupAttributeOnGroup',
    'restrictRegistrationToMappedUsers',
    'groupMap',
    'attributeMap',
    'enabled',
  ];
  private static DEFAULT_ALLOWLIST_DATA: string[] = [];

  protected $tags = [];
  protected $clientEnabledMethods = [
    '$testBind',
    '$testList',
    '$testMapping',
    '$testSearch',
    '$getUsers',
  ];
  public static clientEnabledStaticMethods = ['getMappableGroups'];
  protected $privateData = [...LDAPSource.DEFAULT_PRIVATE_DATA];
  public static searchRestrictedData = ['bindPassword'];
  protected $allowlistData? = [...LDAPSource.DEFAULT_ALLOWLIST_DATA];
  protected $allowlistTags?: string[] = [];

  /**
   * Get all the groups that can be mapped to a source.
   *
   * @param options The options for an optional search query.
   * @param selectors The selectors for an optional search query.
   * @returns An array of the mappable groups.
   */
  public static async getMappableGroups(
    options?: Options,
    selectors?: Selector[],
  ) {
    let tilmeld = enforceTilmeld(this);
    if (!tilmeld.gatekeeper('system/admin')) {
      throw new AccessControlError(
        "You don't have the authority to manage LDAP sources.",
      );
    }

    ({ options, selectors } = clearSearchRestrictedData({
      options: { ...options, class: tilmeld.Group, return: 'entity' },
      selectors: [...(selectors ?? [])],
    }));

    return await this.nymph.getEntities(options, ...selectors);
  }

  public static entryToRawLDAPEntry(entry: Entry): RawLDAPEntry {
    return {
      ...Object.fromEntries(
        Object.entries(entry).map(([name, value]) => {
          if (typeof value === 'string') {
            return [name, value] as [
              string,
              RawLDAPBinaryData | RawLDAPBinaryData[] | string[] | string,
            ];
          } else if (Array.isArray(value)) {
            return [
              name,
              value.map((arrayVal) =>
                typeof arrayVal === 'string'
                  ? arrayVal
                  : { base64: arrayVal.toString('base64') },
              ),
            ] as [
              string,
              RawLDAPBinaryData | RawLDAPBinaryData[] | string[] | string,
            ];
          } else {
            return [name, { base64: value.toString('base64') }] as [
              string,
              RawLDAPBinaryData | RawLDAPBinaryData[] | string[] | string,
            ];
          }
        }),
      ),
      dn: entry.dn,
    };
  }

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
    // No clean mapping in AD to Nymph's prop.
    // avatar
    this.$updateDataProtection();
  }

  public $putData(
    data: LDAPSourceData,
    sdata?: SerializedEntityData,
    source?: 'server',
  ) {
    super.$putData(data, sdata, source);
    this.$updateDataProtection();
  }

  /**
   * Update the data protection arrays for the current user.
   */
  public $updateDataProtection() {
    const tilmeld = enforceTilmeld(this);

    this.$privateData = [...LDAPSource.DEFAULT_PRIVATE_DATA];
    this.$allowlistData = [...LDAPSource.DEFAULT_ALLOWLIST_DATA];

    if (
      tilmeld.gatekeeper('tilmeld/admin') ||
      tilmeld.gatekeeper('system/admin')
    ) {
      // This is an admin, so they can edit LDAP sources.
      this.$privateData = [];
      this.$allowlistData = undefined;
    }
  }

  public $wakeSkipAc() {
    this.$useSkipAc(true);
    try {
      const result = this.$wake();
      this.$useSkipAc(false);
      return result;
    } catch (e: any) {
      this.$useSkipAc(false);
      throw e;
    }
  }

  public async $getClient(authenticate = true) {
    const proto = this.encryption === 'ldaps' ? 'ldaps' : 'ldap';
    const ext =
      (proto === 'ldaps' && this.port != null && this.port !== 636) ||
      (proto === 'ldap' && this.port != null && this.port !== 389)
        ? `:${parseFloat(`${this.port}`)}`
        : '';

    const options: ClientOptions = {
      url: `${proto}://${this.host}${ext}`,
      timeout: 0,
      connectTimeout: 0,
      strictDN: true,
      autoRebind: true,
    };

    if (this.encryption !== 'none') {
      options.tlsOptions = {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: !this.ignoreCertificateErrors,
      };
    }

    const client = new Client(options);

    if (this.encryption === 'starttls') {
      await client.startTLS({
        minVersion: 'TLSv1.2',
        rejectUnauthorized: !this.ignoreCertificateErrors,
      });
    }

    if (authenticate) {
      await client.bind(this.bindUsername, this.bindPassword);
    }

    return client;
  }

  @acceptStateFromClient
  public async $testBind(): Promise<void> {
    let tilmeld = enforceTilmeld(this);
    if (!tilmeld.gatekeeper('system/admin')) {
      throw new AccessControlError(
        "You don't have the authority to manage LDAP sources.",
      );
    }

    this.$formatData();

    try {
      const client = await this.$getClient(false);

      await client.bind(this.bindUsername, this.bindPassword);
      try {
        await client.unbind();
      } catch (e: any) {
        throw new Error(
          `Bind was successful, but unbind resulted in error: ${e.message}`,
        );
      }
    } catch (e: any) {
      console.error('During Bind Test:', e);
      throw e;
    }
  }

  @acceptStateFromClient
  public async $testList(): Promise<RawLDAPSearchResult> {
    let tilmeld = enforceTilmeld(this);
    if (!tilmeld.gatekeeper('system/admin')) {
      throw new AccessControlError(
        "You don't have the authority to manage LDAP sources.",
      );
    }

    this.$formatData();

    const client = await this.$getClient();

    const results = await client.search(this.searchBase, {
      derefAliases: 'search',
    });

    const entries = results.searchEntries.map((entry) =>
      LDAPSource.entryToRawLDAPEntry(entry),
    ) as RawLDAPEntry[];

    await client.unbind();

    return entries;
  }

  @acceptStateFromClient
  public async $testMapping(username: string): Promise<UserClass | null> {
    let tilmeld = enforceTilmeld(this);
    if (!tilmeld.gatekeeper('system/admin')) {
      throw new AccessControlError(
        "You don't have the authority to manage LDAP sources.",
      );
    }

    this.$formatData();
    let user = tilmeld.User.factorySync();
    user.username = username;

    const info = await this.$fillUser({ user });

    return info == null ? null : user;
  }

  @acceptStateFromClient
  public async $testSearch(username: string): Promise<RawLDAPEntry | null> {
    let tilmeld = enforceTilmeld(this);
    if (!tilmeld.gatekeeper('system/admin')) {
      throw new AccessControlError(
        "You don't have the authority to manage LDAP sources.",
      );
    }

    this.$formatData();

    const results = await this.$search(username);

    if (results == null) {
      return null;
    }

    return LDAPSource.entryToRawLDAPEntry(results);
  }

  public async $search(username: string): Promise<Entry | null> {
    const client = await this.$getClient();

    const results = await client.search(this.searchBase, {
      filter: this.userSearchFilter.replace('{0}', Filter.escape(username)),
      derefAliases: 'search',
    });

    await client.unbind();

    if (results.searchEntries.length > 1) {
      throw new AmbiguousUserError(
        `Username search results in more than one user found for: ${username}`,
      );
    }

    if (results.searchEntries.length < 1) {
      return null;
    }

    return results.searchEntries[0];
  }

  public async $fillUser({ user }: { user: UserClass }) {
    const userInfo = await this.$search(user.username);

    if (userInfo == null) {
      return null;
    }

    user.source = this;

    if (this.attributeMap.nameFirst?.trim()) {
      user.nameFirst = evalEstreeExpression.default.evaluate.sync(
        whence.default.parse(this.attributeMap.nameFirst),
        userInfo,
      );
    }
    if (this.attributeMap.nameMiddle?.trim()) {
      user.nameMiddle = evalEstreeExpression.default.evaluate.sync(
        whence.default.parse(this.attributeMap.nameMiddle),
        userInfo,
      );
    }
    if (this.attributeMap.nameLast?.trim()) {
      user.nameLast = evalEstreeExpression.default.evaluate.sync(
        whence.default.parse(this.attributeMap.nameLast),
        userInfo,
      );
    }
    if (this.attributeMap.name?.trim()) {
      user.name = evalEstreeExpression.default.evaluate.sync(
        whence.default.parse(this.attributeMap.name),
        userInfo,
      );
    }
    if (this.attributeMap.phone?.trim()) {
      user.phone = evalEstreeExpression.default.evaluate.sync(
        whence.default.parse(this.attributeMap.phone),
        userInfo,
      );
    }
    if (this.attributeMap.email?.trim()) {
      user.email = evalEstreeExpression.default.evaluate.sync(
        whence.default.parse(this.attributeMap.email),
        userInfo,
      );
    }
    if (this.attributeMap.username?.trim()) {
      user.username = evalEstreeExpression.default.evaluate.sync(
        whence.default.parse(this.attributeMap.username),
        userInfo,
      );
    }
    if (this.attributeMap.avatar?.trim()) {
      user.avatar = evalEstreeExpression.default.evaluate.sync(
        whence.default.parse(this.attributeMap.avatar),
        userInfo,
      );
      if (Buffer.isBuffer(user.avatar)) {
        const fileType = await fileTypeFromBuffer(Buffer.from(user.avatar));
        user.avatar = `data:${fileType?.mime ?? 'image/jpeg'};base64,${user.avatar.toString('base64url')}`;
      }
    }
    if (this.attributeMap.enabled?.trim()) {
      user.enabled = !!evalEstreeExpression.default.evaluate.sync(
        whence.default.parse(this.attributeMap.enabled),
        userInfo,
      );
    }

    if (
      user.name &&
      !user.nameFirst &&
      user.nameLast &&
      user.name !== user.nameLast &&
      user.name.endsWith(user.nameLast)
    ) {
      user.nameFirst = user.name
        .slice(0, user.name.length - user.nameLast.length)
        .trim();
    }

    if (
      user.name &&
      !user.nameLast &&
      user.nameFirst &&
      user.name !== user.nameFirst &&
      user.name.startsWith(user.nameFirst)
    ) {
      user.nameLast = user.name
        .slice(user.name.length - user.nameFirst.length)
        .trim();
    }

    if (user.phone) {
      user.phone = user.phone.replace(/\D/g, () => '');
    }

    if (this.groupAttributeOnUser != null) {
      const groupAssignment = userInfo[this.groupAttributeOnUser];
      const groupAssignmentStrings = Buffer.isBuffer(groupAssignment)
        ? groupAssignment.toString('utf8')
        : typeof groupAssignment === 'string'
          ? groupAssignment
          : groupAssignment.map<string>((group) =>
              Buffer.isBuffer(group) ? group.toString('utf8') : `${group}`,
            );
      for (let { remoteDN, localGroup } of this.groupMap) {
        if (
          remoteDN === groupAssignmentStrings ||
          (Array.isArray(groupAssignmentStrings) &&
            groupAssignmentStrings.includes(remoteDN))
        ) {
          if (!localGroup.$inArray(user.groups)) {
            user.groups.push(localGroup);
          }
        } else {
          const idx = localGroup.$arraySearch(user.groups);
          if (idx > -1) {
            user.groups.splice(idx, 1);
          }
        }
      }
    }

    if (this.groupAttributeOnGroup != null) {
      const client = await this.$getClient();

      for (let { remoteDN, localGroup } of this.groupMap) {
        const searchResults = await client.search(remoteDN, {
          scope: 'base',
          derefAliases: 'search',
        });

        if (!searchResults.searchEntries?.length) {
          throw new AmbiguousUserError(
            'Group search returned no entries: ' + remoteDN,
          );
        }

        if (searchResults.searchEntries.length > 1) {
          throw new AmbiguousUserError(
            'Group search returned multiple entries: ' + remoteDN,
          );
        }

        const groupInfo = searchResults.searchEntries[0];

        const userAssignment = groupInfo[this.groupAttributeOnGroup];
        const userAssignmentStrings = Buffer.isBuffer(userAssignment)
          ? userAssignment.toString('utf8')
          : typeof userAssignment === 'string'
            ? userAssignment
            : userAssignment.map<string>((group) =>
                Buffer.isBuffer(group) ? group.toString('utf8') : `${group}`,
              );

        if (
          userInfo.dn === userAssignmentStrings ||
          (Array.isArray(userAssignmentStrings) &&
            userAssignmentStrings.includes(userInfo.dn))
        ) {
          if (!localGroup.$inArray(user.groups)) {
            user.groups.push(localGroup);
          }
        } else {
          const idx = localGroup.$arraySearch(user.groups);
          if (idx > -1) {
            user.groups.splice(idx, 1);
          }
        }
      }

      await client.unbind();
    }

    // Password is a required field, so we have to put _something_ there.
    // As long as the system is set up correctly, this password should never be
    // checked anyway, and it would only work with plain text password storage.
    user.password = `ldap-${this.guid}`;

    return userInfo;
  }

  public async $authenticate({
    user,
    password,
  }: {
    /**
     * The user to authenticate.
     *
     * If the user is new, fill in their username and source.
     */
    user: UserClass;
    /**
     * The password provided by the user.
     */
    password: string;
  }): Promise<boolean> {
    const tilmeld = enforceTilmeld(this);

    if (!this.$is(user.source)) {
      throw new BadDataError('This LDAP source is not the source of the user.');
    }

    if (!tilmeld.config.ldapSupport) {
      throw new AccessControlError(
        'LDAP support is not enabled on this server.',
      );
    }

    if (
      !user.username ||
      typeof user.username !== 'string' ||
      user.username.trim() === ''
    ) {
      throw new BadDataError('Username is required.');
    }

    if (!this.enabled) {
      // This source has been disabled.
      return false;
    }

    const userInfo = await this.$fillUser({ user });

    if (userInfo?.dn == null) {
      if (user.guid != null) {
        // The user was deleted on the LDAP server.
        user.enabled = false;
        await user.$saveSkipAC();
      }
      return false;
    }

    try {
      // Now we're ready to try to bind to the LDAP server with that user.
      const client = await this.$getClient(false);
      await client.bind(userInfo.dn, password);
      await client.unbind();
    } catch (e: any) {
      if (e instanceof InvalidCredentialsError) {
        // Couldn't bind with the user.
        return false;
      }
      throw e;
    }

    // We've successfully bound, which means the user has given the right
    // credentials.

    // Now we should check whether they mapped to a group.
    if (this.restrictRegistrationToMappedUsers && !user.groups.length) {
      // The user didn't map to any groups. They shouldn't be able to log in.
      if (user.guid != null) {
        // The user was removed from a mapped group.
        user.enabled = false;
        await user.$saveSkipAC();
      }
      return false;
    }

    if (user.guid != null) {
      // If we get here, everything was successful and the user already existed.
      // Now we save the user with the updated info.
      await user.$saveSkipAC();
    }

    return true;
  }

  /**
   * Gets an array of users from this source.
   *
   * @param limit The limit for the query.
   * @param offset The offset for the query.
   * @param reverse Reverse the sort.
   * @param sort Sort the results.
   * @param enabled If set, return enabled/disabled users only.
   * @returns An array of users.
   */
  public async $getUsers(
    limit?: number,
    offset?: number,
    reverse?: boolean,
    sort?: string,
    enabled?: boolean,
  ): Promise<{ entities: UserClass[]; count: number }> {
    let tilmeld = enforceTilmeld(this);
    if (!tilmeld.gatekeeper('system/admin')) {
      throw new AccessControlError(
        "You don't have the authority to manage LDAP sources.",
      );
    }

    limit = limit == null || isNaN(Number(limit)) ? undefined : Number(limit);
    offset =
      offset == null || isNaN(Number(offset)) ? undefined : Number(offset);
    reverse = reverse == null ? undefined : !!reverse;
    sort =
      typeof sort === 'string' &&
      !tilmeld.User.searchRestrictedData.includes(sort)
        ? sort
        : undefined;
    enabled = enabled == null ? undefined : !!enabled;

    const entities = await this.$nymph.getEntities(
      { class: tilmeld.User, limit, offset, reverse, sort },
      {
        type: '&',
        ref: ['source', this],
      },
      ...(enabled == null
        ? []
        : [{ type: '&', equal: ['enabled', enabled] } as Selector]),
    );

    const count = await this.$nymph.getEntities(
      { class: tilmeld.User, return: 'count' },
      {
        type: '&',
        ref: ['source', this],
      },
      ...(enabled == null
        ? []
        : [{ type: '&', equal: ['enabled', enabled] } as Selector]),
    );

    return { entities, count };
  }

  public async $validate() {
    const obj = this.$getValidatable();
    try {
      v.parse(LDAPSourceSchema, obj);
    } catch (e: any) {
      console.log(obj);

      throw new BadDataError(
        `Invalid ${(this.constructor as EntityConstructor).class}: ` +
          (e instanceof v.ValiError
            ? Object.entries(v.flatten(e.issues).nested || {})
                .map(([field, messages]) => `"${field}": ${messages}`)
                .join(', ')
            : e?.message),
      );
    }
  }

  public $formatData() {
    this.host = this.host.trim();

    // Clear empty values.
    if (this.port == null || this.port === 0) {
      delete this.port;
    }
    if (this.groupAttributeOnUser == null || this.groupAttributeOnUser === '') {
      delete this.groupAttributeOnUser;
    }
    if (
      this.groupAttributeOnGroup == null ||
      this.groupAttributeOnGroup === ''
    ) {
      delete this.groupAttributeOnGroup;
    }
    if (
      this.attributeMap.nameFirst == null ||
      this.attributeMap.nameFirst === ''
    ) {
      delete this.attributeMap.nameFirst;
    }
    if (
      this.attributeMap.nameMiddle == null ||
      this.attributeMap.nameMiddle === ''
    ) {
      delete this.attributeMap.nameMiddle;
    }
    if (
      this.attributeMap.nameLast == null ||
      this.attributeMap.nameLast === ''
    ) {
      delete this.attributeMap.nameLast;
    }
    if (this.attributeMap.name == null || this.attributeMap.name === '') {
      delete this.attributeMap.name;
    }
    if (this.attributeMap.phone == null || this.attributeMap.phone === '') {
      delete this.attributeMap.phone;
    }
    if (this.attributeMap.email == null || this.attributeMap.email === '') {
      delete this.attributeMap.email;
    }
    if (this.attributeMap.avatar == null || this.attributeMap.avatar === '') {
      delete this.attributeMap.avatar;
    }
    if (this.attributeMap.enabled == null || this.attributeMap.enabled === '') {
      delete this.attributeMap.enabled;
    }
  }

  public async $save() {
    let tilmeld = enforceTilmeld(this);

    if (!tilmeld.gatekeeper('system/admin')) {
      throw new AccessControlError(
        "You don't have the authority to manage LDAP sources.",
      );
    }

    if (!tilmeld.config.ldapSupport) {
      throw new AccessControlError(
        'LDAP support is not enabled on this server.',
      );
    }

    // Formatting.
    this.$formatData();

    // Validate before transaction, to catch issues early.
    await this.$validate();

    let preGuid = this.guid;
    let preCdate = this.cdate;
    let preMdate = this.mdate;
    return await transaction(
      this.$nymph,
      'tilmeld-save-ldapsource-' + (this.guid || nanoid()),
      async (nymph) => {
        this.$setNymph(nymph);

        for (let callback of (this.constructor as typeof LDAPSource)
          .beforeSaveCallbacks) {
          if (callback) {
            await callback(this);
          }
        }

        // Validate again within transaction, to catch any issues before saving.
        await this.$validate();

        await super.$save();

        for (let callback of (this.constructor as typeof LDAPSource)
          .afterSaveCallbacks) {
          if (callback) {
            await callback(this);
          }
        }
      },
      async (nymph, committed) => {
        this.$setNymph(nymph);

        if (!committed) {
          this.guid = preGuid;
          this.cdate = preCdate;
          this.mdate = preMdate;
        }
      },
    );
  }

  @transactional
  public async $delete() {
    let tilmeld = enforceTilmeld(this);

    if (!tilmeld.gatekeeper('system/admin')) {
      throw new AccessControlError(
        "You don't have the authority to manage ldapsources.",
      );
    }

    for (let callback of (this.constructor as typeof LDAPSource)
      .beforeDeleteCallbacks) {
      if (callback) {
        await callback(this);
      }
    }

    // Delete its users.
    const users = await this.$nymph.getEntities(
      { class: tilmeld.User, skipAc: true },
      {
        type: '&',
        ref: ['source', this],
      },
    );
    if (users.length) {
      for (let curUser of users) {
        await curUser.$delete();
      }
    }

    // Delete the ldapsource.
    await super.$delete();

    for (let callback of (this.constructor as typeof LDAPSource)
      .afterDeleteCallbacks) {
      if (callback) {
        await callback(this);
      }
    }
  }

  public static on<T extends LDAPSourceEventType>(
    event: T,
    callback: T extends 'beforeSave'
      ? TilmeldBeforeLDAPSourceSaveCallback
      : T extends 'afterSave'
        ? TilmeldAfterLDAPSourceSaveCallback
        : T extends 'beforeDelete'
          ? TilmeldBeforeLDAPSourceDeleteCallback
          : T extends 'afterDelete'
            ? TilmeldAfterLDAPSourceDeleteCallback
            : never,
  ) {
    const prop = (event + 'Callbacks') as T extends 'beforeSave'
      ? 'beforeSaveCallbacks'
      : T extends 'afterSave'
        ? 'afterSaveCallbacks'
        : T extends 'beforeDelete'
          ? 'beforeDeleteCallbacks'
          : T extends 'afterDelete'
            ? 'afterDeleteCallbacks'
            : never;
    if (!(prop in this)) {
      throw new Error('Invalid event type.');
    }
    // @ts-ignore: The callback should always be the right type here.
    this[prop].push(callback);
    return () => this.off(event, callback);
  }

  public static off<T extends LDAPSourceEventType>(
    event: T,
    callback: T extends 'beforeSave'
      ? TilmeldBeforeLDAPSourceSaveCallback
      : T extends 'afterSave'
        ? TilmeldAfterLDAPSourceSaveCallback
        : T extends 'beforeDelete'
          ? TilmeldBeforeLDAPSourceDeleteCallback
          : T extends 'afterDelete'
            ? TilmeldAfterLDAPSourceDeleteCallback
            : never,
  ) {
    const prop = (event + 'Callbacks') as T extends 'beforeSave'
      ? 'beforeSaveCallbacks'
      : T extends 'afterSave'
        ? 'afterSaveCallbacks'
        : T extends 'beforeDelete'
          ? 'beforeDeleteCallbacks'
          : T extends 'afterDelete'
            ? 'afterDeleteCallbacks'
            : never;
    if (!(prop in this)) {
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

/*
= Active Directory Attributes

| Description                                                           | Attribute                       |
| --------------------------------------------------------------------- | ------------------------------- |
| First Name                                                            | givenName                       |
| Middle Name/Initials                                                  | initials                        |
| Last Name                                                             | sn                              |
| Logon Name                                                            | userPrincipalName               |
| Logon Name (Pre Windows 2000)                                         | sAMAccountName                  |
| Display Name                                                          | displayName                     |
| Full Name                                                             | name/cn                         |
| Description                                                           | description                     |
| Office                                                                | physicalDeliveryOfficeName      |
| Telephone Number                                                      | telephoneNumber                 |
| Email                                                                 | mail                            |
| Web Page                                                              | wWWHomePage                     |
| Password                                                              | password                        |
| Street                                                                | streetAddress                   |
| PO Box                                                                | postOfficeBox                   |
| City                                                                  | I                               |
| State/Province                                                        | st                              |
| Zip/Postal Code                                                       | postalCode                      |
| Country                                                               | co                              |
| Country 2 Digit Code - e.g., US                                       | c                               |
| Country Code - e.g., 840 for the US                                   | countryCode                     |
| Add to Groups                                                         | memberOf                        |
| Remove from Groups                                                    | removememberOf                  |
| Account Expires (use the same date format as the server)              | accountExpires                  |
| User Account Control                                                  | userAccountControl              |
| User Photo (Thumbnail)                                                | thumbnailPhoto                  |
| User Photo (Alt, supports high resolution photos)                     | exchangePhoto                   |
| User Photo (Alt)                                                      | jpegPhoto                       |
| User Photo (Alt)                                                      | photo                           |
| User Photo (Thumbnail, Alt)                                           | thumbnailLogo                   |
| Profile Path                                                          | profilePath                     |
| Login Script                                                          | scriptPath                      |
| Home Folder                                                           | homeDirectory                   |
| Home Drive                                                            | homeDrive                       |
| Log on to                                                             | userWorkstations                |
| Home                                                                  | homePhone                       |
| Pager                                                                 | pager                           |
| Mobile                                                                | mobile                          |
| Fax                                                                   | facisimileTelephoneNumber       |
| IP Phone                                                              | ipPhone                         |
| Notes                                                                 | info                            |
| Title                                                                 | title                           |
| Department                                                            | department                      |
| Company                                                               | company                         |
| Manager                                                               | manager                         |
| Mail Alias                                                            | mailNickName                    |
| Simple Display Name                                                   | displayNamePrintable            |
| Hide from Exchange Address Lists                                      | msExchHideFromAddressLists      |
| Sending Message Size (KB)                                             | submissionContLength            |
| Receiving Message Size (KB)                                           | delivContLength                 |
| Accept Messages from Authenticated Users Only                         | msExchRequireAuthToSendTo       |
| Reject Messages From                                                  | unauthOrig                      |
| Accept Messages From                                                  | authOrig                        |
| Send on Behalf                                                        | publicDelegates                 |
| Forward To                                                            | altRecipient                    |
| Deliver and Redirect                                                  | deliverAndRedirect              |
| Recipient Limits                                                      | msExchRecipLimit                |
| Use Mailbox Store Defaults                                            | mDBuseDefaults                  |
| Issue Warning at (KB)                                                 | mDBStorageQuota                 |
| Prohibit Send at (KB)                                                 | mDBOverQuotaLimit               |
| Prohibit Send and Receive at (KB)                                     | mDBOverHardQuotaLimit           |
| Do not Permanently Delete Messages Until the Store Has Been Backed Up | deletedItemFlags                |
| Keep Deleted Items for (days)                                         | garbageCollPeriod               |
| Outlook Mobile Access                                                 | msExchOmaAdminWirelessEnable    |
| Outlook Web Access                                                    | protocolSettings                |
| Allow Terminal Server Logon                                           | tsAllowLogon                    |
| Terminal Services Profile Path                                        | tsProfilePath                   |
| Terminal Services Home Directory                                      | tsHomeDir                       |
| Start the Following Program at Logon                                  | tsInheritInitialProgram         |
| Starting Program File Name                                            | tsInitialProgram                |
| Start In                                                              | tsWorkingDir                    |
| Connect Client Drive at Logon                                         | tsDeviceClientDrives            |
| Connect Client Printer at Logon                                       | tsDeviceClientPrinters          |
| Default to Main Client Printer                                        | tsDeviceClientDefaultPrinter    |
| End Disconnected Session                                              | tsTimeOutSettingsDisConnections |
| Active Session Limit                                                  | tsTimeOutSettingsConnections    |
| Idle Session Limit                                                    | tsTimeOutSettingsIdle           |
| When Session Limit Reached or Connection Broken                       | tsBrokenTimeOutSettings         |
| Allow Reconnection                                                    | tsReConnectSettings             |
| Remote Control                                                        | tsShadowSettings                |
| Protect Accidental Deletion                                           | preventDeletion                 |
| Manager Can Update Members                                            | managerCanUpdateMembers         |
| Primary Group ID                                                      | primaryGroupID                  |
| Administrative Group                                                  | msExchAdminGroup                |
| Exchange Server Name                                                  | msExchHomeServerName            |
| Managed By                                                            | managedBy                       |
| externalEmailAddress                                                  | targetAddress                   |
| Add Proxy Addresses                                                   | proxyAddresses                  |
| Automatically Update Email-Address Based on Recipient Policy          | msExchPoliciesExcluded          |
| Employee Identifier                                                   | employeeID                      |
| The user's division                                                   | division                        |
*/
