import {
  Nymph,
  EntityInterface,
  FormattedSelector,
  Options,
  TilmeldInterface,
  TilmeldAccessLevels,
} from '@nymphjs/nymph';
import { Request, Response } from 'express';

import { Config, ConfigDefaults as defaults } from './conf';
import { AccessControlError } from './errors';
import Group from './Group';
import User, { UserData } from './User';
import { AccessControlData } from './Tilmeld.types';

/**
 * A user and group system for Nymph.js.
 *
 * Written by Hunter Perrin for SciActive.
 *
 * @author Hunter Perrin <hperrin@gmail.com>
 * @copyright SciActive Inc
 * @see http://nymph.io/
 */
export default class Tilmeld implements TilmeldInterface {
  /**
   * The Nymph instance.
   */
  public nymph: Nymph = {} as Nymph;

  /**
   * The Tilmeld config.
   */
  public config: Config;

  /**
   * The currently logged in user.
   */
  public currentUser: (User & UserData) | null = null;

  /**
   * The user class for this instance of Tilmeld.
   */
  public User: typeof User = User;

  /**
   * The group class for this instance of Tilmeld.
   */
  public Group: typeof Group = Group;

  /**
   * If you will be performing authentication functions (logging in/out), you
   * should set these so Tilmeld can read and write cookies and headers.
   *
   * If you want the user to be authenticated with the cookie and/or header they
   * provide, you should set at least the request. It's better to set both, so
   * the JWT can be updated if needed.
   *
   * After you set these, call `authenticate()` to read user authentication data
   * from them and fill the user's session.
   *
   * If you want to support cookie based authentication (which still requires an
   * XSRF token for security), you should enable the cookie parser middleware.
   */
  public request: Request | null = null;
  public response: Response | null = null;

  /**
   * Skip the authenticate step of initialization.
   */
  private skipAuthenticate = false;

  /**
   * Create a new instance of Tilmeld.
   *
   * @param config The Tilmeld configuration.
   */
  public constructor(config: Partial<Config> & { jwtSecret: string }) {
    this.config = { ...defaults, ...config };
  }

  /**
   * This is used internally by Nymph. Don't call it yourself.
   * @returns A clone of this instance.
   */
  public clone() {
    const tilmeld = new Tilmeld(this.config);
    tilmeld.request = this.request;
    tilmeld.response = this.response;
    tilmeld.currentUser = this.currentUser;
    tilmeld.skipAuthenticate = true;

    return tilmeld;
  }

  /**
   * Initialize Tilmeld.
   *
   * This is meant to be called internally by Nymph. Don't call this directly.
   *
   * @param nymph The Nymph instance.
   */
  public init(nymph: Nymph) {
    this.nymph = nymph;

    // Set up access control hooks when Nymph is called.
    if (this.nymph.driver == null) {
      throw new Error("Tilmeld can't be configured before Nymph.");
    }

    // Configure the classes.
    class NymphUser extends User {}
    NymphUser.nymph = this.nymph;
    NymphUser.tilmeld = this;
    (NymphUser as any).skipOnClone = true;
    this.User = NymphUser;
    this.nymph.addEntityClass(NymphUser);
    class NymphGroup extends Group {}
    NymphGroup.nymph = this.nymph;
    NymphGroup.tilmeld = this;
    (NymphUser as any).skipOnClone = true;
    this.Group = NymphGroup;
    this.nymph.addEntityClass(NymphGroup);

    this.initAccessControl();
    if (this.request != null && !this.skipAuthenticate) {
      this.authenticate();
    }
    this.skipAuthenticate = false;
  }

  /**
   * Check to see if the current user has an ability.
   *
   * If `ability` is undefined, it will check to see if a user is currently
   * logged in.
   *
   * @param ability The ability.
   * @returns Whether the user has the given ability.
   */
  public gatekeeper(ability?: string): boolean {
    if (this.currentUser == null) {
      return false;
    }
    return this.currentUser.$gatekeeper(ability);
  }

  private initAccessControl() {
    // Check for the skip access control option and add AC selectors.
    const handleQuery = function (
      nymph: Nymph,
      options: Options,
      selectors: FormattedSelector[]
    ) {
      const tilmeld = nymph.tilmeld as Tilmeld;
      if (
        !options ||
        !('skipAc' in options) ||
        !options.skipAc ||
        options.source === 'client'
      ) {
        if (options?.source === 'client') {
          if (
            !tilmeld.gatekeeper('tilmeld/admin') && // The user is not an admin.
            ((!tilmeld.config.enableUserSearch &&
              options.class?.factorySync() instanceof User) || // The use is searching for a user and searching is disabled.
              (!tilmeld.config.enableGroupSearch &&
                options.class?.factorySync() instanceof Group)) && // Or the same, but for a group.
            (selectors[0] == null || // No selector specified.
              selectors[0].type !== '&' || // Or the type is not and.
              (!('guid' in selectors[0]) && !('equal' in selectors[0])) || // Or they're searching for something other than guid or equal.
              ('guid' in selectors[0] &&
                (!selectors[0].guid?.length ||
                  !selectors[0].guid?.[0]?.length)) || // Or they're not searching for a specific guid.
              ('equal' in selectors[0] &&
                selectors[0].equal?.[0]?.[0] !== 'username' &&
                selectors[0].equal?.[0]?.[0] !== 'groupname')) // Or they're not searching for a specific username/groupname.
          ) {
            // If the user is not specifically searching for a GUID or username,
            // and they're not allowed to search, it should fail.
            throw new AccessControlError('No permission to search.');
          }
        }
        // Add access control selectors
        tilmeld.addAccessControlSelectors(options, selectors);
      }
    };
    handleQuery.skipOnClone = true;

    // Filter entities being deleted for user permissions.
    const checkPermissionsDelete = function (
      nymph: Nymph,
      entity: EntityInterface
    ) {
      const tilmeld = nymph.tilmeld as Tilmeld;
      if (
        typeof entity.$tilmeldDeleteSkipAC === 'function' &&
        entity.$tilmeldDeleteSkipAC()
      ) {
        return;
      }
      // Test for permissions.
      if (tilmeld.checkPermissions(entity, TilmeldAccessLevels.FULL_ACCESS)) {
        throw new AccessControlError('No permission to delete.');
      }
    };
    checkPermissionsDelete.skipOnClone = true;

    // Filter entities being deleted for user permissions.
    const checkPermissionsDeleteByID = function (
      nymph: Nymph,
      guid: string,
      className?: string
    ) {
      const entity = nymph.driver.getEntitySync(
        { class: nymph.getEntityClass(className ?? 'Entity') },
        { type: '&', guid: guid }
      );
      if (entity != null) {
        checkPermissionsDelete(nymph, entity);
      }
    };
    checkPermissionsDeleteByID.skipOnClone = true;

    // Filter entities being saved for user permissions, and filter any
    // disallowed changes to AC properties.
    const checkPermissionsSaveAndFilterAcChanges = function (
      nymph: Nymph,
      entity: EntityInterface & AccessControlData
    ) {
      const tilmeld = nymph.tilmeld as Tilmeld;
      if (!entity) {
        return;
      }
      if (
        typeof entity.$tilmeldSaveSkipAC === 'function' &&
        entity.$tilmeldSaveSkipAC()
      ) {
        return;
      }

      if (entity.guid != null) {
        // If the entity is not new, check that the user has full access before
        // allowing a change to ac properties.

        const originalAc = entity.$getOriginalAcValues();
        const newAc = {
          user: entity.user ?? null,
          group: entity.group ?? null,
          acUser: entity.acUser ?? null,
          acGroup: entity.acGroup ?? null,
          acOther: entity.acOther ?? null,
          acRead: entity.acRead ?? null,
          acWrite: entity.acWrite ?? null,
          acFull: entity.acFull ?? null,
        };

        const setAcProperties = (acValues: { [k: string]: any }) => {
          for (let name in acValues) {
            const value = acValues[name];
            if (value == null) {
              delete entity[name];
            } else {
              entity[name] = value;
            }
          }
        };

        // Restore original AC properties and check permissions.
        setAcProperties(originalAc);
        if (tilmeld.checkPermissions(entity, TilmeldAccessLevels.FULL_ACCESS)) {
          // Only allow changes to AC properties if the user has full access.
          // TODO: only allow changes to `user` and `group` if tilmeld admin or
          //       group is user's group.
          setAcProperties(newAc);
        }
      }

      // Test for permissions.
      if (!tilmeld.checkPermissions(entity, TilmeldAccessLevels.WRITE_ACCESS)) {
        throw new AccessControlError('No permission to write.');
      }
    };
    checkPermissionsSaveAndFilterAcChanges.skipOnClone = true;

    /*
     * Add the current user's "user", "group", and access control to new entity.
     *
     * This occurs right before an entity is saved. It only alters the entity
     * if:
     *
     * - There is a user logged in.
     * - The entity is new (doesn't have a GUID.)
     * - The entity is not a user or group.
     *
     * Default access control is
     *
     * - acUser = TilmeldAccessLevels.FULL_ACCESS
     * - acGroup = TilmeldAccessLevels.READ_ACCESS
     * - acOther = TilmeldAccessLevels.NO_ACCESS
     */
    const addAccess = function (
      nymph: Nymph,
      entity: EntityInterface & AccessControlData
    ) {
      const tilmeld = nymph.tilmeld as Tilmeld;
      const user = tilmeld.currentUser;
      if (
        user != null &&
        entity.guid == null &&
        !(entity instanceof User) &&
        !(entity instanceof Group)
      ) {
        if (entity.user == null) {
          entity.user = user;
        }
        if (
          entity.group == null &&
          user.group != null &&
          user.group.guid != null
        ) {
          entity.group = user.group;
        }
        if (entity.acUser == null) {
          entity.acUser = TilmeldAccessLevels.FULL_ACCESS;
        }
        if (entity.acGroup == null) {
          entity.acGroup = TilmeldAccessLevels.READ_ACCESS;
        }
        if (entity.acOther == null) {
          entity.acOther = TilmeldAccessLevels.NO_ACCESS;
        }
        if (entity.acRead == null) {
          entity.acRead = [];
        }
        if (entity.acWrite == null) {
          entity.acWrite = [];
        }
        if (entity.acFull == null) {
          entity.acFull = [];
        }
      }
    };
    addAccess.skipOnClone = true;

    const validate = function (
      _nymph: Nymph,
      entity: EntityInterface & AccessControlData
    ) {
      if (!(entity instanceof User) && !(entity instanceof Group)) {
        const ownershipAcPropertyValidator = (prop: any) => {
          if (
            typeof prop != 'number' ||
            prop < TilmeldAccessLevels.NO_ACCESS ||
            prop > TilmeldAccessLevels.FULL_ACCESS
          ) {
            throw new AccessControlError(
              'Invalid access control property: ' + prop
            );
          }
        };

        const accessAcPropertyValidator = (prop: any) => {
          if (!Array.isArray(prop)) {
            throw new AccessControlError(
              'Invalid access control property: ' + prop
            );
          }
          prop.forEach((value) => {
            if (!(value instanceof User || value instanceof Group)) {
              throw new AccessControlError(
                'Invalid access control property: ' + prop
              );
            }
          });
        };

        if ('user' in entity) {
          if (!(entity.user instanceof User)) {
            throw new AccessControlError(
              'Invalid access control property: user'
            );
          }
        }

        if ('group' in entity) {
          if (!(entity.group instanceof Group)) {
            throw new AccessControlError(
              'Invalid access control property: group'
            );
          }
        }

        if ('acUser' in entity) {
          ownershipAcPropertyValidator(entity.acUser);
        }
        if ('acGroup' in entity) {
          ownershipAcPropertyValidator(entity.acGroup);
        }
        if ('acOther' in entity) {
          ownershipAcPropertyValidator(entity.acOther);
        }
        if ('acRead' in entity) {
          accessAcPropertyValidator(entity.acRead);
        }
        if ('acWrite' in entity) {
          accessAcPropertyValidator(entity.acWrite);
        }
        if ('acFull' in entity) {
          accessAcPropertyValidator(entity.acFull);
        }
      }
    };
    validate.skipOnClone = true;

    this.nymph.on('query', handleQuery);

    this.nymph.on('beforeSaveEntity', addAccess);
    this.nymph.on('beforeSaveEntity', validate);
    this.nymph.on('beforeSaveEntity', checkPermissionsSaveAndFilterAcChanges);

    this.nymph.on('beforeDeleteEntity', checkPermissionsDelete);
    this.nymph.on('beforeDeleteEntityByID', checkPermissionsDeleteByID);
  }

  /**
   * Add selectors to a list of options and selectors which will limit results
   * to only entities the current user has access to.
   *
   * @param optionsAndSelectors The options and selectors of the query.
   */
  public addAccessControlSelectors(
    options: Options,
    selectors: FormattedSelector[]
  ) {
    const user = this.currentUser;

    if (
      user != null &&
      (user.abilities?.indexOf('system/admin') ?? -1) !== -1
    ) {
      // The user is a system admin, so they can see everything.
      return;
    }

    if (options == null) {
      throw new Error('No options in argument.');
    } else if (
      'class' in options &&
      (options.class?.factorySync() instanceof User ||
        options.class?.factorySync() instanceof Group)
    ) {
      // They are requesting a user/group. Always accessible for reading.
      return;
    }

    if (user === null) {
      selectors.push({
        type: '|',
        // Other access control is sufficient.
        gte: [['acOther', TilmeldAccessLevels.READ_ACCESS]],
        // The user and group are not set.
        selector: [
          {
            type: '&',
            '!defined': ['user', 'group'],
          },
        ],
      });
    } else {
      const subSelectors: FormattedSelector[] = [
        {
          type: '&',
          '!defined': ['user', 'group'],
        },
        // It is owned by the user.
        {
          type: '&',
          ref: [['user', user]],
          gte: [['acUser', TilmeldAccessLevels.READ_ACCESS]],
        },
      ];
      const selector: FormattedSelector = {
        type: '|',
        // Other access control is sufficient.
        gte: [['acOther', TilmeldAccessLevels.READ_ACCESS]],
        // The user and group are not set.
        selector: subSelectors,
        // The user is listed in acRead, acWrite, or acFull.
        ref: [
          ['acRead', user],
          ['acWrite', user],
          ['acFull', user],
        ],
      };
      const groupRefs: FormattedSelector['ref'] = [];
      const acRefs: FormattedSelector['ref'] = [];
      if (user.group != null && user.group.guid != null) {
        // It belongs to the user's primary group.
        groupRefs.push(['group', user.group]);
        // User's primary group is listed in acRead, acWrite, or acFull.
        acRefs.push(['acRead', user.group]);
        acRefs.push(['acWrite', user.group]);
        acRefs.push(['acFull', user.group]);
      }
      for (let curSecondaryGroup of user.groups ?? []) {
        if (curSecondaryGroup != null && curSecondaryGroup.guid != null) {
          // It belongs to the user's secondary group.
          groupRefs.push(['group', curSecondaryGroup]);
          // User's secondary group is listed in acRead, acWrite, or acFull.
          acRefs.push(['acRead', curSecondaryGroup]);
          acRefs.push(['acWrite', curSecondaryGroup]);
          acRefs.push(['acFull', curSecondaryGroup]);
        }
      }
      for (let curDescendantGroup of user.$getDescendantGroupsSync()) {
        if (curDescendantGroup != null && curDescendantGroup.guid != null) {
          // It belongs to the user's secondary group.
          groupRefs.push(['group', curDescendantGroup]);
          // User's secondary group is listed in acRead, acWrite, or acFull.
          acRefs.push(['acRead', curDescendantGroup]);
          acRefs.push(['acWrite', curDescendantGroup]);
          acRefs.push(['acFull', curDescendantGroup]);
        }
      }
      // All the group refs.
      if (groupRefs.length) {
        subSelectors.push({
          type: '&',
          gte: [['acGroup', TilmeldAccessLevels.READ_ACCESS]],
          selector: [
            {
              type: '|',
              ref: groupRefs,
            },
          ],
        });
      }
      // All the acRead, acWrite, and acFull refs.
      if (acRefs.length) {
        subSelectors.push({
          type: '|',
          ref: acRefs,
        });
      }
      selectors.push(selector);
    }
  }

  /**
   * Check an entity's permissions for a user.
   *
   * This will check the AC (Access Control) properties of the entity. These
   * include the following properties:
   *
   * - acUser
   * - acGroup
   * - acOther
   * - acRead
   * - acWrite
   * - acFull
   *
   * "acUser" refers to the entity's owner, "acGroup" refers to all users in the
   * entity's group and all ancestor groups, and "acOther" refers to any user
   * who doesn't fit these descriptions.
   *
   * Each of these properties should be either NO_ACCESS, READ_ACCESS,
   * WRITE_ACCESS, or FULL_ACCESS.
   *
   * - NO_ACCESS - the user has no access to the entity.
   * - READ_ACCESS, the user has read access to the entity.
   * - WRITE_ACCESS, the user has read and write access to the entity, but can't
   *   delete it, change its access controls, or change its ownership.
   * - FULL_ACCESS, the user has read, write, and delete access to the entity,
   *   as well as being able to manage its access controls and ownership.
   *
   * These properties defaults to:
   *
   * - acUser = TilmeldAccessLevels.FULL_ACCESS
   * - acGroup = TilmeldAccessLevels.READ_ACCESS
   * - acOther = TilmeldAccessLevels.NO_ACCESS
   *
   * "acRead", "acWrite", and "acFull" are arrays of users and/or groups that
   * also have those permissions.
   *
   * Only users with FULL_ACCESS have the ability to change any of the ac*,
   * user, and group properties.
   *
   * The following conditions will result in different checks, which determine
   * whether the check passes:
   *
   * - The user has the "system/admin" ability. (Always true.)
   * - It is a user or group. (True for READ_ACCESS or Tilmeld admins.)
   * - The entity has no "user" and no "group". (Always true.)
   * - No user is logged in. (Check other AC.)
   * - The entity is the user. (Always true.)
   * - It is the user's primary group. (True for READ_ACCESS.)
   * - The user or its groups are listed in "acRead". (True for READ_ACCESS.)
   * - The user or its groups are listed in "acWrite". (True for READ_ACCESS and
   *   WRITE_ACCESS.)
   * - The user or its groups are listed in "acFull". (Always true.)
   * - Its "user" is the user. (It is owned by the user.) (Check user AC.)
   * - Its "group" is the user's primary group. (Check group AC.)
   * - Its "group" is one of the user's secondary groups. (Check group AC.)
   * - Its "group" is a descendant of one of the user's groups. (Check group
   *   AC.)
   * - None of the above. (Check other AC.)
   *
   * @param entity The entity to check.
   * @param type The lowest level of permission to consider a pass.
   * @param user The user to check permissions for. If null, uses the current user. If false, checks for public access.
   * @returns Whether the current user has at least `type` permission for the entity.
   */
  public checkPermissions(
    entity: EntityInterface & AccessControlData,
    type: TilmeldAccessLevels = TilmeldAccessLevels.READ_ACCESS,
    user?: (User & UserData) | false
  ) {
    // Only works for entities.
    if (typeof entity !== 'object' || typeof entity.$is !== 'function') {
      return false;
    }

    let userOrNull: (User & UserData) | null = null;
    let userOrEmpty: User & UserData = this.User.factorySync();
    // Calculate the user.
    if (user == null) {
      userOrNull = this.currentUser;
      userOrEmpty = this.User.current(true);
    } else if (user !== false) {
      userOrNull = user;
      userOrEmpty = user;
    }

    if (userOrEmpty.$gatekeeper('system/admin')) {
      return true;
    }

    // Users and groups are always readable. Editable by Tilmeld admins.
    if (
      (entity instanceof User || entity instanceof Group) &&
      (type === TilmeldAccessLevels.READ_ACCESS ||
        userOrEmpty.$gatekeeper('tilmeld/admin'))
    ) {
      return true;
    }

    // Entities with no owners are always editable.
    if (entity.user == null && entity.group == null) {
      return true;
    }

    // Load access control, since we need it now...
    const acUser = entity.acUser ?? TilmeldAccessLevels.FULL_ACCESS;
    const acGroup = entity.acGroup ?? TilmeldAccessLevels.READ_ACCESS;
    const acOther = entity.acOther ?? TilmeldAccessLevels.NO_ACCESS;

    if (userOrNull === null) {
      return acOther >= type;
    }

    // Check if the entity is the user.
    if (userOrEmpty.$is(entity)) {
      return true;
    }

    // Check if the entity is the user's group. Always readable.
    if (
      userOrEmpty.group != null &&
      typeof userOrEmpty.group.$is === 'function' &&
      userOrEmpty.group.$is(entity) &&
      type === TilmeldAccessLevels.READ_ACCESS
    ) {
      return true;
    }

    // Calculate all the groups the user belongs to.
    let allGroups = userOrEmpty.group == null ? [] : [userOrEmpty.group];
    allGroups = allGroups.concat(userOrEmpty.groups ?? []);
    allGroups = allGroups.concat(userOrEmpty.$getDescendantGroupsSync());

    // Check access ac properties.
    const checks = [
      {
        type: TilmeldAccessLevels.FULL_ACCESS,
        array: [...(entity.acFull ?? [])],
      },
      {
        type: TilmeldAccessLevels.WRITE_ACCESS,
        array: [...(entity.acWrite ?? [])],
      },
      {
        type: TilmeldAccessLevels.READ_ACCESS,
        array: [...(entity.acRead ?? [])],
      },
    ];
    for (let curCheck of checks) {
      if (type <= curCheck.type) {
        if (userOrEmpty.$inArray(curCheck.array)) {
          return true;
        }
        for (let curGroup of allGroups) {
          if (
            typeof curGroup.$inArray === 'function' &&
            curGroup.$inArray(curCheck.array)
          ) {
            return true;
          }
        }
      }
    }

    // Check ownership ac properties.
    if (
      entity.user != null &&
      typeof entity.user.$is === 'function' &&
      entity.user.$is(userOrNull)
    ) {
      return acUser >= type;
    }
    if (
      entity.group != null &&
      typeof entity.group.$inArray === 'function' &&
      entity.group.$inArray(allGroups)
    ) {
      return acGroup >= type;
    }
    return acOther >= type;
  }

  /**
   * Check a UID's permissions for a user.
   *
   * ## THIS ONLY CHECKS AUTOMATICALLY FOR CLIENT REQUESTS.
   *
   * UID functions on the Node.js side are not checked automatically. This
   * function is only run automatically for UID functions run from the client.
   * You should call this function manually if you're running a UID function on
   * the Node.js side and you want it gated.
   *
   * This will check the Tilmeld config and the user's abilities.
   *
   * - READ_ACCESS, the UID is listed in clientReadableUIDs or the user has the
   *   "uid/get/nameofuid" ability.
   * - WRITE_ACCESS, the UID is listed in clientEnabledUIDs or the user has the
   *   "uid/new/nameofuid" ability.
   * - FULL_ACCESS, the UID is listed in clientSetabledUIDs or the user has the
   *   "uid/set/nameofuid" ability.
   *
   * @param name The UID to check.
   * @param type The lowest level of permission to consider a pass.
   * @param user The user to check permissions for. If null, uses the current user. If false, checks for public access.
   * @returns Whether the current user has at least `type` permission for the UID.
   */
  public checkClientUIDPermissions(
    name: string,
    type: TilmeldAccessLevels = TilmeldAccessLevels.READ_ACCESS,
    user?: (User & UserData) | false
  ) {
    let userOrEmpty: User & UserData = this.User.factorySync();
    // Calculate the user.
    if (user == null) {
      userOrEmpty = this.User.current(true);
    } else if (user !== false) {
      userOrEmpty = user;
    }

    if (userOrEmpty.$gatekeeper('system/admin')) {
      return true;
    }

    if (type === TilmeldAccessLevels.FULL_ACCESS) {
      return (
        this.config.clientSetabledUIDs.indexOf(name) !== -1 ||
        userOrEmpty.$gatekeeper(`uid/set/${name}`)
      );
    } else if (type === TilmeldAccessLevels.WRITE_ACCESS) {
      return (
        this.config.clientEnabledUIDs.indexOf(name) !== -1 ||
        this.config.clientSetabledUIDs.indexOf(name) !== -1 ||
        userOrEmpty.$gatekeeper(`uid/new/${name}`) ||
        userOrEmpty.$gatekeeper(`uid/set/${name}`)
      );
    } else if (type === TilmeldAccessLevels.READ_ACCESS) {
      return (
        this.config.clientReadableUIDs.indexOf(name) !== -1 ||
        this.config.clientEnabledUIDs.indexOf(name) !== -1 ||
        this.config.clientSetabledUIDs.indexOf(name) !== -1 ||
        userOrEmpty.$gatekeeper(`uid/get/${name}`) ||
        userOrEmpty.$gatekeeper(`uid/new/${name}`) ||
        userOrEmpty.$gatekeeper(`uid/set/${name}`)
      );
    }

    return false;
  }

  /**
   * Fill session user data.
   *
   * @param user The user.
   */
  public fillSession(user: User & UserData) {
    // Read groups right now, since gatekeeper needs them, so
    // $udpateDataProtection will fail to read them (since it runs gatekeeper).
    const _group = user.group;
    const _groups = user.groups;
    this.currentUser = user;
    // Now update the data protection on the user and all the groups.
    this.currentUser.$updateDataProtection();
    if (this.currentUser.group != null) {
      this.currentUser.group.$updateDataProtection();
    }
    for (let group of this.currentUser.groups ?? []) {
      group.$updateDataProtection();
    }
  }

  /**
   * Clear session user data.
   */
  public clearSession() {
    const user = this.currentUser;
    this.currentUser = null;
    if (user) {
      user.$updateDataProtection();
      if (user.group != null) {
        user.group.$updateDataProtection();
      }
      for (let group of user.groups ?? []) {
        group.$updateDataProtection();
      }
    }
  }

  /**
   * Validate and extract the user from a token.
   *
   * @param token The authentication token.
   * @returns The user on success, null on failure.
   */
  public async extractToken(token: string) {
    const extract = this.config.jwtExtract(this.config, token);
    if (extract == null) {
      return null;
    }
    const { guid } = extract;

    const user = await this.nymph.getEntity(
      { class: this.User },
      {
        type: '&',
        guid: guid,
      }
    );
    if (!user || !user.guid || !user.enabled) {
      return null;
    }

    return user;
  }

  /**
   * Check for a TILMELDAUTH token, and, if set, authenticate from it.
   *
   * @param skipXsrfToken Skip the XSRF token check.
   * @returns True if a user was authenticated, false on any failure.
   */
  public authenticate(skipXsrfToken = false) {
    if (this.request == null) {
      return false;
    }

    const cookies = this.request.cookies ?? {};

    // If a client does't support cookies, they can use the X-TILMELDAUTH header
    // to provide the auth token.
    let fromAuthHeader = false;
    let authToken: string;
    if (this.request.header('x-tilmeldauth') != null) {
      fromAuthHeader = true;
      authToken = this.request.header('x-tilmeldauth') as string;
    } else if ('TILMELDAUTH' in cookies) {
      fromAuthHeader = false;
      authToken = cookies.TILMELDAUTH;
    } else {
      return false;
    }

    let extract: { guid: string; expire: Date } | null;
    if (
      skipXsrfToken ||
      this.request.originalUrl.startsWith(this.config.setupPath)
    ) {
      // The request is for the setup app, or we were told to skip the XSRF
      // check, so don't check for the XSRF token.
      extract = this.config.jwtExtract(this.config, authToken);
    } else {
      // The request is for something else, so check for a valid XSRF token,
      // unless the auth token is provided by a header (instead of a cookie).
      const xsrfToken = this.request.header('x-xsrf-token');
      if (xsrfToken == null && !fromAuthHeader) {
        return false;
      }

      extract = this.config.jwtExtract(this.config, authToken, xsrfToken);
    }

    if (extract == null) {
      this.logout();
      return false;
    }
    const { guid, expire } = extract;

    const user = this.User.factorySync(guid);
    if (user.guid == null || !user.enabled) {
      this.logout();
      return false;
    }

    if (expire.valueOf() < Date.now() + this.config.jwtRenew * 1000) {
      // If the user is less than renew time from needing a new token, give them
      // a new one.
      this.login(user, fromAuthHeader);
    } else {
      this.fillSession(user);
    }
    return true;
  }

  /**
   * Logs the given user into the system.
   *
   * @param user The user.
   * @param sendAuthHeader When true, a custom header with the auth token will be sent.
   * @returns True on success, false on failure.
   */
  public login(user: User & UserData, sendAuthHeader: boolean) {
    if (user.guid != null && user.enabled) {
      if (this.response && !this.response.headersSent) {
        const token = this.config.jwtBuilder(this.config, user);
        const appUrl = new URL(this.config.appUrl);
        this.response.cookie('TILMELDAUTH', token, {
          domain: this.config.cookieDomain,
          path: this.config.cookiePath,
          maxAge: this.config.jwtExpire * 1000,
          secure: appUrl.protocol === 'https',
          httpOnly: false, // Allow JS access (for CSRF protection).
          sameSite: appUrl.protocol === 'https' ? 'lax' : 'strict',
        });
        if (sendAuthHeader) {
          this.response.set('X-TILMELDAUTH', token);
        }
      }
      this.fillSession(user);
      return true;
    }
    return false;
  }

  /**
   * Logs the current user out of the system.
   */
  public logout() {
    this.clearSession();
    if (this.response && !this.response.headersSent) {
      this.response.clearCookie('TILMELDAUTH', {
        domain: this.config.cookieDomain,
        path: this.config.cookiePath,
      });
      this.response.set('X-TILMELDAUTH', '');
    }
  }

  // /**
  //  * Sort an array of groups hierarchically.
  //  *
  //  * An additional property of the groups can be used to sort them under their
  //  * parents.
  //  *
  //  * @param array The array of groups.
  //  * @param property The name of the property to sort groups by. Undefined for no additional sorting.
  //  * @param caseSensitive Sort case sensitively.
  //  * @param reverse Reverse the sort order.
  //  */
  // public static groupSort(
  //   array: any[],
  //   property?: string,
  //   caseSensitive = false,
  //   reverse = false
  // ) {
  //   hsort(array, property, 'parent', caseSensitive, reverse);
  // }
}
