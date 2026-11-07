import Entity, { type EntityInstanceType } from './Entity.js';
import type {
  EntityConstructor,
  EntityInterface,
  EntityJson,
  EntityPatch,
  ServerCallResponse,
  ServerCallStaticResponse,
} from './Entity.types.js';
import { EntityWeakCache } from './EntityWeakCache.js';
import { QueryWeakCache } from './QueryWeakCache.js';
import type { AbortableAsyncIterator } from './HttpRequester.js';
import { HttpRequester, ClientError } from './HttpRequester.js';
import type {
  EventType,
  NymphOptions,
  Options,
  RequestCallback,
  ResponseCallback,
  Selector,
} from './Nymph.types.js';
import type PubSub from './PubSub.js';
import {
  classNamesToEntityConstructors,
  entitiesToReferences,
  entityConstructorsToClassNames,
} from './utils.js';

type NymphNewUidRequest = { action: 'uid'; data: string };
type NymphSetUidRequest = {
  action: 'uid';
  data: { name: string; value: number };
};
type NymphGetUidRequest = { action: 'uid'; data: string };
type NymphDeleteUidRequest = { action: 'uid'; data: string };
type NymphUidRequest =
  | NymphNewUidRequest
  | NymphSetUidRequest
  | NymphGetUidRequest
  | NymphDeleteUidRequest;

type NymphEntityMethodRequestPlural = {
  action: 'entities';
  data: (EntityJson | EntityPatch)[];
};
type NymphEntityMethodRequestSingular = {
  action: 'entity';
  data: EntityJson | EntityPatch;
};
type NymphEntityMethodRequest =
  NymphEntityMethodRequestPlural | NymphEntityMethodRequestSingular;

type NymphEntityDeleteRequestPlural = {
  action: 'entities';
  data: { guid: string; class: string }[];
};
type NymphEntityDeleteRequestSingular = {
  action: 'entity';
  data: { guid: string; class: string };
};
type NymphEntityDeleteRequest =
  NymphEntityDeleteRequestPlural | NymphEntityDeleteRequestSingular;

type NymphEntityQueryRequest = {
  action: 'entity' | 'entities';
  data: [Options, ...Selector[]];
};

type NymphEntityServerCallRequestPushState = {
  action: 'method';
  data: {
    entity: EntityInterface | EntityJson;
    pushState: true;
    pullState: boolean;
    method: string;
    params: any[];
  };
};
type NymphEntityServerCallRequestNoPushState = {
  action: 'method';
  data: {
    class: string;
    guid: string | null;
    pushState: false;
    pullState: boolean;
    method: string;
    params: any[];
  };
};
type NymphEntityServerCallRequestStatic = {
  action: 'method';
  data: {
    class: string;
    static: true;
    method: string;
    params: any[];
  };
};
type NymphEntityServerCallRequestStaticIterator = {
  action: 'method';
  data: {
    class: string;
    static: true;
    iterator: true;
    method: string;
    params: any[];
  };
};
type NymphEntityServerCallRequest =
  | NymphEntityServerCallRequestPushState
  | NymphEntityServerCallRequestNoPushState
  | NymphEntityServerCallRequestStatic
  | NymphEntityServerCallRequestStaticIterator;

export default class Nymph {
  /**
   * And optional PubSub client instance.
   */
  public pubsub: PubSub | undefined = undefined;

  /**
   * A simple map of names to Entity classes.
   */
  private entityClasses: { [k: string]: EntityConstructor } = {};

  /**
   * The entity class for this instance of Nymph.
   */
  public Entity: typeof Entity;

  /**
   * This instance's requester.
   */
  public requester: HttpRequester;

  private requestCallbacks: RequestCallback[] = [];
  private responseCallbacks: ResponseCallback[] = [];
  private restUrl: string = '';
  public weakCache = false;
  public weakCacheKeepDirtyData = false;
  /**
   * Headers that will be sent with every request.
   *
   * These are used by Tilmeld for authentication.
   */
  public headers: { [k: string]: string } = {};
  /**
   * The entity cache.
   */
  public entityCache = new EntityWeakCache();
  /**
   * The query cache.
   */
  public queryCache = new QueryWeakCache();
  /**
   * Return `null` or empty array instead of error when entity/ies not found.
   */
  public returnNullOnNotFound = false;

  public constructor(NymphOptions: NymphOptions) {
    this.restUrl = NymphOptions.restUrl;
    // @ts-ignore TS doesn't know about WeakRef.
    this.weakCache = !!NymphOptions.weakCache && typeof WeakRef !== 'undefined';
    this.weakCacheKeepDirtyData = !!NymphOptions.weakCacheKeepDirtyData;
    if (
      'returnNullOnNotFound' in NymphOptions &&
      NymphOptions.returnNullOnNotFound != null
    ) {
      this.returnNullOnNotFound = NymphOptions.returnNullOnNotFound;
    }

    this.Entity = this.addEntityClass(Entity);

    this.requester = new HttpRequester(
      'fetch' in NymphOptions ? NymphOptions.fetch : undefined,
    );

    if ('renewTokens' in NymphOptions && !NymphOptions.renewTokens) {
      this.headers['X-Tilmeld-Token-Renewal'] = 'off';
    }

    this.requester.on('request', (_requester, url, options) => {
      for (let i = 0; i < this.requestCallbacks.length; i++) {
        this.requestCallbacks[i] && this.requestCallbacks[i](url, options);
      }
    });

    this.requester.on('response', (_requester, response, text) => {
      for (let i = 0; i < this.responseCallbacks.length; i++) {
        this.responseCallbacks[i] && this.responseCallbacks[i](response, text);
      }
    });
  }

  /**
   * Clear both the entity and the query caches.
   */
  public clearCaches() {
    this.entityCache = new EntityWeakCache();
    this.queryCache = new QueryWeakCache();
  }

  /**
   * Add your class to this instance.
   *
   * This will create a class that extends your class within this instance of
   * Nymph and return it. You can then use this class's constructor and methods,
   * which will use this instance of Nymph.
   *
   * Because this creates a subclass, don't use the class returned from
   * `getEntityClass` to check with `instanceof`. Instead, use the base class
   * that you passed into this method.
   */
  public addEntityClass<T extends EntityConstructor>(entityClass: T): T {
    const nymph = this;
    class NymphEntity extends entityClass {
      static nymph: Nymph = nymph;

      constructor(...args: any[]) {
        super(...args);
      }
    }
    this.entityClasses[entityClass.class] = NymphEntity;
    return NymphEntity;
  }

  public getEntityClass<T extends EntityConstructor>(className: T): T;
  public getEntityClass(className: string): EntityConstructor;
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
    throw new ClassNotAvailableError('Tried to use class: ' + key);
  }

  public async newUID(name: string) {
    const data: NymphNewUidRequest = { action: 'uid', data: name };
    const result = await this.requester.POST({
      url: this.restUrl,
      headers: { ...this.headers },
      dataType: 'text',
      data,
    });
    return Number(result);
  }

  public async setUID(name: string, value: number) {
    const data: NymphSetUidRequest = { action: 'uid', data: { name, value } };
    return await this.requester.PUT({
      url: this.restUrl,
      headers: { ...this.headers },
      dataType: 'json',
      data,
    });
  }

  public async getUID(name: string) {
    const data: NymphGetUidRequest = { action: 'uid', data: name };
    let promise: Promise<any> | null = null;
    const queryJSON = JSON.stringify(data);
    if (this.weakCache) {
      promise = this.queryCache.get(queryJSON);
    }
    if (promise == null) {
      promise = this.requester.GET({
        url: this.restUrl,
        headers: { ...this.headers },
        dataType: 'text',
        data,
      });
      if (this.weakCache) {
        this.queryCache.set(queryJSON, promise);
      }
    }
    const result = await promise;
    return Number(result);
  }

  public async deleteUID(name: string) {
    const data: NymphDeleteUidRequest = { action: 'uid', data: name };
    return await this.requester.DELETE({
      url: this.restUrl,
      headers: { ...this.headers },
      dataType: 'text',
      data,
    });
  }

  public async saveEntity(entity: EntityInterface) {
    let method: 'POST' | 'PUT' = entity.guid == null ? 'POST' : 'PUT';
    let json = entity.toJSON();
    if (Array.isArray(json)) {
      throw new InvalidRequestError("Can't save sleeping references.");
    }
    return await this.requestWithMethod(entity, method, json, false);
  }

  public async saveEntities(entities: EntityInterface[]) {
    if (!entities.length) {
      return Promise.resolve(false);
    }

    let method: 'POST' | 'PUT' = entities[0].guid == null ? 'POST' : 'PUT';
    entities.forEach((cur) => {
      if (
        (method === 'POST' && cur.guid != null) ||
        (method === 'PUT' && cur.guid == null)
      ) {
        throw new InvalidRequestError(
          'Due to REST restriction, you can only create new entities or ' +
            'update existing entities, not both at the same time.',
        );
      }
    });
    let jsons = entities.map((e) => {
      const json = e.toJSON();
      if (Array.isArray(json)) {
        throw new InvalidRequestError("Can't save sleeping references.");
      }
      return json;
    });
    return await this.requestWithMethod(entities, method, jsons, true);
  }

  public async patchEntity(entity: EntityInterface) {
    if (entity.guid == null) {
      throw new InvalidRequestError(
        "You can't patch an entity that hasn't yet been saved.",
      );
    }

    let patch = entity.$getPatch();
    return await this.requestWithMethod(entity, 'PATCH', patch, false);
  }

  public async patchEntities(entities: EntityInterface[]) {
    if (!entities.length) {
      return Promise.resolve(false);
    }

    entities.forEach((cur) => {
      if (cur.guid == null) {
        throw new InvalidRequestError(
          'Due to REST restriction, you can only create new entities or ' +
            'update existing entities, not both at the same time.',
        );
      }
    });
    let patch = entities.map((e) => e.$getPatch());
    return await this.requestWithMethod(entities, 'PATCH', patch, true);
  }

  private async requestWithMethod<T extends EntityInterface>(
    entity: T,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    data: EntityJson | EntityPatch,
    plural: false,
  ): Promise<T>;
  private async requestWithMethod<T extends EntityInterface>(
    entity: T[],
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    data: (EntityJson | EntityPatch)[],
    plural: true,
  ): Promise<T[]>;
  private async requestWithMethod<T extends EntityInterface>(
    entity: T | T[],
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    data: (EntityJson | EntityPatch) | (EntityJson | EntityPatch)[],
    plural: boolean,
  ): Promise<T | T[]> {
    let body: NymphEntityMethodRequest;
    if (plural && Array.isArray(data)) {
      body = {
        action: 'entities',
        data,
      };
    } else {
      if (Array.isArray(data)) {
        throw new Error('Plural not specified, but data is an array.');
      }
      body = {
        action: 'entity',
        data,
      };
    }
    const response = await this.requester[method]({
      url: this.restUrl,
      headers: { ...this.headers },
      dataType: 'json',
      data: body,
    });
    if (plural && Array.isArray(entity) && entity.length === response.length) {
      return entity.map((e, i) =>
        response[i] &&
        response[i].guid != null &&
        (e.guid == null || e.guid === response[i].guid)
          ? e.$init(response[i], method !== 'GET')
          : e,
      ) as T[];
    } else if (!Array.isArray(entity) && response.guid != null) {
      return entity.$init(response, method !== 'GET') as T;
    }
    throw new Error('Server error');
  }

  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'count' },
    ...selectors: Selector[]
  ): Promise<number>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    ...selectors: Selector[]
  ): Promise<EntityInstanceType<T> | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'count' },
    guid: string,
  ): Promise<number>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    guid: string,
  ): Promise<string | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    guid: string,
  ): Promise<EntityInstanceType<T> | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    ...selectors: Selector[] | string[]
  ): Promise<EntityInstanceType<T> | string | number | null> {
    let data: any = null;
    try {
      // @ts-ignore: Implementation signatures of overloads are not externally visible.
      data = (await this.getEntityData(options, ...selectors)) as
        EntityJson<T> | string | number | null;
    } catch (e: any) {
      if (
        this.returnNullOnNotFound &&
        e instanceof ClientError &&
        e.status === 404
      ) {
        data = null;
      } else {
        throw e;
      }
    }

    if (options.return && options.return === 'count') {
      return Number(data ?? 0) as number;
    }
    if (data != null) {
      if (options.return && options.return === 'guid') {
        return data as string;
      } else {
        return this.initEntity(data as EntityJson<T>, false);
      }
    }

    return null;
  }

  public async getEntityData<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'count' },
    ...selectors: Selector[]
  ): Promise<number>;
  public async getEntityData<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string | null>;
  public async getEntityData<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    ...selectors: Selector[]
  ): Promise<EntityJson<T> | null>;
  public async getEntityData<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'count' },
    guid: string,
  ): Promise<number>;
  public async getEntityData<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    guid: string,
  ): Promise<string | null>;
  public async getEntityData<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    guid: string,
  ): Promise<EntityJson<T> | null>;
  public async getEntityData<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    ...selectors: Selector[] | string[]
  ): Promise<EntityJson<T> | string | number | null> {
    if (options.class instanceof Entity) {
      throw new InvalidRequestError(
        "You can't make REST requests with the base Entity class.",
      );
    }
    // Set up options and selectors.
    if (typeof selectors[0] === 'string') {
      selectors = [{ type: '&', guid: selectors[0] }];
    }
    const query: NymphEntityQueryRequest = {
      action: 'entity',
      data: [
        entityConstructorsToClassNames(options),
        ...entityConstructorsToClassNames(entitiesToReferences(selectors)),
      ],
    };
    let promise: Promise<any> | null = null;
    const queryJSON = JSON.stringify(query);
    if (this.weakCache) {
      promise = this.queryCache.get(queryJSON);
    }
    if (promise == null) {
      promise = this.requester.GET({
        url: this.restUrl,
        headers: { ...this.headers },
        dataType: 'json',
        data: query,
      });
      if (this.weakCache) {
        this.queryCache.set(queryJSON, promise);
      }
    }

    const data = await promise;

    if (options.return === 'count' || typeof data.guid !== 'undefined') {
      return data;
    }
    return null;
  }

  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'count' },
    ...selectors: Selector[]
  ): Promise<number>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string[]>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    ...selectors: Selector[]
  ): Promise<EntityInstanceType<T>[]>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    ...selectors: Selector[]
  ): Promise<EntityInstanceType<T>[] | string[] | number> {
    let data = null;
    try {
      const query: NymphEntityQueryRequest = {
        action: 'entities',
        data: [
          entityConstructorsToClassNames(options),
          ...entityConstructorsToClassNames(entitiesToReferences(selectors)),
        ],
      };
      let promise: Promise<any> | null = null;
      const queryJSON = JSON.stringify(query);
      if (this.weakCache) {
        promise = this.queryCache.get(queryJSON);
      }
      if (promise == null) {
        promise = this.requester.GET({
          url: this.restUrl,
          headers: { ...this.headers },
          dataType: 'json',
          data: query,
        });
        if (this.weakCache) {
          this.queryCache.set(queryJSON, promise);
        }
      }
      data = await promise;
    } catch (e: any) {
      if (
        this.returnNullOnNotFound &&
        e instanceof ClientError &&
        e.status === 404
      ) {
        data = null;
      } else {
        throw e;
      }
    }

    if (options.return && options.return === 'count') {
      return Number(data ?? 0) as number;
    }
    if (data == null) {
      return [];
    }
    if (options.return && options.return === 'guid') {
      return data;
    }
    return data.map((e: EntityJson<T>) => this.initEntity(e, false));
  }

  public initEntity<T extends EntityConstructor = EntityConstructor>(
    entityJSON: EntityJson<T>,
    isFromSave: boolean,
  ): EntityInstanceType<T> {
    const EntityClass = classNamesToEntityConstructors<T>(
      this,
      entityJSON.class as unknown as T,
    );
    if (!EntityClass) {
      throw new ClassNotAvailableError(
        entityJSON.class + ' class cannot be found.',
      );
    }
    let entity = EntityClass.factorySync();
    if (this.weakCache) {
      // Try to get it from cache.
      const entityFromCache = this.entityCache.get(
        EntityClass,
        entityJSON.guid || '',
      );
      if (entityFromCache != null) {
        entity = entityFromCache as EntityInstanceType<T>;
      }
    }
    return entity.$init(entityJSON, isFromSave) as EntityInstanceType<T>;
  }

  public getEntityFromCache<T extends EntityConstructor = EntityConstructor>(
    EntityClass: EntityConstructor,
    guid: string,
  ): EntityInstanceType<T> | null {
    if (!this.weakCache) {
      return null;
    }
    return this.entityCache.get(
      EntityClass,
      guid,
    ) as EntityInstanceType<T> | null;
  }

  public setEntityToCache(
    EntityClass: EntityConstructor,
    entity: EntityInterface,
  ) {
    if (!this.weakCache) {
      return;
    }
    return this.entityCache.set(EntityClass, entity);
  }

  public initEntitiesFromData<T extends any>(item: T, isFromSave: boolean): T {
    if (Array.isArray(item)) {
      // Recurse into lower arrays.
      return item.map((entry) =>
        this.initEntitiesFromData(entry, isFromSave),
      ) as T;
    } else if (item instanceof Object && !(item instanceof Entity)) {
      if (
        item.hasOwnProperty('class') &&
        item.hasOwnProperty('guid') &&
        item.hasOwnProperty('cdate') &&
        item.hasOwnProperty('mdate') &&
        item.hasOwnProperty('tags') &&
        item.hasOwnProperty('data') &&
        classNamesToEntityConstructors(
          this,
          (item as any as EntityJson).class,
        ) != null
      ) {
        return this.initEntity(item as any as EntityJson, isFromSave) as T;
      } else {
        for (let [key, value] of Object.entries(item)) {
          // @ts-ignore: Key comes from the object. It's fine.
          item[key] = this.initEntitiesFromData(value, isFromSave);
        }
      }
    }
    // Not an entity or array, just return it.
    return item;
  }

  public async deleteEntity(
    entity: EntityInterface | EntityInterface[],
    plural = false,
  ) {
    let data: NymphEntityDeleteRequest;
    if (plural && Array.isArray(entity)) {
      data = {
        action: 'entities',
        data: entity.map((e) => {
          if (e.guid == null) {
            throw new Error('Guid is null.');
          }
          return {
            guid: e.guid,
            class: (e.constructor as EntityConstructor).class,
          };
        }),
      };
    } else {
      const guid = (entity as EntityInterface).guid;
      if (guid == null) {
        throw new Error('Guid is null.');
      }
      data = {
        action: 'entity',
        data: {
          guid,
          class: (entity.constructor as EntityConstructor).class,
        },
      };
    }
    return await this.requester.DELETE({
      url: this.restUrl,
      headers: { ...this.headers },
      dataType: 'json',
      data,
    });
  }

  public async deleteEntities(entities: EntityInterface[]) {
    return await this.deleteEntity(entities, true);
  }

  public async serverCall(
    entity: EntityInterface,
    method: string,
    params: any[],
    {
      pushState = false,
      pullState = false,
    }: {
      pushState?: boolean;
      pullState?: boolean;
    },
  ): Promise<ServerCallResponse> {
    let data: NymphEntityServerCallRequest;
    if (pushState) {
      data = {
        action: 'method',
        data: {
          entity,
          pushState: true,
          pullState: !!pullState,
          method,
          params: entityConstructorsToClassNames(entitiesToReferences(params)),
        },
      };
    } else {
      data = {
        action: 'method',
        data: {
          class: (entity.constructor as EntityConstructor).class,
          guid: entity.guid,
          pushState: false,
          pullState: !!pullState,
          method,
          params: entityConstructorsToClassNames(entitiesToReferences(params)),
        },
      };
    }

    const result = await this.requester.POST({
      url: this.restUrl,
      headers: { ...this.headers },
      dataType: 'json',
      data,
    });

    return {
      ...result,
      return: this.initEntitiesFromData(result.return, false),
    };
  }

  public async serverCallStatic(
    className: string,
    method: string,
    params: any[],
  ): Promise<ServerCallStaticResponse> {
    const data: NymphEntityServerCallRequestStatic = {
      action: 'method',
      data: {
        class: className,
        static: true,
        method: method,
        params: entityConstructorsToClassNames(entitiesToReferences(params)),
      },
    };
    const result = await this.requester.POST({
      url: this.restUrl,
      headers: { ...this.headers },
      dataType: 'json',
      data,
    });

    return this.initEntitiesFromData(result, false);
  }

  public async serverCallStaticIterator(
    className: string,
    method: string,
    params: any[],
  ): Promise<AbortableAsyncIterator<ServerCallStaticResponse>> {
    const data: NymphEntityServerCallRequestStaticIterator = {
      action: 'method',
      data: {
        class: className,
        static: true,
        method: method,
        iterator: true,
        params: entityConstructorsToClassNames(entitiesToReferences(params)),
      },
    };
    const iterable = await this.requester.POST_ITERATOR({
      url: this.restUrl,
      headers: { ...this.headers },
      dataType: 'json',
      data,
    });

    const that = this;
    const iterator: AbortableAsyncIterator = {
      abortController: iterable.abortController,
      async *[Symbol.asyncIterator]() {
        for await (let response of iterable) {
          if (response instanceof Error) {
            yield response;
          } else {
            yield that.initEntitiesFromData(response, false);
          }
        }
      },
    };

    return iterator;
  }

  public on<T extends EventType>(
    event: T,
    callback: T extends 'request'
      ? RequestCallback
      : T extends 'response'
        ? ResponseCallback
        : never,
  ) {
    const prop = (event + 'Callbacks') as T extends 'request'
      ? 'requestCallbacks'
      : T extends 'request'
        ? 'responseCallbacks'
        : never;
    if (!(prop in this)) {
      throw new Error('Invalid event type.');
    }
    // @ts-ignore: The callback should always be the right type here.
    this[prop].push(callback);
    return () => this.off(event, callback);
  }

  public off<T extends EventType>(
    event: T,
    callback: T extends 'request'
      ? RequestCallback
      : T extends 'response'
        ? ResponseCallback
        : never,
  ) {
    const prop = (event + 'Callbacks') as T extends 'request'
      ? 'requestCallbacks'
      : T extends 'request'
        ? 'responseCallbacks'
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

export class ClassNotAvailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClassNotAvailableError';
  }
}

export class InvalidRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRequestError';
  }
}
