import fs from 'node:fs';
import { difference } from 'lodash-es';
import ReadLines from 'n-readlines';
import strtotime from 'locutus/php/datetime/strtotime.js';
import { guid } from '@nymphjs/guid';

import type Nymph from '../Nymph.js';
import type { Selector, Options, FormattedSelector } from '../Nymph.types.js';
import Entity, { type EntityInstanceType } from '../Entity.js';
import type {
  EntityConstructor,
  EntityData,
  EntityInterface,
  EntityReference,
  SerializedEntityData,
} from '../Entity.types.js';
import {
  InvalidParametersError,
  UnableToConnectError,
} from '../errors/index.js';
import { xor } from '../utils.js';

// from: https://stackoverflow.com/a/6969486/664915
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * A Nymph database driver.
 */
export default abstract class NymphDriver {
  protected nymph: Nymph = new Proxy({} as Nymph, {
    get() {
      throw new Error(
        'Attempted access of Nymph instance before driver initialization!',
      );
    },
  });

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

  /**
   * This is used internally by Nymph. Don't call it yourself.
   *
   * @returns A clone of this instance.
   */
  abstract clone(): NymphDriver;

  /**
   * Connect to the data store.
   */
  abstract connect(): Promise<boolean>;

  abstract isConnected(): boolean;
  protected abstract internalTransaction(name: string): Promise<any>;
  abstract startTransaction(name: string): Promise<Nymph>;
  abstract commit(name: string): Promise<boolean>;
  abstract rollback(name: string): Promise<boolean>;
  abstract inTransaction(): Promise<boolean>;
  abstract deleteEntityByID(
    guid: string,
    classConstructor: EntityConstructor,
  ): Promise<boolean>;
  abstract deleteEntityByID(guid: string, className?: string): Promise<boolean>;
  abstract deleteUID(name: string): Promise<boolean>;

  /**
   * Disconnect from the data store.
   */
  abstract disconnect(): Promise<boolean>;

  /**
   * Detect whether the database needs to be migrated.
   *
   * If true, the database should be exported with an old version of Nymph, then
   * imported into a fresh database with this version.
   */
  abstract needsMigration(): Promise<boolean>;

  abstract exportDataIterator(): AsyncGenerator<
    { type: 'comment' | 'uid' | 'entity'; content: string },
    void,
    undefined | false
  >;
  abstract getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'count' },
    ...selectors: Selector[]
  ): Promise<number>;
  abstract getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string[]>;
  abstract getEntities<T extends EntityConstructor = EntityConstructor>(
    options?: Options<T>,
    ...selectors: Selector[]
  ): Promise<EntityInstanceType<T>[]>;
  abstract getEntities<T extends EntityConstructor = EntityConstructor>(
    options?: Options<T>,
    ...selectors: Selector[]
  ): Promise<EntityInstanceType<T>[] | string[] | number>;
  abstract getUID(name: string): Promise<number | null>;
  abstract importEntity(entity: {
    guid: string;
    cdate: number;
    mdate: number;
    tags: string[];
    sdata: SerializedEntityData;
    etype: string;
  }): Promise<void>;
  abstract importUID(uid: { name: string; value: number }): Promise<void>;
  abstract newUID(name: string): Promise<number | null>;
  abstract renameUID(oldName: string, newName: string): Promise<boolean>;
  abstract saveEntity(entity: EntityInterface): Promise<boolean>;
  abstract setUID(name: string, value: number): Promise<boolean>;

  /**
   * Initialize the Nymph driver.
   *
   * This is meant to be called internally by Nymph. Don't call this directly.
   *
   * @param nymph The Nymph instance.
   */
  public init(nymph: Nymph) {
    this.nymph = nymph;
  }

  protected posixRegexMatch(
    pattern: string,
    subject: string,
    caseInsensitive = false,
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
      for await (let entry of this.exportDataIterator()) {
        fs.writeSync(fhandle, entry.content);
      }
      fs.closeSync(fhandle);
    } catch (e: any) {
      return false;
    }
    return true;
  }

  public async exportPrint() {
    for await (let entry of this.exportDataIterator()) {
      console.log(entry.content);
    }
    return true;
  }

  public async importDataIterator(
    lines: Iterable<string>,
    transaction?: boolean,
  ) {
    const first = lines[Symbol.iterator]().next();

    if (first.done || first.value !== '#nex2') {
      throw new Error('Tried to import a file that is not a NEX v2 file.');
    }

    if (transaction) {
      await this.internalTransaction('nymph-import');
    }
    try {
      let guid: string | null = null;
      let sdata: SerializedEntityData = {};
      let tags: string[] = [];
      let etype = '__undefined';
      for (let line of lines) {
        if (line.match(/^\s*#/)) {
          continue;
        }
        const entityMatch = line.match(
          /^\s*{([0-9A-Fa-f]+)}<([-\w_]+)>\[([^\]]*)\]\s*$/,
        );
        const propMatch = line.match(/^\s*([^=]+)\s*=\s*(.*\S)\s*$/);
        const uidMatch = line.match(/^\s*<([^>]+)>\[(\d+)\]\s*$/);
        if (uidMatch) {
          // Add the UID.
          await this.importUID({
            name: uidMatch[1],
            value: Number(uidMatch[2]),
          });
        } else if (entityMatch) {
          // Save the current entity.
          if (guid) {
            const cdate = Number(JSON.parse(sdata.cdate));
            delete sdata.cdate;
            const mdate = Number(JSON.parse(sdata.mdate));
            delete sdata.mdate;
            await this.importEntity({ guid, cdate, mdate, tags, sdata, etype });
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
        const cdate = Number(JSON.parse(sdata.cdate));
        delete sdata.cdate;
        const mdate = Number(JSON.parse(sdata.mdate));
        delete sdata.mdate;
        await this.importEntity({ guid, cdate, mdate, tags, sdata, etype });
      }
      if (transaction) {
        await this.commit('nymph-import');
      }
    } catch (e: any) {
      await this.rollback('nymph-import');
      throw e;
    }
    return true;
  }

  public async importData(text: string, transaction?: boolean) {
    return await this.importDataIterator(text.split('\n'), transaction);
  }

  public async import(filename: string, transaction?: boolean) {
    let rl: ReadLines;
    try {
      rl = new ReadLines(filename);
    } catch (e: any) {
      throw new InvalidParametersError('Provided filename is unreadable.');
    }

    const lines = {
      *[Symbol.iterator]() {
        let line: false | Buffer;
        while ((line = rl.next())) {
          yield line.toString('utf8');
        }
      },
    };

    return await this.importDataIterator(lines, transaction);
  }

  public checkData(
    data: EntityData,
    sdata: SerializedEntityData,
    selectors: Selector[],
    guid: string | null = null,
    tags: string[] | null = null,
  ) {
    try {
      const formattedSelectors = this.formatSelectors(selectors).selectors;

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

          const clauseNot = key.substring(0, 1) === '!';
          if (key === 'selector' || key === '!selector') {
            const tmpArr = (
              Array.isArray(value) ? value : [value]
            ) as Selector[];
            pass = xor(
              this.checkData(data, sdata, tmpArr, guid, tags),
              xor(typeIsNot, clauseNot),
            );
          } else {
            if (key === 'qref' || key === '!qref') {
              throw new Error("Can't use checkData on qref clauses.");
            } else {
              // Check if it doesn't pass any for &, check if it passes any for |.
              for (const curValue of value) {
                if (curValue == null) {
                  continue;
                }

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
                      xor(typeIsNot, clauseNot),
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
                      xor(typeIsNot, clauseNot),
                    );
                    break;
                  case 'ref':
                  case '!ref':
                    const testRefValue = (curValue as [string, any])[1] as any;
                    pass = xor(
                      propName in data &&
                        this.entityReferenceSearch(
                          data[propName],
                          testRefValue,
                        ),
                      xor(typeIsNot, clauseNot),
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
                      xor(typeIsNot, clauseNot),
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
                          JSON.stringify(testContainValue),
                        ) !== -1,
                      xor(typeIsNot, clauseNot),
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
                            '$',
                        ).test(data[propName]),
                      xor(typeIsNot, clauseNot),
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
                      xor(typeIsNot, clauseNot),
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
                          true,
                        ),
                      xor(typeIsNot, clauseNot),
                    );
                    break;
                  case 'gt':
                  case '!gt':
                    const testGTValue = (
                      curValue as [string, number]
                    )[1] as number;
                    pass = xor(
                      propName in data && data[propName] > testGTValue,
                      xor(typeIsNot, clauseNot),
                    );
                    break;
                  case 'gte':
                  case '!gte':
                    const testGTEValue = (
                      curValue as [string, number]
                    )[1] as number;
                    pass = xor(
                      propName in data && data[propName] >= testGTEValue,
                      xor(typeIsNot, clauseNot),
                    );
                    break;
                  case 'lt':
                  case '!lt':
                    const testLTValue = (
                      curValue as [string, number]
                    )[1] as number;
                    pass = xor(
                      propName in data && data[propName] < testLTValue,
                      xor(typeIsNot, clauseNot),
                    );
                    break;
                  case 'lte':
                  case '!lte':
                    const testLTEValue = (
                      curValue as [string, number]
                    )[1] as number;
                    pass = xor(
                      propName in data && data[propName] <= testLTEValue,
                      xor(typeIsNot, clauseNot),
                    );
                    break;
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
    } catch (e: any) {
      this.nymph.config.debugError(
        'nymph',
        `Failed to check entity data: ${e}`,
      );
      throw e;
    }
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
    entity:
      | EntityInterface
      | EntityReference
      | string
      | (EntityInterface | EntityReference | string)[],
  ) {
    // Get the GUID, if the passed $entity is an object.
    const guids: string[] = [];
    if (Array.isArray(entity)) {
      if (entity[0] === 'nymph_entity_reference') {
        guids.push(value[1]);
      } else {
        for (const curEntity of entity) {
          if (typeof curEntity === 'string') {
            guids.push(curEntity);
          } else if (Array.isArray(curEntity)) {
            guids.push(curEntity[1]);
          } else if (typeof curEntity.guid === 'string') {
            guids.push(curEntity.guid);
          }
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
    options: Options = {},
  ): {
    selectors: FormattedSelector[];
    qrefs: [Options, ...FormattedSelector[]][];
  } {
    const newSelectors: FormattedSelector[] = [];
    const qrefs: [Options, ...FormattedSelector[]][] = [];

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
            const QrefEntityClass = qrefOptions.class
              ? this.nymph.getEntityClass(qrefOptions.class)
              : this.nymph.getEntityClass('Entity');
            const newOptions = {
              ...qrefOptions,
              class: QrefEntityClass,
              source: options.source,
            };
            const newSelectors = this.formatSelectors(qrefSelectors, options);
            qrefs.push(
              [newOptions, ...newSelectors.selectors],
              ...newSelectors.qrefs,
            );
            formatArr[i] = [name, [newOptions, ...newSelectors.selectors]];
          }
          newSelector[key] = formatArr;
        } else if (key === 'selector' || key === '!selector') {
          const tmpArr = (Array.isArray(value) ? value : [value]) as Selector[];
          const newSelectors = this.formatSelectors(tmpArr, options);
          newSelector[key] = newSelectors.selectors;
          qrefs.push(...newSelectors.qrefs);
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

    return { selectors: newSelectors, qrefs };
  }

  protected iterateSelectorsForQuery(
    selectors: FormattedSelector[],
    callback: (data: {
      key: string;
      value: any;
      typeIsOr: boolean;
      typeIsNot: boolean;
    }) => string,
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
        let curQuery = callback({ key, value, typeIsOr, typeIsNot });
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

  protected getEntitiesRowLike<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'count' },
    selectors: Selector[],
    performQueryCallback: (data: {
      options: Options<T>;
      selectors: FormattedSelector[];
      etype: string;
    }) => {
      result: any;
    },
    rowFetchCallback: () => any,
    freeResultCallback: () => void,
    getCountCallback: (row: any) => number,
    getGUIDCallback: (row: any) => string,
    getTagsAndDatesCallback: (row: any) => {
      tags: string[];
      cdate: number;
      mdate: number;
    },
    getDataNameAndSValueCallback: (row: any) => {
      name: string;
      svalue: string;
    },
  ): { result: any; process: () => number | Error };
  protected getEntitiesRowLike<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    selectors: Selector[],
    performQueryCallback: (data: {
      options: Options<T>;
      selectors: FormattedSelector[];
      etype: string;
    }) => {
      result: any;
    },
    rowFetchCallback: () => any,
    freeResultCallback: () => void,
    getCountCallback: (row: any) => number,
    getGUIDCallback: (row: any) => string,
    getTagsAndDatesCallback: (row: any) => {
      tags: string[];
      cdate: number;
      mdate: number;
    },
    getDataNameAndSValueCallback: (row: any) => {
      name: string;
      svalue: string;
    },
  ): { result: any; process: () => string[] | Error };
  protected getEntitiesRowLike<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    selectors: Selector[],
    performQueryCallback: (data: {
      options: Options<T>;
      selectors: FormattedSelector[];
      etype: string;
    }) => {
      result: any;
    },
    rowFetchCallback: () => any,
    freeResultCallback: () => void,
    getCountCallback: (row: any) => number,
    getGUIDCallback: (row: any) => string,
    getTagsAndDatesCallback: (row: any) => {
      tags: string[];
      cdate: number;
      mdate: number;
    },
    getDataNameAndSValueCallback: (row: any) => {
      name: string;
      svalue: string;
    },
  ): {
    result: any;
    process: () => EntityInstanceType<T>[] | Error;
  };
  protected getEntitiesRowLike<T extends EntityConstructor = EntityConstructor>(
    options: Options<T>,
    selectors: Selector[],
    performQueryCallback: (data: {
      options: Options<T>;
      selectors: FormattedSelector[];
      etype: string;
    }) => {
      result: any;
    },
    rowFetchCallback: () => any,
    freeResultCallback: () => void,
    getCountCallback: (row: any) => number,
    getGUIDCallback: (row: any) => string,
    getTagsAndDatesCallback: (row: any) => {
      tags: string[];
      cdate: number;
      mdate: number;
    },
    getDataNameAndSValueCallback: (row: any) => {
      name: string;
      svalue: string;
    },
  ): {
    result: any;
    process: () => EntityInstanceType<T>[] | string[] | number | Error;
  } {
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
          'Invalid query selector passed: ' + JSON.stringify(selector),
        );
      }
    }

    let entities: EntityInstanceType<T>[] | string[] = [];
    let count = 0;
    const EntityClass =
      options.class ?? (this.nymph.getEntityClass('Entity') as T);
    const etype = EntityClass.ETYPE;

    // Check if the requested entity is cached.
    if (
      this.nymph.config.cache &&
      !options.skipCache &&
      selectors.length &&
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
        const entity = this.pullCache<EntityInstanceType<T>>(
          selectors[0]['guid'],
          EntityClass.class,
          !!options.skipAc,
        );
        if (
          entity != null &&
          entity.guid != null &&
          (!('tag' in selectors[0]) ||
            entity.hasTag(
              ...(Array.isArray(selectors[0].tag)
                ? selectors[0].tag
                : [selectors[0].tag]),
            ))
        ) {
          const guid = entity.guid;
          return {
            result: Promise.resolve(null),
            process: () =>
              options.return === 'count'
                ? guid
                  ? 1
                  : 0
                : options.return === 'guid'
                  ? [guid]
                  : [entity],
          };
        }
      }
    }

    try {
      const formattedSelectors = this.formatSelectors(selectors, options);
      this.nymph.runQueryCallbacks(options, formattedSelectors.selectors);
      for (let i = 0; i < formattedSelectors.qrefs.length; i++) {
        const [options, ...selectors] = formattedSelectors.qrefs[i];
        this.nymph.runQueryCallbacks(options, selectors);
        formattedSelectors.qrefs[i] = [options, ...selectors];
      }
      const { result } = performQueryCallback({
        options,
        selectors: formattedSelectors.selectors,
        etype,
      });

      return {
        result,
        process: () => {
          let row = rowFetchCallback();
          if (options.return === 'count') {
            while (row != null) {
              count += getCountCallback(row);
              row = rowFetchCallback();
            }
          } else if (options.return === 'guid') {
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
              const entity = EntityClass.factorySync() as EntityInstanceType<T>;
              entity.$nymph = this.nymph;
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
              if (this.nymph.config.cache) {
                this.pushCache(guid, cdate, mdate, tags, data, sdata);
              }
              // @ts-ignore: ts doesn't know the return type here.
              entities.push(entity);
            }
          }

          freeResultCallback();

          return options.return === 'count' ? count : entities;
        },
      };
    } catch (e: any) {
      return {
        result: Promise.resolve(e),
        process: () => {
          return e;
        },
      };
    }
  }

  protected async saveEntityRowLike(
    entity: EntityInterface,
    saveNewEntityCallback: (data: {
      entity: EntityInterface;
      guid: string;
      tags: string[];
      data: EntityData;
      sdata: SerializedEntityData;
      uniques: string[];
      cdate: number;
      etype: string;
    }) => Promise<boolean>,
    saveExistingEntityCallback: (data: {
      entity: EntityInterface;
      guid: string;
      tags: string[];
      data: EntityData;
      sdata: SerializedEntityData;
      uniques: string[];
      mdate: number;
      etype: string;
    }) => Promise<boolean>,
    startTransactionCallback: (() => Promise<void>) | null = null,
    commitTransactionCallback:
      | ((success: boolean) => Promise<boolean>)
      | null = null,
  ) {
    // Get a modified date.
    let mdate = Date.now();
    if (entity.mdate != null) {
      if (this.nymph.config.updateMDate === false) {
        mdate = entity.mdate;
      } else if (typeof this.nymph.config.updateMDate === 'number') {
        mdate = entity.mdate + this.nymph.config.updateMDate;
      }
    }
    const tags = difference(entity.tags, ['']);
    const data = entity.$getData();
    const sdata = entity.$getSData();
    const uniques = await entity.$getUniques();
    const EntityClass = entity.constructor as EntityConstructor;
    const etype = EntityClass.ETYPE;
    if (startTransactionCallback) {
      await startTransactionCallback();
    }
    let success = false;
    if (entity.guid == null) {
      const cdate = mdate;
      const newId = guid();
      success = await saveNewEntityCallback({
        entity,
        guid: newId,
        tags,
        data,
        sdata,
        uniques,
        cdate,
        etype,
      });
      if (success) {
        entity.guid = newId;
        entity.cdate = cdate;
        entity.mdate = mdate;
      }
    } else {
      // Removed any cached versions of this entity.
      if (this.nymph.config.cache) {
        this.cleanCache(entity.guid);
      }
      success = await saveExistingEntityCallback({
        entity,
        guid: entity.guid,
        tags,
        data,
        sdata,
        uniques,
        mdate,
        etype,
      });
      if (success) {
        entity.mdate = mdate;
      }
    }
    if (commitTransactionCallback) {
      success = await commitTransactionCallback(success);
    }
    // Cache the entity.
    if (success && this.nymph.config.cache) {
      this.pushCache(
        entity.guid as string,
        entity.cdate as number,
        entity.mdate as number,
        entity.tags,
        data,
        sdata,
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
  protected pullCache<T extends Entity>(
    guid: string,
    className: string,
    useSkipAc = false,
  ): T | null {
    // Increment the entity access count.
    if (!(guid in this.entityCount)) {
      this.entityCount[guid] = 0;
    }
    this.entityCount[guid]++;
    if (guid in this.entityCache) {
      const entity = this.nymph.getEntityClass(className).factorySync() as T;
      if (entity) {
        entity.$nymph = this.nymph;
        entity.$useSkipAc(!!useSkipAc);
        entity.guid = guid;
        entity.cdate = this.entityCache[guid]['cdate'];
        entity.mdate = this.entityCache[guid]['mdate'];
        entity.tags = this.entityCache[guid]['tags'];
        entity.$putData(
          this.entityCache[guid]['data'],
          this.entityCache[guid]['sdata'],
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
    sdata: SerializedEntityData,
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
    if (this.entityCount[guid] < this.nymph.config.cacheThreshold) {
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
      this.nymph.config.cacheLimit &&
      Object.keys(this.entityCache).length >= this.nymph.config.cacheLimit
    ) {
      // Find which entity has been accessed the least.
      const least =
        Object.entries(this.entityCount)
          .sort(([_guidA, countA], [_guidB, countB]) => countA - countB)
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
