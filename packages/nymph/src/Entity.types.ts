import type { Nymph } from './Nymph';
import type { Options } from './Nymph.types';

export type ACProperties = {
  user: any;
  group: any;
  acUser: any;
  acGroup: any;
  acOther: any;
  acRead: any;
  acWrite: any;
  acFull: any;
};

export type EntityReference = ['nymph_entity_reference', string, string];

export type EntityData = {
  [k: string]: any;
};

export type SerializedEntityData = {
  [k: string]: string;
};

export type EntityJson = {
  class: string;
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
   * The instance of Nymph to use for queries.
   */
  $nymph: Nymph;
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
   * Replace any referenced entities in the data with sleeping references.
   *
   * Calling this function ensures that the next time a referenced entity is
   * accessed, it will be retrieved from the DB (unless it is in Nymph's cache).
   */
  $clearCache(): void;
  /**
   * Get the client enabled methods.
   *
   * @returns The names of methods allowed to be called by the frontend with serverCall.
   */
  $getClientEnabledMethods(): string[];
  /**
   * Used to retrieve the data object.
   *
   * This should only be used by Nymph to save the data into storage.
   *
   * @param includeSData Whether to include the serialized data as well.
   * @returns The entity's data object.
   */
  $getData(includeSData?: boolean): EntityData;
  /**
   * Used to retrieve the serialized data object.
   *
   * This should only be used by Nymph to save the data object into storage.
   *
   * This method is used by Nymph to avoid unserializing data that hasn't been
   * requested yet.
   *
   * It should always be called after getData().
   *
   * @returns The entity's serialized data object.
   */
  $getSData(): SerializedEntityData;
  /**
   * Get the original values of the AC properties.
   *
   * @returns An object of AC properties.
   */
  $getOriginalAcValues(): ACProperties;
  /**
   * Get an object that holds the same data as the entity.
   *
   * This provides an object that can be validated.
   *
   * @returns A pure object representation of the entity.
   */
  $getValidatable(): Object;
  /**
   * Get the entity's tags.
   *
   * Using this instead of accessing the `tags` prop directly will wake sleeping
   * references.
   *
   * @returns The entity's tags.
   */
  $getTags(): string[];
  /**
   * Check that the entity has all of the given tags.
   *
   * @param tags List of tags.
   * @returns True or false.
   */
  $hasTag(...tags: string[]): boolean;
  /**
   * Accept JSON data from the client.
   *
   * This function uses the security protection lists:
   *
   * - $protectedTags
   * - $protectedData
   * - $allowlistTags
   * - $allowlistData
   *
   * @param input The input data. Please note, this will be modified (destroyed).
   * @param allowConflict Allow to accept data that is older than the current data.
   */
  $jsonAcceptData(input: EntityJson, allowConflict?: boolean): void;
  /**
   * Accept JSON patch from the client.
   *
   * This function uses the security protection lists:
   *
   * - $protectedTags
   * - $protectedData
   * - $allowlistTags
   * - $allowlistData
   *
   * @param patch The patch data. Please note, this will be modified (destroyed).
   * @param allowConflict Allow to accept data that is older than the current data.
   */
  $jsonAcceptPatch(patch: EntityPatch, allowConflict?: boolean): void;
  /**
   * Used to set the data.
   *
   * This should only be used by Nymph to push the data from storage.
   *
   * `sdata` is used by Nymph to avoid unserializing data that hasn't been
   * requested yet.
   *
   * @param data The data object.
   * @param sdata The serialized data object.
   */
  $putData(data: EntityData, sdata?: SerializedEntityData): void;
  /**
   * Remove one or more tags.
   *
   * @param tags List of tags.
   */
  $removeTag(...tags: string[]): void;
  /**
   * Return a Nymph Entity Reference for this entity.
   *
   * If the entity hasn't been saved yet (and has no GUID), it will be
   * returned instead.
   *
   * @returns A Nymph Entity Reference array as an unsaved entity.
   */
  $toReference(): EntityReference | EntityInterface;
  /**
   * Set whether to use "skipAc" when accessing entity references.
   *
   * @param useSkipAc True or false, whether to use it.
   */
  $useSkipAc(useSkipAc: boolean): void;
}

export type EntityConstructor = (new (guid?: string) => EntityInterface) & {
  /**
   * The instance of Nymph to use for queries.
   */
  nymph: Nymph;
  /**
   * A unique name for this type of entity used to separate its data from other
   * types of entities in the database.
   */
  ETYPE: string;
  /**
   * The lookup name for this entity.
   *
   * This is used for reference arrays (and sleeping references) and client
   * requests.
   */
  class: string;
  /**
   * Properties that will not be searchable from the frontend. If the frontend
   * includes any of these properties in any of their clauses, they will be
   * filtered out before the search is executed.
   */
  searchRestrictedData: string[];
  /**
   * The names of static methods allowed to be called by the frontend with
   * serverCallStatic.
   */
  clientEnabledStaticMethods: string[];
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
   * Sleeping references won't retrieve their data from the database until it
   * is actually used.
   *
   * @param reference The Nymph Entity Reference to use to wake.
   * @returns The new instance.
   */
  factoryReference(reference: EntityReference): EntityInterface;
  /**
   * Alter the options for a query for this entity.
   *
   * @param options The current options.
   * @returns The altered options.
   */
  alterOptions?<T extends Options>(options: T): T;
};
