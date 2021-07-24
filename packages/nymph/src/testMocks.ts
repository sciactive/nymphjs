import { EntityInterface, EntityJson } from './Entity.d';
import { Options, Selector } from './Nymph.d';
import newGUID from './newGUID';

export class MockNymph {
  private static entities: { [k: string]: EntityJson } = {};
  public static entityClasses: { [k: string]: new () => EntityInterface } = {};
  public static Tilmeld: any = undefined;

  public static setEntityClass(
    className: string,
    entityClass: new () => EntityInterface
  ) {
    this.entityClasses[className] = entityClass;
  }

  public static getEntityClass(
    className: string
  ): (new () => EntityInterface) | null {
    if (className in this.entityClasses) {
      return this.entityClasses[className];
    }
    return null;
  }

  public static saveEntity(entity: EntityInterface): boolean {
    const className = (entity.constructor as any).class as string;

    if (entity.guid == null) {
      entity.guid = newGUID();
      entity.cdate = Date.now();
    } else if (
      entity.guid in this.entities &&
      entity.mdate < (this.entities[entity.guid].mdate ?? 0)
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

    this.entities[entity.guid] = entityJson;
    return true;
  }

  public static getEntity<
    T extends new () => EntityInterface = new () => EntityInterface
  >(options?: Options<T>, ...selectors: Selector[]): InstanceType<T> | null {
    const guid = selectors[0].guid;
    if (
      !options ||
      !guid ||
      typeof guid !== 'string' ||
      !(guid in this.entities)
    ) {
      return null;
    }

    const entity: EntityInterface = (
      (options.class as T & { factory(): InstanceType<T> }) ??
      this.getEntityClass('Entity')
    ).factory();
    const entityJson = this.entities[guid];
    entity.guid = guid;
    entity.cdate = entityJson.cdate;
    entity.mdate = entityJson.mdate;
    entity.tags = entityJson.tags;
    entity.$putData(entityJson.data, {});

    return entity as InstanceType<T>;
  }

  public static deleteEntity(entity: EntityInterface): boolean {
    if (entity.guid != null && entity.guid in this.entities) {
      delete this.entities[entity.guid];
      return true;
    }
    return false;
  }
}
