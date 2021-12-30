import { EntityConstructor, EntityInterface } from './Entity.types';

export default class EntityWeakCache {
  private references: WeakMap<EntityConstructor, { [k: string]: any }> =
    new WeakMap();

  get(EntityClass: EntityConstructor, guid: string): EntityInterface | null {
    const classMap = this.references.get(EntityClass);
    if (classMap && guid in classMap) {
      const weakRef = classMap[guid];
      if (weakRef && weakRef.deref() != null) {
        return weakRef.deref();
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

    // @ts-ignore TS doesn't know about WeakRef.
    const weakRef = new WeakRef(entity);

    const classMap = this.references.get(EntityClass) || {};
    this.references.set(EntityClass, classMap);
    classMap[entity.guid] = weakRef;
  }
}
