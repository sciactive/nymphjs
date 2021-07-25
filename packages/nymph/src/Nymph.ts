import { Config, ConfigDefaults as defaults } from './conf';
import { NymphDriver } from './drivers';
import { EntityConstructor, EntityInterface } from './Entity.d';
import { Selector, Options } from './Nymph.d';

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
  public static config: Config;
  public static driver: NymphDriver;
  public static entityClasses: { [k: string]: EntityConstructor } = {};
  public static Tilmeld: any = undefined;

  public static setEntityClass(
    className: string,
    entityClass: EntityConstructor
  ) {
    this.entityClasses[className] = entityClass;
  }

  public static getEntityClass(className: string): EntityConstructor | null {
    if (className in this.entityClasses) {
      return this.entityClasses[className];
    }
    return null;
  }

  /**
   * Initialize Nymph.
   *
   * @param config The Nymph configuration.
   * @param driver The Nymph database driver.
   * @param Tilmeld The Tilmeld user/group manager, if you want to use it.
   */
  public static init(
    config: Partial<Config>,
    driver: NymphDriver,
    Tilmeld?: any
  ) {
    this.config = { ...defaults, ...config };
    if (this.driver && this.driver.connected) {
      this.driver.disconnect();
    }
    this.driver = driver;
    this.Tilmeld = Tilmeld;
  }

  /**
   * Connect to the database.
   *
   * @returns Whether the instance is connected to the database.
   */
  public static connect() {
    return this.driver.connect();
  }

  /**
   * Disconnect from the database.
   *
   * @returns Whether the instance is connected to the database.
   */
  public static disconnect(): boolean {
    return this.driver.disconnect();
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
  public static newUID(name: string): number | null {
    return this.driver.newUID(name);
  }

  /**
   * Get the current value of a unique ID.
   * @param name The UID's name.
   * @returns The UID's value, or null on failure and if it doesn't exist.
   */
  public static getUID(name: string): number | null {
    return this.driver.getUID(name);
  }

  /**
   * Set the value of a UID.
   *
   * @param name The UID's name.
   * @param value The value.
   * @returns True on success, false on failure.
   */
  public static setUID(name: string, value: number): boolean {
    return this.driver.setUID(name, value);
  }

  /**
   * Delete a unique ID.
   *
   * @param name The UID's name.
   * @returns True on success, false on failure.
   */
  public static deleteUID(name: string): boolean {
    return this.driver.deleteUID(name);
  }

  /**
   * Rename a unique ID.
   *
   * @param oldName The old name.
   * @param newName The new name.
   * @returns True on success, false on failure.
   */
  public static renameUID(oldName: string, newName: string): boolean {
    return this.driver.renameUID(oldName, newName);
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
  public static saveEntity(entity: EntityInterface): boolean {
    return this.driver.saveEntity(entity);
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
   * - sort - How to sort the entities. Accepts "guid", "cdate", and "mdate".
   *   Defaults to "cdate".
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
   * - array - An array with a name, then value. True if the named property is
   *   an array containing the value.
   * - contains - An array with a name, then value. True if the named property
   *   contains the value (its JSON string is found within the property's).
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
   *   the named property is the entity or an array containing the entity.
   * - qref - An array with a name, then a full query (including options). True
   *   if the named property is an entity that matches the query or an array
   *   containing an entity that matches the query.
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
   * @returns An array of entities, or null on failure.
   * @todo An option to place a total count in a var.
   * @todo Use an asterisk to specify any variable.
   */
  public static getEntities<T extends EntityConstructor = EntityConstructor>(
    options?: Options<T>,
    ...selectors: Selector[]
  ): InstanceType<T>[] | null {
    return this.driver.getEntities(options, ...selectors);
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
  public static getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> = {},
    ...selectors: Selector[] | [string]
  ): InstanceType<T> | null {
    return this.driver.getEntity(options, ...selectors);
  }

  /**
   * Delete an entity from the database.
   *
   * @param entity The entity.
   * @returns True on success, false on failure.
   */
  public static deleteEntity(entity: EntityInterface): boolean {
    return this.driver.deleteEntity(entity);
  }

  /**
   * Delete an entity from the database by its GUID.
   *
   * @param guid The entity's GUID.
   * @param className The entity's class name.
   * @returns True on success, false on failure.
   */
  public static deleteEntityByID(guid: string, className?: string): boolean {
    return this.driver.deleteEntityByID(guid, className);
  }

  /**
   * Export entities to a local file.
   *
   * This is the file format:
   *
   * ```
   * # Comments begin with #
   *    # And can have white space before them.
   * # This defines a UID.
   * <name/of/uid>[5]
   * <another uid>[8000]
   * # For UIDs, the name is in angle brackets (<>) and the value follows
   * # in square brackets ([]).
   * # This starts a new entity.
   * {1234abcd}<entity_etype>[tag,list,with,commas]
   * # For entities, the GUID is in curly brackets ({}), then the etype in
   * #  angle brackets, then the comma separated tag list follows in square
   * #  brackets ([]).
   * # Properties are stored like this:
   * # propname=JSON.stringify(value)
   *     abilities="[\"system/all\"]"
   *     groups="[]"
   *     inheritAbilities="false"
   *     name="\"admin\""
   * # White space before/after "=" and at beginning/end of line is ignored.
   *         username  =     "\"admin\""
   * {2}<entity_etype>[tag,list]
   *     another="\"This is another entity.\""
   *     newline="\"\\n\""
   * ```
   *
   * @param filename The file to export to.
   * @returns True on success, false on failure.
   */
  public static export(filename: string): boolean {
    return this.driver.export(filename);
  }

  /**
   * Export entities to the console.
   *
   * @returns True on success, false on failure.
   */
  public static exportPrint(): boolean {
    return this.driver.exportPrint();
  }

  /**
   * Import entities from a file.
   *
   * @param filename The file to import from.
   * @returns True on success, false on failure.
   */
  public static import(filename: string): boolean {
    return this.driver.import(filename);
  }

  /**
   * Sort an array of entities hierarchically by a specified property's value.
   *
   * Entities will be placed immediately after their parents. The
   * `parentProperty` property must hold either null, or the entity's parent.
   *
   * @param array The array of entities.
   * @param property The name of the property to sort entities by.
   * @param parentProperty The name of the property which holds the parent of the entity.
   * @param caseSensitive Sort case sensitively.
   * @param reverse Reverse the sort order.
   */
  public static hsort(
    array: EntityInterface[],
    property: string,
    parentProperty: string,
    caseSensitive?: boolean,
    reverse?: boolean
  ): void {
    return this.driver.hsort(
      array,
      property,
      parentProperty,
      caseSensitive,
      reverse
    );
  }

  /**
   * Sort an array of entities by parent and a specified property's value.
   *
   * Entities' will be sorted by their parents' properties, then the entities'
   * properties.
   *
   * @param array The array of entities.
   * @param property The name of the property to sort entities by.
   * @param parentProperty The name of the property which holds the parent of the entity.
   * @param caseSensitive Sort case sensitively.
   * @param reverse Reverse the sort order.
   */
  public static psort(
    array: EntityInterface[],
    property: string,
    parentProperty: string,
    caseSensitive?: boolean,
    reverse?: boolean
  ): void {
    return this.driver.psort(
      array,
      property,
      parentProperty,
      caseSensitive,
      reverse
    );
  }

  /**
   * Sort an array of entities by a specified property's value.
   *
   * @param array The array of entities.
   * @param property The name of the property to sort entities by.
   * @param caseSensitive Sort case sensitively.
   * @param reverse Reverse the sort order.
   */
  public static sort(
    array: EntityInterface[],
    property: string,
    caseSensitive?: boolean,
    reverse?: boolean
  ): void {
    return this.driver.sort(array, property, caseSensitive, reverse);
  }
}
