export type SortOptions = {
  /** Sort case sensitively. */
  caseSensitive?: boolean;
  /** Reverse the sort order. */
  reverse?: boolean;
  /** Options to pass to Intl.Collator for string comparisons. This overrides the caseSensitive options. */
  collatorOptions?: Intl.CollatorOptions;
  /** A custom comparator to use. This overrides all other options except reverse. */
  comparator?: (a: any, b: any) => number;
};

/**
 * Entity Array Sorter
 *
 * Sorting functions sort the array in place and also return the sorted array.
 */
export default class Sorter<Entity extends Object> {
  public array: (Entity & { [k: string]: any })[];
  private sortProperty: string | null = null;
  private sortParent: string | null = null;
  private collator: Intl.Collator = new Intl.Collator();
  private comparator: ((a: any, b: any) => number) | undefined = undefined;

  constructor(array: Entity[]) {
    this.array = array as (Entity & { [k: string]: any })[];
  }

  private _arraySortProperty(
    a: Entity & { [k: string]: any },
    b: Entity & { [k: string]: any }
  ) {
    const prop = this.sortProperty as string;
    const parent = this.sortParent as string;

    if (
      parent != null &&
      a[parent] instanceof Object &&
      b[parent] instanceof Object
    ) {
      const aParentProp = a[parent][prop];
      const bParentProp = b[parent][prop];
      if (
        typeof aParentProp !== 'undefined' ||
        typeof bParentProp !== 'undefined'
      ) {
        if (this.comparator != null) {
          const result = this.comparator(aParentProp, bParentProp);
          if (result !== 0) {
            return result;
          }
        } else if (
          typeof aParentProp === 'string' &&
          typeof bParentProp === 'string'
        ) {
          const result = this.collator.compare(aParentProp, bParentProp);
          if (result !== 0) {
            return result;
          }
        } else if (aParentProp > bParentProp) {
          return 1;
        } else if (aParentProp < bParentProp) {
          return -1;
        }
      }
    }

    // If they have the same parent, order them by their own prop.
    const aProp = a[prop];
    const bProp = b[prop];
    if (this.comparator != null) {
      return this.comparator(aProp, bProp);
    } else if (typeof aProp === 'string' && typeof bProp === 'string') {
      return this.collator.compare(aProp, bProp);
    } else if (aProp > bProp) {
      return 1;
    } else if (aProp < bProp) {
      return -1;
    }
    return 0;
  }

  /**
   * Sort an array of entities hierarchically by a specified property's value.
   *
   * Entities will be placed immediately after their parents. The
   * `parentProperty` property, if present, should hold either null, undefined,
   * or the entity's parent.
   *
   * @param property The name of the property to sort entities by.
   * @param parentProperty The name of the property which holds the parent of the entity.
   */
  public hsort(
    property: string,
    parentProperty: string,
    sortOptions?: SortOptions
  ): Entity[] {
    // First sort by the requested property.
    this.sort(property, sortOptions);
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
          !(parentProperty in this.array[key]) ||
          this.array[key][parentProperty] == null ||
          typeof this.array[key][parentProperty].$inArray !== 'function' ||
          !this.array[key][parentProperty].$inArray([
            ...newArray,
            ...this.array,
          ])
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
            let newKey = pkey;
            while (
              newKey + 1 < newArray.length &&
              parentProperty in newArray[newKey + 1] &&
              newArray[newKey + 1][parentProperty] != null &&
              ancestry.indexOf(newArray[newKey + 1][parentProperty].guid) !== -1
            ) {
              ancestry.push(newArray[newKey + 1].guid);
              newKey += 1;
            }
            // Where to place the entity.
            newKey += 1;
            if (newKey < newArray.length) {
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

  /**
   * Sort an array of entities by parent and a specified property's value.
   *
   * Entities' will be sorted by their parents' properties, then the entities'
   * properties.
   *
   * @param property The name of the property to sort entities by.
   * @param parentProperty The name of the property which holds the parent of the entity.
   */
  public psort(
    property: string,
    parentProperty: string,
    {
      caseSensitive = false,
      reverse = false,
      collatorOptions = undefined,
      comparator = undefined,
    }: SortOptions = {}
  ): Entity[] {
    // Sort by the requested property.
    this.sortProperty = property;
    this.sortParent = parentProperty;
    this.collator = new Intl.Collator(
      undefined,
      collatorOptions || {
        sensitivity: caseSensitive ? 'case' : 'base',
        caseFirst: 'false',
      }
    );
    this.comparator = comparator;
    this.array.sort(this._arraySortProperty.bind(this));
    if (reverse) {
      this.array.reverse();
    }
    return this.array as Entity[];
  }

  /**
   * Sort an array of entities by a specified property's value.
   *
   * @param property The name of the property to sort entities by.
   */
  public sort(
    property: string,
    {
      caseSensitive = false,
      reverse = false,
      collatorOptions = undefined,
      comparator = undefined,
    }: SortOptions = {}
  ): Entity[] {
    // Sort by the requested property.
    this.sortProperty = property;
    this.sortParent = null;
    this.collator = new Intl.Collator(
      undefined,
      collatorOptions || {
        sensitivity: caseSensitive ? 'case' : 'base',
      }
    );
    this.comparator = comparator;
    this.array.sort(this._arraySortProperty.bind(this));
    if (reverse) {
      this.array.reverse();
    }
    return this.array as Entity[];
  }
}
