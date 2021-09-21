import { EntityReference } from './Entity.types';
import { Nymph } from './Nymph';

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

export function entitiesToReferences(item: any, nymph: Nymph): any {
  const EntityClass = nymph.getEntityClass('Entity');

  if (item instanceof EntityClass && typeof item.$toReference === 'function') {
    // Convert entities to references.
    return item.$toReference();
  } else if (Array.isArray(item)) {
    // Recurse into lower arrays.
    return item.map((entry) => entitiesToReferences(entry, nymph));
  } else if (item instanceof Object) {
    let newObj = Object.create(item);
    for (let [key, value] of Object.entries(item)) {
      newObj[key] = entitiesToReferences(value, nymph);
    }
    return newObj;
  }
  // Not an entity or array, just return it.
  return item;
}

export function referencesToEntities(
  item: any,
  nymph: Nymph,
  useSkipAc = false
): any {
  const Entity = nymph.getEntityClass('Entity');

  if (Array.isArray(item)) {
    // Check if it's a reference.
    if (item[0] === 'nymph_entity_reference') {
      try {
        const EntityClass = nymph.getEntityClass(item[2]);
        const entity = EntityClass.factoryReference(item as EntityReference);
        entity.$useSkipAc(useSkipAc);
        entity.$nymph = nymph;
        return entity;
      } catch (e: any) {
        return item;
      }
    } else {
      // Recurse into lower arrays.
      return item.map((entry) => referencesToEntities(entry, nymph, useSkipAc));
    }
  } else if (Entity && item instanceof Object && !(item instanceof Entity)) {
    for (let [key, value] of Object.entries(item)) {
      item[key] = referencesToEntities(value, nymph);
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
