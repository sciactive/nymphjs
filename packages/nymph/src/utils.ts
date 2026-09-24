import Entity from './Entity.js';
import { EntityReference } from './Entity.types.js';
import Nymph from './Nymph.js';

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

export function entityConstructorsToClassNames(item: any): any {
  if (item == null || Buffer.isBuffer(item) || ArrayBuffer.isView(item)) {
    return item;
  } else if (typeof item === 'function' && item.prototype instanceof Entity) {
    // Convert entity classes to class references.
    return ['nymph_class_reference', item.class];
  } else if (item instanceof Entity) {
    // Don't touch entities.
    return item;
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

export function classNamesToEntityConstructors<T extends any>(
  nymph: Nymph,
  item: T,
  enforceRestEnabledFlag = false,
): T {
  if (item == null || Buffer.isBuffer(item) || ArrayBuffer.isView(item)) {
    return item;
  } else if (
    Array.isArray(item) &&
    item.length === 2 &&
    item[0] === 'nymph_class_reference' &&
    typeof item[1] === 'string'
  ) {
    // Convert class references to entity classes.
    const EntityClass = nymph.getEntityClass(item[1]);
    if (enforceRestEnabledFlag && !EntityClass.restEnabled) {
      throw new Error('Not accessible.');
    }
    return EntityClass as T;
  } else if (item instanceof Entity) {
    // Don't touch entities.
    return item;
  } else if (typeof item === 'function' && item.prototype instanceof Entity) {
    // Don't touch Entity classes.
    return item;
  } else if (Array.isArray(item)) {
    // Recurse into lower arrays.
    return item.map((entry) =>
      classNamesToEntityConstructors(nymph, entry, enforceRestEnabledFlag),
    ) as T;
  } else if (item instanceof Object) {
    let newObj = Object.create(item);
    for (let [key, value] of Object.entries(item)) {
      newObj[key] = classNamesToEntityConstructors(
        nymph,
        value,
        enforceRestEnabledFlag,
      );
    }
    return newObj;
  }
  // Not an entity or array, just return it.
  return item;
}

export function entitiesToReferences(item: any, existingOnly?: boolean): any {
  if (item == null || Buffer.isBuffer(item) || ArrayBuffer.isView(item)) {
    return item;
  } else if (item instanceof Entity) {
    // Convert entities to references.
    return item.$toReference(existingOnly);
  } else if (typeof item === 'function' && item.prototype instanceof Entity) {
    // Don't touch Entity classes.
    return item;
  } else if (Array.isArray(item)) {
    // Recurse into lower arrays.
    return item.map((entry) => entitiesToReferences(entry, existingOnly));
  } else if (item instanceof Object) {
    let newObj = Object.create(item);
    for (let [key, value] of Object.entries(item)) {
      newObj[key] = entitiesToReferences(value, existingOnly);
    }
    return newObj;
  }
  // Not an entity or array, just return it.
  return item;
}

export function referencesToEntities(
  item: any,
  nymph: Nymph,
  useSkipAc = false,
  enforceRestEnabledFlag = false,
): any {
  if (item == null || Buffer.isBuffer(item) || ArrayBuffer.isView(item)) {
    return item;
  } else if (Array.isArray(item)) {
    // Check if it's a reference.
    if (item[0] === 'nymph_entity_reference') {
      try {
        const EntityClass = nymph.getEntityClass(item[2]);
        if (enforceRestEnabledFlag && !EntityClass.restEnabled) {
          throw new Error('Not accessible.');
        }
        const entity = EntityClass.factoryReference(item as EntityReference);
        entity.$useSkipAc(useSkipAc);
        entity.$nymph = nymph;
        return entity;
      } catch (e: any) {
        return item;
      }
    } else {
      // Recurse into lower arrays.
      return item.map((entry) =>
        referencesToEntities(entry, nymph, useSkipAc, enforceRestEnabledFlag),
      );
    }
  } else if (item instanceof Entity) {
    // Don't touch entities.
    return item;
  } else if (typeof item === 'function' && item.prototype instanceof Entity) {
    // Don't touch Entity classes.
    return item;
  } else if (item instanceof Object) {
    let newObj = Object.create(item);
    for (let [key, value] of Object.entries(item)) {
      newObj[key] = referencesToEntities(
        value,
        nymph,
        useSkipAc,
        enforceRestEnabledFlag,
      );
    }
    return newObj;
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
