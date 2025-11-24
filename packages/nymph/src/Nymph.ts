import { Config, ConfigDefaults as defaults } from './conf/index.js';
import type { NymphDriver } from './driver/index.js';
import Entity, {
  type EntityInstanceType,
  type EntityObjectType,
} from './Entity.js';
import type { EntityConstructor, EntityInterface } from './Entity.types.js';
import {
  ClassNotAvailableError,
  InvalidParametersError,
} from './errors/index.js';
import type {
  Selector,
  Options,
  NymphConnectCallback,
  NymphDisconnectCallback,
  NymphBeforeGetEntityCallback,
  NymphBeforeGetEntitiesCallback,
  NymphBeforeSaveEntityCallback,
  NymphAfterSaveEntityCallback,
  NymphFailedSaveEntityCallback,
  NymphBeforeDeleteEntityCallback,
  NymphAfterDeleteEntityCallback,
  NymphFailedDeleteEntityCallback,
  NymphBeforeDeleteEntityByIDCallback,
  NymphAfterDeleteEntityByIDCallback,
  NymphFailedDeleteEntityByIDCallback,
  NymphBeforeNewUIDCallback,
  NymphAfterNewUIDCallback,
  NymphFailedNewUIDCallback,
  NymphBeforeSetUIDCallback,
  NymphAfterSetUIDCallback,
  NymphFailedSetUIDCallback,
  NymphBeforeRenameUIDCallback,
  NymphAfterRenameUIDCallback,
  NymphFailedRenameUIDCallback,
  NymphBeforeDeleteUIDCallback,
  NymphAfterDeleteUIDCallback,
  NymphFailedDeleteUIDCallback,
  NymphBeforeStartTransactionCallback,
  NymphAfterStartTransactionCallback,
  NymphBeforeCommitTransactionCallback,
  NymphAfterCommitTransactionCallback,
  NymphBeforeRollbackTransactionCallback,
  NymphAfterRollbackTransactionCallback,
  NymphEventType,
  NymphQueryCallback,
  FormattedSelector,
  TilmeldInterface,
} from './Nymph.types.js';

/**
 * An object relational mapper for Node.js.
 *
 * Written by Hunter Perrin for SciActive.
 *
 * @author Hunter Perrin <hperrin@gmail.com>
 * @copyright SciActive Inc
 * @see http://nymph.io/
 */
export default class Nymph {
  /**
   * The Nymph config.
   */
  public config: Config;

  /**
   * The Nymph instance that this one was cloned from, or null if it's not a
   * clone.
   */
  public parent: Nymph | null;

  /**
   * The Nymph database driver.
   */
  public driver: NymphDriver;

  /**
   * An optional Tilmeld user/group manager instance.
   */
  public tilmeld?: TilmeldInterface = undefined;

  /**
   * A simple map of names to Entity classes.
   */
  private entityClasses: { [k: string]: EntityConstructor } = {};

  /**
   * The entity class for this instance of Nymph.
   */
  public Entity: typeof Entity;

  private connectCallbacks: NymphConnectCallback[] = [];
  private disconnectCallbacks: NymphDisconnectCallback[] = [];
  private queryCallbacks: NymphQueryCallback[] = [];
  private beforeGetEntityCallbacks: NymphBeforeGetEntityCallback[] = [];
  private beforeGetEntitiesCallbacks: NymphBeforeGetEntitiesCallback[] = [];
  private beforeSaveEntityCallbacks: NymphBeforeSaveEntityCallback[] = [];
  private afterSaveEntityCallbacks: NymphAfterSaveEntityCallback[] = [];
  private failedSaveEntityCallbacks: NymphFailedSaveEntityCallback[] = [];
  private beforeDeleteEntityCallbacks: NymphBeforeDeleteEntityCallback[] = [];
  private afterDeleteEntityCallbacks: NymphAfterDeleteEntityCallback[] = [];
  private failedDeleteEntityCallbacks: NymphFailedDeleteEntityCallback[] = [];
  private beforeDeleteEntityByIDCallbacks: NymphBeforeDeleteEntityByIDCallback[] =
    [];
  private afterDeleteEntityByIDCallbacks: NymphAfterDeleteEntityByIDCallback[] =
    [];
  private failedDeleteEntityByIDCallbacks: NymphFailedDeleteEntityByIDCallback[] =
    [];
  private beforeNewUIDCallbacks: NymphBeforeNewUIDCallback[] = [];
  private afterNewUIDCallbacks: NymphAfterNewUIDCallback[] = [];
  private failedNewUIDCallbacks: NymphFailedNewUIDCallback[] = [];
  private beforeSetUIDCallbacks: NymphBeforeSetUIDCallback[] = [];
  private afterSetUIDCallbacks: NymphAfterSetUIDCallback[] = [];
  private failedSetUIDCallbacks: NymphFailedSetUIDCallback[] = [];
  private beforeRenameUIDCallbacks: NymphBeforeRenameUIDCallback[] = [];
  private afterRenameUIDCallbacks: NymphAfterRenameUIDCallback[] = [];
  private failedRenameUIDCallbacks: NymphFailedRenameUIDCallback[] = [];
  private beforeDeleteUIDCallbacks: NymphBeforeDeleteUIDCallback[] = [];
  private afterDeleteUIDCallbacks: NymphAfterDeleteUIDCallback[] = [];
  private failedDeleteUIDCallbacks: NymphFailedDeleteUIDCallback[] = [];
  private beforeStartTransactionCallbacks: NymphBeforeStartTransactionCallback[] =
    [];
  private afterStartTransactionCallbacks: NymphAfterStartTransactionCallback[] =
    [];
  private beforeCommitTransactionCallbacks: NymphBeforeCommitTransactionCallback[] =
    [];
  private afterCommitTransactionCallbacks: NymphAfterCommitTransactionCallback[] =
    [];
  private beforeRollbackTransactionCallbacks: NymphBeforeRollbackTransactionCallback[] =
    [];
  private afterRollbackTransactionCallbacks: NymphAfterRollbackTransactionCallback[] =
    [];

  /**
   * Initialize Nymph.
   *
   * @param config The Nymph configuration.
   * @param driver The Nymph database driver.
   * @param tilmeld The Tilmeld user/group manager instance, if you want to use it.
   * @param parent Used internally by Nymph. Don't set this.
   */
  public constructor(
    config: Partial<Config>,
    driver: NymphDriver,
    tilmeld?: TilmeldInterface,
    parent?: Nymph,
  ) {
    this.config = { ...defaults, ...config };
    this.driver = driver;
    this.parent = parent ?? null;

    this.Entity = this.addEntityClass(Entity);

    if (parent) {
      for (const name in parent.entityClasses) {
        if (
          name === 'Entity' ||
          (parent.entityClasses[name] as any).skipOnClone
        ) {
          continue;
        }
        this.addEntityClass(parent.entityClasses[name]);
      }

      const events = [
        'connect',
        'disconnect',
        'query',
        'beforeGetEntity',
        'beforeGetEntities',
        'beforeSaveEntity',
        'afterSaveEntity',
        'failedSaveEntity',
        'beforeDeleteEntity',
        'afterDeleteEntity',
        'failedDeleteEntity',
        'beforeDeleteEntityByID',
        'afterDeleteEntityByID',
        'failedDeleteEntityByID',
        'beforeNewUID',
        'afterNewUID',
        'failedNewUID',
        'beforeSetUID',
        'afterSetUID',
        'failedSetUID',
        'beforeRenameUID',
        'afterRenameUID',
        'failedRenameUID',
        'beforeDeleteUID',
        'afterDeleteUID',
        'failedDeleteUID',
        'beforeStartTransaction',
        'afterStartTransaction',
        'beforeCommitTransaction',
        'afterCommitTransaction',
        'beforeRollbackTransaction',
        'afterRollbackTransaction',
      ];

      for (let event of events) {
        const prop = event + 'Callbacks';
        // @ts-ignore: The callback should be the right type here.
        const callbacks = parent[prop];
        for (let callback of callbacks) {
          if (callback.skipOnClone) {
            continue;
          }
          this.on(event as NymphEventType, callback);
        }
      }
    }

    this.config.debugInfo('nymph', 'Nymph loaded.');

    if (tilmeld != null) {
      this.tilmeld = tilmeld;
    }

    this.driver.init(this);
    this.config.debugInfo('nymph', 'Nymph driver loaded.');
    if (this.tilmeld) {
      this.tilmeld.init(this);
      this.config.debugInfo('nymph', 'Tilmeld loaded.');
    }
  }

  /**
   * Add your class to this instance.
   *
   * This will create a class that extends your class within this instance of
   * Nymph and return it. You can then use this class's constructor and methods,
   * which will use this instance of Nymph.
   *
   * Because this creates a subclass, don't use the class
   * returned from `getEntityClass` to check with `instanceof`.
   */
  public addEntityClass<T extends EntityConstructor>(EntityClass: T): T {
    if (EntityClass.class in this.entityClasses) {
      this.config.debugLog(
        'nymph',
        `Adding duplicate class "${EntityClass.class}". This may be a mistake.`,
      );
    }

    // Check that it doesn't have the same etype as any other class.
    for (const ExistingClass of Object.values(this.entityClasses)) {
      if (
        EntityClass.ETYPE === ExistingClass.ETYPE &&
        EntityClass.class !== EntityClass.class
      ) {
        this.config.debugLog(
          'nymph',
          `Adding class "${EntityClass.class}" with same etype as existing class "${ExistingClass.class}". This may be a mistake.`,
        );
      }
    }

    const nymph = this;
    this.entityClasses[EntityClass.class] = class extends EntityClass {
      static nymph: Nymph = nymph;

      constructor(...args: any[]) {
        super(...args);
      }
    };
    return this.entityClasses[EntityClass.class] as T;
  }

  /**
   * Get the class that uses the specified class name.
   */
  public getEntityClass(className: string): EntityConstructor;
  public getEntityClass<T extends EntityConstructor>(className: T): T;
  public getEntityClass<T extends EntityConstructor = EntityConstructor>(
    className: T | string,
  ): T | EntityConstructor {
    let key: string | null = null;
    if (typeof className === 'string') {
      key = className;
    } else {
      key = className.class;
    }
    if (key in this.entityClasses) {
      return this.entityClasses[key];
    }
    this.config.debugError('nymph', `Tried to use missing class "${key}".`);
    throw new ClassNotAvailableError(`Tried to use missing class "${key}".`);
  }

  /**
   * Get the class that uses the specified etype.
   *
   * Note that it is fine, though unusual, for two classes to use the same
   * etype. However, this can lead to very hard to diagnose bugs, so is
   * generally discouraged.
   */
  public getEntityClassByEtype(etype: string): EntityConstructor {
    for (const EntityClass of Object.values(this.entityClasses)) {
      if (EntityClass.ETYPE === etype) {
        return EntityClass;
      }
    }
    this.config.debugError(
      'nymph',
      `Tried to use missing class by etype "${etype}".`,
    );
    throw new ClassNotAvailableError(
      `Tried to use missing class by etype "${etype}".`,
    );
  }

  /**
   * Get a clone of this instance with cloned classes and event listeners.
   *
   * @returns A clone of this instance.
   */
  public clone() {
    return new Nymph(
      this.config,
      this.driver.clone(),
      this.tilmeld?.clone(),
      this,
    );
  }

  /**
   * Connect to the database.
   *
   * @returns Whether the instance is connected to the database.
   */
  public async connect(): Promise<boolean> {
    try {
      const result = this.driver.connect();
      for (let callback of this.connectCallbacks) {
        if (callback) {
          await callback(this, result);
        }
      }
      this.config.debugInfo('nymph', 'Driver connected.');
      return await result;
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to connect: ${e}`);
      throw e;
    }
  }

  /**
   * Disconnect from the database.
   *
   * @returns Whether the instance is connected to the database.
   */
  public async disconnect(): Promise<boolean> {
    try {
      const result = this.driver.disconnect();
      for (let callback of this.disconnectCallbacks) {
        if (callback) {
          await callback(this, result);
        }
      }
      this.config.debugInfo('nymph', 'Driver disconnected.');
      return await result;
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to disconnect: ${e}`);
      throw e;
    }
  }

  /**
   * Run all the query callbacks on a query.
   */
  public runQueryCallbacks(options: Options, selectors: FormattedSelector[]) {
    for (let callback of this.queryCallbacks) {
      if (callback) {
        callback(this, options, selectors);
      }
    }
  }

  /**
   * Start an atomic transaction and returns a new instance of Nymph.
   *
   * All proceeding changes using this new instance will wait to be written to
   * the database's permanent storage until commit() is called. You can also
   * undo all the changes since this function ran with rollback().
   *
   * Transactions will nest as long as every name is unique. Internally, Nymph
   * uses names prefixed with "nymph-".
   *
   * @returns A new instance of Nymph that should be used for the transaction.
   */
  public async startTransaction(name: string): Promise<Nymph> {
    try {
      for (let callback of this.beforeStartTransactionCallbacks) {
        if (callback) {
          await callback(this, name);
        }
      }
      this.config.debugLog('nymph', `Starting transaction "${name}".`);
      const result = await this.driver.startTransaction(name);
      for (let callback of this.afterStartTransactionCallbacks) {
        if (callback) {
          await callback(this, name, result);
        }
      }
      return result;
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to start transaction: ${e}`);
      throw e;
    }
  }

  /**
   * Commit the named transaction.
   *
   * After this is called, the transaction instance should be discarded.
   *
   * @returns True on success, false on failure.
   */
  public async commit(name: string): Promise<boolean> {
    try {
      for (let callback of this.beforeCommitTransactionCallbacks) {
        if (callback) {
          await callback(this, name);
        }
      }
      this.config.debugLog('nymph', `Committing transaction "${name}".`);
      const result = await this.driver.commit(name);
      for (let callback of this.afterCommitTransactionCallbacks) {
        if (callback) {
          await callback(this, name, result);
        }
      }
      return result;
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to commit transaction: ${e}`);
      throw e;
    }
  }

  /**
   * Rollback the named transaction.
   *
   * After this is called, the transaction instance should be discarded.
   *
   * @returns True on success, false on failure.
   */
  public async rollback(name: string): Promise<boolean> {
    try {
      for (let callback of this.beforeRollbackTransactionCallbacks) {
        if (callback) {
          await callback(this, name);
        }
      }
      this.config.debugLog('nymph', `Rolling back transaction "${name}".`);
      const result = await this.driver.rollback(name);
      for (let callback of this.afterRollbackTransactionCallbacks) {
        if (callback) {
          await callback(this, name, result);
        }
      }
      return result;
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to roll back transaction: ${e}`);
      throw e;
    }
  }

  /**
   * Check if there is any open transaction.
   *
   * @returns True if there is a transaction.
   */
  public async inTransaction(): Promise<boolean> {
    return await this.driver.inTransaction();
  }

  /**
   * Increment or create a unique ID and return the new value.
   *
   * Unique IDs, or UIDs are similar to GUIDs, but numeric and sequential.
   *
   * A UID can be used to identify an object when the GUID doesn't suffice. On
   * a system where a new entity is created many times per second, referring
   * to something by its GUID may be unintuitive. However, the component
   * designer is responsible for assigning UIDs to the component's entities.
   * Beware that if a UID is incremented for an entity, and the entity cannot
   * be saved, there is no safe, and therefore, no recommended way to
   * decrement the UID back to its previous value.
   *
   * If newUID() is passed the name of a UID which does not exist yet, one
   * will be created with that name, and assigned the value 1. If the UID
   * already exists, its value will be incremented. The new value will be
   * returned.
   *
   * @param name The UID's name.
   * @returns The UID's new value, or null on failure.
   */
  public async newUID(name: string): Promise<number | null> {
    try {
      for (let callback of this.beforeNewUIDCallbacks) {
        if (callback) {
          await callback(this, name);
        }
      }
      let result: Promise<number | null>;
      try {
        result = this.driver.newUID(name);
      } catch (e: any) {
        for (let callback of this.failedNewUIDCallbacks) {
          if (callback) {
            await callback(this, e);
          }
        }
        throw e;
      }
      for (let callback of this.afterNewUIDCallbacks) {
        if (callback) {
          await callback(this, result);
        }
      }
      return await result;
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to create UID "${name}": ${e}`);
      throw e;
    }
  }

  /**
   * Get the current value of a unique ID.
   * @param name The UID's name.
   * @returns The UID's value, or null on failure and if it doesn't exist.
   */
  public async getUID(name: string): Promise<number | null> {
    try {
      return await this.driver.getUID(name);
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to get UID "${name}": ${e}`);
      throw e;
    }
  }

  /**
   * Set the value of a UID.
   *
   * @param name The UID's name.
   * @param value The value.
   * @returns True on success, false on failure.
   */
  public async setUID(name: string, value: number): Promise<boolean> {
    try {
      for (let callback of this.beforeSetUIDCallbacks) {
        if (callback) {
          await callback(this, name, value);
        }
      }
      let result: Promise<boolean>;
      try {
        result = this.driver.setUID(name, value);
      } catch (e: any) {
        for (let callback of this.failedSetUIDCallbacks) {
          if (callback) {
            await callback(this, e);
          }
        }
        throw e;
      }
      for (let callback of this.afterSetUIDCallbacks) {
        if (callback) {
          await callback(this, result);
        }
      }
      return await result;
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to set UID "${name}": ${e}`);
      throw e;
    }
  }

  /**
   * Delete a unique ID.
   *
   * @param name The UID's name.
   * @returns True on success, false on failure.
   */
  public async deleteUID(name: string): Promise<boolean> {
    try {
      for (let callback of this.beforeDeleteUIDCallbacks) {
        if (callback) {
          await callback(this, name);
        }
      }
      let result: Promise<boolean>;
      try {
        result = this.driver.deleteUID(name);
      } catch (e: any) {
        for (let callback of this.failedDeleteUIDCallbacks) {
          if (callback) {
            await callback(this, e);
          }
        }
        throw e;
      }
      for (let callback of this.afterDeleteUIDCallbacks) {
        if (callback) {
          await callback(this, result);
        }
      }
      return await result;
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to delete UID "${name}": ${e}`);
      throw e;
    }
  }

  /**
   * Rename a unique ID.
   *
   * @param oldName The old name.
   * @param newName The new name.
   * @returns True on success, false on failure.
   */
  public async renameUID(oldName: string, newName: string): Promise<boolean> {
    try {
      for (let callback of this.beforeRenameUIDCallbacks) {
        if (callback) {
          await callback(this, oldName, newName);
        }
      }
      let result: Promise<boolean>;
      try {
        result = this.driver.renameUID(oldName, newName);
      } catch (e: any) {
        for (let callback of this.failedRenameUIDCallbacks) {
          if (callback) {
            await callback(this, e);
          }
        }
        throw e;
      }
      for (let callback of this.afterRenameUIDCallbacks) {
        if (callback) {
          await callback(this, result);
        }
      }
      return await result;
    } catch (e: any) {
      this.config.debugError(
        'nymph',
        `Failed to rename UID "${oldName}" to "${newName}": ${e}`,
      );
      throw e;
    }
  }

  /**
   * Save an entity to the database.
   *
   * If the entity has never been saved (has no GUID), a variable "cdate"
   * is set on it with the current Unix timestamp.
   *
   * The variable "mdate" is set to the current Unix timestamp.
   *
   * @param entity The entity.
   * @returns True on success, false on failure.
   */
  public async saveEntity(entity: EntityInterface): Promise<boolean> {
    try {
      for (let callback of this.beforeSaveEntityCallbacks) {
        if (callback) {
          await callback(this, entity);
        }
      }
      let result: Promise<boolean>;
      try {
        result = this.driver.saveEntity(entity);
      } catch (e: any) {
        for (let callback of this.failedSaveEntityCallbacks) {
          if (callback) {
            await callback(this, e);
          }
        }
        throw e;
      }
      for (let callback of this.afterSaveEntityCallbacks) {
        if (callback) {
          await callback(this, result);
        }
      }
      return await result;
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to save entity: ${e}`);
      throw e;
    }
  }

  /**
   * Get an array of entities.
   *
   * `options` is an object, which contains any of the following settings:
   *
   * - class - The class to create each entity with.
   * - limit - The limit of entities to be returned.
   * - offset - The offset from the oldest matching entity to start retrieving.
   * - reverse - If true, entities will be retrieved from newest to oldest.
   *   Therefore, offset will be from the newest entity.
   * - sort - How to sort the entities. Accepts "cdate", "mdate", or the name of
   *   a top-level property. The method of sorting properties other than cdate
   *   and mdate is driver dependent. The only hard rule is that numbers should
   *   be sorted numerically (2 before 10). Defaults to "cdate".
   * - return - What to return. "entity", "object", "guid", or "count". Defaults
   *   to "entity".
   * - source - Will be 'client' if the query came from a REST call.
   * - skipCache - If true, Nymph will skip the cache and retrieve the entity
   *   from the DB.
   * - skipAc - If true, Tilmeld will not filter returned entities according to
   *   access controls. (If Tilmeld is installed.) (This is *always* set to
   *   false by the REST server.)
   *
   * If a class is specified, it must have a factory() static method that
   * returns a new instance.
   *
   * Selectors are objects. Any amount of selectors can be provided. Empty
   * selectors will be ignored. The `type` property of a selector is required
   * and can be one of the following strings:
   *
   * - & - (and) All values in the selector must be true.
   * - | - (or) At least one value in the selector must be true.
   * - !& - (not and) All values in the selector must be false.
   * - !| - (not or) At least one value in the selector must be false.
   *
   * The rest of the properties in the selectors are called selector clauses,
   * which can be any of the following (in the form selector.name = value, or
   * selector.name = [value1, value2,...]):
   *
   * - guid - A GUID. True if the entity's GUID is equal.
   * - tag - A tag. True if the entity has the tag.
   * - defined - A name. True if the named property exists.
   * - truthy - A name. True if the named property is defined and truthy.
   * - equal - An array with a name, then value. True if the named property is
   *   defined and equal (their JSON strings are identical).
   * - contain - An array with a name, then value. True if the named property
   *   contains the value (its JSON string is found within the property's JSON
   *   string).
   * - search - An array with a name, then search query. True if the named
   *   property matches the query. Use single quotes to find sequential terms.
   *   Use double quotes to find exact terms. Use "or" as the or operator. Use
   *   "-" before a term as the negation operator. Stop words and punctuation
   *   are stripped. Case insensitive.
   * - match - An array with a name, then regular expression. True if the
   *   named property matches. Uses POSIX RegExp. Case sensitive. Must *not* be
   *   surrounded by any delimiters.
   * - imatch - An array with a name, then regular expression. True if the
   *   named property matches. Uses POSIX RegExp. Case insensitive. Must *not*
   *   be surrounded by any delimiters.
   * - like - An array with a name, then pattern. True if the named property
   *   matches. Uses % for variable length wildcard and _ for single character
   *   wildcard. Case sensitive.
   * - ilike - An array with a name, then pattern. True if the named property
   *   matches. Uses % for variable length wildcard and _ for single character
   *   wildcard. Case insensitive.
   * - gt - An array with a name, then value. True if the named property is
   *   greater than the value.
   * - gte - An array with a name, then value. True if the named property is
   *   greater than or equal to the value.
   * - lt - An array with a name, then value. True if the named property is
   *   less than the value.
   * - lte - An array with a name, then value. True if the named property is
   *   less than or equal to the value.
   * - ref - An array with a name, then either an entity, or a GUID. True if
   *   the named property is the entity or contains the entity.
   * - qref - An array with a name, then a full query (including options) in an
   *   array. True if the named property is an entity that matches the query or
   *   contains an entity that matches the query.
   * - selector - A selector. (Keep in mind, you can also use an array of these,
   *   just like any other clause.)
   *
   * These clauses can all be negated, by prefixing them with an exclamation
   * point, such as "!truthy" to mean falsy (or undefined).
   *
   * Any clause that accepts an array of name and value can also accept a third
   * element. If value is null and the third element is a string, the third
   * element will be used with Locutus' strtotime function to set value to a
   * relative timestamp. For example, the following selector will look for all
   * entities that were created in the last day:
   *
   * ```
   * {
   *   type: '&',
   *   gte: ['cdate', null, '-1 day']
   * }
   * ```
   *
   * Locutus' implementation: https://locutus.io/php/datetime/strtotime/
   * PHP's documentation: https://www.php.net/manual/en/function.strtotime.php
   *
   * This example will retrieve the last two entities where:
   *
   * - It has 'person' tag.
   * - spouse is defined.
   * - gender is male and lname is Smith.
   * - warnings is not an integer 0.
   * - It has 'level1' and 'level2' tags, or it has 'access1' and 'access2'
   *   tags.
   * - It has either 'employee' or 'manager' tag.
   * - name is either Clark, James, Chris, Christopher, Jake, or Jacob.
   * - If age is 22 or more, then pay is not greater than 8.
   *
   * ```
   * const entities = Nymph.getEntities(
   *   { class: Entity, reverse: true, limit: 2 },
   *   {
   *     type: '&', // all must be true
   *     tag: 'person',
   *     defined: 'spouse',
   *     equal: [
   *       ['gender', 'male'],
   *       ['lname', 'Smith']
   *     ],
   *     '!equal': ['warnings', 0]
   *   },
   *   {
   *     type: '|', // at least one of the selectors in this must match
   *     selector: [
   *       {
   *         type: '&',
   *         tag: ['level1', 'level2']
   *       },
   *       {
   *         type: '&',
   *         tag: ['access1', 'access2']
   *       }
   *     ]
   *   },
   *   {
   *     type: '|', // at least one must be true
   *     tag: ['employee', 'manager']
   *   },
   *   {
   *     type: '|',
   *     equal: [
   *       ['name', 'Clark'],
   *       ['name', 'James']
   *     ],
   *     match: [
   *       ['name', 'Chris(topher)?'],
   *       ['name', 'Ja(ke|cob)']
   *     ]
   *   },
   *   {
   *     type: '!|', // at least one must be false
   *     gte: ['age', 22],
   *     gt: ['pay', 8]
   *   }
   * );
   * ```
   *
   * @param options The options.
   * @param selectors Unlimited optional selectors to search for. If none are given, all entities are retrieved for the given options.
   * @returns An array of entities or guids, or a count.
   * @todo Use an asterisk to specify any variable.
   */
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'count' },
    ...selectors: Selector[]
  ): Promise<number>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string[]>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'object' },
    ...selectors: Selector[]
  ): Promise<EntityObjectType<T>[]>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options?: Options<T>,
    ...selectors: Selector[]
  ): Promise<EntityInstanceType<T>[]>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> = {},
    ...selectors: Selector[]
  ): Promise<
    EntityInstanceType<T>[] | EntityObjectType<T>[] | string[] | number
  > {
    if (options.source === 'client' && options.return === 'object') {
      throw new InvalidParametersError(
        'Object return type not allowed from client.',
      );
    }

    try {
      for (let callback of this.beforeGetEntitiesCallbacks) {
        if (callback) {
          await callback(this, options, selectors);
        }
      }
      return await this.driver.getEntities(options, ...selectors);
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to get entities: ${e}`);
      throw e;
    }
  }

  /**
   * Get the first entity to match all options/selectors.
   *
   * options and selectors are the same as in getEntities().
   *
   * This function is equivalent to setting options.limit to 1 for
   * getEntities(), except that it will return null if no entity is found.
   * getEntities() would return an empty array.
   *
   * @param options The options.
   * @param selectors Unlimited optional selectors to search for, or a single GUID. If none are given, all entities are searched for the given options.
   * @returns An entity or guid, or null on failure or nothing found, or a number.
   */
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'count' },
    ...selectors: Selector[]
  ): Promise<number>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'object' },
    ...selectors: Selector[]
  ): Promise<EntityObjectType<T> | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    ...selectors: Selector[]
  ): Promise<EntityInstanceType<T> | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    guid: string,
  ): Promise<string | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'object' },
    guid: string,
  ): Promise<EntityObjectType<T> | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    guid: string,
  ): Promise<EntityInstanceType<T> | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> = {},
    ...selectors: Selector[] | string[]
  ): Promise<
    EntityInstanceType<T> | EntityObjectType<T> | string | number | null
  > {
    if (options.source === 'client' && options.return === 'object') {
      throw new InvalidParametersError(
        'Object return type not allowed from client.',
      );
    }

    try {
      // Set up options and selectors.
      if (typeof selectors[0] === 'string') {
        selectors = [{ type: '&', guid: selectors[0] }];
      }
      options.limit = 1;
      for (let callback of this.beforeGetEntityCallbacks) {
        if (callback) {
          await callback(this, options, selectors as Selector[]);
        }
      }
      const entities = await this.driver.getEntities(
        options,
        ...(selectors as Selector[]),
      );
      if (options.return === 'count') {
        return entities as unknown as number;
      }
      if (!entities || !entities.length) {
        return null;
      }
      return entities[0];
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to get entity: ${e}`);
      throw e;
    }
  }

  /**
   * Delete an entity from the database.
   *
   * @param entity The entity.
   * @returns True on success, false on failure.
   */
  public async deleteEntity(entity: EntityInterface): Promise<boolean> {
    try {
      for (let callback of this.beforeDeleteEntityCallbacks) {
        if (callback) {
          await callback(this, entity);
        }
      }
      let result: Promise<boolean>;
      try {
        result = this.driver.deleteEntity(entity);
      } catch (e: any) {
        for (let callback of this.failedDeleteEntityCallbacks) {
          if (callback) {
            await callback(this, e);
          }
        }
        throw e;
      }
      for (let callback of this.afterDeleteEntityCallbacks) {
        if (callback) {
          await callback(this, result);
        }
      }
      return await result;
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to delete entity: ${e}`);
      throw e;
    }
  }

  /**
   * Delete an entity from the database by its GUID.
   *
   * @param guid The entity's GUID.
   * @param className The entity's class name.
   * @returns True on success, false on failure.
   */
  public async deleteEntityByID(
    guid: string,
    className?: string,
  ): Promise<boolean> {
    try {
      for (let callback of this.beforeDeleteEntityByIDCallbacks) {
        if (callback) {
          await callback(this, guid, className);
        }
      }
      let result: Promise<boolean>;
      try {
        result = this.driver.deleteEntityByID(guid, className);
      } catch (e: any) {
        for (let callback of this.failedDeleteEntityByIDCallbacks) {
          if (callback) {
            await callback(this, e);
          }
        }
        throw e;
      }
      for (let callback of this.afterDeleteEntityByIDCallbacks) {
        if (callback) {
          await callback(this, result);
        }
      }
      return await result;
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to delete entity by ID: ${e}`);
      throw e;
    }
  }

  /**
   * Export entities to a local file.
   *
   * This is the file format:
   *
   * ```
   * #nex2
   * # The above line must be the first thing in the file.
   * # Comments begin with #
   *    # And can have white space before them.
   * # This defines a UID.
   * <name/of/uid>[5]
   * <another uid>[8000]
   * # For UIDs, the name is in angle brackets (<>) and the value follows
   * # in square brackets ([]).
   * # This starts a new entity.
   * {1234abcd}<etype>[tag,list,with,commas]
   * # For entities, the GUID is in curly brackets ({}), then the etype in
   * #  angle brackets, then the comma separated tag list follows in square
   * #  brackets ([]).
   * # Properties are stored like this:
   * # propname=JSON.stringify(value)
   *     abilities=["system/admin"]
   *     groups=[]
   *     inheritAbilities=false
   *     name="admin"
   * # White space before/after "=" and at beginning/end of line is ignored.
   *         username  =     "admin"
   * {2}<etype>[tag,list]
   *     another="This is another entity."
   *     newline="\n"
   * ```
   *
   * @param filename The file to export to.
   * @returns True on success, false on failure.
   */
  public async export(filename: string): Promise<boolean> {
    try {
      return await this.driver.export(filename);
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to export: ${e}`);
      throw e;
    }
  }

  /**
   * Export entities to the console.
   *
   * @returns True on success, false on failure.
   */
  public async exportPrint(): Promise<boolean> {
    try {
      return await this.driver.exportPrint();
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to export: ${e}`);
      throw e;
    }
  }

  /**
   * Import entities from a file.
   *
   * @param filename The file to import from.
   * @returns True on success, false on failure.
   */
  public async import(filename: string): Promise<boolean> {
    try {
      return await this.driver.import(filename);
    } catch (e: any) {
      this.config.debugError('nymph', `Failed to import: ${e}`);
      throw e;
    }
  }

  /**
   * Detect whether the database needs to be migrated.
   *
   * If true, the database should be exported with an old version of Nymph, then
   * imported into a fresh database with this version.
   */
  public async needsMigration(): Promise<boolean> {
    return await this.driver.needsMigration();
  }

  public on<T extends NymphEventType>(
    event: T,
    callback: T extends 'connect'
      ? NymphConnectCallback
      : T extends 'disconnect'
        ? NymphDisconnectCallback
        : T extends 'query'
          ? NymphQueryCallback
          : T extends 'beforeGetEntity'
            ? NymphBeforeGetEntityCallback
            : T extends 'beforeGetEntities'
              ? NymphBeforeGetEntitiesCallback
              : T extends 'beforeSaveEntity'
                ? NymphBeforeSaveEntityCallback
                : T extends 'afterSaveEntity'
                  ? NymphAfterSaveEntityCallback
                  : T extends 'failedSaveEntity'
                    ? NymphFailedSaveEntityCallback
                    : T extends 'beforeDeleteEntity'
                      ? NymphBeforeDeleteEntityCallback
                      : T extends 'afterDeleteEntity'
                        ? NymphAfterDeleteEntityCallback
                        : T extends 'failedDeleteEntity'
                          ? NymphFailedDeleteEntityCallback
                          : T extends 'beforeDeleteEntityByID'
                            ? NymphBeforeDeleteEntityByIDCallback
                            : T extends 'afterDeleteEntityByID'
                              ? NymphAfterDeleteEntityByIDCallback
                              : T extends 'failedDeleteEntityByID'
                                ? NymphFailedDeleteEntityByIDCallback
                                : T extends 'beforeNewUID'
                                  ? NymphBeforeNewUIDCallback
                                  : T extends 'afterNewUID'
                                    ? NymphAfterNewUIDCallback
                                    : T extends 'failedNewUID'
                                      ? NymphFailedNewUIDCallback
                                      : T extends 'beforeSetUID'
                                        ? NymphBeforeSetUIDCallback
                                        : T extends 'afterSetUID'
                                          ? NymphAfterSetUIDCallback
                                          : T extends 'failedSetUID'
                                            ? NymphFailedSetUIDCallback
                                            : T extends 'beforeRenameUID'
                                              ? NymphBeforeRenameUIDCallback
                                              : T extends 'afterRenameUID'
                                                ? NymphAfterRenameUIDCallback
                                                : T extends 'failedRenameUID'
                                                  ? NymphFailedRenameUIDCallback
                                                  : T extends 'beforeDeleteUID'
                                                    ? NymphBeforeDeleteUIDCallback
                                                    : T extends 'afterDeleteUID'
                                                      ? NymphAfterDeleteUIDCallback
                                                      : T extends 'failedDeleteUID'
                                                        ? NymphFailedDeleteUIDCallback
                                                        : T extends 'beforeStartTransaction'
                                                          ? NymphBeforeStartTransactionCallback
                                                          : T extends 'afterStartTransaction'
                                                            ? NymphAfterStartTransactionCallback
                                                            : T extends 'beforeCommitTransaction'
                                                              ? NymphBeforeCommitTransactionCallback
                                                              : T extends 'afterCommitTransaction'
                                                                ? NymphAfterCommitTransactionCallback
                                                                : T extends 'beforeRollbackTransaction'
                                                                  ? NymphBeforeRollbackTransactionCallback
                                                                  : T extends 'afterRollbackTransaction'
                                                                    ? NymphAfterRollbackTransactionCallback
                                                                    : never,
  ) {
    const prop = (event + 'Callbacks') as T extends 'connect'
      ? 'connectCallbacks'
      : T extends 'disconnect'
        ? 'disconnectCallbacks'
        : T extends 'query'
          ? 'queryCallbacks'
          : T extends 'beforeGetEntity'
            ? 'beforeGetEntityCallbacks'
            : T extends 'beforeGetEntities'
              ? 'beforeGetEntitiesCallbacks'
              : T extends 'beforeSaveEntity'
                ? 'beforeSaveEntityCallbacks'
                : T extends 'afterSaveEntity'
                  ? 'afterSaveEntityCallbacks'
                  : T extends 'failedSaveEntity'
                    ? 'failedSaveEntityCallbacks'
                    : T extends 'beforeDeleteEntity'
                      ? 'beforeDeleteEntityCallbacks'
                      : T extends 'afterDeleteEntity'
                        ? 'afterDeleteEntityCallbacks'
                        : T extends 'failedDeleteEntity'
                          ? 'failedDeleteEntityCallbacks'
                          : T extends 'beforeDeleteEntityByID'
                            ? 'beforeDeleteEntityByIDCallbacks'
                            : T extends 'afterDeleteEntityByID'
                              ? 'afterDeleteEntityByIDCallbacks'
                              : T extends 'failedDeleteEntityByID'
                                ? 'failedDeleteEntityByIDCallbacks'
                                : T extends 'beforeNewUID'
                                  ? 'beforeNewUIDCallbacks'
                                  : T extends 'afterNewUID'
                                    ? 'afterNewUIDCallbacks'
                                    : T extends 'failedNewUID'
                                      ? 'failedNewUIDCallbacks'
                                      : T extends 'beforeSetUID'
                                        ? 'beforeSetUIDCallbacks'
                                        : T extends 'afterSetUID'
                                          ? 'afterSetUIDCallbacks'
                                          : T extends 'failedSetUID'
                                            ? 'failedSetUIDCallbacks'
                                            : T extends 'beforeRenameUID'
                                              ? 'beforeRenameUIDCallbacks'
                                              : T extends 'afterRenameUID'
                                                ? 'afterRenameUIDCallbacks'
                                                : T extends 'failedRenameUID'
                                                  ? 'failedRenameUIDCallbacks'
                                                  : T extends 'beforeDeleteUID'
                                                    ? 'beforeDeleteUIDCallbacks'
                                                    : T extends 'afterDeleteUID'
                                                      ? 'afterDeleteUIDCallbacks'
                                                      : T extends 'failedDeleteUID'
                                                        ? 'failedDeleteUIDCallbacks'
                                                        : T extends 'beforeStartTransaction'
                                                          ? 'beforeStartTransactionCallbacks'
                                                          : T extends 'afterStartTransaction'
                                                            ? 'afterStartTransactionCallbacks'
                                                            : T extends 'beforeCommitTransaction'
                                                              ? 'beforeCommitTransactionCallbacks'
                                                              : T extends 'afterCommitTransaction'
                                                                ? 'afterCommitTransactionCallbacks'
                                                                : T extends 'beforeRollbackTransaction'
                                                                  ? 'beforeRollbackTransactionCallbacks'
                                                                  : T extends 'afterRollbackTransaction'
                                                                    ? 'afterRollbackTransactionCallbacks'
                                                                    : never;
    if (!(prop in this)) {
      throw new Error('Invalid event type.');
    }
    // @ts-ignore: The callback should be the right type here.
    this[prop].push(callback);
    return () => this.off(event, callback);
  }

  public off<T extends NymphEventType>(
    event: T,
    callback: T extends 'connect'
      ? NymphConnectCallback
      : T extends 'disconnect'
        ? NymphDisconnectCallback
        : T extends 'query'
          ? NymphQueryCallback
          : T extends 'beforeGetEntity'
            ? NymphBeforeGetEntityCallback
            : T extends 'beforeGetEntities'
              ? NymphBeforeGetEntitiesCallback
              : T extends 'beforeSaveEntity'
                ? NymphBeforeSaveEntityCallback
                : T extends 'afterSaveEntity'
                  ? NymphAfterSaveEntityCallback
                  : T extends 'failedSaveEntity'
                    ? NymphFailedSaveEntityCallback
                    : T extends 'beforeDeleteEntity'
                      ? NymphBeforeDeleteEntityCallback
                      : T extends 'afterDeleteEntity'
                        ? NymphAfterDeleteEntityCallback
                        : T extends 'failedDeleteEntity'
                          ? NymphFailedDeleteEntityCallback
                          : T extends 'beforeDeleteEntityByID'
                            ? NymphBeforeDeleteEntityByIDCallback
                            : T extends 'afterDeleteEntityByID'
                              ? NymphAfterDeleteEntityByIDCallback
                              : T extends 'failedDeleteEntityByID'
                                ? NymphFailedDeleteEntityByIDCallback
                                : T extends 'beforeNewUID'
                                  ? NymphBeforeNewUIDCallback
                                  : T extends 'afterNewUID'
                                    ? NymphAfterNewUIDCallback
                                    : T extends 'failedNewUID'
                                      ? NymphFailedNewUIDCallback
                                      : T extends 'beforeSetUID'
                                        ? NymphBeforeSetUIDCallback
                                        : T extends 'afterSetUID'
                                          ? NymphAfterSetUIDCallback
                                          : T extends 'failedSetUID'
                                            ? NymphFailedSetUIDCallback
                                            : T extends 'beforeRenameUID'
                                              ? NymphBeforeRenameUIDCallback
                                              : T extends 'afterRenameUID'
                                                ? NymphAfterRenameUIDCallback
                                                : T extends 'failedRenameUID'
                                                  ? NymphFailedRenameUIDCallback
                                                  : T extends 'beforeDeleteUID'
                                                    ? NymphBeforeDeleteUIDCallback
                                                    : T extends 'afterDeleteUID'
                                                      ? NymphAfterDeleteUIDCallback
                                                      : T extends 'failedDeleteUID'
                                                        ? NymphFailedDeleteUIDCallback
                                                        : T extends 'beforeStartTransaction'
                                                          ? NymphBeforeStartTransactionCallback
                                                          : T extends 'afterStartTransaction'
                                                            ? NymphAfterStartTransactionCallback
                                                            : T extends 'beforeCommitTransaction'
                                                              ? NymphBeforeCommitTransactionCallback
                                                              : T extends 'afterCommitTransaction'
                                                                ? NymphAfterCommitTransactionCallback
                                                                : T extends 'beforeRollbackTransaction'
                                                                  ? NymphBeforeRollbackTransactionCallback
                                                                  : T extends 'afterRollbackTransaction'
                                                                    ? NymphAfterRollbackTransactionCallback
                                                                    : never,
  ) {
    const prop = (event + 'Callbacks') as T extends 'connect'
      ? 'connectCallbacks'
      : T extends 'disconnect'
        ? 'disconnectCallbacks'
        : T extends 'query'
          ? 'queryCallbacks'
          : T extends 'beforeSaveEntity'
            ? 'beforeSaveEntityCallbacks'
            : T extends 'beforeGetEntity'
              ? 'beforeGetEntityCallbacks'
              : T extends 'beforeGetEntities'
                ? 'beforeGetEntitiesCallbacks'
                : T extends 'afterSaveEntity'
                  ? 'afterSaveEntityCallbacks'
                  : T extends 'failedSaveEntity'
                    ? 'failedSaveEntityCallbacks'
                    : T extends 'beforeDeleteEntity'
                      ? 'beforeDeleteEntityCallbacks'
                      : T extends 'afterDeleteEntity'
                        ? 'afterDeleteEntityCallbacks'
                        : T extends 'failedDeleteEntity'
                          ? 'failedDeleteEntityCallbacks'
                          : T extends 'beforeDeleteEntityByID'
                            ? 'beforeDeleteEntityByIDCallbacks'
                            : T extends 'afterDeleteEntityByID'
                              ? 'afterDeleteEntityByIDCallbacks'
                              : T extends 'failedDeleteEntityByID'
                                ? 'failedDeleteEntityByIDCallbacks'
                                : T extends 'beforeNewUID'
                                  ? 'beforeNewUIDCallbacks'
                                  : T extends 'afterNewUID'
                                    ? 'afterNewUIDCallbacks'
                                    : T extends 'failedNewUID'
                                      ? 'failedNewUIDCallbacks'
                                      : T extends 'beforeSetUID'
                                        ? 'beforeSetUIDCallbacks'
                                        : T extends 'afterSetUID'
                                          ? 'afterSetUIDCallbacks'
                                          : T extends 'failedSetUID'
                                            ? 'failedSetUIDCallbacks'
                                            : T extends 'beforeRenameUID'
                                              ? 'beforeRenameUIDCallbacks'
                                              : T extends 'afterRenameUID'
                                                ? 'afterRenameUIDCallbacks'
                                                : T extends 'failedRenameUID'
                                                  ? 'failedRenameUIDCallbacks'
                                                  : T extends 'beforeDeleteUID'
                                                    ? 'beforeDeleteUIDCallbacks'
                                                    : T extends 'afterDeleteUID'
                                                      ? 'afterDeleteUIDCallbacks'
                                                      : T extends 'failedDeleteUID'
                                                        ? 'failedDeleteUIDCallbacks'
                                                        : T extends 'beforeStartTransaction'
                                                          ? 'beforeStartTransactionCallbacks'
                                                          : T extends 'afterStartTransaction'
                                                            ? 'afterStartTransactionCallbacks'
                                                            : T extends 'beforeCommitTransaction'
                                                              ? 'beforeCommitTransactionCallbacks'
                                                              : T extends 'afterCommitTransaction'
                                                                ? 'afterCommitTransactionCallbacks'
                                                                : T extends 'beforeRollbackTransaction'
                                                                  ? 'beforeRollbackTransactionCallbacks'
                                                                  : T extends 'afterRollbackTransaction'
                                                                    ? 'afterRollbackTransactionCallbacks'
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
