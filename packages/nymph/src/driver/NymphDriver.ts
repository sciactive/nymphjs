import fs from 'fs';
import { difference } from 'lodash';
import ReadLines from 'n-readlines';
import strtotime from 'locutus/php/datetime/strtotime';

import newGUID from '../newGUID';
import {
  EntityConstructor,
  EntityData,
  EntityInterface,
  SerializedEntityData,
} from '../Entity.types';
import { InvalidParametersError, UnableToConnectError } from '../errors';
import Nymph from '../Nymph';
import { Selector, Options, FormattedSelector } from '../Nymph.types';
import { xor } from '../utils';

// from: https://stackoverflow.com/a/6969486/664915
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * A Nymph database driver.
 */
export default abstract class NymphDriver {
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
   * Protect against infinite loops.
   */
  private putDataCounter = 0;

  abstract connect(): Promise<boolean>;
  abstract isConnected(): boolean;
  abstract startTransaction(name: string): Promise<boolean>;
  abstract commit(name: string): Promise<boolean>;
  abstract rollback(name: string): Promise<boolean>;
  abstract inTransaction(): Promise<boolean>;
  abstract deleteEntityByID(
    guid: string,
    classConstructor: EntityConstructor
  ): Promise<boolean>;
  abstract deleteEntityByID(guid: string, className?: string): Promise<boolean>;
  abstract deleteUID(name: string): Promise<boolean>;
  abstract disconnect(): Promise<boolean>;
  protected abstract exportEntities(
    writeLine: (line: string) => void
  ): Promise<void>;
  abstract getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string[]>;
  abstract getEntities<T extends EntityConstructor = EntityConstructor>(
    options?: Options<T>,
    ...selectors: Selector[]
  ): Promise<ReturnType<T['factorySync']>[]>;
  abstract getEntities<T extends EntityConstructor = EntityConstructor>(
    options?: Options<T>,
    ...selectors: Selector[]
  ): Promise<ReturnType<T['factorySync']>[] | string[]>;
  protected abstract getEntitiesSync<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): string[];
  protected abstract getEntitiesSync<
    T extends EntityConstructor = EntityConstructor
  >(
    options?: Options<T>,
    ...selectors: Selector[]
  ): ReturnType<T['factorySync']>[];
  protected abstract getEntitiesSync<
    T extends EntityConstructor = EntityConstructor
  >(
    options?: Options<T>,
    ...selectors: Selector[]
  ): ReturnType<T['factorySync']>[] | string[];
  abstract getUID(name: string): Promise<number | null>;
  abstract import(filename: string): Promise<boolean>;
  abstract newUID(name: string): Promise<number | null>;
  abstract renameUID(oldName: string, newName: string): Promise<boolean>;
  abstract saveEntity(entity: EntityInterface): Promise<boolean>;
  abstract setUID(name: string, value: number): Promise<boolean>;

  protected posixRegexMatch(
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

  public async export(filename: string) {
    try {
      const fhandle = fs.openSync(filename, 'w');
      if (!fhandle) {
        throw new InvalidParametersError('Provided filename is not writeable.');
      }
      await this.exportEntities((line: string) => {
        fs.writeSync(fhandle, `${line}\n`);
      });
      fs.closeSync(fhandle);
    } catch (e: any) {
      return false;
    }
    return true;
  }

  public async exportPrint() {
    await this.exportEntities((line: string) => {
      console.log(line);
    });
    return true;
  }

  protected async importFromFile(
    filename: string,
    saveEntityCallback: (
      guid: string,
      tags: string[],
      sdata: SerializedEntityData,
      etype: string
    ) => Promise<void>,
    saveUIDCallback: (name: string, value: number) => Promise<void>,
    startTransactionCallback: (() => Promise<void>) | null = null,
    commitTransactionCallback: (() => Promise<void>) | null = null
  ) {
    let rl: ReadLines;
    try {
      rl = new ReadLines(filename);
    } catch (e: any) {
      throw new InvalidParametersError('Provided filename is unreadable.');
    }
    let guid: string | null = null;
    let line: Buffer | false = false;
    let sdata: SerializedEntityData = {};
    let tags: string[] = [];
    let etype = '__undefined';
    if (startTransactionCallback) {
      await startTransactionCallback();
    }
    while ((line = rl.next())) {
      const text = line.toString('utf8');
      if (text.match(/^\s*#/)) {
        continue;
      }
      const entityMatch = text.match(
        /^\s*{([0-9A-Fa-f]+)}<([-\w_]+)>\[([^\]]*)\]\s*$/
      );
      const propMatch = text.match(/^\s*([^=]+)\s*=\s*(.*\S)\s*$/);
      const uidMatch = text.match(/^\s*<([^>]+)>\[(\d+)\]\s*$/);
      if (uidMatch) {
        // Add the UID.
        await saveUIDCallback(uidMatch[1], Number(uidMatch[2]));
      } else if (entityMatch) {
        // Save the current entity.
        if (guid) {
          await saveEntityCallback(guid, tags, sdata, etype);
          guid = null;
          tags = [];
          sdata = {};
          etype = '__undefined';
        }
        // Record the new entity's info.
        guid = entityMatch[1];
        etype = entityMatch[2];
        tags = entityMatch[3].split(',');
      } else if (propMatch) {
        // Add the variable to the new entity.
        if (guid) {
          sdata[propMatch[1]] = propMatch[2];
        }
      }
      // Clear the entity cache.
      this.entityCache = {};
    }
    // Save the last entity.
    if (guid) {
      await saveEntityCallback(guid, tags, sdata, etype);
    }
    if (commitTransactionCallback) {
      await commitTransactionCallback();
    }
    return true;
  }

  public checkData(
    data: EntityData,
    sdata: SerializedEntityData,
    selectors: Selector[],
    guid: string | null = null,
    tags: string[] | null = null
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

        const clauseNot = key.substr(0, 1) === '!';
        if (key === 'selector' || key === '!selector') {
          const tmpArr = (Array.isArray(value) ? value : [value]) as Selector[];
          pass = xor(
            this.checkData(data, sdata, tmpArr, guid, tags),
            xor(typeIsNot, clauseNot)
          );
        } else {
          if (key === 'qref' || key === '!qref') {
            throw new Error("Can't use checkData on qref clauses.");
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
                  case 'contain':
                  case '!contain':
                    const testContainValue = (
                      curValue as [string, any]
                    )[1] as any;
                    pass = xor(
                      propName in data &&
                        JSON.stringify(data[propName]).indexOf(
                          JSON.stringify(testContainValue)
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

  public async deleteEntity(entity: EntityInterface) {
    const className = (entity.constructor as any).class as string;
    if (entity.guid == null) {
      return false;
    }
    const ret = await this.deleteEntityByID(entity.guid, className);
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
        } else if (typeof curEntity.guid === 'string') {
          guids.push(curEntity.guid);
        }
      }
    } else if (typeof entity === 'string') {
      guids.push(entity);
    } else if (typeof entity.guid === 'string') {
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

  public formatSelectors(
    selectors: Selector[],
    options: Options = {}
  ): FormattedSelector[] {
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

        if (value === undefined) {
          continue;
        }

        if (key === 'qref' || key === '!qref') {
          const tmpArr = (
            Array.isArray(((value as Selector['qref']) ?? [])[0])
              ? value
              : [value]
          ) as [string, [Options, ...Selector[]]][];
          const formatArr: [string, [Options, ...FormattedSelector[]]][] = [];
          for (let i = 0; i < tmpArr.length; i++) {
            const name = tmpArr[i][0];
            const [qrefOptions, ...qrefSelectors] = tmpArr[i][1];
            const QrefEntityClass =
              typeof qrefOptions.class === 'string'
                ? Nymph.getEntityClass(qrefOptions.class)
                : qrefOptions.class ?? Nymph.getEntityClass('Entity');
            const newOptions = {
              ...qrefOptions,
              class: QrefEntityClass,
              source: options.source,
            };
            const newSelectors = this.formatSelectors(qrefSelectors, options);
            Nymph.runQueryCallbacks(newOptions, newSelectors);
            formatArr[i] = [name, [newOptions, ...newSelectors]];
          }
          newSelector[key] = formatArr;
        } else if (key === 'selector' || key === '!selector') {
          const tmpArr = (Array.isArray(value) ? value : [value]) as Selector[];
          newSelector[key] = this.formatSelectors(tmpArr, options);
        } else if (!Array.isArray(value)) {
          // @ts-ignore: ts doesn't know what value is here.
          newSelector[key] = [[value]];
        } else if (!Array.isArray(value[0])) {
          if (
            value.length === 3 &&
            value[1] == null &&
            typeof value[2] === 'string'
          ) {
            // @ts-ignore: ts doesn't know what value is here.
            newSelector[key] = [[value[0], strtotime(value[2]) * 1000]];
          } else {
            // @ts-ignore: ts doesn't know what value is here.
            newSelector[key] = [value];
          }
        } else {
          // @ts-ignore: ts doesn't know what value is here.
          newSelector[key] = value.map((curValue) => {
            if (
              curValue.length === 3 &&
              curValue[1] == null &&
              typeof curValue[2] === 'string'
            ) {
              return [curValue[0], strtotime(curValue[2]) * 1000];
            }
            return curValue;
          });
        }
      }

      newSelectors.push(newSelector);
    }

    return newSelectors;
  }

  protected iterateSelectorsForQuery(
    selectors: FormattedSelector[],
    callback: (
      key: string,
      value: any,
      typeIsOr: boolean,
      typeIsNot: boolean
    ) => string
  ) {
    const queryParts = [];
    for (const curSelector of selectors) {
      let curSelectorQuery = '';
      let type: string = curSelector.type;
      let typeIsNot: boolean = type === '!&' || type === '!|';
      let typeIsOr: boolean = type === '|' || type === '!|';
      for (const key in curSelector) {
        const value: any = (curSelector as any)[key];
        if (key === 'type') {
          continue;
        }
        let curQuery = callback(key, value, typeIsOr, typeIsNot);
        if (curQuery) {
          if (curSelectorQuery) {
            curSelectorQuery += typeIsOr ? ' OR ' : ' AND ';
          }
          curSelectorQuery += curQuery;
        }
      }
      if (curSelectorQuery) {
        queryParts.push(curSelectorQuery);
      }
    }

    return queryParts;
  }

  /**
   * Get the first entity to match all options/selectors, synchronously.
   *
   * This should really only be used internally by the Entity class. It's a bad
   * idea to get entities synchronously. The Entity class uses this to load
   * sleeping references.
   *
   * @param options The options.
   * @param selectors Unlimited optional selectors to search for, or a single GUID. If none are given, all entities are searched for the given options.
   * @returns An entity, or null on failure or nothing found.
   */
  public getEntitySync<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): string | null;
  public getEntitySync<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    ...selectors: Selector[]
  ): ReturnType<T['factorySync']> | null;
  public getEntitySync<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    guid: string
  ): string | null;
  public getEntitySync<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    guid: string
  ): ReturnType<T['factorySync']> | null;
  public getEntitySync<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> = {},
    ...selectors: Selector[] | string[]
  ): ReturnType<T['factorySync']> | string | null {
    // Set up options and selectors.
    if (typeof selectors[0] === 'string') {
      selectors = [{ type: '&', guid: selectors[0] }];
    }
    options.limit = 1;
    const entities = this.getEntitiesSync(
      options,
      ...(selectors as Selector[])
    );
    if (!entities || !entities.length) {
      return null;
    }
    return entities[0];
  }

  protected getEntitesRowLike<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    selectors: Selector[],
    performQueryCallback: (
      options: Options<T>,
      formattedSelectors: FormattedSelector[],
      etype: string
    ) => {
      result: any;
    },
    rowFetchCallback: () => any,
    freeResultCallback: () => void,
    getGUIDCallback: (row: any) => string,
    getTagsAndDatesCallback: (row: any) => {
      tags: string[];
      cdate: number;
      mdate: number;
    },
    getDataNameAndSValueCallback: (row: any) => {
      name: string;
      svalue: string;
    }
  ): { result: any; process: () => string[] };
  protected getEntitesRowLike<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    selectors: Selector[],
    performQueryCallback: (
      options: Options<T>,
      formattedSelectors: FormattedSelector[],
      etype: string
    ) => {
      result: any;
    },
    rowFetchCallback: () => any,
    freeResultCallback: () => void,
    getGUIDCallback: (row: any) => string,
    getTagsAndDatesCallback: (row: any) => {
      tags: string[];
      cdate: number;
      mdate: number;
    },
    getDataNameAndSValueCallback: (row: any) => {
      name: string;
      svalue: string;
    }
  ): { result: any; process: () => ReturnType<T['factorySync']>[] };
  protected getEntitesRowLike<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    selectors: Selector[],
    performQueryCallback: (
      options: Options<T>,
      formattedSelectors: FormattedSelector[],
      etype: string
    ) => {
      result: any;
    },
    rowFetchCallback: () => any,
    freeResultCallback: () => void,
    getGUIDCallback: (row: any) => string,
    getTagsAndDatesCallback: (row: any) => {
      tags: string[];
      cdate: number;
      mdate: number;
    },
    getDataNameAndSValueCallback: (row: any) => {
      name: string;
      svalue: string;
    }
  ): { result: any; process: () => ReturnType<T['factorySync']>[] | string[] } {
    if (!this.isConnected()) {
      throw new UnableToConnectError('not connected to DB');
    }
    for (const selector of selectors) {
      if (
        !selector ||
        Object.keys(selector).length === 1 ||
        !('type' in selector) ||
        ['&', '!&', '|', '!|'].indexOf(selector.type) === -1
      ) {
        throw new InvalidParametersError(
          'Invalid query selector passed: ' + JSON.stringify(selector)
        );
      }
    }

    let entities: ReturnType<T['factorySync']>[] | string[] = [];
    const EntityClass = options.class ?? (Nymph.getEntityClass('Entity') as T);
    const etype = EntityClass.ETYPE;

    // Check if the requested entity is cached.
    if (
      Nymph.config.cache &&
      !options.skipCache &&
      'guid' in selectors[0] &&
      typeof selectors[0].guid === 'number'
    ) {
      // Only safe to use the cache option with no other selectors than a GUID
      // and tags.
      if (
        selectors.length === 1 &&
        selectors[0].type === '&' &&
        (Object.keys(selectors[0]).length === 2 ||
          (Object.keys(selectors[0]).length === 3 && 'tag' in selectors[0]))
      ) {
        const entity = this.pullCache<ReturnType<T['factorySync']>>(
          selectors[0]['guid'],
          EntityClass.class,
          !!options.skipAc
        );
        if (
          entity != null &&
          entity.guid != null &&
          (!('tag' in selectors[0]) ||
            entity.hasTag(
              ...(Array.isArray(selectors[0].tag)
                ? selectors[0].tag
                : [selectors[0].tag])
            ))
        ) {
          const guid = entity.guid;
          return {
            result: Promise.resolve(null),
            process: () => (options.return === 'guid' ? [guid] : [entity]),
          };
        }
      }
    }

    const formattedSelectors = this.formatSelectors(selectors, options);
    Nymph.runQueryCallbacks(options, formattedSelectors);
    const { result } = performQueryCallback(options, formattedSelectors, etype);

    return {
      result,
      process: () => {
        let row = rowFetchCallback();
        if (options.return === 'guid') {
          while (row != null) {
            (entities as string[]).push(getGUIDCallback(row));
            row = rowFetchCallback();
          }
        } else {
          while (row != null) {
            const guid = getGUIDCallback(row);
            const tagsAndDates = getTagsAndDatesCallback(row);
            const tags = tagsAndDates.tags;
            const cdate = tagsAndDates.cdate;
            const mdate = tagsAndDates.mdate;
            let dataNameAndSValue = getDataNameAndSValueCallback(row);
            // Data.
            const data: EntityData = {};
            // Serialized data.
            const sdata: SerializedEntityData = {};
            if (dataNameAndSValue.name !== '') {
              // This do will keep going and adding the data until the
              // next entity is reached. $row will end on the next entity.
              do {
                dataNameAndSValue = getDataNameAndSValueCallback(row);
                sdata[dataNameAndSValue.name] = dataNameAndSValue.svalue;
                row = rowFetchCallback();
              } while (row != null && getGUIDCallback(row) === guid);
            } else {
              // Make sure that $row is incremented :)
              row = rowFetchCallback();
            }
            const entity = EntityClass.factorySync() as ReturnType<
              T['factorySync']
            >;
            if (options.skipAc != null) {
              entity.$useSkipAc(!!options.skipAc);
            }
            entity.guid = guid;
            entity.cdate = cdate;
            entity.mdate = mdate;
            entity.tags = tags;
            this.putDataCounter++;
            if (this.putDataCounter == 100) {
              throw new Error('Infinite loop detected in Entity loading.');
            }
            entity.$putData(data, sdata);
            this.putDataCounter--;
            if (Nymph.config.cache) {
              this.pushCache(guid, cdate, mdate, tags, data, sdata);
            }
            // @ts-ignore: ts doesn't know the return type here.
            entities.push(entity);
          }
        }

        freeResultCallback();

        return entities;
      },
    };
  }

  protected async saveEntityRowLike(
    entity: EntityInterface,
    saveNewEntityCallback: (
      entity: EntityInterface,
      guid: string,
      tags: string[],
      data: EntityData,
      sdata: SerializedEntityData,
      cdate: number,
      etype: string
    ) => Promise<boolean>,
    saveExistingEntityCallback: (
      entity: EntityInterface,
      guid: string,
      tags: string[],
      data: EntityData,
      sdata: SerializedEntityData,
      mdate: number,
      etype: string
    ) => Promise<boolean>,
    startTransactionCallback: (() => Promise<void>) | null = null,
    commitTransactionCallback:
      | ((success: boolean) => Promise<boolean>)
      | null = null
  ) {
    // Get a modified date.
    const mdate = Date.now();
    const tags = difference(entity.tags, ['']);
    const data = entity.$getData();
    const sdata = entity.$getSData();
    const EntityClass = entity.constructor as EntityConstructor;
    const etype = EntityClass.ETYPE;
    if (startTransactionCallback) {
      await startTransactionCallback();
    }
    let success = false;
    if (entity.guid == null) {
      const cdate = mdate;
      const newId = newGUID();
      success = await saveNewEntityCallback(
        entity,
        newId,
        tags,
        data,
        sdata,
        cdate,
        etype
      );
      if (success) {
        entity.guid = newId;
        entity.cdate = cdate;
        entity.mdate = mdate;
      }
    } else {
      // Removed any cached versions of this entity.
      if (Nymph.config.cache) {
        this.cleanCache(entity.guid);
      }
      success = await saveExistingEntityCallback(
        entity,
        entity.guid,
        tags,
        data,
        sdata,
        mdate,
        etype
      );
      if (success) {
        entity.mdate = mdate;
      }
    }
    if (commitTransactionCallback) {
      success = await commitTransactionCallback(success);
    }
    // Cache the entity.
    if (success && Nymph.config.cache) {
      this.pushCache(
        entity.guid as string,
        entity.cdate as number,
        entity.mdate as number,
        entity.tags,
        data,
        sdata
      );
    }
    return success;
  }

  /**
   * Pull an entity from the cache.
   *
   * @param guid The entity's GUID.
   * @param className The entity's class.
   * @param useSkipAc Whether to tell the entity to use skip_ac.
   * @returns The entity or null if it's not cached.
   */
  protected pullCache<T extends EntityInterface = EntityInterface>(
    guid: string,
    className: string,
    useSkipAc = false
  ): T | null {
    // Increment the entity access count.
    if (!(guid in this.entityCount)) {
      this.entityCount[guid] = 0;
    }
    this.entityCount[guid]++;
    if (guid in this.entityCache) {
      const entity = Nymph.getEntityClass(className).factorySync() as T;
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

  protected findReferences(svalue: string): string[] {
    const re = /\["nymph_entity_reference","([0-9a-fA-F]+)",/g;
    const matches = svalue.match(re);
    if (matches == null) {
      return [];
    }
    return matches.map((match) => match.replace(re, '$1'));
  }
}
