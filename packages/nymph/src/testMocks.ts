import { EntityConstructor, EntityInterface, EntityJson } from './Entity.d';
import { Options, Selector } from './Nymph.d';
import newGUID from './newGUID';
import { ClassNotAvailableError } from './errors';

const entities: { [k: string]: EntityJson } = {};

export class MockNymphDriver {
  public getEntitySync<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): string | null;
  public getEntitySync<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    ...selectors: Selector[]
  ): ReturnType<T['factory']> | null;
  public getEntitySync<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    guid: string
  ): string | null;
  public getEntitySync<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    guid: string
  ): ReturnType<T['factory']> | null;
  public getEntitySync<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> = {},
    ...selectors: Selector[] | string[]
  ): ReturnType<T['factory']> | string | null {
    const guid =
      typeof selectors[0] === 'string' ? selectors[0] : selectors[0].guid;
    if (!options || !guid || typeof guid !== 'string' || !(guid in entities)) {
      return null;
    }

    const entity: EntityInterface = (
      (options.class as T) ?? MockNymph.getEntityClass('Entity')
    ).factory();
    const entityJson = entities[guid];
    entity.guid = guid;
    entity.cdate = entityJson.cdate;
    entity.mdate = entityJson.mdate;
    entity.tags = entityJson.tags;
    entity.$putData(entityJson.data, {});

    return entity as ReturnType<T['factory']>;
  }
}

export class MockNymph {
  public static entityClasses: { [k: string]: EntityConstructor } = {};
  public static driver = new MockNymphDriver();
  public static Tilmeld: any = undefined;

  public static setEntityClass(
    className: string,
    entityClass: EntityConstructor
  ) {
    this.entityClasses[className] = entityClass;
  }

  public static getEntityClass(className: string): EntityConstructor {
    if (className in this.entityClasses) {
      return this.entityClasses[className];
    }
    throw new ClassNotAvailableError('Tried to use class: ' + className);
  }

  public static async saveEntity(entity: EntityInterface): Promise<boolean> {
    const className = (entity.constructor as any).class as string;

    if (entity.guid == null) {
      entity.guid = newGUID();
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

  public static async deleteEntity(entity: EntityInterface): Promise<boolean> {
    if (entity.guid != null && entity.guid in entities) {
      delete entities[entity.guid];
      return true;
    }
    return false;
  }
}
