import { difference, intersection, isEqual } from 'lodash';

import {
  ACProperties,
  EntityConstructor,
  EntityData,
  EntityInterface,
  EntityJson,
  EntityPatch,
  EntityReference,
  SerializedEntityData,
} from './Entity.types';
import { EntityConflictError, InvalidParametersError } from './errors';
import Nymph from './Nymph';
import {
  entitiesToReferences,
  referencesToEntities,
  uniqueStrings,
} from './utils';

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
 * The == operator will likely not give you the result you want, since any yet
 * to be unserialized data causes == to return false when you probably want it
 * to return true.
 *
 * $equals() performs a more strict comparison of the entity to another. Use
 * $equals() instead of the == operator when you want to check both the entities
 * they represent, and the data inside them. In order to return true for
 * $equals(), the entity and object must meet the following criteria:
 *
 * - They must be entities.
 * - They must have equal GUIDs, or both must have no GUID.
 * - They must be instances of the same class.
 * - Their data must be equal.
 *
 * $is() performs a less strict comparison of the entity to another. Use $is()
 * instead of the == operator when the entity's data may have been changed, but
 * you only care if they represent the same entity. In order to return true, the
 * entity and object must meet the following criteria:
 *
 * - They must be entities.
 * - They must have equal GUIDs, or both must have no GUID.
 * - If they have no GUIDs, their data must be equal.
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
 * Since the referenced entity's class name (meaning the `class` static property,
 * not the name of the class itself) is stored in the reference on the parent
 * entity, if you change the class name in an update, you need to reassign all
 * referenced entities of that class and resave.
 *
 * When an entity is loaded, it does not request its referenced entities from
 * Nymph. Instead, it creates instances without data called sleeping references.
 * When you first access an entity's data, if it is a sleeping reference, it
 * will fill its data from the DB. You can call clearCache() to turn all the
 * entities back into sleeping references.
 */
class Entity<T extends EntityData = EntityData> implements EntityInterface {
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

  /**
   * The entity's Globally Unique ID.
   */
  public guid: string | null = null;
  /**
   * The creation date of the entity as a high precision Unix timestamp.
   */
  public cdate: number | null = null;
  /**
   * The modified date of the entity as a high precision Unix timestamp.
   */
  public mdate: number | null = null;
  /**
   * Array of the entity's tags.
   */
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
  private $isASleepingReference = false;
  /**
   * The reference to use to wake.
   */
  private $sleepingReference: EntityReference | null = null;
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
   * In addition to what's listed here, the 'user' and 'group' properties will
   * be filtered for non-admins when Tilmeld is being used.
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
  public static $clientEnabledStaticMethods: string[] = [];
  /**
   * Whether to use "skipAc" when accessing entity references.
   */
  private $skipAc: boolean = false;
  /**
   * The AC properties' values when the entity was loaded.
   */
  private $originalAcValues: ACProperties | null = null;

  /**
   * Load an entity.
   * @param guid The ID of the entity to load, undefined for a new entity.
   */
  public constructor(guid?: string) {
    this.$dataHandler = {
      has: (data: EntityData, name: string) => {
        this.$referenceWake();

        return data.hasOwnProperty(name) || this.$sdata.hasOwnProperty(name);
      },

      get: (data: EntityData, name: string) => {
        this.$referenceWake();

        if (this.$sdata.hasOwnProperty(name)) {
          data[name] = referencesToEntities(
            JSON.parse(this.$sdata[name]),
            this.$skipAc
          );
          delete this.$sdata[name];
        }
        if (data.hasOwnProperty(name)) {
          return data[name];
        }
        return undefined;
      },

      set: (data: EntityData, name: string, value: any) => {
        this.$referenceWake();

        if (this.$sdata.hasOwnProperty(name)) {
          delete this.$sdata[name];
        }
        data[name] = value;
        return true;
      },

      deleteProperty: (data: EntityData, name: string) => {
        this.$referenceWake();

        if (this.$sdata.hasOwnProperty(name)) {
          return delete this.$sdata[name];
        }
        if (data.hasOwnProperty(name)) {
          return delete data[name];
        }
        return true;
      },
    };
    this.$dataStore = {} as T;
    this.$sdata = {};

    this.$data = new Proxy(this.$dataStore, this.$dataHandler);

    if (guid) {
      const entity = Nymph.driver.getEntitySync(
        { class: this.constructor as EntityConstructor },
        { type: '&', guid: guid }
      );
      if (entity) {
        this.guid = entity.guid;
        this.tags = entity.tags;
        this.cdate = entity.cdate;
        this.mdate = entity.mdate;
        this.$putData(entity.$getData(), entity.$getSData());
      }
    }

    return new Proxy(this, {
      has: (entity: Entity, name: string) => {
        this.$referenceWake();

        if (
          typeof name !== 'string' ||
          name in entity ||
          name.substring(0, 1) === '$'
        ) {
          return name in entity;
        }
        return name in entity.$data;
      },

      get: (entity: Entity, name: string) => {
        this.$referenceWake();

        if (
          typeof name !== 'string' ||
          name in entity ||
          name.substring(0, 1) === '$'
        ) {
          return (entity as any)[name];
        }
        if (name in entity.$data) {
          return entity.$data[name];
        }
        return undefined;
      },

      set: (entity: Entity, name: string, value: any) => {
        this.$referenceWake();

        if (
          typeof name !== 'string' ||
          name in entity ||
          name.substring(0, 1) === '$'
        ) {
          (entity as any)[name] = value;
        } else {
          (entity.$data as any)[name] = value;
        }
        return true;
      },

      deleteProperty: (entity: Entity, name: string) => {
        this.$referenceWake();

        if (name in entity) {
          return delete (entity as any)[name];
        } else if (name in entity.$data) {
          return delete entity.$data[name];
        }
        return true;
      },

      getPrototypeOf: (entity: Entity) => {
        return entity.constructor.prototype;
      },
    }) as Entity<T>;
  }

  public static factory(guid?: string) {
    return new Entity(guid);
  }

  /**
   * Create a new sleeping reference instance.
   *
   * Sleeping references won't retrieve their data from the database until it
   * is actually used.
   *
   * @param reference The Nymph Entity Reference to use to wake.
   * @returns The new instance.
   */
  public static factoryReference(reference: EntityReference) {
    const className = reference[2];
    const EntityClass = Nymph.getEntityClass(className);
    const entity = new EntityClass();
    entity.$referenceSleep(reference);
    return entity;
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
    this.$referenceWake();

    if (tags.length < 1) {
      return;
    }
    this.tags = uniqueStrings([...this.tags, ...tags]);
  }

  public $arraySearch(array: any[], strict = false) {
    this.$referenceWake();

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
    this.$referenceWake();

    this.$putData(this.$getData(), this.$getSData());
  }

  public $getClientEnabledMethods() {
    return this.$clientEnabledMethods;
  }

  public async $delete(): Promise<boolean> {
    this.$referenceWake();

    return await Nymph.deleteEntity(this);
  }

  public $equals(object: any) {
    this.$referenceWake();

    if (!(object instanceof Entity)) {
      return false;
    }
    if (this.guid || object.guid) {
      if (this.guid !== object.guid) {
        return false;
      }
    }
    if (object.constructor !== this.constructor) {
      return false;
    }
    if (object.cdate !== this.cdate) {
      return false;
    }
    if (object.mdate !== this.mdate) {
      return false;
    }
    const obData = object.$getData(true);
    const myData = this.$getData(true);
    return isEqual(obData, myData);
  }

  public $getData(includeSData = false) {
    this.$referenceWake();

    if (includeSData) {
      // Access all the serialized properties to initialize them.
      for (const key in this.$sdata) {
        const unused: any = (this as any)[key];
      }
    }
    return entitiesToReferences({ ...this.$dataStore });
  }

  public $getSData() {
    this.$referenceWake();

    return this.$sdata;
  }

  public $getOriginalAcValues() {
    this.$referenceWake();

    return (
      this.$originalAcValues ?? {
        user: this.$data.user,
        group: this.$data.group,
        acUser: this.$data.acUser,
        acGroup: this.$data.acGroup,
        acOther: this.$data.acOther,
        acRead: this.$data.acRead,
        acWrite: this.$data.acWrite,
        acFull: this.$data.acFull,
      }
    );
  }

  public $getValidatable() {
    this.$referenceWake();

    // Access all the serialized properties to initialize them.
    for (const key in this.$sdata) {
      const unused: any = (this as any)[key];
    }
    return {
      guid: this.guid,
      cdate: this.cdate,
      mdate: this.mdate,
      tags: this.tags,
      ...referencesToEntities(this.$dataStore, this.$skipAc),
    };
  }

  public $getTags() {
    this.$referenceWake();

    return this.tags;
  }

  public $hasTag(...tags: string[]) {
    this.$referenceWake();

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
    this.$referenceWake();

    if (!(object instanceof Entity)) {
      return false;
    }
    if (this.guid || object.guid) {
      return this.guid === object.guid;
    } else if (typeof object.$getData !== 'function') {
      return false;
    } else {
      const obData = object.$getData(true);
      const myData = this.$getData(true);
      return isEqual(obData, myData);
    }
  }

  public $jsonAcceptData(input: EntityJson, allowConflict = false) {
    // TODO: Do this without causing everything to become unserialized.
    this.$referenceWake();

    if (this.guid != input.guid) {
      throw new EntityConflictError(
        'Tried to accept JSON input for the wrong entity.'
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
    if (Nymph.Tilmeld && !Nymph.Tilmeld.gatekeeper('tilmeld/admin')) {
      protectedProps.push('user');
      protectedProps.push('group');
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
    this.$referenceWake();

    if (this.guid != patch.guid) {
      throw new EntityConflictError(
        'Tried to accept JSON patch for the wrong entity.'
      );
    }

    // Accept the modified date.
    const mdate = patch.mdate ?? 0;
    const thismdate = this.mdate ?? 0;
    if (mdate < thismdate && !allowConflict) {
      throw new EntityConflictError('This entity is newer than JSON patch.');
    }
    this.mdate = patch.mdate;

    for (const name in patch.set) {
      if (
        (this.$allowlistData != null &&
          this.$allowlistData.indexOf(name) === -1) ||
        this.$protectedData.indexOf(name) !== -1 ||
        this.$privateData.indexOf(name) !== -1
      ) {
        continue;
      }
      (this.$data as any)[name] = referencesToEntities(
        patch.set[name],
        this.$skipAc
      );
    }

    for (const name of patch.unset) {
      if (
        (this.$allowlistData != null &&
          this.$allowlistData.indexOf(name) === -1) ||
        this.$protectedData.indexOf(name) !== -1 ||
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
    this.$referenceWake();

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
        this.$skipAc
      );
    }
    this.$sdata = mySdata;
    // Set original AC values if not set..
    if (this.$originalAcValues == null) {
      this.$originalAcValues = this.$getOriginalAcValues();
    }
  }

  /**
   * Set up a sleeping reference.
   * @param array $reference The reference to use to wake.
   */
  public $referenceSleep(reference: EntityReference) {
    if (
      reference.length !== 3 ||
      reference[0] !== 'nymph_entity_reference' ||
      typeof reference[1] !== 'string' ||
      typeof reference[2] !== 'string'
    ) {
      throw new InvalidParametersError(
        'referenceSleep expects parameter 1 to be a valid Nymph entity ' +
          'reference.'
      );
    }
    const thisClass: string = (this.constructor as any).class;
    if (reference[2] !== thisClass) {
      throw new InvalidParametersError(
        'referenceSleep can only be called with an entity reference of the ' +
          `same class. Given class: ${reference[2]}; this class: ${thisClass}.`
      );
    }
    this.$isASleepingReference = true;
    this.guid = reference[1];
    this.$sleepingReference = reference;
  }

  /**
   * Wake from a sleeping reference.
   *
   * @returns True on success, false on failure.
   */
  private $referenceWake() {
    if (!this.$isASleepingReference || this.$sleepingReference == null) {
      return true;
    }
    const EntityClass = Nymph.getEntityClass(this.$sleepingReference[2]);
    const entity = Nymph.driver.getEntitySync(
      {
        class: EntityClass,
        skipAc: this.$skipAc,
      },
      { type: '&', guid: this.$sleepingReference[1] }
    );
    if (entity == null) {
      return false;
    }
    this.$isASleepingReference = false;
    this.$sleepingReference = null;
    this.guid = entity.guid;
    this.tags = entity.tags;
    this.cdate = entity.cdate;
    this.mdate = entity.mdate;
    this.$putData(entity.$getData(), entity.$getSData());
    return true;
  }

  public $refresh() {
    this.$referenceWake();

    if (this.guid == null) {
      return false;
    }
    const refresh = Nymph.driver.getEntitySync(
      {
        class: this.constructor as EntityConstructor,
        skipCache: true,
        skipAc: this.$skipAc,
      },
      { type: '&', guid: this.guid }
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
    this.$referenceWake();

    this.tags = difference(this.tags, tags);
  }

  public async $save(): Promise<boolean> {
    this.$referenceWake();

    return await Nymph.saveEntity(this);
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

Nymph.setEntityClass(Entity.class, Entity);
export default Entity;
