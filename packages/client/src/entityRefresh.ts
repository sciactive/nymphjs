import Entity from './Entity';

// Save referenced entities in an entity's data.
export function saveEntities(entity: Entity) {
  let savedEntities = {};

  // @ts-ignore: Accessing a protected property.
  for (let [_key, value] of Object.entries(entity.$dataStore)) {
    addEntitiesToObject(value, savedEntities);
  }

  return savedEntities;
}

const addEntitiesToObject = (
  item: any,
  entitiesObject: { [k: string]: Entity }
) => {
  // @ts-ignore: Accessing a private property.
  if (item instanceof Entity && !item.$isASleepingReference) {
    // Convert entities to references.
    if (item.guid) {
      entitiesObject[item.guid] = item;
    }
  } else if (Array.isArray(item)) {
    // Recurse into lower arrays.
    item.forEach((item) => addEntitiesToObject(item, entitiesObject));
  } else if (item instanceof Object) {
    for (let [_key, value] of Object.entries(item)) {
      addEntitiesToObject(value, entitiesObject);
    }
  }
};

// Restore referenced entities into an entity's data.
// Returns true if there are any sleeping references still in the entity's data
// after the restore.
export function restoreEntities(
  entity: Entity,
  savedEntities: { [k: string]: Entity }
) {
  let data: { containsSleepingReference: boolean } = {
    containsSleepingReference: false,
  };

  // @ts-ignore: Accessing a protected property.
  for (let [key, value] of Object.entries(entity.$dataStore)) {
    // @ts-ignore: Accessing a protected property.
    entity.$dataStore[key] = retoreEntitiesFromObject(
      value,
      savedEntities,
      data
    );
  }

  return data.containsSleepingReference;
}

const retoreEntitiesFromObject = <T extends any>(
  item: T,
  entitiesObject: { [k: string]: Entity },
  data: { containsSleepingReference: boolean }
): T => {
  if (item instanceof Entity) {
    // @ts-ignore: Accessing a private property.
    if (item.$isASleepingReference) {
      if (item.guid && entitiesObject.hasOwnProperty(item.guid)) {
        return entitiesObject[item.guid] as T;
      } else {
        // Couldn't find the entity in saved entities.
        data.containsSleepingReference = true;
        return item;
      }
    } else {
      // Leave entities alone.
      return item;
    }
  } else if (Array.isArray(item)) {
    // Recurse into lower arrays.
    return item.map((item) =>
      retoreEntitiesFromObject(item, entitiesObject, data)
    ) as T;
  } else if (item instanceof Object) {
    for (let [key, value] of Object.entries(item)) {
      // @ts-ignore: The key comes from the object. It can definitely be used to index it.
      item[key] = retoreEntitiesFromObject(value, entitiesObject, data);
    }
    return item;
  }
  // Not an array, just return it.
  return item;
};
