import Entity from './Entity';
import type {
  EntityConstructor,
  EntityInterface,
  EntityJson,
  ServerCallResponse,
  ServerCallStaticResponse,
} from './Entity.types';
import EntityWeakCache from './EntityWeakCache';
import type { AbortableAsyncIterator } from './HttpRequester';
import HttpRequester from './HttpRequester';
import type {
  EventType,
  NymphOptions,
  Options,
  RequestCallback,
  ResponseCallback,
  Selector,
} from './Nymph.types';
import type PubSub from './PubSub';
import { entitiesToReferences, entityConstructorsToClassNames } from './utils';

let requester: HttpRequester;

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

  private requestCallbacks: RequestCallback[] = [];
  private responseCallbacks: ResponseCallback[] = [];
  private restUrl: string = '';
  private weakCache = false;
  public cache = new EntityWeakCache();

  public constructor(NymphOptions: NymphOptions) {
    this.restUrl = NymphOptions.restUrl;
    // @ts-ignore TS doesn't know about WeakRef.
    this.weakCache = !!NymphOptions.weakCache && typeof WeakRef !== 'undefined';

    this.Entity = this.addEntityClass(Entity);

    requester = new HttpRequester(
      'fetch' in NymphOptions ? NymphOptions.fetch : undefined,
    );

    requester.on('request', (_requester, url, options) => {
      for (let i = 0; i < this.requestCallbacks.length; i++) {
        this.requestCallbacks[i] && this.requestCallbacks[i](url, options);
      }
    });

    requester.on('response', (_requester, response, text) => {
      for (let i = 0; i < this.responseCallbacks.length; i++) {
        this.responseCallbacks[i] && this.responseCallbacks[i](response, text);
      }
    });
  }

  /**
   * Add your class to this instance.
   *
   * This will create a class that extends your class within this instance of
   * Nymph and return it. You can then use this class's constructor and methods,
   * which will use this instance of Nymph.
   *
   * Because this creates a subclass, don't use the class
   * returned from `getEntityClass` to check with `instanceof`.
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
    const data = await requester.POST({
      url: this.restUrl,
      dataType: 'text',
      data: { action: 'uid', data: name },
    });
    return Number(data);
  }

  public async setUID(name: string, value: number) {
    return await requester.PUT({
      url: this.restUrl,
      dataType: 'json',
      data: { action: 'uid', data: { name, value } },
    });
  }

  public async getUID(name: string) {
    const data = await requester.GET({
      url: this.restUrl,
      dataType: 'text',
      data: { action: 'uid', data: name },
    });
    return Number(data);
  }

  public async deleteUID(name: string) {
    return await requester.DELETE({
      url: this.restUrl,
      dataType: 'text',
      data: { action: 'uid', data: name },
    });
  }

  public async saveEntity(entity: EntityInterface) {
    let method: 'POST' | 'PUT' = entity.guid == null ? 'POST' : 'PUT';
    return await this.requestWithMethod(entity, method, entity, false);
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
    return await this.requestWithMethod(entities, method, entities, true);
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
    data: { [k: string]: any },
    plural: false,
  ): Promise<T>;
  private async requestWithMethod<T extends EntityInterface>(
    entity: T[],
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    data: { [k: string]: any },
    plural: true,
  ): Promise<T[]>;
  private async requestWithMethod<T extends EntityInterface>(
    entity: T | T[],
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    data: { [k: string]: any },
    plural: boolean,
  ): Promise<T | T[]> {
    const response = await requester[method]({
      url: this.restUrl,
      dataType: 'json',
      data: {
        action: plural ? 'entities' : 'entity',
        data,
      },
    });
    if (plural && Array.isArray(entity) && entity.length === response.length) {
      return entity.map((e, i) =>
        response[i] &&
        typeof response[i].guid !== 'undefined' &&
        (e.guid == null || e.guid === response[i].guid)
          ? e.$init(response[i])
          : e,
      ) as T[];
    } else if (!Array.isArray(entity) && typeof response.guid !== 'undefined') {
      return entity.$init(response) as T;
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
  ): Promise<ReturnType<T['factorySync']> | null>;
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
  ): Promise<ReturnType<T['factorySync']> | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    ...selectors: Selector[] | string[]
  ): Promise<ReturnType<T['factorySync']> | string | number | null> {
    // @ts-ignore: Implementation signatures of overloads are not externally visible.
    const data = (await this.getEntityData(options, ...selectors)) as
      | EntityJson<T>
      | string
      | number
      | null;

    if (options.return && options.return === 'count') {
      return Number(data ?? 0) as number;
    }
    if (data != null) {
      if (options.return && options.return === 'guid') {
        return data as string;
      } else {
        return this.initEntity(data as EntityJson<T>);
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
    const data = await requester.GET({
      url: this.restUrl,
      dataType: 'json',
      data: {
        action: 'entity',
        data: [
          { ...options, class: options.class.class },
          ...entityConstructorsToClassNames(selectors),
        ],
      },
    });

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
  ): Promise<ReturnType<T['factorySync']>[]>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    ...selectors: Selector[]
  ): Promise<ReturnType<T['factorySync']>[] | string[] | number> {
    const data = await requester.GET({
      url: this.restUrl,
      dataType: 'json',
      data: {
        action: 'entities',
        data: [
          { ...options, class: options.class.class },
          ...entityConstructorsToClassNames(selectors),
        ],
      },
    });

    if (options.return && options.return === 'count') {
      return Number(data);
    }
    if (options.return && options.return === 'guid') {
      return data;
    }
    return data.map((e: EntityJson<T>) => this.initEntity(e));
  }

  public initEntity<T extends EntityConstructor = EntityConstructor>(
    entityJSON: EntityJson<T>,
  ): ReturnType<T['factorySync']> {
    const EntityClass = this.getEntityClass(entityJSON.class);
    if (!EntityClass) {
      throw new ClassNotAvailableError(
        entityJSON.class + ' class cannot be found.',
      );
    }
    let entity = EntityClass.factorySync();
    if (this.weakCache) {
      // Try to get it from cache.
      const entityFromCache = this.cache.get(
        EntityClass,
        entityJSON.guid || '',
      );
      if (entityFromCache != null) {
        entity = entityFromCache;
      }
    }
    return entity.$init(entityJSON) as ReturnType<T['factorySync']>;
  }

  public getEntityFromCache<T extends EntityConstructor = EntityConstructor>(
    EntityClass: EntityConstructor,
    guid: string,
  ): ReturnType<T['factorySync']> | null {
    if (!this.weakCache) {
      return null;
    }
    return this.cache.get(EntityClass, guid) as ReturnType<
      T['factorySync']
    > | null;
  }

  public setEntityToCache(
    EntityClass: EntityConstructor,
    entity: EntityInterface,
  ) {
    if (!this.weakCache) {
      return;
    }
    return this.cache.set(EntityClass, entity);
  }

  public initEntitiesFromData<T extends any>(item: T): T {
    if (Array.isArray(item)) {
      // Recurse into lower arrays.
      return item.map((entry) => this.initEntitiesFromData(entry)) as T;
    } else if (item instanceof Object && !(item instanceof Entity)) {
      if (
        item.hasOwnProperty('class') &&
        item.hasOwnProperty('guid') &&
        item.hasOwnProperty('cdate') &&
        item.hasOwnProperty('mdate') &&
        item.hasOwnProperty('tags') &&
        item.hasOwnProperty('data') &&
        this.getEntityClass((item as any as EntityJson).class)
      ) {
        return this.initEntity(item as any as EntityJson) as T;
      } else {
        for (let [key, value] of Object.entries(item)) {
          // @ts-ignore: Key comes from the object. It's fine.
          item[key] = this.initEntitiesFromData(value);
        }
      }
    }
    // Not an entity or array, just return it.
    return item;
  }

  public async deleteEntity(
    entity: EntityInterface | EntityInterface[],
    _plural = false,
  ) {
    return await requester.DELETE({
      url: this.restUrl,
      dataType: 'json',
      data: {
        action: _plural ? 'entities' : 'entity',
        data:
          _plural && Array.isArray(entity)
            ? entity.map((e) => ({
                guid: e.guid,
                class: (e.constructor as EntityConstructor).class,
              }))
            : {
                guid: (entity as EntityInterface).guid,
                class: (entity.constructor as EntityConstructor).class,
              },
      },
    });
  }

  public async deleteEntities(entities: EntityInterface[]) {
    return await this.deleteEntity(entities, true);
  }

  public async serverCall(
    entity: EntityInterface,
    method: string,
    params: any[],
    stateless = false,
  ): Promise<ServerCallResponse> {
    const data = await requester.POST({
      url: this.restUrl,
      dataType: 'json',
      data: {
        action: 'method',
        data: {
          entity,
          stateless,
          method,
          params: entitiesToReferences(entityConstructorsToClassNames(params)),
        },
      },
    });

    return {
      ...data,
      return: this.initEntitiesFromData(data.return),
    };
  }

  public async serverCallStatic(
    className: string,
    method: string,
    params: any[],
  ): Promise<ServerCallStaticResponse> {
    const data = await requester.POST({
      url: this.restUrl,
      dataType: 'json',
      data: {
        action: 'method',
        data: {
          class: className,
          static: true,
          method: method,
          params: entitiesToReferences(entityConstructorsToClassNames(params)),
        },
      },
    });

    return this.initEntitiesFromData(data);
  }

  public async serverCallStaticIterator(
    className: string,
    method: string,
    params: any[],
  ): Promise<AbortableAsyncIterator<ServerCallStaticResponse>> {
    const iterable = await requester.POST_ITERATOR({
      url: this.restUrl,
      dataType: 'json',
      data: {
        action: 'method',
        data: {
          class: className,
          static: true,
          method: method,
          iterator: true,
          params: entitiesToReferences(entityConstructorsToClassNames(params)),
        },
      },
    });

    const that = this;
    const iterator: AbortableAsyncIterator = {
      abortController: iterable.abortController,
      async *[Symbol.asyncIterator]() {
        for await (let response of iterable) {
          if (response instanceof Error) {
            yield response;
          } else {
            yield that.initEntitiesFromData(response);
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

  public setXsrfToken(token: string | null) {
    requester.setXsrfToken(token);
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
