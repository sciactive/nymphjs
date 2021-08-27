import Nymph, { EntityInterface, Options, Selector } from '@nymphjs/nymph';
import { Request, Response } from 'express';
import { AccessControlData } from './AccessControlData';
import { Config, ConfigDefaults as defaults } from './conf';
import Group from './Group';
import User, { UserData } from './User';

/**
 * A user and group system for Nymph.js.
 *
 * Written by Hunter Perrin for SciActive.
 *
 * @author Hunter Perrin <hperrin@gmail.com>
 * @copyright SciActive Inc
 * @see http://nymph.io/
 */
export default class Tilmeld {
  public static NO_ACCESS = 0;
  public static READ_ACCESS = 1;
  public static WRITE_ACCESS = 2;
  public static FULL_ACCESS = 4;

  /**
   * The Tilmeld config.
   */
  public static config: Config;

  /**
   * The currently logged in user.
   */
  public static currentUser: (User & UserData) | null = null;

  /**
   * If you will be performing authentication functions (logging in/out), you should set these so
   * Tilmeld can read and write cookies and headers.
   *
   * If you want the user to be authenticated with the cookie and/or header they provide, you should
   * set at least the request. It's better to set both, so the JWT can be updated if needed.
   *
   * After you set these, call `authenticate()` to read user authentication data from them and fill
   * the user's session.
   *
   * If you want to support cookie based authentication (which still requires an XSRF token for
   * security), you should enable the cookie parser middleware.
   */
  public static request: Request;
  public static response: Response;

  /**
   * Check to see if the current user has an ability.
   *
   * If `ability` is undefined, it will check to see if a user is currently logged in.
   *
   * @param ability The ability.
   * @returns Whether the user has the given ability.
   */
  public static gatekeeper(ability?: string): boolean {
    if (this.currentUser == null) {
      return false;
    }
    return this.currentUser.$gatekeeper(ability);
  }

  /**
   * Initialize Tilmeld.
   *
   * @param config The Tilmeld configuration.
   */
  public static init(config: Partial<Config> & { jwtSecret: string }) {
    this.config = { ...defaults, ...config };

    // Set up access control hooks when Nymph is called.
    if (Nymph.driver == null) {
      throw new Error("Tilmeld can't be configured before Nymph.");
    }

    // TODO: HookMethods::setup();
    if (this.request != null) {
      this.authenticate();
    }
  }

  /**
   * Add selectors to a list of options and selectors which will limit results to only entities the
   * current user has access to.
   *
   * @param optionsAndSelectors The options and selectors of the query.
   */
  public static addAccessControlSelectors(
    optionsAndSelectors: [Options, ...Selector[]]
  ) {
    const user = this.currentUser;

    if (user != null && user.$gatekeeper('system/admin')) {
      // The user is a system admin, so they can see everything.
      return;
    }

    if (optionsAndSelectors.length === 0) {
      throw new Error('No options in argument.');
    } else if (
      'class' in optionsAndSelectors[0] &&
      (optionsAndSelectors[0].class === User ||
        optionsAndSelectors[0].class === Group)
    ) {
      // They are requesting a user/group. Always accessible for reading.
      return;
    }

    if (user === null) {
      optionsAndSelectors.push({
        type: '|',
        // Other access control is sufficient.
        gte: ['acOther', Tilmeld.READ_ACCESS],
        // The user and group are not set.
        selector: {
          type: '&',
          '!defined': ['user', 'group'],
        },
      });
    } else {
      const subSelectors: Selector[] = [
        {
          type: '&',
          '!defined': ['user', 'group'],
        },
        // It is owned by the user.
        {
          type: '&',
          ref: ['user', user],
          gte: ['acUser', Tilmeld.READ_ACCESS],
        },
      ];
      const selector: Selector = {
        type: '|',
        // Other access control is sufficient.
        gte: ['acOther', Tilmeld.READ_ACCESS],
        // The user and group are not set.
        selector: subSelectors,
        // The user is listed in acRead, acWrite, or acFull.
        ref: [
          ['acRead', user],
          ['acWrite', user],
          ['acFull', user],
        ],
      };
      const groupRefs: Selector['ref'] = [];
      const acRefs: Selector['ref'] = [];
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
      for (let curDescendantGroup of user.$getDescendantGroups()) {
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
          gte: ['acGroup', Tilmeld.READ_ACCESS],
          selector: {
            type: '|',
            ref: groupRefs,
          },
        });
      }
      // All the acRead, acWrite, and acFull refs.
      if (acRefs.length) {
        subSelectors.push({
          type: '|',
          ref: acRefs,
        });
      }
      optionsAndSelectors.push(selector);
    }
  }

  /**
   * Check an entity's permissions for a user.
   *
   * This will check the AC (Access Control) properties of the entity. These include the following
   * properties:
   *
   * - acUser
   * - acGroup
   * - acOther
   * - acRead
   * - acWrite
   * - acFull
   *
   * "acUser" refers to the entity's owner, "acGroup" refers to all users in the entity's group and
   * all ancestor groups, and "acOther" refers to any user who doesn't fit these descriptions.
   *
   * Each of these properties should be either NO_ACCESS, READ_ACCESS, WRITE_ACCESS, or FULL_ACCESS.
   *
   * - NO_ACCESS - the user has no access to the entity.
   * - READ_ACCESS, the user has read access to the entity.
   * - WRITE_ACCESS, the user has read and write access to the entity, but can't delete it, change
   *   its access controls, or change its ownership.
   * - FULL_ACCESS, the user has read, write, and delete access to the entity, as well as being able
   *   to manage its access controls and ownership.
   *
   * These properties defaults to:
   *
   * - acUser = Tilmeld.FULL_ACCESS
   * - acGroup = Tilmeld.READ_ACCESS
   * - acOther = Tilmeld.NO_ACCESS
   *
   * "acRead", "acWrite", and "acFull" are arrays of users and/or groups that also have those
   * permissions.
   *
   * Only users with FULL_ACCESS have the ability to change any of the ac*, user, and group
   * properties.
   *
   * The following conditions will result in different checks, which determine whether the check
   * passes:
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
   * @param type The lowest level of permission to consider a pass. One of Tilmeld.READ_ACCESS, Tilmeld.WRITE_ACCESS, or Tilmeld.FULL_ACCESS.
   * @param user The user to check permissions for. If null, uses the current user. If false, checks for public access.
   * @returns Whether the current user has at least `type` permission for the entity.
   */
  public static checkPermissions(
    entity: EntityInterface & AccessControlData,
    type = Tilmeld.READ_ACCESS,
    user?: (User & UserData) | false
  ) {
    // Only works for entities.
    if (typeof entity !== 'object' || typeof entity.$is !== 'function') {
      return false;
    }

    let userOrNull: (User & UserData) | null = null;
    let userOrEmpty: User & UserData = User.factorySync();
    // Calculate the user.
    if (user == null) {
      userOrNull = this.currentUser;
      userOrEmpty = User.current(true);
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
      (type === Tilmeld.READ_ACCESS || userOrEmpty.$gatekeeper('tilmeld/admin'))
    ) {
      return true;
    }

    // Entities with no owners are always editable.
    if (entity.user == null && entity.group == null) {
      return true;
    }

    // Load access control, since we need it now...
    const acUser = entity.acUser ?? Tilmeld.FULL_ACCESS;
    const acGroup = entity.acGroup ?? Tilmeld.READ_ACCESS;
    const acOther = entity.acOther ?? Tilmeld.NO_ACCESS;

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
      type === Tilmeld.READ_ACCESS
    ) {
      return true;
    }

    // Calculate all the groups the user belongs to.
    let allGroups = userOrEmpty.group == null ? [] : [userOrEmpty.group];
    allGroups = allGroups.concat(userOrEmpty.groups ?? []);
    allGroups = allGroups.concat(userOrEmpty.$getDescendantGroups());

    // Check access ac properties.
    const checks = [
      { type: Tilmeld.FULL_ACCESS, array: [...(entity.acFull ?? [])] },
      { type: Tilmeld.WRITE_ACCESS, array: [...(entity.acWrite ?? [])] },
      { type: Tilmeld.READ_ACCESS, array: [...(entity.acRead ?? [])] },
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
   * Fill session user data.
   *
   * @param user The user.
   */
  public static fillSession(user: User & UserData) {
    // Read groups right now, since gatekeeper needs them, so $udpateDataProtection will fail to
    // read them (since it runs gatekeeper).
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
  public static clearSession() {
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
  public static async extractToken(token: string) {
    const extract = this.config.jwtExtract(token);
    if (extract == null) {
      return null;
    }
    const { guid } = extract;

    const user = await Nymph.getEntity(
      { class: User },
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
  public static authenticate(skipXsrfToken = false) {
    if (this.request == null) {
      return false;
    }

    const cookies = this.request.cookies ?? {};

    // If a client does't support cookies, they can use the X-TILMELDAUTH header to provide the auth
    // token.
    let fromAuthHeader = false;
    let authToken: string;
    if (this.request.header('HTTP_X_TILMELDAUTH') != null) {
      fromAuthHeader = true;
      authToken = this.request.header('HTTP_X_TILMELDAUTH') as string;
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
      // The request is for the setup app, or we were told to skip the XSRF check, so don't check
      // for the XSRF token.
      extract = this.config.jwtExtract(authToken);
    } else {
      // The request is for something else, so check for a valid XSRF token, unless the auth token
      // is provided by a header (instead of a cookie).
      const xsrfToken = this.request.header('HTTP_X_XSRF_TOKEN');
      if (xsrfToken == null && !fromAuthHeader) {
        return false;
      }

      extract = this.config.jwtExtract(authToken, xsrfToken);
    }

    if (extract == null) {
      this.logout();
      return false;
    }
    const { guid, expire } = extract;

    const user = User.factorySync(guid);
    if (user.guid == null || !user.enabled) {
      this.logout();
      return false;
    }

    if (expire.valueOf() < Date.now() + this.config.jwtRenew * 1000) {
      // If the user is less than renew time from needing a new token, give them a new one.
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
  public static login(user: User & UserData, sendAuthHeader: boolean) {
    if (user.guid != null && user.enabled) {
      if (this.response && !this.response.headersSent) {
        const token = this.config.jwtBuilder(user);
        const appUrl = new URL(this.config.appUrl);
        this.response.cookie('TILMELDAUTH', token, {
          domain: this.config.cookieDomain,
          path: this.config.cookiePath,
          maxAge: this.config.jwtExpire * 1000,
          secure: appUrl.protocol === 'https',
          httpOnly: false, // Allow JS access (for CSRF protection).
          sameSite: 'lax',
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
  public static logout() {
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
  //  * An additional property of the groups can be used to sort them under their parents.
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
