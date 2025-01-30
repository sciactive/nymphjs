import Entity from './Entity.js';
import { EntityReference } from './Entity.types.js';
import Nymph from './Nymph.js';
import { Options, Selector } from './Nymph.types.js';

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

export function classNamesToEntityConstructors(
  nymph: Nymph,
  selectors: Selector[],
  enforceRestEnabledFlag = false,
): Selector[] {
  const newSelectors: Selector[] = [];

  for (const curSelector of selectors) {
    const newSelector: Selector = { type: curSelector.type };

    for (const k in curSelector) {
      const key = k as keyof Selector;
      const value = curSelector[key];

      if (key === 'type') {
        continue;
      }

      if (value === undefined) {
        continue;
      }

      if (key === 'qref' || key === '!qref') {
        const tmpArr = (
          Array.isArray(((value as Selector['qref']) ?? [])[0])
            ? value
            : [value]
        ) as [string, [Options, ...Selector[]]][];
        for (let i = 0; i < tmpArr.length; i++) {
          const name = tmpArr[i][0];
          const [qrefOptions, ...selectors] = tmpArr[i][1];
          const QrefEntityClass = qrefOptions.class
            ? nymph.getEntityClass(qrefOptions.class)
            : nymph.getEntityClass('Entity');
          if (enforceRestEnabledFlag && !QrefEntityClass.restEnabled) {
            throw new Error('Not accessible.');
          }
          const options = { ...qrefOptions, class: QrefEntityClass };
          if (!newSelector[key]) {
            newSelector[key] = [];
          }
          (newSelector[key] as [string, [Options, ...Selector[]]][]).push([
            name,
            [
              options,
              ...classNamesToEntityConstructors(
                nymph,
                selectors,
                enforceRestEnabledFlag,
              ),
            ],
          ]);
        }
      } else if (key === 'selector' || key === '!selector') {
        const tmpArr = (Array.isArray(value) ? value : [value]) as Selector[];
        newSelector[key] = classNamesToEntityConstructors(
          nymph,
          tmpArr,
          enforceRestEnabledFlag,
        );
      } else {
        // @ts-ignore: ts doesn't know what value is here.
        newSelector[key] = value;
      }
    }

    newSelectors.push(newSelector);
  }

  return newSelectors;
}

export function entitiesToReferences(item: any): any {
  if (item == null || Buffer.isBuffer(item) || ArrayBuffer.isView(item)) {
    return item;
  } else if (
    item instanceof Entity &&
    typeof item.$toReference === 'function'
  ) {
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

export function referencesToEntities(
  item: any,
  nymph: Nymph,
  useSkipAc = false,
): any {
  if (item == null || Buffer.isBuffer(item) || ArrayBuffer.isView(item)) {
    return item;
  } else if (Array.isArray(item)) {
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
