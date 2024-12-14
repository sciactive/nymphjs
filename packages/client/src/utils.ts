import { EntityReference } from './Entity.types.js';
import Nymph from './Nymph.js';
import Entity from './Entity.js';

export function uniqueStrings(array: string[]) {
  const obj: { [k: string]: true } = {};
  for (let i = 0; i < array.length; ++i) {
    obj[array[i]] = true;
  }
  return Object.keys(obj);
}

export function entityConstructorsToClassNames(item: any): any {
  if (
    typeof item === 'function' &&
    item.prototype instanceof Entity &&
    typeof item.class === 'string'
  ) {
    // Convert entity classes to strings.
    return item.class;
  } else if (Array.isArray(item)) {
    // Recurse into lower arrays.
    return item.map((entry) => entityConstructorsToClassNames(entry));
  } else if (item instanceof Object) {
    let newObj = Object.create(item);
    for (let [key, value] of Object.entries(item)) {
      newObj[key] = entityConstructorsToClassNames(value);
    }
    return newObj;
  }
  // Not an entity or array, just return it.
  return item;
}

export function entitiesToReferences(item: any): any {
  if (item instanceof Entity && typeof item.$toReference === 'function') {
    // Convert entities to references.
    return item.$toReference();
  } else if (Array.isArray(item)) {
    // Recurse into lower arrays.
    return item.map((entry) => entitiesToReferences(entry));
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

export function referencesToEntities(item: any, nymph: Nymph): any {
  if (Array.isArray(item)) {
    // Check if it's a reference.
    if (item[0] === 'nymph_entity_reference') {
      try {
        const EntityClass = nymph.getEntityClass(item[2]);
        return EntityClass.factoryReference(item as EntityReference);
      } catch (e: any) {
        return item;
      }
    } else {
      // Recurse into lower arrays.
      return item.map((item) => referencesToEntities(item, nymph));
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
  const tempArray: (keyof typeof obj)[] = Object.keys(obj);
  tempArray.sort();
  for (let i = 0; i < tempArray.length; i++) {
    const temp = obj[tempArray[i]];
    delete obj[tempArray[i]];
    obj[tempArray[i]] = temp;
  }
  return obj;
}
