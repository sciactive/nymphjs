export default class EntitySorter<
  Entity extends new () => Object,
  Nymph extends {
    getEntityClass(className: string): Entity;
  }
> {
  private array: (Entity & { [k: string]: any })[];
  private sortProperty: string | null = null;
  private sortParent: string | null = null;
  private sortCaseSensitive: boolean | null = null;

  private nymph: Nymph;

  constructor(array: Entity[], nymph: Nymph) {
    this.array = array as (Entity & { [k: string]: any })[];
    this.nymph = nymph;
  }

  private _arraySortProperty(
    a: Entity & { [k: string]: any },
    b: Entity & { [k: string]: any }
  ) {
    let prop = this.sortProperty as string;
    let parent = this.sortParent as string;
    const Entity = this.nymph.getEntityClass('Entity');
    if (
      parent != null &&
      a[parent] instanceof Entity &&
      b[parent] instanceof Entity
    ) {
      const aParentProp = a[parent][prop];
      const bParentProp = b[parent][prop];
      if (
        typeof aParentProp !== 'undefined' ||
        typeof bParentProp !== 'undefined'
      ) {
        if (
          !this.sortCaseSensitive &&
          typeof aParentProp === 'string' &&
          typeof bParentProp === 'string'
        ) {
          const asort = aParentProp.toUpperCase();
          const bsort = bParentProp.toUpperCase();
          if (asort !== bsort) {
            return asort.localeCompare(bsort);
          }
        } else {
          if (aParentProp > bParentProp) {
            return 1;
          }
          if (aParentProp < bParentProp) {
            return -1;
          }
        }
      }
    }
    // If they have the same parent, order them by their own prop.
    const aProp = a[prop];
    const bProp = b[prop];
    if (
      !this.sortCaseSensitive &&
      typeof aProp === 'string' &&
      typeof bProp === 'string'
    ) {
      const asort = aProp.toUpperCase();
      const bsort = bProp.toUpperCase();
      return asort.localeCompare(bsort);
    } else {
      if (aProp > bProp) {
        return 1;
      }
      if (aProp < bProp) {
        return -1;
      }
    }
    return 0;
  }

  public hsort(
    property: string,
    parentProperty: string,
    caseSensitive = false,
    reverse = false
  ) {
    // First sort by the requested property.
    this.sort(property, caseSensitive, reverse);
    if (typeof parentProperty === 'undefined' || parentProperty === null) {
      return this.array;
    }

    // Now sort by children.
    let newArray: (Entity & { [k: string]: any })[] = [];
    // Look for entities ready to go in order.
    let changed: boolean;
    while (this.array.length) {
      changed = false;
      for (let key = 0; key < this.array.length; key++) {
        // Must break after adding one, so any following children don't go in
        // the wrong order.
        if (
          this.array[key][parentProperty] == null ||
          typeof this.array[key][parentProperty].$inArray !== 'function' ||
          !this.array[key][parentProperty].$inArray(newArray.concat(this.array))
        ) {
          // If they have no parent (or their parent isn't in the array), they
          // go on the end.
          newArray.push(this.array[key]);
          this.array.splice(key, 1);
          changed = true;
          break;
        } else if (
          typeof this.array[key][parentProperty].$arraySearch === 'function'
        ) {
          // Else find the parent.
          const pkey = this.array[key][parentProperty].$arraySearch(newArray);
          if (pkey !== -1) {
            // And insert after the parent.
            // This makes entities go to the end of the child list.
            const ancestry = [this.array[key][parentProperty].guid];
            let newKey = Number(pkey);
            while (
              typeof newArray[newKey + 1] !== 'undefined' &&
              newArray[newKey + 1][parentProperty] != null &&
              ancestry.indexOf(newArray[newKey + 1][parentProperty].guid) !== -1
            ) {
              ancestry.push(newArray[newKey + 1].guid);
              newKey += 1;
            }
            // Where to place the entity.
            newKey += 1;
            if (typeof newArray[newKey] !== 'undefined') {
              // If it already exists, we have to splice it in.
              newArray.splice(newKey, 0, this.array[key]);
            } else {
              // Else just add it.
              newArray.push(this.array[key]);
            }
            this.array.splice(key, 1);
            changed = true;
            break;
          }
        }
      }
      if (!changed) {
        // If there are any unexpected errors and the array isn't changed, just
        // stick the rest on the end.
        if (this.array.length) {
          newArray = newArray.concat(this.array);
          this.array.splice(0, this.array.length);
        }
      }
    }
    // Now push the new array out.
    this.array.splice(0, 0, ...newArray);
    return this.array as Entity[];
  }

  public psort(
    property: string,
    parentProperty: string,
    caseSensitive = false,
    reverse = false
  ) {
    // Sort by the requested property.
    this.sortProperty = property;
    this.sortParent = parentProperty;
    this.sortCaseSensitive = !!caseSensitive;
    this.array.sort(this._arraySortProperty.bind(this));
    if (reverse) {
      this.array.reverse();
    }
    return this.array as Entity[];
  }

  public sort(property: string, caseSensitive = false, reverse = false) {
    // Sort by the requested property.
    this.sortProperty = property;
    this.sortParent = null;
    this.sortCaseSensitive = !!caseSensitive;
    this.array.sort(this._arraySortProperty.bind(this));
    if (reverse) {
      this.array.reverse();
    }
    return this.array as Entity[];
  }
}
