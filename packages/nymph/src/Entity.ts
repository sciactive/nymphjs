import { difference, intersection, isEqual } from 'lodash-es';

import type Nymph from './Nymph.js';
import type { Options } from './Nymph.types.js';
import type {
  ACProperties,
  EntityConstructor,
  EntityData,
  EntityInterface,
  EntityJson,
  EntityPatch,
  EntityReference,
  SerializedEntityData,
} from './Entity.types.js';
import {
  EntityConflictError,
  EntityIsSleepingReferenceError,
  InvalidParametersError,
  InvalidStateError,
} from './errors/index.js';
import {
  entitiesToReferences,
  referencesToEntities,
  uniqueStrings,
} from './utils.js';

export type EntityDataType<T> =
  T extends Entity<infer DataType> ? DataType : never;

export type EntityInstanceType<T extends EntityConstructor> =
  T extends new () => infer E ? E & EntityDataType<E> : never;

/**
 * Database abstraction object.
 *
 * Provides a way to access, manipulate, and store data in Nymph.
 *
 * The GUID is not set until the entity is saved. GUIDs must be unique forever,
 * even after deletion. It's the job of the Nymph DB driver to make sure no two
 * entities ever have the same GUID. This is generally done by using a large
 * randomly generated ID.
 *
 * Each entity class has an etype that determines which table(s) in the database
 * it belongs to. If two entity classes have the same etype, their data will be
 * stored in the same table(s). This isn't a good idea, however, because
 * references to an entity store a class name, not an etype.
 *
 * Tags are used to classify entities. Where an etype is used to separate data
 * by tables, tags can be used to separate entities within a table. You can
 * define specific tags to be protected, meaning they cannot be added/removed
 * from the client. It can be useful to allow user defined tags, such as for
 * blog posts.
 *
 * Simply calling $delete() will not unset the entity. It will still take up
 * memory. Likewise, simply calling unset will not delete the entity from the
 * DB.
 *
 * Some notes about $equals() and $is(), the replacements for "==":
 *
 * The == operator will likely not give you the result you want, since two
 * instances of the same entity will fail that check, even though they represent
 * the same data in the database.
 *
 * $equals() performs a more strict comparison of the entity to another. Use
 * $equals() instead of the == operator when you want to check both the entities
 * they represent, and the data inside them. In order to return true for
 * $equals(), the entity and object must meet the following criteria:
 *
 * - They must be entities.
 * - They must have equal GUIDs, or both must have no GUID.
 * - Their data and tags must be equal.
 *
 * $is() performs a less strict comparison of the entity to another. Use $is()
 * instead of the == operator when the entity's data may have been changed, but
 * you only care if they represent the same entity. In order to return true, the
 * entity and object must meet the following criteria:
 *
 * - They must be entities.
 * - They must have equal GUIDs, or both must have no GUID.
 * - If they have no GUIDs, their data and tags must be equal.
 *
 * Some notes about saving entities in other entity's properties:
 *
 * Entities use references in the DB to store an entity in their properties. The
 * reference is stored as an array with the values:
 *
 * - 0 => The string 'nymph_entity_reference'
 * - 1 => The referenced entity's GUID.
 * - 2 => The referenced entity's class name.
 *
 * Since the referenced entity's class name (meaning the `class` static
 * property, not the name of the class itself) is stored in the reference on the
 * parent entity, if you change the class name in an update, you need to
 * reassign all referenced entities of that class and resave.
 *
 * When an entity is loaded, it does not request its referenced entities from
 * Nymph. Instead, it creates instances without data called sleeping references.
 * When you first access an entity's data, if it is a sleeping reference, it
 * will fill its data from the DB. You can call clearCache() to turn all the
 * entities back into sleeping references.
 */
export default class Entity<T extends EntityData = EntityData>
  implements EntityInterface
{
  /**
   * The instance of Nymph to use for queries.
   */
  public static nymph = {} as Nymph;
  /**
   * A unique name for this type of entity used to separate its data from other
   * types of entities in the database.
   */
  public static ETYPE = 'entity';
  /**
   * The lookup name for this entity.
   *
   * This is used for reference arrays (and sleeping references) and client
   * requests.
   */
  public static class = 'Entity';

  public $nymph: Nymph;
  public guid: string | null = null;
  public cdate: number | null = null;
  public mdate: number | null = null;
  public tags: string[] = [];
  /**
   * The data proxy handler.
   */
  protected $dataHandler: Object;
  /**
   * The actual data store.
   */
  protected $dataStore: T;
  /**
   * The actual sdata store.
   */
  protected $sdata: SerializedEntityData;
  /**
   * The data proxy object.
   */
  protected $data: T;
  /**
   * Whether this instance is a sleeping reference.
   */
  protected $isASleepingReference = false;
  /**
   * The reference to use to wake.
   */
  protected $sleepingReference: EntityReference | null = null;
  /**
   * A promise that resolved when the entity's data is wake.
   */
  protected $wakePromise: Promise<Entity<T>> | null = null;
  /**
   * Properties that will not be serialized into JSON with toJSON(). This
   * can be considered a denylist, because these properties will not be set
   * with incoming JSON.
   *
   * Clients CAN still determine what is in these properties, unless they are
   * also listed in searchRestrictedData.
   */
  protected $privateData: string[] = [];
  /**
   * Whether this entity should publish changes to PubSub servers.
   */
  public static pubSubEnabled = true;
  /**
   * Whether this entity should be accessible on the frontend through the REST
   * server.
   *
   * If this is false, any request from the client that attempts to use this
   * entity will fail.
   */
  public static restEnabled = true;
  /**
   * Properties that will not be searchable from the frontend. If the frontend
   * includes any of these properties in any of their clauses, they will be
   * filtered out before the search is executed.
   */
  public static searchRestrictedData: string[] = [];
  /**
   * Properties that can only be modified by server side code. They will still
   * be visible on the frontend, unlike $privateData, but any changes to them
   * that come from the frontend will be ignored.
   *
   * In addition to what's listed here, all of the access control properties
   * will be included when Tilmeld is being used. These are:
   *
   * - acUser
   * - acGroup
   * - acOther
   * - acRead
   * - acWrite
   * - acFull
   * - user
   * - group
   *
   * You should modify these through client enabled methods or the $save method
   * instead, for safety.
   */
  protected $protectedData: string[] = [];
  /**
   * If this is defined, then it lists the only properties that will be
   * accepted from incoming JSON. Any other properties will be ignored.
   *
   * If you use an allowlist, you don't need to use protectedData, since you
   * can simply leave those entries out of allowlistData.
   */
  protected $allowlistData?: string[];
  /**
   * Tags that can only be added/removed by server side code. They will still be
   * visible on the frontend, but any changes to them that come from the
   * frontend will be ignored.
   */
  protected $protectedTags: string[] = [];
  /**
   * If this is defined, then it lists the only tags that will be accepted from
   * incoming JSON. Any other tags will be ignored.
   */
  protected $allowlistTags?: string[];
  /**
   * The names of methods allowed to be called by the frontend with serverCall.
   */
  protected $clientEnabledMethods: string[] = [];
  /**
   * The names of static methods allowed to be called by the frontend with
   * serverCallStatic.
   */
  public static clientEnabledStaticMethods: string[] = [];
  /**
   * Whether to use "skipAc" when accessing entity references.
   */
  private $skipAc: boolean = false;
  /**
   * The AC properties' values when the entity was loaded.
   */
  private $originalAcValues: ACProperties | null = null;

  /**
   * Alter the options for a query for this entity.
   *
   * @param options The current options.
   * @returns The altered options.
   */
  static alterOptions?<T extends Options>(options: T): T;

  /**
   * Initialize an entity.
   */
  public constructor(..._rest: any[]) {
    this.$nymph = (this.constructor as EntityConstructor).nymph;
    this.$dataHandler = {
      has: (data: EntityData, name: string) => {
        this.$check();

        return name in data || name in this.$sdata;
      },

      get: (data: EntityData, name: string) => {
        this.$check();

        if (this.$sdata.hasOwnProperty(name)) {
          data[name] = referencesToEntities(
            JSON.parse(this.$sdata[name]),
            this.$nymph,
            this.$skipAc,
          );
          delete this.$sdata[name];
        }
        if (data.hasOwnProperty(name)) {
          return data[name];
        }
        return undefined;
      },

      set: (data: EntityData, name: string, value: any) => {
        this.$check();

        if (this.$sdata.hasOwnProperty(name)) {
          delete this.$sdata[name];
        }
        data[name] = value;
        return true;
      },

      deleteProperty: (data: EntityData, name: string) => {
        this.$check();

        if (this.$sdata.hasOwnProperty(name)) {
          return delete this.$sdata[name];
        }
        if (data.hasOwnProperty(name)) {
          return delete data[name];
        }
        return true;
      },

      defineProperty: (
        data: EntityData,
        name: string,
        descriptor: PropertyDescriptor,
      ) => {
        this.$check();

        if (this.$sdata.hasOwnProperty(name)) {
          delete this.$sdata[name];
        }
        Object.defineProperty(data, name, descriptor);
        return true;
      },

      getOwnPropertyDescriptor: (data: EntityData, name: string) => {
        this.$check();

        if (this.$sdata.hasOwnProperty(name)) {
          data[name] = referencesToEntities(
            JSON.parse(this.$sdata[name]),
            this.$nymph,
            this.$skipAc,
          );
          delete this.$sdata[name];
        }
        return Object.getOwnPropertyDescriptor(data, name);
      },

      ownKeys: (data: EntityData) => {
        this.$check();

        return Object.getOwnPropertyNames(data).concat(
          Object.getOwnPropertyNames(this.$sdata),
        );
      },
    };
    this.$dataStore = {} as T;
    this.$sdata = {};

    this.$data = new Proxy(this.$dataStore, this.$dataHandler);

    return new Proxy(this, {
      has: (entity: Entity, name: string) => {
        if (
          typeof name !== 'string' ||
          name in entity ||
          name.substring(0, 1) === '$'
        ) {
          return name in entity;
        }

        this.$check();
        return name in entity.$data;
      },

      get: (entity: Entity, name: string) => {
        if (
          typeof name !== 'string' ||
          name in entity ||
          name.substring(0, 1) === '$'
        ) {
          if (name === 'tags' || name === 'cdate' || name === 'mdate') {
            this.$check();
          }
          return (entity as any)[name];
        }

        this.$check();
        if (name in entity.$data) {
          return entity.$data[name];
        }
        return undefined;
      },

      set: (entity: Entity, name: string, value: any) => {
        if (
          typeof name !== 'string' ||
          name in entity ||
          name.substring(0, 1) === '$'
        ) {
          if (name === 'tags' || name === 'cdate' || name === 'mdate') {
            this.$check();
          }
          (entity as any)[name] = value;
        } else {
          this.$check();
          (entity.$data as any)[name] = value;
        }
        return true;
      },

      deleteProperty: (entity: Entity, name: string) => {
        if (name in entity) {
          return delete (entity as any)[name];
        } else if (name in entity.$data) {
          this.$check();
          return delete entity.$data[name];
        }
        return true;
      },

      getPrototypeOf: (entity: Entity) => {
        return entity.constructor.prototype;
      },

      defineProperty: (
        entity: Entity,
        name: string,
        descriptor: PropertyDescriptor,
      ) => {
        if (
          typeof name !== 'string' ||
          name in entity ||
          name.substring(0, 1) === '$'
        ) {
          if (name === 'tags' || name === 'cdate' || name === 'mdate') {
            this.$check();
          }
          Object.defineProperty(entity, name, descriptor);
        } else {
          this.$check();
          Object.defineProperty(entity.$data, name, descriptor);
        }
        return true;
      },

      getOwnPropertyDescriptor: (entity: Entity, name: string) => {
        if (
          typeof name !== 'string' ||
          name in entity ||
          name.substring(0, 1) === '$'
        ) {
          if (name === 'tags' || name === 'cdate' || name === 'mdate') {
            this.$check();
          }
          return Object.getOwnPropertyDescriptor(entity, name);
        } else {
          this.$check();
          return Object.getOwnPropertyDescriptor(entity.$data, name);
        }
      },

      ownKeys: (entity: Entity) => {
        this.$check();
        return Object.getOwnPropertyNames(entity).concat(
          Object.getOwnPropertyNames(entity.$data),
        );
      },
    }) as Entity<T>;
  }

  /**
   * Create or retrieve a new entity instance.
   *
   * Note that this will always return an entity, even if the GUID is not found.
   *
   * @param guid An optional GUID to retrieve.
   */
  public static async factory<E extends Entity>(
    this: {
      new (): E;
    },
    guid?: string,
  ): Promise<E & EntityDataType<E>> {
    const entity = new this();
    if (guid != null) {
      const entity = await (
        this as unknown as EntityConstructor
      ).nymph.getEntity(
        {
          class: this as unknown as EntityConstructor,
        },
        { type: '&', guid },
      );
      if (entity != null) {
        return entity as E & EntityDataType<E>;
      }
    }
    return entity as E & EntityDataType<E>;
  }

  /**
   * Create a new entity instance.
   */
  public static factorySync<E extends Entity>(this: {
    new (): E;
  }): E & EntityDataType<E> {
    return new this() as E & EntityDataType<E>;
  }

  /**
   * Create a new sleeping reference instance.
   *
   * Sleeping references won't retrieve their data from the database until they
   * are readied with `$wake()` or a parent's `$wakeAll()`.
   *
   * @param reference The Nymph Entity Reference to use to wake.
   * @returns The new instance.
   */
  public static factoryReference<E extends Entity>(
    this: {
      new (): E;
    },
    reference: EntityReference,
  ): E & EntityDataType<E> {
    const entity = new this();
    entity.$referenceSleep(reference);
    return entity as E & EntityDataType<E>;
  }

  /**
   * Get an array of strings that **must** be unique across the current etype.
   *
   * When you try to save another entity with any of the same unique strings,
   * Nymph will throw an error.
   *
   * The default implementation of this static method instantiates the entity,
   * assigns all of the given data, then calls `$getUniques` and returns its
   * output. This can have a performance impact if a lot of extra processing
   * happens during any of these steps. You can override this method to
   * calculate the unique strings faster, but you must return the same strings
   * that would be returned by `$getUniques`.
   *
   * @returns Resolves to an array of entity's unique constraint strings.
   */
  public static async getUniques({
    guid,
    cdate,
    mdate,
    tags,
    data,
    sdata,
  }: {
    guid?: string;
    cdate?: number;
    mdate?: number;
    tags: string[];
    data: EntityData;
    sdata?: SerializedEntityData;
  }) {
    const entity = new this();
    if (guid != null) {
      entity.guid = guid;
    }
    if (cdate != null) {
      entity.cdate = cdate;
    }
    if (mdate != null) {
      entity.mdate = mdate;
    }
    entity.tags = tags;
    entity.$putData(data, sdata);
    return await entity.$getUniques();
  }

  public toJSON() {
    if (this.$isASleepingReference) {
      return this.$sleepingReference;
    }
    const obj: EntityJson = {
      class: (this.constructor as any).class as string,
      guid: this.guid,
      cdate: this.cdate,
      mdate: this.mdate,
      tags: [...this.tags],
      data: {},
    };
    const data = this.$getData(true);
    for (const key in data) {
      if (this.$privateData.indexOf(key) === -1) {
        obj.data[key] = entitiesToReferences(data[key]);
      }
    }
    return obj;
  }

  public $addTag(...tags: string[]) {
    this.$check();

    if (tags.length < 1) {
      return;
    }
    this.tags = uniqueStrings([...this.tags, ...tags]);
  }

  public $arraySearch(array: any[], strict = false) {
    this.$check();

    if (!Array.isArray(array)) {
      return -1;
    }
    for (let i = 0; i < array.length; i++) {
      const curEntity = array[i];
      if (strict ? this.$equals(curEntity) : this.$is(curEntity)) {
        return i;
      }
    }
    return -1;
  }

  public $clearCache() {
    this.$check();

    this.$putData(this.$getData(), this.$getSData());
  }

  public $getClientEnabledMethods() {
    return this.$clientEnabledMethods;
  }

  public async $delete(): Promise<boolean> {
    this.$check();

    return await this.$nymph.deleteEntity(this);
  }

  public $equals(object: any) {
    this.$check();

    if (!(object instanceof Entity)) {
      return false;
    }
    if (this.guid || object.guid) {
      if (this.guid !== object.guid) {
        return false;
      }
    }
    if (object.cdate !== this.cdate) {
      return false;
    }
    if (object.mdate !== this.mdate) {
      return false;
    }
    const obTags = [...object.tags].sort();
    const myTags = [...this.tags].sort();
    if (!isEqual(obTags, myTags)) {
      return false;
    }
    const obData = object.$getData(true);
    const myData = this.$getData(true);
    return isEqual(obData, myData);
  }

  public $getData(includeSData = false) {
    this.$check();

    if (includeSData) {
      // Access all the serialized properties to initialize them.
      for (const key in this.$sdata) {
        const _unused: any = (this as any)[key];
      }
    }
    return entitiesToReferences({ ...this.$dataStore });
  }

  public $getSData() {
    this.$check();

    return this.$sdata;
  }

  public async $getUniques(): Promise<string[]> {
    return [];
  }

  public $getOriginalAcValues(): ACProperties {
    this.$check();

    return this.$originalAcValues ?? this.$getCurrentAcValues();
  }

  public $getCurrentAcValues(): ACProperties {
    this.$check();

    return {
      user: this.$getAcUid(),
      group: this.$getAcGid(),
      acUser: this.$data.acUser ?? null,
      acGroup: this.$data.acGroup ?? null,
      acOther: this.$data.acOther ?? null,
      acRead: this.$getAcReadIds(),
      acWrite: this.$getAcWriteIds(),
      acFull: this.$getAcFullIds(),
    };
  }

  public $getAcUid() {
    if ('user' in this.$sdata) {
      const userValue = JSON.parse(this.$sdata.user);
      if (
        Array.isArray(userValue) &&
        userValue[0] === 'nymph_entity_reference'
      ) {
        return userValue[1];
      }
    }
    return (this.$data.user?.guid ?? null) as string | null;
  }
  public $getAcGid() {
    if ('group' in this.$sdata) {
      const groupValue = JSON.parse(this.$sdata.group);
      if (
        Array.isArray(groupValue) &&
        groupValue[0] === 'nymph_entity_reference'
      ) {
        return groupValue[1];
      }
    }
    return (this.$data.group?.guid ?? null) as string | null;
  }
  public $getAcReadIds() {
    return (this.$data.acRead?.map((entity: EntityInterface) => entity.guid) ??
      null) as (string | null)[] | null;
  }
  public $getAcWriteIds() {
    return (this.$data.acWrite?.map((entity: EntityInterface) => entity.guid) ??
      null) as (string | null)[] | null;
  }
  public $getAcFullIds() {
    return (this.$data.acFull?.map((entity: EntityInterface) => entity.guid) ??
      null) as (string | null)[] | null;
  }

  public $getValidatable() {
    this.$check();

    // Access all the serialized properties to initialize them.
    for (const key in this.$sdata) {
      const _unused: any = (this as any)[key];
    }
    return {
      guid: this.guid,
      cdate: this.cdate,
      mdate: this.mdate,
      tags: this.tags,
      ...referencesToEntities(this.$dataStore, this.$nymph, this.$skipAc),
    };
  }

  public $getTags() {
    this.$check();

    return this.tags;
  }

  public $hasTag(...tags: string[]) {
    this.$check();

    if (!tags.length) {
      return false;
    }
    for (const tag of tags) {
      if (this.tags.indexOf(tag) === -1) {
        return false;
      }
    }
    return true;
  }

  public $inArray(array: any[], strict = false) {
    return this.$arraySearch(array, strict) !== -1;
  }

  public $is(object: any) {
    if (!(object instanceof Entity)) {
      return false;
    }

    if (this.guid || object.guid) {
      return this.guid === object.guid;
    }

    this.$check();
    if (typeof object.$getData !== 'function') {
      return false;
    } else {
      const obTags = [...object.tags].sort();
      const myTags = [...this.tags].sort();
      if (!isEqual(obTags, myTags)) {
        return false;
      }
      const obData = object.$getData(true);
      const myData = this.$getData(true);
      return isEqual(obData, myData);
    }
  }

  public $jsonAcceptData(input: EntityJson, allowConflict = false) {
    this.$check();

    if (this.guid != input.guid) {
      throw new EntityConflictError(
        'Tried to accept JSON input for the wrong entity.',
      );
    }

    // Accept the modified date.
    const mdate = input.mdate ?? 0;
    const thismdate = this.mdate ?? 0;
    if (mdate < thismdate && !allowConflict) {
      throw new EntityConflictError('This entity is newer than JSON input.');
    }
    this.mdate = input.mdate;

    // Accept the tags.
    const currentTags = this.$getTags();
    const protectedTags = intersection(this.$protectedTags, currentTags);
    let tags = difference(input.tags, this.$protectedTags);

    if (this.$allowlistTags != null) {
      tags = intersection(tags, this.$allowlistTags);
    }

    this.$removeTag(...currentTags);
    this.$addTag(...protectedTags, ...tags);

    // Accept the data.
    const data = input.data;
    const privateData: EntityData = {};
    for (const name of this.$privateData) {
      if (name in this.$data) {
        privateData[name] = this.$data[name];
      }
      if (name in data) {
        delete data[name];
      }
    }

    const protectedData: EntityData = {};
    const protectedProps = [...this.$protectedData];
    if (this.$nymph.tilmeld) {
      protectedProps.push('acUser');
      protectedProps.push('acGroup');
      protectedProps.push('acOther');
      protectedProps.push('acRead');
      protectedProps.push('acWrite');
      protectedProps.push('acFull');
      if (
        ((this.constructor as EntityConstructor).class !== 'User' &&
          (this.constructor as EntityConstructor).class !== 'Group') ||
        !(this.$nymph.tilmeld as any).currentUser ||
        (!(this.$nymph.tilmeld as any).currentUser.abilities?.includes(
          'tilmeld/admin',
        ) &&
          !(this.$nymph.tilmeld as any).currentUser.abilities?.includes(
            'system/admin',
          ))
      ) {
        protectedProps.push('user');
        protectedProps.push('group');
      }
    }
    for (const name of protectedProps) {
      if (name in this.$data) {
        protectedData[name] = this.$data[name];
      }
      if (name in data) {
        delete data[name];
      }
    }

    let nonAllowlistData: EntityData = {};
    if (this.$allowlistData != null) {
      nonAllowlistData = { ...this.$getData(true) };
      for (const name of this.$allowlistData) {
        delete nonAllowlistData[name];
      }
      for (const name in data) {
        if (this.$allowlistData.indexOf(name) === -1) {
          delete data[name];
        }
      }
    }

    this.$putData({
      ...nonAllowlistData,
      ...data,
      ...protectedData,
      ...privateData,
    });
  }

  public $jsonAcceptPatch(patch: EntityPatch, allowConflict = false) {
    this.$check();

    if (this.guid != patch.guid) {
      throw new EntityConflictError(
        'Tried to accept JSON patch for the wrong entity.',
      );
    }

    // Accept the modified date.
    const mdate = patch.mdate ?? 0;
    const thismdate = this.mdate ?? 0;
    if (mdate < thismdate && !allowConflict) {
      throw new EntityConflictError('This entity is newer than JSON patch.');
    }
    this.mdate = patch.mdate;

    const protectedProps = [...this.$protectedData];
    if (this.$nymph.tilmeld) {
      protectedProps.push('acUser');
      protectedProps.push('acGroup');
      protectedProps.push('acOther');
      protectedProps.push('acRead');
      protectedProps.push('acWrite');
      protectedProps.push('acFull');
      if (
        ((this.constructor as EntityConstructor).class !== 'User' &&
          (this.constructor as EntityConstructor).class !== 'Group') ||
        !(this.$nymph.tilmeld as any).currentUser ||
        (!(this.$nymph.tilmeld as any).currentUser.abilities?.includes(
          'tilmeld/admin',
        ) &&
          !(this.$nymph.tilmeld as any).currentUser.abilities?.includes(
            'system/admin',
          ))
      ) {
        protectedProps.push('user');
        protectedProps.push('group');
      }
    }

    for (const name in patch.set) {
      if (
        (this.$allowlistData != null &&
          this.$allowlistData.indexOf(name) === -1) ||
        protectedProps.indexOf(name) !== -1 ||
        this.$privateData.indexOf(name) !== -1
      ) {
        continue;
      }
      (this.$data as any)[name] = referencesToEntities(
        patch.set[name],
        this.$nymph,
        this.$skipAc,
      );
    }

    for (const name of patch.unset) {
      if (
        (this.$allowlistData != null &&
          this.$allowlistData.indexOf(name) === -1) ||
        protectedProps.indexOf(name) !== -1 ||
        this.$privateData.indexOf(name) !== -1
      ) {
        continue;
      }
      delete this.$data[name];
    }

    for (const tag of patch.addTags) {
      if (
        (this.$allowlistTags != null &&
          this.$allowlistTags.indexOf(tag) === -1) ||
        this.$protectedTags.indexOf(tag) !== -1
      ) {
        continue;
      }
      this.$addTag(tag);
    }

    for (const tag of patch.removeTags) {
      if (
        (this.$allowlistTags != null &&
          this.$allowlistTags.indexOf(tag) === -1) ||
        this.$protectedTags.indexOf(tag) !== -1
      ) {
        continue;
      }
      this.$removeTag(tag);
    }
  }

  public $putData(data: EntityData, sdata?: SerializedEntityData) {
    this.$check();

    const mySdata = sdata ?? this.$getSData();
    for (const name in data) {
      delete mySdata[name];
    }
    for (const name in this.$dataStore) {
      delete this.$dataStore[name];
    }
    for (const name in data) {
      (this.$dataStore as any)[name] = referencesToEntities(
        data[name],
        this.$nymph,
        this.$skipAc,
      );
    }
    this.$sdata = mySdata;
    // Set original AC values if not set..
    if (this.$originalAcValues == null) {
      this.$originalAcValues = this.$getCurrentAcValues();
    }
  }

  /**
   * Set up a sleeping reference.
   * @param array $reference The reference to use to wake.
   */
  protected $referenceSleep(reference: EntityReference) {
    if (
      reference.length !== 3 ||
      reference[0] !== 'nymph_entity_reference' ||
      typeof reference[1] !== 'string' ||
      typeof reference[2] !== 'string'
    ) {
      throw new InvalidParametersError(
        'referenceSleep expects parameter 1 to be a valid Nymph entity ' +
          'reference.',
      );
    }
    const thisClass: string = (this.constructor as any).class;
    if (reference[2] !== thisClass) {
      throw new InvalidParametersError(
        'referenceSleep can only be called with an entity reference of the ' +
          `same class. Given class: ${reference[2]}; this class: ${thisClass}.`,
      );
    }
    this.$isASleepingReference = true;
    this.guid = reference[1];
    this.$sleepingReference = reference;
  }

  /**
   * Check if this is a sleeping reference and throw an error if so.
   */
  protected $check() {
    if (this.$isASleepingReference || this.$sleepingReference != null) {
      throw new EntityIsSleepingReferenceError(
        'This entity is in a sleeping reference state. You must use .$wake() to wake it.',
      );
    }
  }

  /**
   * Check if this is a sleeping reference.
   */
  public $asleep() {
    return this.$isASleepingReference || this.$sleepingReference != null;
  }

  /**
   * Wake from a sleeping reference.
   */
  public $wake() {
    if (!this.$isASleepingReference || this.$sleepingReference == null) {
      this.$wakePromise = null;
      return Promise.resolve(this);
    }
    if (this.$sleepingReference?.[1] == null) {
      throw new InvalidStateError(
        'Tried to wake a sleeping reference with no GUID.',
      );
    }
    if (!this.$wakePromise) {
      const EntityClass = this.$nymph.getEntityClass(
        this.$sleepingReference[2],
      );
      this.$wakePromise = this.$nymph
        .getEntity(
          {
            class: EntityClass,
            skipAc: this.$skipAc,
          },
          { type: '&', guid: this.$sleepingReference[1] },
        )
        .then((entity) => {
          if (entity == null || entity.guid == null) {
            return Promise.reject(
              new InvalidStateError(
                'The sleeping reference could not be retrieved.',
              ),
            );
          }
          this.$isASleepingReference = false;
          this.$sleepingReference = null;
          this.guid = entity.guid;
          this.tags = entity.tags;
          this.cdate = entity.cdate;
          this.mdate = entity.mdate;
          this.$putData(entity.$getData(), entity.$getSData());

          return this;
        })
        .finally(() => {
          this.$wakePromise = null;
        });
    }
    return this.$wakePromise;
  }

  public $wakeAll(level?: number) {
    return new Promise((resolve, reject) => {
      // Run this once this entity is wake.
      const wakeProps = () => {
        let newLevel;
        // If level is undefined, keep going forever, otherwise, stop once we've
        // gone deep enough.
        if (level !== undefined) {
          newLevel = level - 1;
        }
        if (newLevel !== undefined && newLevel < 0) {
          resolve(this);
          return;
        }
        const promises = [];
        // Go through data looking for entities to wake.
        for (let [key, value] of Object.entries(this.$data)) {
          if (value instanceof Entity && value.$isASleepingReference) {
            promises.push(value.$wakeAll(newLevel));
          } else if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
              if (
                value[i] instanceof Entity &&
                value[i].$isASleepingReference
              ) {
                promises.push(value[i].$wakeAll(newLevel));
              }
            }
          }
        }
        if (promises.length) {
          Promise.all(promises).then(
            () => resolve(this),
            (errObj) => reject(errObj),
          );
        } else {
          resolve(this);
        }
      };

      if (this.$isASleepingReference) {
        this.$wake().then(wakeProps, (errObj) => reject(errObj));
      } else {
        wakeProps();
      }
    }) as Promise<Entity<T>>;
  }

  public async $refresh() {
    await this.$wake();

    if (this.guid == null) {
      return false;
    }
    const refresh = await this.$nymph.getEntity(
      {
        class: this.$nymph.getEntityClass(
          this.constructor as EntityConstructor,
        ),
        skipCache: true,
        skipAc: this.$skipAc,
      },
      { type: '&', guid: this.guid },
    );
    if (refresh == null) {
      return 0;
    }
    this.tags = refresh.tags;
    this.cdate = refresh.cdate;
    this.mdate = refresh.mdate;
    this.$putData(refresh.$getData(), refresh.$getSData());
    return true;
  }

  public $removeTag(...tags: string[]) {
    this.$check();

    this.tags = difference(this.tags, tags);
  }

  public async $save(): Promise<boolean> {
    await this.$wake();

    return await this.$nymph.saveEntity(this);
  }

  public $toReference() {
    if (this.$isASleepingReference && this.$sleepingReference != null) {
      return this.$sleepingReference;
    }
    if (this.guid == null) {
      return this;
    }
    return [
      'nymph_entity_reference',
      this.guid,
      (this.constructor as any).class as string,
    ] as EntityReference;
  }

  public $useSkipAc(skipAc: boolean) {
    this.$skipAc = !!skipAc;
  }
}
