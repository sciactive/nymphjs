import {
  EntityConstructor,
  EntityData,
  EntityInterface,
  SerializedEntityData,
} from '../Entity.d';
import Nymph from '../Nymph';
import { Selector, Options, FormattedSelector } from '../Nymph.d';

function xor(a: any, b: any): boolean {
  return !!(a && !b) || (!a && b);
}

// from: https://stackoverflow.com/a/6969486/664915
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * A Nymph database driver.
 */
export default abstract class NymphDriver {
  /**
   * Whether this instance is currently connected to a database.
   */
  public connected = false;
  /**
   * A cache to make entity retrieval faster.
   */
  protected entityCache: {
    [k: string]: {
      cdate: number;
      mdate: number;
      tags: string[];
      data: EntityData;
      sdata: SerializedEntityData;
    };
  } = {};
  /**
   * A counter for the entity cache to determine the most accessed entities.
   */
  protected entityCount: { [k: string]: number } = {};
  /**
   * Sort case sensitively.
   */
  protected sortCaseSensitive = false;
  /**
   * Parent property to sort by.
   */
  protected sortParent: string | null = null;
  /**
   * Property to sort by.
   */
  protected sortProperty: string = 'cdate';

  abstract connect(): boolean;
  abstract deleteEntityByID(guid: string, className?: string): boolean;
  abstract deleteUID(name: string): boolean;
  abstract disconnect(): boolean;
  abstract export(filename: string): boolean;
  abstract exportPrint(): boolean;
  abstract getEntities<T extends EntityConstructor = EntityConstructor>(
    options?: Options<T>,
    ...selectors: Selector[]
  ): InstanceType<T> | null;
  abstract getUID(name: string): number | null;
  abstract hsort(
    array: EntityInterface[],
    property: string,
    parentProperty: string,
    caseSensitive?: boolean,
    reverse?: boolean
  ): void;
  abstract import(filename: string): boolean;
  abstract newUID(name: string): number | null;
  abstract psort(
    array: EntityInterface[],
    property: string,
    parentProperty: string,
    caseSensitive?: boolean,
    reverse?: boolean
  ): void;
  abstract renameUID(oldName: string, newName: string): boolean;
  abstract saveEntity(entity: EntityInterface): boolean;
  abstract setUID(name: string, value: number): boolean;
  abstract sort(
    array: EntityInterface[],
    property: string,
    caseSensitive?: boolean,
    reverse?: boolean
  ): void;

  private posixRegexMatch(
    pattern: string,
    subject: string,
    caseInsensitive = false
  ) {
    const posixClasses = [
      // '[[:<:]]',
      // '[[:>:]]',
      '[:alnum:]',
      '[:alpha:]',
      '[:ascii:]',
      '[:blank:]',
      '[:cntrl:]',
      '[:digit:]',
      '[:graph:]',
      '[:lower:]',
      '[:print:]',
      '[:punct:]',
      '[:space:]',
      '[:upper:]',
      '[:word:]',
      '[:xdigit:]',
    ];
    const jsClasses = [
      // '\b(?=\w)',
      // '(?<=\w)\b',
      '[A-Za-z0-9]',
      '[A-Za-z]',
      '[\x00-\x7F]',
      '[ \t]', // '\s',
      '[\x00-\x1F\x7F]', // '[\000\001\002\003\004\005\006\007\008\009\010\011\012\013\014'.
      //   '\015\016\017\018\019\020\021\022\023\024\025\026\027\028\029'.
      //   '\030\031\032\033\034\035\036\037\177]',
      '[0-9]', // '\d',
      '[\x21-\x7E]', // '[A-Za-z0-9!"#$%&\'()*+,\-./:;<=>?@[\\\]^_`{|}\~]',
      '[a-z]',
      '[\x20-\x7E]', // '[A-Za-z0-9!"#$%&\'()*+,\-./:;<=>?@[\\\]^_`{|}\~]',
      '[!"#$%&\'()*+,-./:;<=>?@[\\\\\\]^_‘{|}~]', // '[!"#$%&\'()*+,\-./:;<=>?@[\\\]^_`{|}\~]',
      '[ \t\r\n\v\f]', // '[\t\n\x0B\f\r ]',
      '[A-Z]',
      '[A-Za-z0-9_]',
      '[0-9A-Fa-f]',
    ];

    let newPattern = pattern;
    for (let i = 0; i < posixClasses.length; i++) {
      newPattern = newPattern.replace(posixClasses[i], () => jsClasses[i]);
    }

    let re = new RegExp(newPattern, caseInsensitive ? 'mi' : 'm');

    return re.test(subject);
  }

  public checkData(
    data: EntityData,
    sdata: SerializedEntityData,
    selectors: Selector[],
    guid: string | null = null,
    tags: string[] | null = null,
    typesAlreadyChecked: (keyof Selector)[] = []
  ) {
    const formattedSelectors = this.formatSelectors(selectors);

    for (const curSelector of formattedSelectors) {
      const type = curSelector.type;
      const typeIsNot = type === '!&' || type === '!|';
      const typeIsOr = type === '|' || type === '!|';
      let pass = !typeIsOr;
      for (const k in curSelector) {
        const key = k as keyof Selector;
        const value = curSelector[key];

        if (key === 'type' || value == null) {
          continue;
        }

        if (key === 'selector') {
          const tmpArr = (Array.isArray(value) ? value : [value]) as Selector[];
          pass = this.checkData(
            data,
            sdata,
            tmpArr,
            guid,
            tags,
            typesAlreadyChecked
          );
        } else {
          const clauseNot = key.substr(0, 1) === '!';
          if (typesAlreadyChecked.indexOf(key) !== -1) {
            // Skip because it has already been checked. (By the query.)
            pass = true;
          } else if (key === 'qref') {
            // TODO: implement qref clauses
            throw new Error('not implemented');
          } else {
            // Check if it doesn't pass any for &, check if it
            // passes any for |.
            for (const curValue of value) {
              if (curValue == null) {
                continue;
              }

              if (
                ((key === 'guid' || key === '!guid') && guid == null) ||
                ((key === 'tag' || key === '!tag') && tags == null)
              ) {
                // Skip because it has already been checked (by the query).
                pass = true;
              } else {
                const propName = (curValue as string[])[0];

                // Unserialize the data for this variable.
                if (propName in sdata) {
                  data[propName] = JSON.parse(sdata[propName]);
                  delete sdata[propName];
                }

                switch (key) {
                  case 'guid':
                  case '!guid':
                    pass = xor(guid == propName, xor(typeIsNot, clauseNot));
                    break;
                  case 'tag':
                  case '!tag':
                    pass = xor(
                      (tags ?? []).indexOf(propName) !== -1,
                      xor(typeIsNot, clauseNot)
                    );
                    break;
                  case 'defined':
                  case '!defined':
                    pass = xor(propName in data, xor(typeIsNot, clauseNot));
                    break;
                  case 'truthy':
                  case '!truthy':
                    pass = xor(
                      propName in data && data[propName],
                      xor(typeIsNot, clauseNot)
                    );
                    break;
                  case 'ref':
                  case '!ref':
                    const testRefValue = (curValue as [string, any])[1] as any;
                    pass = xor(
                      propName in data &&
                        this.entityReferenceSearch(
                          data[propName],
                          testRefValue
                        ),
                      xor(typeIsNot, clauseNot)
                    );
                    break;
                  case 'equal':
                  case '!equal':
                    const testEqualValue = (
                      curValue as [string, any]
                    )[1] as any;
                    pass = xor(
                      propName in data &&
                        JSON.stringify(data[propName]) ===
                          JSON.stringify(testEqualValue),
                      xor(typeIsNot, clauseNot)
                    );
                    break;
                  case 'contains':
                  case '!contains':
                    const testContainsValue = (
                      curValue as [string, any]
                    )[1] as any;
                    pass = xor(
                      propName in data &&
                        JSON.stringify(data[propName]).indexOf(
                          JSON.stringify(testEqualValue)
                        ) !== -1,
                      xor(typeIsNot, clauseNot)
                    );
                    break;
                  case 'like':
                  case '!like':
                    const testLikeValue = (
                      curValue as [string, string]
                    )[1] as string;
                    pass = xor(
                      propName in data &&
                        new RegExp(
                          '^' +
                            escapeRegExp(testLikeValue)
                              .replace('%', () => '.*')
                              .replace('_', () => '.') +
                            '$'
                        ).test(data[propName]),
                      xor(typeIsNot, clauseNot)
                    );
                    break;
                  case 'match':
                  case '!match':
                    const testMatchValue = (
                      curValue as [string, string]
                    )[1] as string;
                    // Convert a POSIX regex to a JS regex.
                    pass = xor(
                      propName in data &&
                        this.posixRegexMatch(testMatchValue, data[propName]),
                      xor(typeIsNot, clauseNot)
                    );
                    break;
                  case 'imatch':
                  case '!imatch':
                    const testIMatchValue = (
                      curValue as [string, string]
                    )[1] as string;
                    // Convert a POSIX regex to a JS regex.
                    pass = xor(
                      propName in data &&
                        this.posixRegexMatch(
                          testIMatchValue,
                          data[propName],
                          true
                        ),
                      xor(typeIsNot, clauseNot)
                    );
                    break;
                  case 'gt':
                  case '!gt':
                    const testGTValue = (
                      curValue as [string, number]
                    )[1] as number;
                    pass = xor(
                      propName in data && data[propName] > testGTValue,
                      xor(typeIsNot, clauseNot)
                    );
                    break;
                  case 'gte':
                  case '!gte':
                    const testGTEValue = (
                      curValue as [string, number]
                    )[1] as number;
                    pass = xor(
                      propName in data && data[propName] >= testGTEValue,
                      xor(typeIsNot, clauseNot)
                    );
                    break;
                  case 'lt':
                  case '!lt':
                    const testLTValue = (
                      curValue as [string, number]
                    )[1] as number;
                    pass = xor(
                      propName in data && data[propName] < testLTValue,
                      xor(typeIsNot, clauseNot)
                    );
                    break;
                  case 'lte':
                  case '!lte':
                    const testLTEValue = (
                      curValue as [string, number]
                    )[1] as number;
                    pass = xor(
                      propName in data && data[propName] <= testLTEValue,
                      xor(typeIsNot, clauseNot)
                    );
                    break;
                  case 'array':
                  case '!array':
                    const testArrayValue = (
                      curValue as [string, any]
                    )[1] as any;
                    pass = xor(
                      propName in data &&
                        Array.isArray(data[propName]) &&
                        data[propName].indexOf(testArrayValue) !== -1,
                      xor(typeIsNot, clauseNot)
                    );
                    break;
                }
              }
              if (!xor(typeIsOr, pass)) {
                break;
              }
            }
          }
        }
        if (!xor(typeIsOr, pass)) {
          break;
        }
      }
      if (!pass) {
        return false;
      }
    }
    return true;
  }

  /**
   * Remove all copies of an entity from the cache.
   *
   * @param guid The GUID of the entity to remove.
   */
  protected cleanCache(guid: string) {
    delete this.entityCache[guid];
  }

  public deleteEntity(entity: EntityInterface) {
    const className = (entity.constructor as any).class as string;
    const ret = this.deleteEntityByID(entity.guid, className);
    if (ret) {
      entity.guid = null;
      entity.cdate = null;
      entity.mdate = null;
    }
    return ret;
  }

  /**
   * Search through a value for an entity reference.
   *
   * @param value Any value to search.
   * @param entity An entity, GUID, or array of either to search for.
   * @returns True if the reference is found, false otherwise.
   */
  protected entityReferenceSearch(
    value: any,
    entity: EntityInterface | string | (EntityInterface | string)[]
  ) {
    // Get the GUID, if the passed $entity is an object.
    const guids: string[] = [];
    if (Array.isArray(entity)) {
      for (const curEntity of entity) {
        if (typeof curEntity === 'string') {
          guids.push(curEntity);
        } else {
          guids.push(curEntity.guid);
        }
      }
    } else if (typeof entity === 'string') {
      guids.push(entity);
    } else {
      guids.push(entity.guid);
    }
    if (
      Array.isArray(value) &&
      value[0] === 'nymph_entity_reference' &&
      guids.indexOf(value[1]) !== -1
    ) {
      return true;
    }
    // Search through arrays and objects looking for the reference.
    if (Array.isArray(value) || typeof value === 'object') {
      for (const key in value) {
        if (this.entityReferenceSearch(value[key], guids)) {
          return true;
        }
      }
    }
    return false;
  }

  public formatSelectors(selectors: Selector[]): FormattedSelector[] {
    const newSelectors: FormattedSelector[] = [];

    for (const curSelector of selectors) {
      const newSelector: FormattedSelector = {
        type: curSelector.type,
      };

      for (const k in curSelector) {
        const key = k as keyof Selector;
        const value = curSelector[key];

        if (key === 'type') {
          continue;
        }

        if (key === 'selector') {
          const tmpArr = (Array.isArray(value) ? value : [value]) as Selector[];
          newSelector[key] = this.formatSelectors(tmpArr);
        } else if (!Array.isArray(value)) {
          // @ts-ignore
          newSelector[key] = [[value]];
        } else if (!Array.isArray(value[0])) {
          // @ts-ignore
          newSelector[key] = [value];
        } else {
          // @ts-ignore
          newSelector[key] = value;
        }
      }
    }

    return newSelectors;
  }

  public getEntity<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> = {},
    ...selectors: Selector[] | [string]
  ): InstanceType<T> | null {
    // Set up options and selectors.
    if (typeof selectors[0] === 'string') {
      selectors[0] = { type: '&', guid: selectors[0] };
    }
    options.limit = 1;
    const entities = this.getEntities(options, ...(selectors as Selector[]));
    if (!entities) {
      return null;
    }
    return entities[0];
  }

  /**
   * Pull an entity from the cache.
   *
   * @param guid The entity's GUID.
   * @param className The entity's class.
   * @param useSkipAc Whether to tell the entity to use skip_ac.
   * @returns The entity or null if it's not cached.
   */
  protected pullCache(
    guid: string,
    className: string,
    useSkipAc = false
  ): EntityInterface | null {
    // Increment the entity access count.
    if (!(guid in this.entityCount)) {
      this.entityCount[guid] = 0;
    }
    this.entityCount[guid]++;
    if (guid in this.entityCache) {
      const entity = Nymph.getEntityClass(className)?.factory();
      if (entity) {
        entity.$useSkipAc(!!useSkipAc);
        entity.guid = guid;
        entity.cdate = this.entityCache[guid]['cdate'];
        entity.mdate = this.entityCache[guid]['mdate'];
        entity.tags = this.entityCache[guid]['tags'];
        entity.$putData(
          this.entityCache[guid]['data'],
          this.entityCache[guid]['sdata']
        );
        return entity;
      }
    }
    return null;
  }

  /**
   * Push an entity onto the cache.
   *
   * @param guid The entity's GUID.
   * @param cdate The entity's cdate.
   * @param mdate The entity's mdate.
   * @param tags The entity's tags.
   * @param data The entity's data.
   * @param sdata The entity's sdata.
   */
  protected pushCache(
    guid: string,
    cdate: number,
    mdate: number,
    tags: string[],
    data: EntityData,
    sdata: SerializedEntityData
  ) {
    if (guid == null) {
      return;
    }
    // Increment the entity access count.
    if (!(guid in this.entityCount)) {
      this.entityCount[guid] = 0;
    }
    this.entityCount[guid]++;
    // Check the threshold.
    if (this.entityCount[guid] < Nymph.config.cacheThreshold) {
      return;
    }
    // Cache the entity.
    this.entityCache[guid] = {
      cdate: cdate,
      mdate: mdate,
      tags: tags,
      data: data,
      sdata: sdata,
    };
    while (
      Nymph.config.cacheLimit &&
      Object.keys(this.entityCache).length >= Nymph.config.cacheLimit
    ) {
      // Find which entity has been accessed the least.
      const least =
        Object.entries(this.entityCount)
          .sort(([guidA, countA], [guidB, countB]) => countA - countB)
          .pop()?.[0] ?? null;
      if (least == null) {
        // This should never happen.
        return;
      }
      // Remove it.
      delete this.entityCache[least];
      delete this.entityCount[least];
    }
  }
}
