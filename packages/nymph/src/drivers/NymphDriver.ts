import fs from 'fs';
import ReadLines from 'n-readlines';

import {
  EntityConstructor,
  EntityData,
  EntityInterface,
  SerializedEntityData,
} from '../Entity.d';
import { InvalidParametersError, UnableToConnectError } from '../errors';
import Nymph from '../Nymph';
import { Selector, Options, FormattedSelector } from '../Nymph.d';

import { NymphDriverConfig } from './NymphDriver.d';

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
   * Nymph driver configuration object.
   */
  public config: NymphDriverConfig;
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

  abstract connect(): boolean;
  abstract deleteEntityByID(guid: string, className?: string): boolean;
  abstract deleteUID(name: string): boolean;
  abstract disconnect(): boolean;
  protected abstract exportEntities(writeLine: (line: string) => void): void;
  abstract getEntities<T extends EntityConstructor = EntityConstructor>(
    options?: Options<T>,
    ...selectors: Selector[]
  ): InstanceType<T>[] | null;
  abstract getUID(name: string): number | null;
  abstract import(filename: string): boolean;
  protected abstract makeEntityQuery(
    options: Options,
    formattedSelectors: FormattedSelector[],
    etypeDirty: string
  ): {
    query: string;
    fullCoverage: boolean;
    limitOffsetCoverage: boolean;
  };
  abstract newUID(name: string): number | null;
  protected abstract query(query: string, etypeDirty: string): any;
  abstract renameUID(oldName: string, newName: string): boolean;
  abstract saveEntity(entity: EntityInterface): boolean;
  abstract setUID(name: string, value: number): boolean;

  constructor(config: NymphDriverConfig) {
    this.config = config;
    this.connect();
  }

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

  public export(filename: string) {
    try {
      const fhandle = fs.openSync(filename, 'w');
      if (!fhandle) {
        throw new InvalidParametersError('Provided filename is not writeable.');
      }
      this.exportEntities((line: string) => {
        fs.writeSync(fhandle, line);
      });
      fs.closeSync(fhandle);
    } catch (e) {
      return false;
    }
    return true;
  }

  public exportPrint() {
    this.exportEntities((line: string) => {
      console.log(line);
    });
    return true;
  }

  protected importFromFile(
    filename: string,
    saveEntityCallback: (
      guid: string,
      tags: string[],
      data: EntityData,
      etype: string
    ) => void,
    saveUIDCallback: (name: string, value: number) => void,
    startTransactionCallback: (() => void) | null = null,
    commitTransactionCallback: (() => void) | null = null
  ) {
    let rl: ReadLines;
    try {
      rl = new ReadLines(filename);
    } catch (e) {
      throw new InvalidParametersError('Provided filename is unreadable.');
    }
    let guid: string | null = null;
    let line: Buffer | false = false;
    let data: EntityData = {};
    let tags: string[] = [];
    let etype = '__undefined';
    if (startTransactionCallback) {
      startTransactionCallback();
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
      if (entityMatch) {
        // Save the current entity.
        if (guid) {
          saveEntityCallback(guid, tags, data, etype);
          guid = null;
          tags = [];
          data = {};
          etype = '__undefined';
        }
        // Record the new entity's info.
        guid = entityMatch[1];
        etype = entityMatch[2];
        tags = entityMatch[3].split(',').map((t) => t.replace(/^\s*|\s*$/, ''));
      } else if (propMatch) {
        // Add the variable to the new entity.
        if (guid) {
          data[propMatch[1]] = JSON.parse(propMatch[2]);
        }
      } else if (uidMatch) {
        // Add the UID.
        saveUIDCallback(uidMatch[1], Number(uidMatch[2]));
      }
      // Clear the entity cache.
      this.entityCache = {};
    }
    // Save the last entity.
    if (guid) {
      saveEntityCallback(guid, tags, data, etype);
    }
    if (commitTransactionCallback) {
      commitTransactionCallback();
    }
    return true;
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

  protected iterateSelectorsForQuery(
    selectors: Selector[],
    recurseCallback: (value: any) => string,
    callback: (
      curQuery: string,
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
        let curQuery = '';
        if (key === 'selector') {
          if (curQuery.length) {
            curQuery += typeIsOr ? ' OR ' : ' AND ';
          }
          curQuery += recurseCallback(value);
        } else {
          curQuery = callback(curQuery, key, value, typeIsOr, typeIsNot);
        }
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

  protected getEntitesRowLike(
    options: Options,
    selectors: Selector[],
    typesAlreadyChecked: (keyof Selector)[],
    rowFetchCallback: (result: any) => void,
    freeResultCallback: (result: any) => void,
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
  ) {
    if (!this.connected) {
      throw new UnableToConnectError('not connected to DB');
    }
    for (const key in selectors) {
      const selector = selectors[key];
      if (
        !selector ||
        (Object.keys(selector).length === 1 &&
          'type' in selector &&
          ['&', '!&', '|', '!|'].indexOf(selector.type) !== -1)
      ) {
        delete selectors[key];
        continue;
      }
      if (
        !('type' in selector) ||
        ['&', '!&', '|', '!|'].indexOf(selector.type) === -1
      ) {
        throw new InvalidParametersError(
          'Invalid query selector passed: ' + JSON.stringify(selector)
        );
      }
    }

    const entities = [];
    const EntityClass =
      options.class ?? (Nymph.getEntityClass('Entity') as EntityConstructor);
    const etypeDirty = EntityClass.ETYPE;
    const ret = options.return ?? 'entity';

    let count = 0;
    let ocount = 0;

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
        const entity = this.pullCache(
          selectors[0]['guid'],
          EntityClass.class,
          !!options.skipAc
        );
        if (
          entity != null &&
          (!('tag' in selectors[0]) ||
            entity.hasTag(
              ...(Array.isArray(selectors[0].tag)
                ? selectors[0].tag
                : [selectors[0].tag])
            ))
        ) {
          return [entity];
        }
      }
    }

    const formattedSelectors = this.formatSelectors(selectors);
    const query = this.makeEntityQuery(options, formattedSelectors, etypeDirty);
    const result = this.query(query.query, etypeDirty);

    let row = rowFetchCallback(result);
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
          row = rowFetchCallback(result);
        } while (row != null && getGUIDCallback(row) === guid);
      } else {
        // Make sure that $row is incremented :)
        row = rowFetchCallback(result);
      }
      // Check all conditions.
      let passed: boolean;
      if (query.fullCoverage) {
        passed = true;
      } else {
        passed = this.checkData(
          data,
          sdata,
          selectors,
          null,
          null,
          typesAlreadyChecked
        );
      }
      if (passed) {
        if (
          typeof options.offset === 'number' &&
          !query.limitOffsetCoverage &&
          ocount < options.offset
        ) {
          // We must be sure this entity is actually a match before
          // incrementing the offset.
          ocount++;
          continue;
        }
        switch (ret) {
          case 'entity':
          default:
            let entity: EntityInterface | null = null;
            // if (Nymph.config.cache && !(options.skipCache)) {
            //   entity = this.pullCache(
            //     guid,
            //     EntityClass.class,
            //     !!options.skipAc
            //   );
            // }
            // if (entity == null || mdate > entity.mdate) {
            entity = EntityClass.factory();
            if (options.skipAc != null) {
              entity.$useSkipAc(!!options.skipAc);
            }
            entity.guid = guid;
            entity.cdate = cdate;
            entity.mdate = mdate;
            entity.tags = tags;
            entity.$putData(data, sdata);
            if (Nymph.config.cache) {
              this.pushCache(guid, cdate, mdate, tags, data, sdata);
            }
            // }
            entities.push(entity);
            break;
          case 'guid':
            entities.push(guid);
            break;
        }
        if (!query.limitOffsetCoverage) {
          count++;
          if (options.limit != null && count >= options.limit) {
            break;
          }
        }
      }
    }

    freeResultCallback(result);

    return entities;
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
    if (!entities || !entities.length) {
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
