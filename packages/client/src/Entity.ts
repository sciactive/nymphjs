import { difference, isEqual } from 'lodash';

import type Nymph from './Nymph';
import {
  EntityConstructor,
  EntityData,
  EntityInterface,
  EntityJson,
  EntityPatch,
  EntityReference,
} from './Entity.types';
import {
  uniqueStrings,
  entitiesToReferences,
  referencesToEntities,
  sortObj,
} from './utils';

export type EntityDataType<T> = T extends Entity<infer DataType>
  ? DataType
  : never;

export type EntityInstanceType<T extends EntityConstructor> =
  T extends new () => infer E ? E & EntityDataType<E> : never;

export default class Entity<T extends EntityData = EntityData>
  implements EntityInterface
{
  /**
   * The instance of Nymph to use for queries.
   */
  public static nymph = {} as Nymph;
  /**
   * The lookup name for this entity.
   *
   * This is used for reference arrays (and sleeping references) and server
   * requests.
   */
  public static class = 'Entity';

  /**
   * The instance of Nymph to use for queries.
   */
  public $nymph: Nymph;
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
   * The partition where the entity came from.
   */
  private $partition: string | undefined = undefined;
  /**
   * Array of the entity's original tags (for patch).
   */
  protected $originalTags: string[] = [];
  /**
   * A map of props to whether they're dirty (for patch).
   */
  protected $dirty: { [k: string]: boolean } = {};
  /**
   * The data proxy handler.
   */
  protected $dataHandler: Object;
  /**
   * The actual data store.
   */
  protected $dataStore: T;
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
   * Initialize an entity.
   */
  public constructor(..._rest: any[]) {
    this.$nymph = (this.constructor as EntityConstructor).nymph;
    this.$dataHandler = {
      has: (data: EntityData, name: string) => {
        if (typeof name !== 'symbol' && this.$isASleepingReference) {
          console.error(`Tried to check data on a sleeping reference: ${name}`);
          return false;
        }
        return name in data;
      },

      get: (data: EntityData, name: string) => {
        if (typeof name !== 'symbol' && this.$isASleepingReference) {
          console.error(`Tried to get data on a sleeping reference: ${name}`);
          return undefined;
        }
        if (data.hasOwnProperty(name)) {
          return data[name];
        }
        return undefined;
      },

      set: (data: EntityData, name: string, value: any) => {
        if (typeof name !== 'symbol' && this.$isASleepingReference) {
          console.error(`Tried to set data on a sleeping reference: ${name}`);
          return false;
        }
        if (typeof name !== 'symbol') {
          this.$dirty[name] = true;
        }
        data[name] = value;
        return true;
      },

      deleteProperty: (data: EntityData, name: string) => {
        if (typeof name !== 'symbol' && this.$isASleepingReference) {
          console.error(
            `Tried to delete data on a sleeping reference: ${name}`,
          );
          return false;
        }
        if (data.hasOwnProperty(name)) {
          this.$dirty[name] = true;
          return delete data[name];
        }
        return true;
      },

      defineProperty: (
        data: EntityData,
        name: string,
        descriptor: PropertyDescriptor,
      ) => {
        if (typeof name !== 'symbol' && this.$isASleepingReference) {
          console.error(
            `Tried to define data on a sleeping reference: ${name}`,
          );
          return false;
        }
        if (typeof name !== 'symbol') {
          this.$dirty[name] = true;
        }
        Object.defineProperty(data, name, descriptor);
        return true;
      },

      getOwnPropertyDescriptor: (data: EntityData, name: string) => {
        if (typeof name !== 'symbol' && this.$isASleepingReference) {
          console.error(
            `Tried to get property descriptor on a sleeping reference: ${name}`,
          );
          return undefined;
        }
        return Object.getOwnPropertyDescriptor(data, name);
      },

      ownKeys: (data: EntityData) => {
        if (this.$isASleepingReference) {
          console.error(`Tried to enumerate data on a sleeping reference.`);
          return undefined;
        }
        return Object.getOwnPropertyNames(data);
      },
    };
    this.$dataStore = {} as T;
    this.$data = new Proxy(this.$dataStore, this.$dataHandler);

    return new Proxy(this, {
      has(entity: Entity, name: string) {
        if (
          typeof name !== 'string' ||
          name in entity ||
          name.substring(0, 1) === '$'
        ) {
          return name in entity;
        }
        return name in entity.$data;
      },

      get(entity: Entity, name: string) {
        if (
          typeof name !== 'string' ||
          name in entity ||
          name.substring(0, 1) === '$'
        ) {
          return (entity as EntityInterface)[name];
        }
        if (name in entity.$data) {
          return entity.$data[name];
        }
        return undefined;
      },

      set(entity: Entity, name: string, value: any) {
        if (
          typeof name !== 'string' ||
          name in entity ||
          name.substring(0, 1) === '$'
        ) {
          (entity as EntityInterface)[name] = value;
        } else {
          entity.$data[name] = value;
        }
        return true;
      },

      deleteProperty(entity: Entity, name: string) {
        if (name in entity) {
          return delete (entity as EntityInterface)[name];
        } else if (name in entity.$data) {
          return delete entity.$data[name];
        }
        return true;
      },

      getPrototypeOf(entity: Entity) {
        return entity.constructor.prototype;
      },

      defineProperty(
        entity: Entity,
        name: string,
        descriptor: PropertyDescriptor,
      ) {
        if (
          typeof name !== 'string' ||
          name in entity ||
          name.substring(0, 1) === '$'
        ) {
          Object.defineProperty(entity, name, descriptor);
        } else {
          Object.defineProperty(entity.$data, name, descriptor);
        }
        return true;
      },

      getOwnPropertyDescriptor(entity: Entity, name: string) {
        if (
          typeof name !== 'string' ||
          name in entity ||
          name.substring(0, 1) === '$'
        ) {
          return Object.getOwnPropertyDescriptor(entity, name);
        } else {
          return Object.getOwnPropertyDescriptor(entity.$data, name);
        }
      },

      ownKeys(entity: Entity) {
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
    partition?: string,
  ): Promise<E & EntityDataType<E>> {
    const cacheEntity = (
      guid
        ? (this as unknown as EntityConstructor).nymph.getEntityFromCache(
            this as unknown as EntityConstructor,
            guid,
          )
        : null
    ) as Entity | null;
    if (cacheEntity) {
      return cacheEntity as E & EntityDataType<E>;
    }
    const entity = new this();
    if (guid != null) {
      entity.guid = guid;
      entity.$isASleepingReference = true;
      entity.$sleepingReference = [
        'nymph_entity_reference',
        guid,
        (this as unknown as EntityConstructor).class,
        partition,
      ];
      await entity.$wake();
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
   * Sleeping references won't retrieve their data from the server until they
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
    const cacheEntity = (
      reference[1]
        ? (this as unknown as EntityConstructor).nymph.getEntityFromCache(
            this as unknown as EntityConstructor,
            reference[1],
          )
        : null
    ) as Entity | null;

    const entity = cacheEntity || new this();
    if (!cacheEntity) {
      entity.$referenceSleep(reference);
    }
    return entity as E & EntityDataType<E>;
  }

  /**
   * Call a static method on the server version of this entity.
   *
   * @param method The name of the method.
   * @param params The parameters to call the method with.
   * @returns The value that the method on the server returned.
   */
  public static async serverCallStatic(method: string, params: Iterable<any>) {
    const data = await this.nymph.serverCallStatic(
      this.class,
      method,
      // Turn the params into a real array, in case an arguments object was
      // passed.
      Array.prototype.slice.call(params),
    );
    return data.return;
  }

  /**
   * Call a static iterator method on the server version of this entity.
   *
   * @param method The name of the method.
   * @param params The parameters to call the method with.
   * @returns An iterator that iterates over values that the method on the server yields.
   */
  public static async serverCallStaticIterator(
    method: string,
    params: Iterable<any>,
  ) {
    return await this.nymph.serverCallStaticIterator(
      this.class,
      method,
      // Turn the params into a real array, in case an arguments object was
      // passed.
      Array.prototype.slice.call(params),
    );
  }

  public toJSON() {
    this.$check();
    const obj: EntityJson = {
      class: (this.constructor as any).class as string,
      partition: this.$partition,
      guid: this.guid,
      cdate: this.cdate,
      mdate: this.mdate,
      tags: [...this.tags],
      data: {},
    };
    for (let [key, value] of Object.entries(this.$dataStore)) {
      obj.data[key] = entitiesToReferences(value);
    }
    return obj;
  }

  public $init(entityJson: EntityJson | null) {
    if (entityJson == null) {
      return this;
    }

    this.$isASleepingReference = false;
    this.$sleepingReference = null;

    this.$partition = entityJson.partition;
    this.guid = entityJson.guid;
    this.cdate = entityJson.cdate;
    this.mdate = entityJson.mdate;
    this.tags = entityJson.tags;
    this.$originalTags = entityJson.tags.slice(0);
    this.$dirty = {};
    this.$dataStore = Object.entries(entityJson.data)
      .map(([key, value]) => {
        this.$dirty[key] = false;
        return { key, value: referencesToEntities(value, this.$nymph) };
      })
      .reduce(
        (obj, { key, value }) => Object.assign(obj, { [key]: value }),
        {},
      ) as T;
    this.$data = new Proxy(this.$dataStore, this.$dataHandler);

    this.$nymph.setEntityToCache(this.constructor as EntityConstructor, this);

    return this as Entity<T>;
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

  public async $delete(): Promise<boolean> {
    this.$check();

    const guid = this.guid;

    return (await this.$nymph.deleteEntity(this)) === guid;
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
    const obData = sortObj(object.toJSON());
    obData.tags?.sort();
    // obData.data = sortObj(obData.data);
    const myData = sortObj(this.toJSON());
    myData.tags?.sort();
    // myData.data = sortObj(myData.data);
    return isEqual(obData, myData);
  }

  public $getPatch(): EntityPatch {
    this.$check();
    if (this.guid == null) {
      throw new InvalidStateError(
        "You can't make a patch from an unsaved entity.",
      );
    }
    const patch: EntityPatch = {
      class: (this.constructor as EntityConstructor).class,
      partition: this.$partition,
      guid: this.guid,
      mdate: this.mdate,
      addTags: this.tags.filter(
        (tag) => this.$originalTags.indexOf(tag) === -1,
      ),
      removeTags: this.$originalTags.filter(
        (tag) => this.tags.indexOf(tag) === -1,
      ),
      unset: [],
      set: {},
    };

    for (let [key, dirty] of Object.entries(this.$dirty)) {
      if (dirty) {
        if (key in this.$data) {
          patch.set[key] = entitiesToReferences(this.$data[key]);
        } else {
          patch.unset.push(key);
        }
      }
    }

    return patch;
  }

  public $hasTag(...tags: string[]) {
    this.$check();

    if (!tags.length) {
      return false;
    }
    for (let i = 0; i < tags.length; i++) {
      if (this.tags.indexOf(tags[i]) === -1) {
        return false;
      }
    }
    return true;
  }

  public $inArray(array: any[], strict = false) {
    return this.$arraySearch(array, strict) !== -1;
  }

  public $is(object: any) {
    this.$check();

    if (!(object instanceof Entity)) {
      return false;
    }
    if (this.guid || object.guid) {
      return this.guid === object.guid;
    } else if (typeof object.toJSON !== 'function') {
      return false;
    } else {
      const obData = sortObj(object.toJSON());
      obData.tags?.sort();
      // obData.data = sortObj(obData.data);
      const myData = sortObj(this.toJSON());
      myData.tags?.sort();
      // myData.data = sortObj(myData.data);
      return isEqual(obData, myData);
    }
  }

  public async $patch() {
    this.$check();

    const mdate = this.mdate;

    await this.$nymph.patchEntity(this);
    return mdate !== this.mdate;
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
    if (!this.$isASleepingReference) {
      this.$wakePromise = null;
      return Promise.resolve(this);
    }
    if (this.$sleepingReference?.[1] == null) {
      throw new InvalidStateError(
        'Tried to wake a sleeping reference with no GUID.',
      );
    }
    if (!this.$wakePromise) {
      this.$wakePromise = this.$nymph
        .getEntityData(
          {
            class: this.constructor as EntityConstructor,
            partition: this.$partition,
          },
          { type: '&', guid: this.$sleepingReference[1] },
        )
        .then((data) => {
          if (data == null) {
            const errObj = { data, textStatus: 'No data returned.' };
            return Promise.reject(errObj);
          }
          return this.$init(data);
        })
        .finally(() => {
          this.$wakePromise = null;
        });
    }
    return this.$wakePromise;
  }

  public $wakeAll(level?: number) {
    return new Promise((resolve, reject) => {
      // Run this once this entity is awake.
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

  protected $referenceSleep(reference: EntityReference) {
    this.$isASleepingReference = true;
    this.guid = reference[1];
    this.$partition = reference[3];
    this.$sleepingReference = [...reference];
  }

  public async $refresh() {
    if (this.$isASleepingReference) {
      await this.$wake();
      return true;
    }

    if (this.guid == null) {
      return false;
    }
    const data = await this.$nymph.getEntityData(
      {
        class: this.constructor as EntityConstructor,
        partition: this.$partition,
      },
      {
        type: '&',
        guid: this.guid,
      },
    );
    this.$init(data);
    return this.guid == null ? 0 : true;
  }

  public $removeTag(...tags: string[]) {
    this.$check();

    this.tags = difference(this.tags, tags);
  }

  public async $save() {
    this.$check();

    await this.$nymph.saveEntity(this);
    return !!this.guid;
  }

  public async $serverCall(
    method: string,
    params: Iterable<any>,
    stateless = false,
  ) {
    this.$check();
    // Turn the params into a real array, in case an arguments object was
    // passed.
    const paramArray = Array.prototype.slice.call(params);
    const data: any = await this.$nymph.serverCall(
      this,
      method,
      paramArray,
      stateless,
    );
    if (!stateless && data.entity) {
      this.$init(data.entity);
    }
    return data.return;
  }

  public $toReference(): EntityReference | EntityInterface {
    if (this.$isASleepingReference && this.$sleepingReference) {
      return this.$sleepingReference;
    }

    if (this.guid == null) {
      return this as EntityInterface;
    }
    return [
      'nymph_entity_reference',
      this.guid,
      (this.constructor as EntityConstructor).class,
      this.$partition,
    ] as EntityReference;
  }

  /**
   * This should only be called internally. Messing with partitions after
   * entities are created can cause data corruption.
   */
  public $setPartition(partition: string | undefined) {
    if (this.guid === null) {
      this.$partition = partition;
      return;
    }

    throw new Error("Can't set partition on an existing entity.");
  }

  public $getPartition() {
    return this.$partition;
  }
}

export class EntityIsSleepingReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EntityIsSleepingReferenceError';
  }
}

export class InvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidStateError';
  }
}
