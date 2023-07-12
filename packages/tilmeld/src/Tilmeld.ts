import {
  Nymph,
  EntityInterface,
  FormattedSelector,
  Options,
  TilmeldInterface,
  TilmeldAccessLevels,
  ACProperties,
} from '@nymphjs/nymph';
import { URL } from 'url';
import { Request, Response } from 'express';
import { xor } from 'lodash';

import { Config, ConfigDefaults as defaults } from './conf';
import { AccessControlError } from './errors';
import Group from './Group';
import User, { UserData } from './User';
import { AccessControlData } from './Tilmeld.types';
import { enforceTilmeld } from './enforceTilmeld';

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
   * Used to avoid infinite loop.
   */
  private alreadyLoggedOutSwitch = false;

  /**
   * Gatekeeper ability cache.
   *
   * Gatekeeper will cache the user's abilities that it calculates, so it can
   * check faster if that user has been checked before.
   */
  private gatekeeperCache: { [k: string]: true } | null = null;

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
   *
   * @returns A clone of this instance.
   */
  public clone() {
    const tilmeld = new Tilmeld(this.config);
    tilmeld.request = this.request;
    tilmeld.response = this.response;
    tilmeld.currentUser = this.currentUser;
    tilmeld.gatekeeperCache = this.gatekeeperCache;

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

    if (this.nymph.driver == null) {
      throw new Error("Tilmeld can't be configured before Nymph.");
    }

    // Configure the classes.
    if (nymph.parent) {
      // This is a cloned Nymph, it should have classes already.
      this.User = this.nymph.getEntityClass(User);
      this.Group = this.nymph.getEntityClass(Group);
    } else {
      // This is a new Nymph, add the classes.
      this.User = this.nymph.addEntityClass(User);
      this.Group = this.nymph.addEntityClass(Group);
    }

    // Clone the current user so its Nymph instance is correct.
    if (this.currentUser) {
      const currentUserGUID = this.currentUser.guid;
      const currentUserCDate = this.currentUser.cdate;
      const currentUserMDate = this.currentUser.mdate;
      const currentUserTags = this.currentUser.tags;
      const currentUserData = this.currentUser.$getData();
      const currentUserSData = this.currentUser.$getSData();

      const user = this.User.factorySync();
      user.guid = currentUserGUID;
      user.cdate = currentUserCDate;
      user.mdate = currentUserMDate;
      user.tags = currentUserTags;
      user.$putData(currentUserData, currentUserSData);
      this.currentUser = user;
      this.currentUser.$updateDataProtection();
      this.currentUser.$updateGroupDataProtection();
    }

    // Set up access control hooks when Nymph is called.
    this.initAccessControl();
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
  public gatekeeper(ability?: string) {
    if (this.currentUser == null || this.gatekeeperCache == null) {
      return false;
    }
    if (ability == null) {
      return true;
    }
    return (
      (ability in this.gatekeeperCache && !!this.gatekeeperCache[ability]) ||
      !!this.currentUser.abilities?.includes('system/admin')
    );
  }

  private initAccessControl() {
    // Check for the skip access control option and add AC selectors.
    const handleQuery = function (
      nymph: Nymph,
      options: Options,
      selectors: FormattedSelector[]
    ) {
      const tilmeld = enforceTilmeld(nymph);
      if (
        !options ||
        !('skipAc' in options) ||
        !options.skipAc ||
        options.source === 'client'
      ) {
        if (options?.source === 'client') {
          if (
            (!tilmeld.currentUser ||
              (!tilmeld.currentUser.abilities?.includes('tilmeld/admin') &&
                !tilmeld.currentUser.abilities?.includes('system/admin'))) && // The user is not an admin.
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
    const checkPermissionsDelete = async function (
      nymph: Nymph,
      entity: EntityInterface
    ) {
      const tilmeld = enforceTilmeld(nymph);
      if (
        typeof entity.$tilmeldDeleteSkipAC === 'function' &&
        entity.$tilmeldDeleteSkipAC()
      ) {
        return;
      }
      // Test for permissions.
      if (!tilmeld.checkPermissions(entity, TilmeldAccessLevels.FULL_ACCESS)) {
        throw new AccessControlError('No permission to delete.');
      }
    };
    checkPermissionsDelete.skipOnClone = true;

    // Filter entities being deleted for user permissions.
    const checkPermissionsDeleteByID = async function (
      nymph: Nymph,
      guid: string,
      className?: string
    ) {
      const entity = await nymph.getEntity(
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
    const checkPermissionsSaveAndFilterAcChanges = async function (
      nymph: Nymph,
      entity: EntityInterface & AccessControlData
    ) {
      const tilmeld = enforceTilmeld(nymph);
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
        const newAc = entity.$getCurrentAcValues();

        function areAcPropertiesChanged(a: ACProperties, b: ACProperties) {
          for (const name of ['user', 'group'] as ('user' | 'group')[]) {
            const aVal = a[name];
            const bVal = b[name];
            if (aVal == null && bVal == null) {
              continue;
            } else if (aVal == null || bVal == null) {
              return true;
            }
            if (aVal !== bVal) {
              return true;
            }
          }
          for (const name of ['acUser', 'acGroup', 'acOther'] as (
            | 'acUser'
            | 'acGroup'
            | 'acOther'
          )[]) {
            const aVal = a[name];
            const bVal = b[name];
            if (aVal == null && bVal == null) {
              continue;
            } else if (aVal == null || bVal == null) {
              return true;
            }
            if (aVal !== bVal) {
              return true;
            }
          }
          for (const name of ['acRead', 'acWrite', 'acFull'] as (
            | 'acRead'
            | 'acWrite'
            | 'acFull'
          )[]) {
            const aVal = a[name];
            const bVal = b[name];
            if (aVal == null && bVal == null) {
              continue;
            } else if (aVal == null || bVal == null) {
              return true;
            }
            if (aVal.length !== bVal.length) {
              return true;
            }
            if (xor(aVal, bVal).length) {
              return true;
            }
          }
          return false;
        }

        if (areAcPropertiesChanged(originalAc, newAc)) {
          if (
            !tilmeld.checkPermissions(
              entity,
              TilmeldAccessLevels.FULL_ACCESS,
              undefined,
              originalAc
            )
          ) {
            // Only allow changes to AC properties if the user has full access.
            throw new AccessControlError(
              'No permission to change access control properties.'
            );
          }

          if (
            (originalAc.user && originalAc.user !== newAc.user) ||
            (!originalAc.user &&
              newAc.user &&
              newAc.user !== tilmeld.currentUser)
          ) {
            throw new AccessControlError(
              'No permission to assign to another user.'
            );
          }

          if (
            newAc.group &&
            newAc.group !== originalAc.group &&
            !(newAc.group =
              tilmeld.currentUser?.$getGid() ||
              (tilmeld.currentUser?.$getGids() ?? []).includes(newAc.group))
          ) {
            throw new AccessControlError(
              'No permission to assign to another group.'
            );
          }
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
    const addAccess = async function (
      nymph: Nymph,
      entity: EntityInterface & AccessControlData
    ) {
      const tilmeld = enforceTilmeld(nymph);
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
        if (entity.group == null) {
          const group = user.group;
          if (group != null && group.guid != null) {
            entity.group = group;
          }
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

    const validate = async function (
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

    if (user == null || user.guid == null) {
      selectors.push({
        type: '|',
        // Other access control is sufficient.
        gte: [['acOther', TilmeldAccessLevels.READ_ACCESS]],
        // The user and group are not set.
        selector: [
          {
            type: '&',
            '!defined': [['user', 'group']],
          },
        ],
      });
    } else {
      const subSelectors: FormattedSelector[] = [
        {
          type: '&',
          '!defined': [['user', 'group']],
        },
        // It is owned by the user.
        {
          type: '&',
          ref: [['user', user.guid]],
          gte: [['acUser', TilmeldAccessLevels.READ_ACCESS]],
        },
      ];
      const groupRefs: FormattedSelector['ref'] = [];
      const acRefs: FormattedSelector['ref'] = [];
      const gid = user.$getGid();
      if (gid != null) {
        // It belongs to the user's primary group.
        groupRefs.push(['group', gid]);
        // User's primary group is listed in acRead, acWrite, or acFull.
        acRefs.push(['acRead', gid]);
        acRefs.push(['acWrite', gid]);
        acRefs.push(['acFull', gid]);
      }
      const gids = user.$getGids();
      for (let curGid of gids ?? []) {
        // It belongs to the user's secondary group.
        groupRefs.push(['group', curGid]);
        // User's secondary group is listed in acRead, acWrite, or acFull.
        acRefs.push(['acRead', curGid]);
        acRefs.push(['acWrite', curGid]);
        acRefs.push(['acFull', curGid]);
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
      const selector: FormattedSelector = {
        type: '|',
        // Other access control is sufficient.
        gte: [['acOther', TilmeldAccessLevels.READ_ACCESS]],
        // The user and group are not set.
        selector: subSelectors,
        // The user is listed in acRead, acWrite, or acFull.
        ref: [
          ['acRead', user.guid],
          ['acWrite', user.guid],
          ['acFull', user.guid],
        ],
      };
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
   * These properties default to:
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
   * - It is a user or group. (True for READ_ACCESS or Tilmeld admins.)
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
   * @param acProperties The acProperties to use instead of getting them from the entity.
   * @returns Whether the current user has at least `type` permission for the entity.
   */
  public checkPermissions(
    entity: EntityInterface,
    type: TilmeldAccessLevels = TilmeldAccessLevels.READ_ACCESS,
    user?: (User & UserData) | false,
    acProperties?: ACProperties
  ) {
    if (!acProperties) {
      acProperties = entity.$getCurrentAcValues() as ACProperties;
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

    // Users and groups are always readable. Editable by Tilmeld admins.
    if (
      (entity instanceof User || entity instanceof Group) &&
      (type === TilmeldAccessLevels.READ_ACCESS ||
        userOrEmpty.abilities?.includes('tilmeld/admin') ||
        userOrEmpty.abilities?.includes('system/admin'))
    ) {
      return true;
    }

    // Load access control, since we need it now...
    const acUser = acProperties.acUser ?? TilmeldAccessLevels.FULL_ACCESS;
    const acGroup = acProperties.acGroup ?? TilmeldAccessLevels.READ_ACCESS;
    const acOther = acProperties.acOther ?? TilmeldAccessLevels.NO_ACCESS;

    if (userOrNull == null) {
      return acOther >= type;
    }

    // Check if the entity is the user.
    if (userOrEmpty.$is(entity)) {
      return true;
    }

    // Check if the entity is the user's group. Always readable.
    const gid = userOrEmpty.$getGid();
    if (
      gid != null &&
      entity.guid === gid &&
      type === TilmeldAccessLevels.READ_ACCESS
    ) {
      return true;
    }

    // Calculate all the groups the user belongs to.
    let allGids = gid == null ? [] : [gid];
    allGids = allGids.concat(userOrEmpty.$getGids() ?? []);

    // Check access ac properties.
    const checks = [
      {
        type: TilmeldAccessLevels.FULL_ACCESS,
        array: [...(acProperties.acFull ?? [])],
      },
      {
        type: TilmeldAccessLevels.WRITE_ACCESS,
        array: [...(acProperties.acWrite ?? [])],
      },
      {
        type: TilmeldAccessLevels.READ_ACCESS,
        array: [...(acProperties.acRead ?? [])],
      },
    ];
    for (let curCheck of checks) {
      if (type <= curCheck.type) {
        if (curCheck.array.includes(userOrEmpty.guid)) {
          return true;
        }
        for (let curGid of allGids) {
          if (curCheck.array.includes(curGid)) {
            return true;
          }
        }
      }
    }

    // Check ownership ac properties.
    if (acProperties.user != null && acProperties.user === userOrNull.guid) {
      return acUser >= type;
    }
    if (acProperties.group != null && allGids.includes(acProperties.group)) {
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
  public async checkClientUIDPermissions(
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

    if (userOrEmpty.abilities?.includes('system/admin')) {
      return true;
    }

    if (type === TilmeldAccessLevels.FULL_ACCESS) {
      return (
        this.config.clientSetabledUIDs.indexOf(name) !== -1 ||
        (await userOrEmpty.$gatekeeper(`uid/set/${name}`))
      );
    } else if (type === TilmeldAccessLevels.WRITE_ACCESS) {
      return (
        this.config.clientEnabledUIDs.indexOf(name) !== -1 ||
        this.config.clientSetabledUIDs.indexOf(name) !== -1 ||
        (await userOrEmpty.$gatekeeper(`uid/new/${name}`)) ||
        (await userOrEmpty.$gatekeeper(`uid/set/${name}`))
      );
    } else if (type === TilmeldAccessLevels.READ_ACCESS) {
      return (
        this.config.clientReadableUIDs.indexOf(name) !== -1 ||
        this.config.clientEnabledUIDs.indexOf(name) !== -1 ||
        this.config.clientSetabledUIDs.indexOf(name) !== -1 ||
        (await userOrEmpty.$gatekeeper(`uid/get/${name}`)) ||
        (await userOrEmpty.$gatekeeper(`uid/new/${name}`)) ||
        (await userOrEmpty.$gatekeeper(`uid/set/${name}`))
      );
    }

    return false;
  }

  /**
   * Fill session user data.
   *
   * @param user The user.
   */
  public async fillSession(user: User & UserData) {
    this.currentUser = user;
    this.gatekeeperCache = await user.$getGatekeeperCache();

    // Now update the data protection on the user and all the groups.
    this.currentUser.$updateDataProtection();
    this.currentUser.$updateGroupDataProtection();
  }

  /**
   * Clear session user data.
   */
  public clearSession() {
    const user = this.currentUser;
    this.currentUser = null;
    this.gatekeeperCache = null;
    if (user) {
      user.$updateDataProtection();
      user.$updateGroupDataProtection();
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
    if (!user || !user.guid) {
      return null;
    }

    return user;
  }

  /**
   * Check for TILMELDAUTH and TILMELDSWITCH tokens, and, if set, authenticate
   * from it/them.
   *
   * You can also call this function after setting `response.locals.user` to the
   * user you want to authenticate. You *should* check for `user.enabled` before
   * setting this variable, unless you explicitly want to log in as a disabled
   * user. (The user must be an instance of the User class for this Tilmeld
   * instance.)
   *
   * This function will set `response.locals.user` to the logged in user on
   * successful authentication.
   *
   * @param skipXsrfToken Skip the XSRF token check.
   * @returns True if a user was authenticated, false on any failure.
   */
  public async authenticate(skipXsrfToken = false) {
    if (this.request == null) {
      return false;
    }

    if (
      this.response &&
      this.response.locals.user &&
      this.response.locals.user instanceof this.User
    ) {
      // The user has already been authenticated through some other means.
      const user = this.response.locals.user;
      await this.fillSession(user);
      return true;
    }

    const cookies = this.request.cookies ?? {};

    // If a client does't support cookies, they can use the X-TILMELDAUTH header
    // to provide the auth token.
    let fromAuthHeader = false;
    let authToken: string;
    let switchToken: string | null;
    if (this.request.header('x-tilmeldauth') != null) {
      fromAuthHeader = true;
      authToken = this.request.header('x-tilmeldauth') as string;
      switchToken =
        (this.request.header('x-tilmeldswitch') as string) ||
        'TILMELDSWITCH' in cookies
          ? cookies.TILMELDSWITCH
          : null;
    } else if ('TILMELDAUTH' in cookies) {
      fromAuthHeader = false;
      authToken = cookies.TILMELDAUTH;
      switchToken = 'TILMELDSWITCH' in cookies ? cookies.TILMELDSWITCH : null;
    } else {
      return false;
    }

    let authExtract: { guid: string; issued: Date; expire: Date } | null;
    let switchExtract: { guid: string; expire: Date } | null;
    if (
      skipXsrfToken ||
      this.request.originalUrl.startsWith(this.config.setupPath)
    ) {
      // The request is for the setup app, or we were told to skip the XSRF
      // check, so don't check for the XSRF token.
      authExtract = this.config.jwtExtract(this.config, authToken);
      switchExtract = switchToken
        ? this.config.jwtExtract(this.config, switchToken)
        : null;
    } else {
      // The request is for something else, so check for a valid XSRF token,
      // unless the auth token is provided by a header (instead of a cookie).
      const xsrfToken = this.request.header('x-xsrf-token');
      if (xsrfToken == null && !fromAuthHeader) {
        return false;
      }

      authExtract = this.config.jwtExtract(this.config, authToken, xsrfToken);
      switchExtract = switchToken
        ? this.config.jwtExtract(this.config, switchToken)
        : null;
    }

    if (authExtract == null) {
      await this.logout();
      return false;
    }
    const { guid, issued, expire } = authExtract;
    const { guid: switchGuid, expire: switchExpire } = switchExtract || {
      guid: null,
      expire: null,
    };

    const user = await this.User.factory(guid);
    if (
      user.guid == null ||
      !user.enabled ||
      expire.getTime() <= Date.now() ||
      issued.getTime() > Date.now() ||
      (user.revokeTokenDate != null && issued.getTime() <= user.revokeTokenDate)
    ) {
      await this.logout();
      return false;
    }

    if (switchGuid && switchExpire && switchExpire.getTime() > Date.now()) {
      // Load the switch user.
      const switchUser = await this.User.factory(switchGuid);
      if (switchUser.guid == null) {
        await this.logoutSwitch();
      } else {
        await this.fillSession(switchUser);

        if (this.response) {
          this.response.locals.user = switchUser;
        }

        return true;
      }
    }

    if (expire.getTime() < Date.now() + this.config.jwtRenew * 1000) {
      // If the user is less than renew time from needing a new token, give them
      // a new one.
      await this.login(user, fromAuthHeader);
    } else {
      await this.fillSession(user);
    }

    if (this.response) {
      this.response.locals.user = user;
    }

    return true;
  }

  /**
   * Logs the given user into the system.
   *
   * @param user The user.
   * @param sendAuthHeader Send the auth token as a custom header.
   * @param sendCookie Send the auth token as a cookie.
   * @returns True on success, false on failure.
   */
  public async login(
    user: User & UserData,
    sendAuthHeader: boolean,
    sendCookie = true
  ) {
    if (user.guid != null && user.enabled) {
      if (this.response) {
        if (!this.response.headersSent) {
          const token = this.config.jwtBuilder(this.config, user);

          if (sendCookie) {
            const appUrl = new URL(this.config.appUrl);
            this.response.cookie('TILMELDAUTH', token, {
              domain: this.config.cookieDomain,
              path: this.config.cookiePath,
              maxAge: this.config.jwtExpire * 1000,
              secure: appUrl.protocol === 'https',
              httpOnly: false, // Allow JS access (for CSRF protection).
              sameSite: appUrl.protocol === 'https' ? 'lax' : 'strict',
            });
          }

          if (sendAuthHeader) {
            this.response.set('X-TILMELDAUTH', token);
          }
        }

        this.response.locals.user = user;
      }

      await this.fillSession(user);
      return true;
    }
    return false;
  }

  /**
   * Adds a switch auth token for the given user.
   *
   * This effectively logs the current user in to the system as the given user.
   *
   * @param user The user.
   * @param sendAuthHeader Send the auth token as a custom header.
   * @param sendCookie Send the auth token as a cookie.
   * @returns True on success, false on failure.
   */
  public async loginSwitch(
    user: User & UserData,
    sendAuthHeader: boolean,
    sendCookie = true
  ) {
    if (user.guid != null) {
      if (this.response) {
        if (!this.response.headersSent) {
          const token = this.config.jwtBuilder(this.config, user, true);

          if (sendCookie) {
            const appUrl = new URL(this.config.appUrl);
            this.response.cookie('TILMELDSWITCH', token, {
              domain: this.config.cookieDomain,
              path: this.config.cookiePath,
              maxAge: this.config.jwtSwitchExpire * 1000,
              secure: appUrl.protocol === 'https',
              httpOnly: false, // Allow JS access (for PubSub auth token).
              sameSite: appUrl.protocol === 'https' ? 'lax' : 'strict',
            });
          }

          if (sendAuthHeader) {
            this.response.set('X-TILMELDSWITCH', token);
          }
        }

        this.response.locals.user = user;
      }

      await this.fillSession(user);
      return true;
    }
    return false;
  }

  /**
   * Logs the current user out of the system.
   *
   * @param clearCookie Clear the auth cookie. (Also send a header.)
   */
  public async logout(clearCookie = true) {
    if (this.request && !this.alreadyLoggedOutSwitch) {
      const cookies = this.request.cookies ?? {};

      if ('TILMELDSWITCH' in cookies) {
        this.alreadyLoggedOutSwitch = true;
        return await this.logoutSwitch(clearCookie);
      }
    }

    this.clearSession();
    if (this.response) {
      if (clearCookie && !this.response.headersSent) {
        this.response.clearCookie('TILMELDAUTH', {
          domain: this.config.cookieDomain,
          path: this.config.cookiePath,
        });
        this.response.set('X-TILMELDAUTH', '');
      }
      this.response.locals.user = null;
    }
  }

  /**
   * Clears the switch user out of the system.
   *
   * @param clearCookie Clear the auth cookie. (Also send a header.)
   */
  public async logoutSwitch(clearCookie = true) {
    this.clearSession();
    if (this.response) {
      if (clearCookie && !this.response.headersSent) {
        this.response.clearCookie('TILMELDSWITCH', {
          domain: this.config.cookieDomain,
          path: this.config.cookiePath,
        });
        this.response.set('X-TILMELDSWITCH', '');
      }
      this.response.locals.user = null;

      await this.authenticate();
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
