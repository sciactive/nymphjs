import { EntityConstructor, EntityInterface } from './Entity.types.js';

export class EntityWeakCache {
  private references: WeakMap<
    EntityConstructor,
    { [k: string]: WeakRef<EntityInterface> }
  > = new WeakMap();

  get(EntityClass: EntityConstructor, guid: string): EntityInterface | null {
    const classMap = this.references.get(EntityClass);
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
    if (!entity.guid) {
      return entity;
    }

    const weakRef = new WeakRef(entity);
    const classMap = this.references.get(EntityClass) || {};
    if (entity.guid in classMap) {
      const deref = classMap[entity.guid] && classMap[entity.guid].deref();
      if (deref != null) {
        return deref;
      }
    }
    this.references.set(EntityClass, classMap);
    classMap[entity.guid] = weakRef;
    return entity;
  }
}
