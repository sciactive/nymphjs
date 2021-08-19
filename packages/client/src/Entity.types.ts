export type ServerCallResponse = {
  return: any;
  entity?: EntityJson;
};

export type ServerCallStaticResponse = any;

export type EntityReference = ['nymph_entity_reference', string, string];

export type EntityData = {
  [k: string]: any;
};

export type SerializedEntityData = {
  [k: string]: string;
};

export type EntityJson<T extends EntityConstructor = EntityConstructor> = {
  class: T['class'];
  guid: string | null;
  cdate: number | null;
  mdate: number | null;
  tags: string[];
  data: EntityData;
};

export type EntityPatch = {
  class: string;
  guid: string;
  mdate: number | null;
  set: EntityData;
  unset: string[];
  addTags: string[];
  removeTags: string[];
};

/**
 * Data Object interface.
 *
 * Objects which hold data from some type of storage.
 */
export interface DataObjectInterface {
  /**
   * Search the array for this object and return the corresponding index.
   *
   * If `strict` is false, `is()` is used to compare. If `strict` is true,
   * `equals()` is used.
   *
   * @param array The array to search.
   * @param strict Whether to use stronger comparison.
   * @returns The index if the object is in the array, -1 if it isn't.
   */
  $arraySearch(array: any[], strict?: boolean): number;
  /**
   * Delete the object from storage.
   *
   * @returns True on success, false on failure.
   */
  $delete(): Promise<boolean>;
  /**
   * Perform a more strict comparison of this object to another.
   *
   * @param object The object to compare.
   * @returns True or false.
   */
  $equals(object: any): boolean;
  /**
   * Check whether this object is in an array.
   *
   * If `strict` is false, `is()` is used to compare. If `strict` is true,
   * `equals()` is used.
   *
   * @param array The array to search.
   * @param strict Whether to use stronger comparison.
   * @returns True if the object is in the array, false if it isn't.
   */
  $inArray(array: any[], strict?: boolean): boolean;
  /**
   * Perform a less strict comparison of this object to another.
   *
   * @param object The object to compare.
   * @returns True or false.
   */
  $is(object: any): boolean;
  /**
   * Save the object's dirty data to storage.
   *
   * @returns True on success, false on failure.
   */
  $patch(): Promise<boolean>;
  /**
   * Refresh the object from storage. (Bypasses Nymph's cache.)
   *
   * If the object has been deleted from storage, the database cannot be
   * reached, or a database error occurs, `refresh()` will return 0.
   *
   * @returns False if the data has not been saved, 0 if it can't be refreshed, true on success.
   */
  $refresh(): Promise<boolean | 0>;
  /**
   * Save the object to storage.
   *
   * @returns True on success, false on failure.
   */
  $save(): Promise<boolean>;
  /**
   * The object's data.
   */
  [k: string]: any;
}

/**
 * Entity interface.
 */
export interface EntityInterface extends DataObjectInterface {
  /**
   * The entity's Globally Unique ID.
   *
   * This is a 12 byte number represented as a lower case HEX string (24
   * characters).
   */
  guid: string | null;
  /**
   * The creation date of the entity as a Unix timestamp in milliseconds.
   */
  cdate: number | null;
  /**
   * The modified date of the entity as a Unix timestamp in milliseconds.
   */
  mdate: number | null;
  /**
   * Array of the entity's tags.
   */
  tags: string[];
  /**
   * Add one or more tags.
   *
   * @param tags List of tags.
   */
  $addTag(...tags: string[]): void;
  /**
   * Get a patch of this entity's dirty data to be applied on the server.
   */
  $getPatch(): EntityPatch;
  /**
   * Check that the entity has all of the given tags.
   *
   * @param tags List of tags.
   * @returns True or false.
   */
  $hasTag(...tags: string[]): boolean;
  /**
   * Initialize this entity from a JSON representation.
   *
   * @param entityJson The entity JSON.
   */
  $init(entityJson: EntityJson | null): EntityInterface;
  /**
   * Retrieve this entity's data from the server.
   *
   * @returns The entity.
   */
  $ready(): Promise<EntityInterface>;
  /**
   * Ready this entity's data, and the data of entity's within this one's.
   *
   * @param level The number of levels deep to ready. If undefined, it will keep going until there are no more entities. (Careful of infinite loops.)
   * @returns The entity.
   */
  $readyAll(level?: number): Promise<EntityInterface>;
  /**
   * Remove one or more tags.
   *
   * @param tags List of tags.
   */
  $removeTag(...tags: string[]): void;
  /**
   * Call an instance method on the server version of this entity.
   *
   * The entity's data will be sent up to the server as well, so the server's
   * state can match the client's state. It won't be propagated into the DB,
   * though.
   *
   * @param method The name of the method.
   * @param params The parameters to call the method with.
   * @param stateless Whether the server should return, and the client update, the data in the entity after the method has run.
   * @returns The value that the method on the server returned.
   */
  $serverCall(
    method: string,
    params: Iterable<any>,
    stateless: boolean
  ): Promise<any>;
  /**
   * Return a Nymph Entity Reference for this entity.
   *
   * If the entity hasn't been saved yet (and has no GUID), it will be
   * returned instead.
   *
   * @returns A Nymph Entity Reference array as an unsaved entity.
   */
  $toReference(): EntityReference | EntityInterface;
}

export type EntityConstructor = (new () => EntityInterface) & {
  /**
   * The lookup name for this entity.
   *
   * This is used for reference arrays (and sleeping references) and client
   * requests.
   */
  class: string;
  /**
   * Create a new entity instance.
   *
   * @param guid An optional GUID to retrieve.
   */
  factory(guid?: string): Promise<EntityInterface>;
  /**
   * Create a new entity instance.
   *
   * @param guid An optional GUID to retrieve.
   */
  factorySync(guid?: string): EntityInterface;
  /**
   * Create a new sleeping reference instance.
   *
   * Sleeping references won't retrieve their data from the server until they
   * are readied with `ready()` or a parent's `readyAll()`.
   *
   * @param reference The Nymph Entity Reference to use to wake.
   * @returns The new instance.
   */
  factoryReference(reference: EntityReference): EntityInterface;
  /**
   * Call a static method on the server version of this entity.
   *
   * @param method The name of the method.
   * @param params The parameters to call the method with.
   * @returns The value that the method on the server returned.
   */
  serverCallStatic(method: string, params: Iterable<any>): Promise<any>;
};
