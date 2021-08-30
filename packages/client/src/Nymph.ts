import {
  EntityConstructor,
  EntityInterface,
  EntityJson,
  ServerCallResponse,
  ServerCallStaticResponse,
} from './Entity.types';
import HttpRequester from './HttpRequester';
import {
  EventType,
  NymphOptions,
  Options,
  RequestCallback,
  ResponseCallback,
  Selector,
} from './Nymph.types';
import { entitiesToReferences } from './utils';

let requester: HttpRequester;

export default class Nymph {
  private static entityClasses: { [k: string]: EntityConstructor } = {};
  private static requestCallbacks: RequestCallback[] = [];
  private static responseCallbacks: ResponseCallback[] = [];
  private static restURL: string;

  public static setEntityClass(
    className: string,
    entityClass: EntityConstructor
  ) {
    this.entityClasses[className] = entityClass;
  }

  public static getEntityClass(className: string) {
    if (this.entityClasses.hasOwnProperty(className)) {
      return this.entityClasses[className];
    }
    throw new ClassNotAvailableError(
      "Tried to get class that's not available: " + className
    );
  }

  public static init(NymphOptions: NymphOptions) {
    this.restURL = NymphOptions.restURL;

    requester = new HttpRequester(
      'fetch' in NymphOptions ? NymphOptions.fetch : undefined
    );

    requester.on('request', (_requester, url, options) => {
      for (let i = 0; i < this.requestCallbacks.length; i++) {
        this.requestCallbacks[i] && this.requestCallbacks[i](url, options);
      }
    });

    requester.on('response', (_requester, response) => {
      for (let i = 0; i < this.responseCallbacks.length; i++) {
        this.responseCallbacks[i] && this.responseCallbacks[i](response);
      }
    });
  }

  public static async newUID(name: string) {
    const data = await requester.POST({
      url: this.restURL,
      dataType: 'text',
      data: { action: 'uid', data: name },
    });
    return Number(data);
  }

  public static async setUID(name: string, value: number) {
    return await requester.PUT({
      url: this.restURL,
      dataType: 'json',
      data: { action: 'uid', data: { name, value } },
    });
  }

  public static async getUID(name: string) {
    const data = await requester.GET({
      url: this.restURL,
      dataType: 'text',
      data: { action: 'uid', data: name },
    });
    return Number(data);
  }

  public static async deleteUID(name: string) {
    return await requester.DELETE({
      url: this.restURL,
      dataType: 'text',
      data: { action: 'uid', data: name },
    });
  }

  public static async saveEntity(entity: EntityInterface) {
    let method: 'POST' | 'PUT' = entity.guid == null ? 'POST' : 'PUT';
    return await this.requestWithMethod(entity, method, entity, false);
  }

  public static async saveEntities(entities: EntityInterface[]) {
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
            'update existing entities, not both at the same time.'
        );
      }
    });
    return await this.requestWithMethod(entities, method, entities, true);
  }

  public static async patchEntity(entity: EntityInterface) {
    if (entity.guid == null) {
      throw new InvalidRequestError(
        "You can't patch an entity that hasn't yet been saved."
      );
    }

    let patch = entity.$getPatch();
    return await this.requestWithMethod(entity, 'PATCH', patch, false);
  }

  public static async patchEntities(entities: EntityInterface[]) {
    if (!entities.length) {
      return Promise.resolve(false);
    }

    entities.forEach((cur) => {
      if (cur.guid == null) {
        throw new InvalidRequestError(
          'Due to REST restriction, you can only create new entities or ' +
            'update existing entities, not both at the same time.'
        );
      }
    });
    let patch = entities.map((e) => e.$getPatch());
    return await this.requestWithMethod(entities, 'PATCH', patch, true);
  }

  private static async requestWithMethod<T extends EntityInterface>(
    entity: T,
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    data: { [k: string]: any },
    plural: false
  ): Promise<T>;
  private static async requestWithMethod<T extends EntityInterface>(
    entity: T[],
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    data: { [k: string]: any },
    plural: true
  ): Promise<T[]>;
  private static async requestWithMethod<T extends EntityInterface>(
    entity: T | T[],
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    data: { [k: string]: any },
    plural: boolean
  ): Promise<T | T[]> {
    const response = await requester[method]({
      url: this.restURL,
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
          : e
      ) as T[];
    } else if (!Array.isArray(entity) && typeof response.guid !== 'undefined') {
      return entity.$init(response) as T;
    }
    throw new Error('Server error');
  }

  public static async getEntity<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string | null>;
  public static async getEntity<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T>,
    ...selectors: Selector[]
  ): Promise<ReturnType<T['factorySync']> | null>;
  public static async getEntity<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T> & { return: 'guid' },
    guid: string
  ): Promise<string | null>;
  public static async getEntity<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T>,
    guid: string
  ): Promise<ReturnType<T['factorySync']> | null>;
  public static async getEntity<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T>,
    ...selectors: Selector[] | string[]
  ): Promise<ReturnType<T['factorySync']> | string | null> {
    // @ts-ignore: Implementation signatures of overloads are not externally visible.
    const data = (await this.getEntityData(options, ...selectors)) as
      | EntityJson<T>
      | string
      | null;
    if (data != null) {
      if (options.return && options.return === 'guid') {
        return data as string;
      } else {
        return this.initEntity(data as EntityJson<T>);
      }
    }

    return null;
  }

  public static async getEntityData<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string | null>;
  public static async getEntityData<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T>,
    ...selectors: Selector[]
  ): Promise<EntityJson<T> | null>;
  public static async getEntityData<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T> & { return: 'guid' },
    guid: string
  ): Promise<string | null>;
  public static async getEntityData<
    T extends EntityConstructor = EntityConstructor
  >(options: Options<T>, guid: string): Promise<EntityJson<T> | null>;
  public static async getEntityData<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T>,
    ...selectors: Selector[] | string[]
  ): Promise<EntityJson<T> | string | null> {
    if (options.class === this.getEntityClass('Entity')) {
      throw new InvalidRequestError(
        "You can't make REST requests with the base Entity class."
      );
    }
    // Set up options and selectors.
    if (typeof selectors[0] === 'string') {
      selectors = [{ type: '&', guid: selectors[0] }];
    }
    const data = await requester.GET({
      url: this.restURL,
      dataType: 'json',
      data: {
        action: 'entity',
        data: [{ ...options, class: options.class.class }, ...selectors],
      },
    });

    if (typeof data.guid !== 'undefined') {
      return data;
    }
    return null;
  }

  public static async getEntities<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string[]>;
  public static async getEntities<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T>,
    ...selectors: Selector[]
  ): Promise<ReturnType<T['factorySync']>[]>;
  public static async getEntities<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T>,
    ...selectors: Selector[]
  ): Promise<ReturnType<T['factorySync']>[] | string[]> {
    const data = await requester.GET({
      url: this.restURL,
      dataType: 'json',
      data: {
        action: 'entities',
        data: [{ ...options, class: options.class.class }, ...selectors],
      },
    });

    if (options.return && options.return === 'guid') {
      return data;
    }
    return data.map((e: EntityJson<T>) => this.initEntity(e));
  }

  public static initEntity<T extends EntityConstructor = EntityConstructor>(
    entityJSON: EntityJson<T>
  ): ReturnType<T['factorySync']> {
    const EntityClass = this.getEntityClass(entityJSON.class);
    if (!EntityClass) {
      throw new ClassNotAvailableError(
        entityJSON.class + ' class cannot be found.'
      );
    }
    const entity = EntityClass.factorySync();
    return entity.$init(entityJSON) as ReturnType<T['factorySync']>;
  }

  public static initEntitiesFromData<T extends any>(item: T): T {
    if (Array.isArray(item)) {
      // Recurse into lower arrays.
      return item.map((entry) => this.initEntitiesFromData(entry)) as T;
    } else if (
      item instanceof Object &&
      !(item instanceof this.getEntityClass('Entity'))
    ) {
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

  public static async deleteEntity(
    entity: EntityInterface | EntityInterface[],
    _plural = false
  ) {
    return await requester.DELETE({
      url: this.restURL,
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

  public static async deleteEntities(entities: EntityInterface[]) {
    return await this.deleteEntity(entities, true);
  }

  public static async serverCall(
    entity: EntityInterface,
    method: string,
    params: any[],
    stateless = false
  ): Promise<ServerCallResponse> {
    const data = await requester.POST({
      url: this.restURL,
      dataType: 'json',
      data: {
        action: 'method',
        data: {
          entity,
          stateless,
          method,
          params: entitiesToReferences(params),
        },
      },
    });

    return {
      ...data,
      return: this.initEntitiesFromData(data.return),
    };
  }

  public static async serverCallStatic(
    className: string,
    method: string,
    params: any[]
  ): Promise<ServerCallStaticResponse> {
    const data = await requester.POST({
      url: this.restURL,
      dataType: 'json',
      data: {
        action: 'method',
        data: {
          class: className,
          static: true,
          method: method,
          params: entitiesToReferences(params),
        },
      },
    });

    return this.initEntitiesFromData(data);
  }

  public static on<T extends EventType>(
    event: T,
    callback: T extends 'request'
      ? RequestCallback
      : T extends 'response'
      ? ResponseCallback
      : never
  ) {
    const prop = (event + 'Callbacks') as T extends 'request'
      ? 'requestCallbacks'
      : T extends 'request'
      ? 'responseCallbacks'
      : never;
    if (!this.hasOwnProperty(prop)) {
      throw new Error('Invalid event type.');
    }
    // @ts-ignore: The callback should always be the right type here.
    this[prop].push(callback);
    return () => this.off(event, callback);
  }

  public static off<T extends EventType>(
    event: T,
    callback: T extends 'request'
      ? RequestCallback
      : T extends 'response'
      ? ResponseCallback
      : never
  ) {
    const prop = (event + 'Callbacks') as T extends 'request'
      ? 'requestCallbacks'
      : T extends 'request'
      ? 'responseCallbacks'
      : never;
    if (!this.hasOwnProperty(prop)) {
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

  public static setXsrfToken(token: string | null) {
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

if (
  this &&
  typeof (this as WindowOrWorkerGlobalScope & { NymphOptions: NymphOptions })
    .NymphOptions !== 'undefined'
) {
  Nymph.init(
    (this as WindowOrWorkerGlobalScope & { NymphOptions: NymphOptions })
      .NymphOptions
  );
}
