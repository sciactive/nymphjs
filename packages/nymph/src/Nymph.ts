import { Config, ConfigDefaults as defaults } from './conf';
import { NymphDriver } from './drivers';
import Entity from './Entity';

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
  public static entityClasses: { [k: string]: typeof Entity } = {};
  public static Tilmeld: any = undefined;

  public static setEntityClass(className: string, entityClass: typeof Entity) {
    this.entityClasses[className] = entityClass;
  }

  public static getEntityClass(className: string): typeof Entity | null {
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
  public static saveEntity(entity: Entity): boolean {
    return this.driver.saveEntity(entity);
  }

  // TODO: docs
  public static getEntities(options?: any, ...selectors: any[]): Entity[] {
    return this.driver.getEntities(options, ...selectors);
  }

  // TODO: docs
  public static getEntity(options?: any, ...selectors: any[]): Entity | null {
    return this.driver.getEntity(options, ...selectors);
  }

  /**
   * Delete an entity from the database.
   *
   * @param entity The entity.
   * @returns True on success, false on failure.
   */
  public static deleteEntity(entity: Entity): boolean {
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
    array: Entity[],
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
    array: Entity[],
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
    array: Entity[],
    property: string,
    caseSensitive?: boolean,
    reverse?: boolean
  ): void {
    return this.driver.sort(array, property, caseSensitive, reverse);
  }
}
