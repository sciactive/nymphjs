import { EntityConstructor, EntityInterface } from './Entity.types.js';

export class EntityWeakCache {
  private references: Map<string, { [k: string]: WeakRef<EntityInterface> }> =
    new Map();

  get(EntityClass: EntityConstructor, guid: string): EntityInterface | null {
    const classMap = this.references.get(EntityClass.class);
    if (classMap && guid in classMap) {
      const weakRef = classMap[guid];
      const deref = weakRef && weakRef.deref();
      if (deref != null) {
        return deref;
      } else {
        delete classMap[guid];
      }
    }
    return null;
  }

  set<T extends EntityInterface = EntityInterface>(
    EntityClass: EntityConstructor,
    entity: T,
  ) {
    if (entity.guid == null) {
      return entity;
    }

    const weakRef = new WeakRef(entity);
    const classMap = this.references.get(EntityClass.class) || {};
    if (entity.guid in classMap) {
      const weakRef = classMap[entity.guid];
      const deref = weakRef && weakRef.deref();
      if (deref != null) {
        return deref as T;
      }
    }
    classMap[entity.guid] = weakRef;
    this.references.set(EntityClass.class, classMap);
    return entity;
  }
}
