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
    b: Entity & { [k: string]: any },
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
    {
      caseSensitive = false,
      reverse = false,
      collatorOptions = undefined,
      comparator = undefined,
    }: SortOptions = {},
  ): Entity[] {
    if (typeof parentProperty === 'undefined' || parentProperty === null) {
      // Just sort by the requested property.
      this.sort(property, {
        caseSensitive,
        reverse,
        collatorOptions,
        comparator,
      });
      return this.array;
    }

    this.sortProperty = property;
    this.sortParent = null;
    this.collator = new Intl.Collator(
      undefined,
      collatorOptions || {
        sensitivity: caseSensitive ? 'case' : 'base',
      },
    );
    this.comparator = comparator;
    const sort = (array: Entity[]) => {
      // Sort by the requested property.
      array.sort(this._arraySortProperty.bind(this));
      if (reverse) {
        array.reverse();
      }
      return array;
    };

    // Pick out all of the children.
    const guidEntries: { [k: string]: Entity[] } = {};
    const newEntries = new Map<Entity, Entity[]>();

    // There is no incrementor in this for loop on purpose. It is incremented
    // conditionally.
    for (let i = 0; i < this.array.length; ) {
      const entity = this.array[i];
      const parent = entity[parentProperty];
      if (parent == null) {
        i++;
      } else if (parent.guid != null) {
        this.array.splice(i, 1);
        if (!(parent.guid in guidEntries)) {
          guidEntries[parent.guid] = [];
        }
        guidEntries[parent.guid].push(entity);
      } else {
        this.array.splice(i, 1);
        let entries: Entity[] = [];
        if (newEntries.has(parent)) {
          entries = newEntries.get(parent) || [];
        }
        entries.push(entity);
        newEntries.set(parent, entries);
      }
    }

    // Sort the top level entries.
    sort(this.array);

    // Now place all of the children back in order.
    for (let i = 0; i < this.array.length; i++) {
      const entity = this.array[i];
      if (entity.guid != null) {
        if (entity.guid in guidEntries) {
          this.array.splice(i + 1, 0, ...sort(guidEntries[entity.guid]));
          delete guidEntries[entity.guid];
        }
      } else {
        if (newEntries.has(entity)) {
          this.array.splice(
            i + 1,
            0,
            ...sort(newEntries.get(entity.guid) || []),
          );
          newEntries.delete(entity);
        }
      }
    }

    // Now place any orphans on the end.
    for (let orphans of Object.values(guidEntries)) {
      this.array.splice(this.array.length, 0, ...sort(orphans));
    }
    for (let [parent, orphans] of newEntries) {
      this.array.splice(this.array.length, 0, ...sort(orphans));
    }

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
    }: SortOptions = {},
  ): Entity[] {
    // Sort by the requested property.
    this.sortProperty = property;
    this.sortParent = parentProperty;
    this.collator = new Intl.Collator(
      undefined,
      collatorOptions || {
        sensitivity: caseSensitive ? 'case' : 'base',
        caseFirst: 'false',
      },
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
    }: SortOptions = {},
  ): Entity[] {
    // Sort by the requested property.
    this.sortProperty = property;
    this.sortParent = null;
    this.collator = new Intl.Collator(
      undefined,
      collatorOptions || {
        sensitivity: caseSensitive ? 'case' : 'base',
      },
    );
    this.comparator = comparator;
    this.array.sort(this._arraySortProperty.bind(this));
    if (reverse) {
      this.array.reverse();
    }
    return this.array as Entity[];
  }
}
