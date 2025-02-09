import type Nymph from './Nymph.js';
import type Entity from './Entity.js';

export type ACProperties = {
  user: string | null;
  group: string | null;
  acUser: number | null;
  acGroup: number | null;
  acOther: number | null;
  acRead: (string | null)[] | null;
  acWrite: (string | null)[] | null;
  acFull: (string | null)[] | null;
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
   * Get a GUID for the entity.
   *
   * If the entity has already been saved, this will just return the GUID.
   *
   * If the entity has not yet been saved, this will return a new GUID that gets
   * held by the entity. The `guid` property will remain null, but this method
   * will then always return the same GUID. When the entity is eventually saved
   * into the database, this GUID will be used.
   */
  $getGuaranteedGUID(): string;
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
   * @param referenceOnlyExisting Whether to only turn existing entities into references.
   * @returns The entity's data object.
   */
  $getData(includeSData?: boolean, referenceOnlyExisting?: boolean): EntityData;
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
   * Get an array of strings that **must** be unique across the current etype.
   *
   * When you try to save another entity with any of the same unique strings,
   * Nymph will throw an error.
   *
   * The default implementation of this method returns an empty array, meaning
   * there are no uniqueness constraints applied to its etype.
   *
   * @returns Resolves to an array of entity's unique constraint strings.
   */
  $getUniques(): Promise<string[]>;
  /**
   * Get the original values of the AC properties.
   *
   * @returns An object of AC properties.
   */
  $getOriginalAcValues(): ACProperties;
  /**
   * Get the current values of the AC properties.
   *
   * @returns An object of AC properties.
   */
  $getCurrentAcValues(): ACProperties;
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
   * This should only be used by Nymph to push the data from storage or the
   * client.
   *
   * `sdata` is used by Nymph to avoid unserializing data that hasn't been
   * requested yet.
   *
   * If `source` is set to "server", the data is coming from the DB or the
   * cache. If not, assume the data is coming from the client and can't be
   * trusted.
   *
   * @param data The data object.
   * @param sdata The serialized data object.
   * @param source If this is set to "server", the data is coming from the DB.
   */
  $putData(
    data: EntityData,
    sdata?: SerializedEntityData,
    source?: 'server',
  ): void;
  /**
   * Remove one or more tags.
   *
   * @param tags List of tags.
   */
  $removeTag(...tags: string[]): void;
  /**
   * Return a Nymph Entity Reference for this entity.
   *
   * If the entity hasn't been saved yet (and has no GUID), it will use the
   * guaranteed GUID from `$getGuaranteedGUID`, unless `existingOnly` is true,
   * then it will return the entity.
   *
   * @param existingOnly Whether to only turn existing entities into references.
   * @returns A Nymph Entity Reference array.
   */
  $toReference(existingOnly?: boolean): EntityReference | EntityInterface;
  /**
   * Set whether to use "skipAc" when accessing entity references.
   *
   * @param useSkipAc True or false, whether to use it.
   */
  $useSkipAc(useSkipAc: boolean): void;
}

export type EntityConstructor<
  D extends EntityData = EntityData,
  E extends Entity<D> = Entity<D>,
> = (new (...args: any[]) => E) & {
  [k in keyof typeof Entity]: (typeof Entity)[k];
};
