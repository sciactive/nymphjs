import { guid } from '@nymphjs/guid';

import type Nymph from './Nymph';
import { EntityConstructor, EntityInterface, EntityJson } from './Entity.types';
import { Options, Selector } from './Nymph.types';
import { ClassNotAvailableError } from './errors';
import Entity from './Entity';

const entities: { [k: string]: EntityJson } = {};

export class MockNymphDriver {
  private nymph: MockNymph;

  public constructor(nymph: MockNymph) {
    this.nymph = nymph;
  }

  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    ...selectors: Selector[]
  ): Promise<ReturnType<T['factorySync']> | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    guid: string,
  ): Promise<string | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    guid: string,
  ): Promise<ReturnType<T['factorySync']> | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> = {},
    ...selectors: Selector[] | string[]
  ): Promise<ReturnType<T['factorySync']> | string | null> {
    const guid =
      typeof selectors[0] === 'string' ? selectors[0] : selectors[0].guid;
    if (!options || !guid || typeof guid !== 'string' || !(guid in entities)) {
      return null;
    }

    const entity: EntityInterface = (
      (options.class as T) ?? this.nymph.getEntityClass('Entity')
    ).factorySync();
    const entityJson = entities[guid];
    entity.guid = guid;
    entity.cdate = entityJson.cdate;
    entity.mdate = entityJson.mdate;
    entity.tags = entityJson.tags;
    entity.$putData(entityJson.data, {});

    return entity as ReturnType<T['factorySync']>;
  }
}

export class MockNymph {
  private entityClasses: { [k: string]: EntityConstructor } = {};
  public driver: MockNymphDriver;
  public Tilmeld: any = undefined;
  public Entity: typeof Entity;

  public constructor() {
    this.driver = new MockNymphDriver(this);

    // class NymphEntity extends Entity {}
    this.Entity = this.addEntityClass(Entity);
  }

  public addEntityClass<T extends EntityConstructor>(entityClass: T): T {
    const nymph = this;
    class NymphEntity extends entityClass {
      static nymph: Nymph = nymph as unknown as Nymph;

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

  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    ...selectors: Selector[]
  ): Promise<ReturnType<T['factorySync']> | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    guid: string,
  ): Promise<string | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    guid: string,
  ): Promise<ReturnType<T['factorySync']> | null>;
  public async getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> = {},
    ...selectors: Selector[] | string[]
  ): Promise<ReturnType<T['factorySync']> | string | null> {
    // @ts-ignore: The selector type is correct here.
    return await this.driver.getEntity(options, ...selectors);
  }

  public async saveEntity(entity: EntityInterface): Promise<boolean> {
    const className = (entity.constructor as any).class as string;

    if (entity.guid == null) {
      entity.guid = guid();
      entity.cdate = Date.now();
    } else if (
      entity.guid in entities &&
      (entity.mdate ?? 0) < (entities[entity.guid].mdate ?? 0)
    ) {
      return false;
    }

    entity.mdate = Date.now();

    const entityJson: EntityJson = {
      class: className,
      guid: entity.guid,
      cdate: entity.cdate,
      mdate: entity.mdate,
      tags: [...entity.tags],
      data: JSON.parse(JSON.stringify(entity.$getData(true))),
    };

    entities[entity.guid] = entityJson;
    return true;
  }

  public async deleteEntity(entity: EntityInterface): Promise<boolean> {
    if (entity.guid != null && entity.guid in entities) {
      delete entities[entity.guid];
      return true;
    }
    return false;
  }
}
