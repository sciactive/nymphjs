import { Config, ConfigDefaults as defaults } from './conf';
import { NymphDriver } from './driver';
import PreInitializedDriver from './driver/PreInitializedDriver';
import { EntityConstructor, EntityInterface } from './Entity.types';
import { ClassNotAvailableError } from './errors';
import type {
  Selector,
  Options,
  NymphConnectCallback,
  NymphDisconnectCallback,
  NymphBeforeGetEntityCallback,
  NymphBeforeGetEntitiesCallback,
  NymphBeforeSaveEntityCallback,
  NymphAfterSaveEntityCallback,
  NymphBeforeDeleteEntityCallback,
  NymphAfterDeleteEntityCallback,
  NymphBeforeDeleteEntityByIDCallback,
  NymphAfterDeleteEntityByIDCallback,
  NymphBeforeNewUIDCallback,
  NymphAfterNewUIDCallback,
  NymphBeforeSetUIDCallback,
  NymphAfterSetUIDCallback,
  NymphBeforeRenameUIDCallback,
  NymphAfterRenameUIDCallback,
  NymphBeforeDeleteUIDCallback,
  NymphAfterDeleteUIDCallback,
  NymphEventType,
  NymphQueryCallback,
  FormattedSelector,
  TilmeldInterface,
} from './Nymph.types';

/**
 * An object relational mapper for Node.js.
 *
 * Written by Hunter Perrin for SciActive.
 *
 * @author Hunter Perrin <hperrin@gmail.com>
 * @copyright SciActive Inc
 * @see http://nymph.io/
 */
export class Nymph {
  /**
   * The PubSub config.
   */
  public config: Config;

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
  public entityClasses: { [k: string]: EntityConstructor } = {};

  private connectCallbacks: NymphConnectCallback[] = [];
  private disconnectCallbacks: NymphDisconnectCallback[] = [];
  private queryCallbacks: NymphQueryCallback[] = [];
  private beforeGetEntityCallbacks: NymphBeforeGetEntityCallback[] = [];
  private beforeGetEntitiesCallbacks: NymphBeforeGetEntitiesCallback[] = [];
  private beforeSaveEntityCallbacks: NymphBeforeSaveEntityCallback[] = [];
  private afterSaveEntityCallbacks: NymphAfterSaveEntityCallback[] = [];
  private beforeDeleteEntityCallbacks: NymphBeforeDeleteEntityCallback[] = [];
  private afterDeleteEntityCallbacks: NymphAfterDeleteEntityCallback[] = [];
  private beforeDeleteEntityByIDCallbacks: NymphBeforeDeleteEntityByIDCallback[] =
    [];
  private afterDeleteEntityByIDCallbacks: NymphAfterDeleteEntityByIDCallback[] =
    [];
  private beforeNewUIDCallbacks: NymphBeforeNewUIDCallback[] = [];
  private afterNewUIDCallbacks: NymphAfterNewUIDCallback[] = [];
  private beforeSetUIDCallbacks: NymphBeforeSetUIDCallback[] = [];
  private afterSetUIDCallbacks: NymphAfterSetUIDCallback[] = [];
  private beforeRenameUIDCallbacks: NymphBeforeRenameUIDCallback[] = [];
  private afterRenameUIDCallbacks: NymphAfterRenameUIDCallback[] = [];
  private beforeDeleteUIDCallbacks: NymphBeforeDeleteUIDCallback[] = [];
  private afterDeleteUIDCallbacks: NymphAfterDeleteUIDCallback[] = [];

  public setEntityClass(className: string, entityClass: EntityConstructor) {
    this.entityClasses[className] = entityClass;
  }

  public getEntityClass(className: string): EntityConstructor {
    if (className in this.entityClasses) {
      const EntityClass = this.entityClasses[className];
      EntityClass.nymph = this;
      return EntityClass;
    }
    throw new ClassNotAvailableError('Tried to use class: ' + className);
  }

  public constructor() {
    this.config = { ...defaults };
    this.driver = new PreInitializedDriver();
  }

  public clone() {
    const nymph = new Nymph();
    nymph.config = this.config;
    nymph.driver = this.driver;
    nymph.tilmeld = this.tilmeld;
    nymph.entityClasses = this.entityClasses;
    if (nymph.tilmeld) {
      nymph.tilmeld.nymph = nymph;
    }

    const events = [
      'connect',
      'disconnect',
      'query',
      'beforeGetEntity',
      'beforeGetEntities',
      'beforeSaveEntity',
      'afterSaveEntity',
      'beforeDeleteEntity',
      'afterDeleteEntity',
      'beforeDeleteEntityByID',
      'afterDeleteEntityByID',
      'beforeNewUID',
      'afterNewUID',
      'beforeSetUID',
      'afterSetUID',
      'beforeRenameUID',
      'afterRenameUID',
      'beforeDeleteUID',
      'afterDeleteUID',
    ];

    for (let event of events) {
      const prop = event + 'Callbacks';
      // @ts-ignore: The callback should be the right type here.
      const callbacks = this[prop];
      for (let callback of callbacks) {
        nymph.on(event as NymphEventType, callback);
      }
    }

    return nymph;
  }

  /**
   * Initialize Nymph.
   *
   * @param config The Nymph configuration.
   * @param driver The Nymph database driver.
   * @param tilmeld The Tilmeld user/group manager instance, if you want to use it.
   */
  public init(
    config: Partial<Config>,
    driver: NymphDriver,
    tilmeld?: TilmeldInterface
  ) {
    this.config = { ...defaults, ...config };
    this.driver = driver;
    if (typeof tilmeld !== 'undefined') {
      this.tilmeld = tilmeld;
    }
    this.driver.init(this);
    if (this.tilmeld) {
      this.tilmeld.init(this);
    }
  }

  /**
   * Connect to the database.
   *
   * @returns Whether the instance is connected to the database.
   */
  public async connect(): Promise<boolean> {
    const result = this.driver.connect();
    for (let callback of this.connectCallbacks) {
      if (callback) {
        callback(result);
      }
    }
    return await result;
  }

  /**
   * Disconnect from the database.
   *
   * @returns Whether the instance is connected to the database.
   */
  public async disconnect(): Promise<boolean> {
    const result = this.driver.disconnect();
    for (let callback of this.disconnectCallbacks) {
      if (callback) {
        callback(result);
      }
    }
    return await result;
  }

  /**
   * Run all the query callbacks on a query.
   */
  public async runQueryCallbacks(
    options: Options,
    selectors: FormattedSelector[]
  ) {
    for (let callback of this.queryCallbacks) {
      if (callback) {
        callback(options, selectors);
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
   * @returns True on success, false on failure.
   */
  public async startTransaction(name: string): Promise<Nymph> {
    return await this.driver.startTransaction(name);
  }

  /**
   * Commit the named transaction.
   *
   * @returns True on success, false on failure.
   */
  public async commit(name: string): Promise<boolean> {
    return await this.driver.commit(name);
  }

  /**
   * Rollback the named transaction.
   *
   * @returns True on success, false on failure.
   */
  public async rollback(name: string): Promise<boolean> {
    return await this.driver.rollback(name);
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
    for (let callback of this.beforeNewUIDCallbacks) {
      if (callback) {
        callback(name);
      }
    }
    const result = this.driver.newUID(name);
    for (let callback of this.afterNewUIDCallbacks) {
      if (callback) {
        callback(result);
      }
    }
    return await result;
  }

  /**
   * Get the current value of a unique ID.
   * @param name The UID's name.
   * @returns The UID's value, or null on failure and if it doesn't exist.
   */
  public async getUID(name: string): Promise<number | null> {
    return await this.driver.getUID(name);
  }

  /**
   * Set the value of a UID.
   *
   * @param name The UID's name.
   * @param value The value.
   * @returns True on success, false on failure.
   */
  public async setUID(name: string, value: number): Promise<boolean> {
    for (let callback of this.beforeSetUIDCallbacks) {
      if (callback) {
        callback(name, value);
      }
    }
    const result = this.driver.setUID(name, value);
    for (let callback of this.afterSetUIDCallbacks) {
      if (callback) {
        callback(result);
      }
    }
    return await result;
  }

  /**
   * Delete a unique ID.
   *
   * @param name The UID's name.
   * @returns True on success, false on failure.
   */
  public async deleteUID(name: string): Promise<boolean> {
    for (let callback of this.beforeDeleteUIDCallbacks) {
      if (callback) {
        callback(name);
      }
    }
    const result = this.driver.deleteUID(name);
    for (let callback of this.afterDeleteUIDCallbacks) {
      if (callback) {
        callback(result);
      }
    }
    return await result;
  }

  /**
   * Rename a unique ID.
   *
   * @param oldName The old name.
   * @param newName The new name.
   * @returns True on success, false on failure.
   */
  public async renameUID(oldName: string, newName: string): Promise<boolean> {
    for (let callback of this.beforeRenameUIDCallbacks) {
      if (callback) {
        callback(oldName, newName);
      }
    }
    const result = this.driver.renameUID(oldName, newName);
    for (let callback of this.afterRenameUIDCallbacks) {
      if (callback) {
        callback(result);
      }
    }
    return await result;
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
    for (let callback of this.beforeSaveEntityCallbacks) {
      if (callback) {
        callback(entity);
      }
    }
    const result = this.driver.saveEntity(entity);
    for (let callback of this.afterSaveEntityCallbacks) {
      if (callback) {
        callback(result);
      }
    }
    return await result;
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
   * - sort - How to sort the entities. Accepts "cdate" or "mdate". Defaults to
   *   "cdate".
   * - return - What to return. "entity" or "guid". Defaults to "entity".
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
   * [
   *   '&',
   *   'gte' => ['cdate', null, '-1 day']
   * ]
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
   * @returns An array of entities.
   * @todo An option to place a total count in a var.
   * @todo Use an asterisk to specify any variable.
   */
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string[]>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options?: Options<T>,
    ...selectors: Selector[]
  ): Promise<ReturnType<T['factorySync']>[]>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> = {},
    ...selectors: Selector[]
  ): Promise<ReturnType<T['factorySync']>[] | string[]> {
    for (let callback of this.beforeGetEntitiesCallbacks) {
      if (callback) {
        callback(options, selectors);
      }
    }
    return await this.driver.getEntities(options, ...selectors);
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
   * @returns An entity, or null on failure or nothing found.
   */
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    ...selectors: Selector[]
  ): Promise<ReturnType<T['factorySync']> | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    guid: string
  ): Promise<string | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    guid: string
  ): Promise<ReturnType<T['factorySync']> | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> = {},
    ...selectors: Selector[] | string[]
  ): Promise<ReturnType<T['factorySync']> | string | null> {
    // Set up options and selectors.
    if (typeof selectors[0] === 'string') {
      selectors = [{ type: '&', guid: selectors[0] }];
    }
    options.limit = 1;
    for (let callback of this.beforeGetEntityCallbacks) {
      if (callback) {
        callback(options, selectors as Selector[]);
      }
    }
    const entities = await this.driver.getEntities(
      options,
      ...(selectors as Selector[])
    );
    if (!entities || !entities.length) {
      return null;
    }
    return entities[0];
  }

  /**
   * Delete an entity from the database.
   *
   * @param entity The entity.
   * @returns True on success, false on failure.
   */
  public async deleteEntity(entity: EntityInterface): Promise<boolean> {
    for (let callback of this.beforeDeleteEntityCallbacks) {
      if (callback) {
        callback(entity);
      }
    }
    const result = this.driver.deleteEntity(entity);
    for (let callback of this.afterDeleteEntityCallbacks) {
      if (callback) {
        callback(result);
      }
    }
    return await result;
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
    className?: string
  ): Promise<boolean> {
    for (let callback of this.beforeDeleteEntityByIDCallbacks) {
      if (callback) {
        callback(guid, className);
      }
    }
    const result = this.driver.deleteEntityByID(guid, className);
    for (let callback of this.afterDeleteEntityByIDCallbacks) {
      if (callback) {
        callback(result);
      }
    }
    return await result;
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
   *     abilities=["system/all"]
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
    return await this.driver.export(filename);
  }

  /**
   * Export entities to the console.
   *
   * @returns True on success, false on failure.
   */
  public async exportPrint(): Promise<boolean> {
    return await this.driver.exportPrint();
  }

  /**
   * Import entities from a file.
   *
   * @param filename The file to import from.
   * @returns True on success, false on failure.
   */
  public async import(filename: string): Promise<boolean> {
    return await this.driver.import(filename);
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
      : T extends 'beforeDeleteEntity'
      ? NymphBeforeDeleteEntityCallback
      : T extends 'afterDeleteEntity'
      ? NymphAfterDeleteEntityCallback
      : T extends 'beforeDeleteEntityByID'
      ? NymphBeforeDeleteEntityByIDCallback
      : T extends 'afterDeleteEntityByID'
      ? NymphAfterDeleteEntityByIDCallback
      : T extends 'beforeNewUID'
      ? NymphBeforeNewUIDCallback
      : T extends 'afterNewUID'
      ? NymphAfterNewUIDCallback
      : T extends 'beforeSetUID'
      ? NymphBeforeSetUIDCallback
      : T extends 'afterSetUID'
      ? NymphAfterSetUIDCallback
      : T extends 'beforeRenameUID'
      ? NymphBeforeRenameUIDCallback
      : T extends 'afterRenameUID'
      ? NymphAfterRenameUIDCallback
      : T extends 'beforeDeleteUID'
      ? NymphBeforeDeleteUIDCallback
      : T extends 'afterDeleteUID'
      ? NymphAfterDeleteUIDCallback
      : never
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
      : T extends 'beforeDeleteEntity'
      ? 'beforeDeleteEntityCallbacks'
      : T extends 'afterDeleteEntity'
      ? 'afterDeleteEntityCallbacks'
      : T extends 'beforeDeleteEntityByID'
      ? 'beforeDeleteEntityByIDCallbacks'
      : T extends 'afterDeleteEntityByID'
      ? 'afterDeleteEntityByIDCallbacks'
      : T extends 'beforeNewUID'
      ? 'beforeNewUIDCallbacks'
      : T extends 'afterNewUID'
      ? 'afterNewUIDCallbacks'
      : T extends 'beforeSetUID'
      ? 'beforeSetUIDCallbacks'
      : T extends 'afterSetUID'
      ? 'afterSetUIDCallbacks'
      : T extends 'beforeRenameUID'
      ? 'beforeRenameUIDCallbacks'
      : T extends 'afterRenameUID'
      ? 'afterRenameUIDCallbacks'
      : T extends 'beforeDeleteUID'
      ? 'beforeDeleteUIDCallbacks'
      : T extends 'afterDeleteUID'
      ? 'afterDeleteUIDCallbacks'
      : never;
    if (!this.hasOwnProperty(prop)) {
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
      : T extends 'beforeDeleteEntity'
      ? NymphBeforeDeleteEntityCallback
      : T extends 'afterDeleteEntity'
      ? NymphAfterDeleteEntityCallback
      : T extends 'beforeDeleteEntityByID'
      ? NymphBeforeDeleteEntityByIDCallback
      : T extends 'afterDeleteEntityByID'
      ? NymphAfterDeleteEntityByIDCallback
      : T extends 'beforeNewUID'
      ? NymphBeforeNewUIDCallback
      : T extends 'afterNewUID'
      ? NymphAfterNewUIDCallback
      : T extends 'beforeSetUID'
      ? NymphBeforeSetUIDCallback
      : T extends 'afterSetUID'
      ? NymphAfterSetUIDCallback
      : T extends 'beforeRenameUID'
      ? NymphBeforeRenameUIDCallback
      : T extends 'afterRenameUID'
      ? NymphAfterRenameUIDCallback
      : T extends 'beforeDeleteUID'
      ? NymphBeforeDeleteUIDCallback
      : T extends 'afterDeleteUID'
      ? NymphAfterDeleteUIDCallback
      : never
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
      : T extends 'beforeDeleteEntity'
      ? 'beforeDeleteEntityCallbacks'
      : T extends 'afterDeleteEntity'
      ? 'afterDeleteEntityCallbacks'
      : T extends 'beforeDeleteEntityByID'
      ? 'beforeDeleteEntityByIDCallbacks'
      : T extends 'afterDeleteEntityByID'
      ? 'afterDeleteEntityByIDCallbacks'
      : T extends 'beforeNewUID'
      ? 'beforeNewUIDCallbacks'
      : T extends 'afterNewUID'
      ? 'afterNewUIDCallbacks'
      : T extends 'beforeSetUID'
      ? 'beforeSetUIDCallbacks'
      : T extends 'afterSetUID'
      ? 'afterSetUIDCallbacks'
      : T extends 'beforeRenameUID'
      ? 'beforeRenameUIDCallbacks'
      : T extends 'afterRenameUID'
      ? 'afterRenameUIDCallbacks'
      : T extends 'beforeDeleteUID'
      ? 'beforeDeleteUIDCallbacks'
      : T extends 'afterDeleteUID'
      ? 'afterDeleteUIDCallbacks'
      : never;
    if (!this.hasOwnProperty(prop)) {
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

export default new Nymph();
