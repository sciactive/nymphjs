import { EntityConstructor, EntityInterface } from './Entity.types.js';

export default class EntityWeakCache {
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

  set(EntityClass: EntityConstructor, entity: EntityInterface) {
    if (!entity.guid) {
      return;
    }

    const weakRef = new WeakRef(entity);

    const classMap = this.references.get(EntityClass) || {};
    this.references.set(EntityClass, classMap);
    classMap[entity.guid] = weakRef;
  }
}
