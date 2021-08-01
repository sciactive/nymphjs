import { EntityReference } from './Entity.d';
import { default as Nymph } from './Nymph';

export function xor(a: any, b: any): boolean {
  return !!(a && !b) || (!a && b);
}

export function uniqueStrings(array: string[]) {
  const obj: { [k: string]: true } = {};
  for (let i = 0; i < array.length; ++i) {
    obj[array[i]] = true;
  }
  return Object.keys(obj);
}

export function entitiesToReferences(item: any): any {
  const EntityClass = Nymph.getEntityClass('Entity');

  if (item instanceof EntityClass && typeof item.$toReference === 'function') {
    // Convert entities to references.
    return item.$toReference();
  } else if (Array.isArray(item)) {
    // Recurse into lower arrays.
    return item.map(entitiesToReferences);
  } else if (item instanceof Object) {
    let newObj = Object.create(item);
    for (let [key, value] of Object.entries(item)) {
      newObj[key] = entitiesToReferences(value);
    }
    return newObj;
  }
  // Not an entity or array, just return it.
  return item;
}

export function referencesToEntities(item: any, useSkipAc = false): any {
  const EntityClass = Nymph.getEntityClass('Entity');

  if (Array.isArray(item)) {
    // Check if it's a reference.
    if (item[0] === 'nymph_entity_reference') {
      try {
        const EntityClass = Nymph.getEntityClass(item[2]);
        const entity = new EntityClass();
        entity.$referenceSleep(item as EntityReference);
        entity.$useSkipAc(useSkipAc);
        return entity;
      } catch (e) {
        return item;
      }
    } else {
      // Recurse into lower arrays.
      return item.map((item) => referencesToEntities(item, useSkipAc));
    }
  } else if (
    EntityClass &&
    item instanceof Object &&
    !(item instanceof EntityClass)
  ) {
    for (let [key, value] of Object.entries(item)) {
      item[key] = referencesToEntities(value);
    }
  }
  // Not an array, just return it.
  return item;
}

export function sortObj<T extends { [k: string]: any }>(obj: T): T {
  // adapted from
  // http://am.aurlien.net/post/1221493460/sorting-javascript-objects
  const tempArray = Object.keys(obj);
  tempArray.sort();
  for (let i = 0; i < tempArray.length; i++) {
    const temp = obj[tempArray[i]];
    delete obj[tempArray[i]];
    // @ts-ignore: string can't be used to index type T?? yes, it can.
    obj[tempArray[i]] = temp;
  }
  return obj;
}
