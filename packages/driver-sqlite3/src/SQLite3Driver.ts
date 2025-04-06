import SQLite3 from 'better-sqlite3';
import {
  NymphDriver,
  type EntityConstructor,
  type EntityData,
  type EntityObjectType,
  type EntityInterface,
  type EntityInstanceType,
  type SerializedEntityData,
  type FormattedSelector,
  type Options,
  type Selector,
  EntityUniqueConstraintError,
  InvalidParametersError,
  NotConfiguredError,
  QueryFailedError,
  UnableToConnectError,
  xor,
} from '@nymphjs/nymph';
import { makeTableSuffix } from '@nymphjs/guid';

import {
  SQLite3DriverConfig,
  SQLite3DriverConfigDefaults as defaults,
} from './conf/index.js';

class InternalStore {
  public link: SQLite3.Database;
  public linkWrite?: SQLite3.Database;
  public connected: boolean = false;
  public transactionsStarted = 0;

  constructor(link: SQLite3.Database) {
    this.link = link;
  }
}

/**
 * The SQLite3 Nymph database driver.
 */
export default class SQLite3Driver extends NymphDriver {
  public config: SQLite3DriverConfig;
  protected prefix: string;
  // @ts-ignore: this is assigned in connect(), which is called by the constructor.
  protected store: InternalStore;

  static escape(input: string) {
    if (input.indexOf('\x00') !== -1) {
      throw new InvalidParametersError(
        'SQLite3 identifiers (like entity ETYPE) cannot contain null characters.',
      );
    }

    return '"' + input.replace(/"/g, () => '""') + '"';
  }

  constructor(config: Partial<SQLite3DriverConfig>, store?: InternalStore) {
    super();
    this.config = { ...defaults, ...config };
    if (this.config.filename === ':memory:') {
      this.config.explicitWrite = true;
    }
    this.prefix = this.config.prefix;
    if (store) {
      this.store = store;
    } else {
      this.connect();
    }
  }

  /**
   * This is used internally by Nymph. Don't call it yourself.
   *
   * @returns A clone of this instance.
   */
  public clone() {
    return new SQLite3Driver(this.config, this.store);
  }

  /**
   * Connect to the SQLite3 database.
   *
   * @returns Whether this instance is connected to a SQLite3 database.
   */
  public connect() {
    if (this.store && this.store.connected) {
      return Promise.resolve(true);
    }

    // Connecting
    this._connect(false);

    return Promise.resolve(this.store.connected);
  }

  private _connect(write: boolean) {
    const { filename, fileMustExist, timeout, explicitWrite, wal, verbose } =
      this.config;

    try {
      const setOptions = (link: SQLite3.Database) => {
        // Set database and connection options.
        if (wal) {
          link.pragma('journal_mode = WAL;');
        }
        link.pragma('encoding = "UTF-8";');
        link.pragma('foreign_keys = 1;');
        link.pragma('case_sensitive_like = 1;');
        for (let pragma of this.config.pragmas) {
          link.pragma(pragma);
        }
        // Create the preg_match and regexp functions.
        link.function('regexp', { deterministic: true }, ((
          pattern: string,
          subject: string,
        ) => (this.posixRegexMatch(pattern, subject) ? 1 : 0)) as (
          ...params: any[]
        ) => any);
      };

      let link: SQLite3.Database;
      try {
        link = new SQLite3(filename, {
          readonly: !explicitWrite && !write,
          fileMustExist,
          timeout,
          verbose,
        });
      } catch (e: any) {
        if (
          e.code === 'SQLITE_CANTOPEN' &&
          !explicitWrite &&
          !write &&
          !this.config.fileMustExist
        ) {
          // This happens when the file doesn't exist and we attempt to open it
          // readonly.
          // First open it in write mode.
          const writeLink = new SQLite3(filename, {
            readonly: false,
            fileMustExist,
            timeout,
            verbose,
          });
          setOptions(writeLink);
          writeLink.close();
          // Now open in readonly.
          link = new SQLite3(filename, {
            readonly: true,
            fileMustExist,
            timeout,
            verbose,
          });
        } else {
          throw e;
        }
      }

      if (!this.store) {
        if (write) {
          throw new Error(
            'Tried to open in write without opening in read first.',
          );
        }
        this.store = new InternalStore(link);
      } else if (write) {
        this.store.linkWrite = link;
      } else {
        this.store.link = link;
      }
      this.store.connected = true;
      setOptions(link);
    } catch (e: any) {
      if (this.store) {
        this.store.connected = false;
      }
      if (filename === ':memory:') {
        throw new NotConfiguredError(
          "It seems the config hasn't been set up correctly. Could not connect: " +
            e?.message,
        );
      } else {
        throw new UnableToConnectError('Could not connect: ' + e?.message);
      }
    }
  }

  /**
   * Disconnect from the SQLite3 database.
   *
   * @returns Whether this instance is connected to a SQLite3 database.
   */
  public async disconnect() {
    if (this.store.connected) {
      if (this.store.linkWrite && !this.config.explicitWrite) {
        this.store.linkWrite.exec('PRAGMA optimize;');
        this.store.linkWrite.close();
        this.store.linkWrite = undefined;
      }
      if (this.config.explicitWrite) {
        this.store.link.exec('PRAGMA optimize;');
      }
      this.store.link.close();
      this.store.transactionsStarted = 0;
      this.store.connected = false;
    }
    return this.store.connected;
  }

  public async inTransaction() {
    return this.store.transactionsStarted > 0;
  }

  /**
   * Check connection status.
   *
   * @returns Whether this instance is connected to a SQLite3 database.
   */
  public isConnected() {
    return this.store.connected;
  }

  /**
   * Create entity tables in the database.
   *
   * @param etype The entity type to create a table for. If this is blank, the default tables are created.
   */
  private createTables(etype: string | null = null) {
    this.startTransaction('nymph-tablecreation');
    try {
      if (etype != null) {
        // Create the entity table.
        this.queryRun(
          `CREATE TABLE IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`,
          )} ("guid" CHARACTER(24) PRIMARY KEY, "tags" TEXT, "cdate" REAL NOT NULL, "mdate" REAL NOT NULL);`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}_id_cdate`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`,
          )} ("cdate");`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}_id_mdate`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`,
          )} ("mdate");`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}_id_tags`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`,
          )} ("tags");`,
        );
        // Create the data table.
        this.queryRun(
          `CREATE TABLE IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`,
          )} ("guid" CHARACTER(24) NOT NULL REFERENCES ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`,
          )} ("guid") ON DELETE CASCADE, "name" TEXT NOT NULL, "value" CHARACTER(1) NOT NULL, "json" BLOB, "string" TEXT, "number" REAL, "truthy" INTEGER, PRIMARY KEY("guid", "name"));`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}_id_guid`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`,
          )} ("guid");`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}_id_guid_name`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`,
          )} ("guid", "name");`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}_id_guid__name_user`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`,
          )} ("guid") WHERE "name" = \'user\';`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}_id_guid__name_group`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`,
          )} ("guid") WHERE "name" = \'group\';`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}_id_name`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`,
          )} ("name");`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}_id_name__truthy`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`,
          )} ("name") WHERE "truthy" = 1;`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}_id_name__falsy`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`,
          )} ("name") WHERE "truthy" <> 1;`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}_id_name_string`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`,
          )} ("name", "string");`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}_id_name_number`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`,
          )} ("name", "number");`,
        );
        // Create the references table.
        this.queryRun(
          `CREATE TABLE IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}`,
          )} ("guid" CHARACTER(24) NOT NULL REFERENCES ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`,
          )} ("guid") ON DELETE CASCADE, "name" TEXT NOT NULL, "reference" CHARACTER(24) NOT NULL, PRIMARY KEY("guid", "name", "reference"));`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}_id_guid`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}`,
          )} ("guid");`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}_id_name`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}`,
          )} ("name");`,
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}_id_name_reference`,
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}`,
          )} ("name", "reference");`,
        );
        // Create the unique strings table.
        this.queryRun(
          `CREATE TABLE IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}uniques_${etype}`,
          )} ("guid" CHARACTER(24) NOT NULL REFERENCES ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`,
          )} ("guid") ON DELETE CASCADE, "unique" TEXT NOT NULL UNIQUE, PRIMARY KEY("guid", "unique"));`,
        );
      } else {
        // Create the UID table.
        this.queryRun(
          `CREATE TABLE IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}uids`,
          )} ("name" TEXT PRIMARY KEY NOT NULL, "cur_uid" INTEGER NOT NULL);`,
        );
      }
    } catch (e: any) {
      this.rollback('nymph-tablecreation');
      throw e;
    }

    this.commit('nymph-tablecreation');
    return true;
  }

  private query<T extends () => any>(
    runQuery: T,
    query: string,
    etypes: string[] = [],
  ): ReturnType<T> {
    try {
      this.nymph.config.debugInfo('sqlite3:query', query);
      return runQuery();
    } catch (e: any) {
      const errorCode = e?.code;
      const errorMsg = e?.message;
      if (
        errorCode === 'SQLITE_ERROR' &&
        errorMsg.match(/^no such table: /) &&
        this.createTables()
      ) {
        for (let etype of etypes) {
          this.createTables(etype);
        }
        try {
          return runQuery();
        } catch (e2: any) {
          throw new QueryFailedError(
            'Query failed: ' + e2?.code + ' - ' + e2?.message,
            query,
          );
        }
      } else if (
        errorCode === 'SQLITE_CONSTRAINT_UNIQUE' &&
        errorMsg.match(/^UNIQUE constraint failed: /)
      ) {
        throw new EntityUniqueConstraintError(`Unique constraint violation.`);
      } else {
        throw new QueryFailedError(
          'Query failed: ' + e?.code + ' - ' + e?.message,
          query,
        );
      }
    }
  }

  private queryArray(
    query: string,
    {
      etypes = [],
      params = {},
    }: { etypes?: string[]; params?: { [k: string]: any } } = {},
  ) {
    return this.query(
      () =>
        (this.store.linkWrite || this.store.link)
          .prepare(query)
          .iterate(params),
      `${query} -- ${JSON.stringify(params)}`,
      etypes,
    );
  }

  private queryGet(
    query: string,
    {
      etypes = [],
      params = {},
    }: { etypes?: string[]; params?: { [k: string]: any } } = {},
  ) {
    return this.query(
      () =>
        (this.store.linkWrite || this.store.link).prepare(query).get(params),
      `${query} -- ${JSON.stringify(params)}`,
      etypes,
    );
  }

  private queryRun(
    query: string,
    {
      etypes = [],
      params = {},
    }: { etypes?: string[]; params?: { [k: string]: any } } = {},
  ) {
    return this.query(
      () =>
        (this.store.linkWrite || this.store.link).prepare(query).run(params),
      `${query} -- ${JSON.stringify(params)}`,
      etypes,
    );
  }

  public async commit(name: string) {
    if (name == null || typeof name !== 'string' || name.length === 0) {
      throw new InvalidParametersError(
        'Transaction commit attempted without a name.',
      );
    }
    if (this.store.transactionsStarted === 0) {
      return true;
    }
    this.queryRun(`RELEASE SAVEPOINT ${SQLite3Driver.escape(name)};`);
    this.store.transactionsStarted--;

    if (
      this.store.transactionsStarted === 0 &&
      this.store.linkWrite &&
      !this.config.explicitWrite
    ) {
      this.store.linkWrite.exec('PRAGMA optimize;');
      this.store.linkWrite.close();
      this.store.linkWrite = undefined;
    }

    return true;
  }

  public async deleteEntityByID(
    guid: string,
    className?: EntityConstructor | string | null,
  ) {
    let EntityClass: EntityConstructor;
    if (typeof className === 'string' || className == null) {
      const GetEntityClass = this.nymph.getEntityClass(className ?? 'Entity');
      EntityClass = GetEntityClass;
    } else {
      EntityClass = className;
    }
    const etype = EntityClass.ETYPE;
    await this.startTransaction('nymph-delete');
    try {
      this.queryRun(
        `DELETE FROM ${SQLite3Driver.escape(
          `${this.prefix}entities_${etype}`,
        )} WHERE "guid"=@guid;`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
      this.queryRun(
        `DELETE FROM ${SQLite3Driver.escape(
          `${this.prefix}data_${etype}`,
        )} WHERE "guid"=@guid;`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
      this.queryRun(
        `DELETE FROM ${SQLite3Driver.escape(
          `${this.prefix}references_${etype}`,
        )} WHERE "guid"=@guid;`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
      this.queryRun(
        `DELETE FROM ${SQLite3Driver.escape(
          `${this.prefix}uniques_${etype}`,
        )} WHERE "guid"=@guid;`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
    } catch (e: any) {
      this.nymph.config.debugError('sqlite3', `Delete entity error: "${e}"`);
      await this.rollback('nymph-delete');
      throw e;
    }

    await this.commit('nymph-delete');
    // Remove any cached versions of this entity.
    if (this.nymph.config.cache) {
      this.cleanCache(guid);
    }
    return true;
  }

  public async deleteUID(name: string) {
    if (!name) {
      throw new InvalidParametersError('Name not given for UID');
    }
    await this.startTransaction('nymph-delete-uid');
    this.queryRun(
      `DELETE FROM ${SQLite3Driver.escape(
        `${this.prefix}uids`,
      )} WHERE "name"=@name;`,
      {
        params: {
          name,
        },
      },
    );
    await this.commit('nymph-delete-uid');
    return true;
  }

  public async *exportDataIterator(): AsyncGenerator<
    { type: 'comment' | 'uid' | 'entity'; content: string },
    void,
    false | undefined
  > {
    if (
      yield {
        type: 'comment',
        content: `#nex2
# Nymph Entity Exchange v2
# http://nymph.io
#
# Generation Time: ${new Date().toLocaleString()}
`,
      }
    ) {
      return;
    }

    if (
      yield {
        type: 'comment',
        content: `

#
# UIDs
#

`,
      }
    ) {
      return;
    }

    // Export UIDs.
    let uids: IterableIterator<any> = this.queryArray(
      `SELECT * FROM ${SQLite3Driver.escape(
        `${this.prefix}uids`,
      )} ORDER BY "name";`,
    );
    for (const uid of uids) {
      if (yield { type: 'uid', content: `<${uid.name}>[${uid.cur_uid}]\n` }) {
        return;
      }
    }

    if (
      yield {
        type: 'comment',
        content: `

#
# Entities
#

`,
      }
    ) {
      return;
    }

    // Get the etypes.
    const tables: IterableIterator<any> = this.queryArray(
      "SELECT `name` FROM `sqlite_master` WHERE `type`='table' AND `name` LIKE @prefix;",
      {
        params: {
          prefix: this.prefix + 'entities_' + '%',
        },
      },
    );
    const etypes = [];
    for (const table of tables) {
      etypes.push(table.name.substr((this.prefix + 'entities_').length));
    }

    for (const etype of etypes) {
      // Export entities.
      const dataIterator: IterableIterator<any> = this.queryArray(
        `SELECT e.*, d."name", d."value", json(d."json") as "json", d."string", d."number" FROM ${SQLite3Driver.escape(
          `${this.prefix}entities_${etype}`,
        )} e LEFT JOIN ${SQLite3Driver.escape(
          `${this.prefix}data_${etype}`,
        )} d USING ("guid") ORDER BY e."guid";`,
      )[Symbol.iterator]();
      let datum = dataIterator.next();
      while (!datum.done) {
        const guid = datum.value.guid;
        const tags = datum.value.tags.slice(1, -1);
        const cdate = datum.value.cdate;
        const mdate = datum.value.mdate;
        let currentEntityExport: string[] = [];
        currentEntityExport.push(`{${guid}}<${etype}>[${tags}]`);
        currentEntityExport.push(`\tcdate=${JSON.stringify(cdate)}`);
        currentEntityExport.push(`\tmdate=${JSON.stringify(mdate)}`);
        if (datum.value.name != null) {
          // This do will keep going and adding the data until the
          // next entity is reached. datum will end on the next entity.
          do {
            const value =
              datum.value.value === 'N'
                ? JSON.stringify(datum.value.number)
                : datum.value.value === 'S'
                  ? JSON.stringify(datum.value.string)
                  : datum.value.value === 'J'
                    ? datum.value.json
                    : datum.value.value;
            currentEntityExport.push(`\t${datum.value.name}=${value}`);
            datum = dataIterator.next();
          } while (!datum.done && datum.value.guid === guid);
        } else {
          // Make sure that datum is incremented :)
          datum = dataIterator.next();
        }
        currentEntityExport.push('');

        if (yield { type: 'entity', content: currentEntityExport.join('\n') }) {
          return;
        }
      }
    }
  }

  /**
   * Generate the SQLite3 query.
   * @param options The options array.
   * @param formattedSelectors The formatted selector array.
   * @param etype
   * @param count Used to track internal params.
   * @param params Used to store internal params.
   * @param subquery Whether only a subquery should be returned.
   * @returns The SQL query.
   */
  private makeEntityQuery(
    options: Options,
    formattedSelectors: FormattedSelector[],
    etype: string,
    count = { i: 0 },
    params: { [k: string]: any } = {},
    subquery = false,
    tableSuffix = '',
    etypes: string[] = [],
    guidSelector: string | undefined = undefined,
  ) {
    if (typeof options.class?.alterOptions === 'function') {
      options = options.class.alterOptions(options);
    }
    const eTable = `e${tableSuffix}`;
    const dTable = `d${tableSuffix}`;
    const fTable = `f${tableSuffix}`;
    const ieTable = `ie${tableSuffix}`;
    const sTable = `s${tableSuffix}`;
    const sort = options.sort ?? 'cdate';
    const queryParts = this.iterateSelectorsForQuery(
      formattedSelectors,
      ({ key, value, typeIsOr, typeIsNot }) => {
        const clauseNot = key.startsWith('!');
        let curQuery = '';
        for (const curValue of value) {
          switch (key) {
            case 'guid':
            case '!guid':
              for (const curGuid of curValue) {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const guid = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  ieTable +
                  '."guid"=@' +
                  guid;
                params[guid] = curGuid;
              }
              break;
            case 'tag':
            case '!tag':
              for (const curTag of curValue) {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const tag = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  ieTable +
                  '."tags" LIKE @' +
                  tag +
                  " ESCAPE '\\'";
                params[tag] =
                  '%,' +
                  curTag
                    .replace('\\', '\\\\')
                    .replace('%', '\\%')
                    .replace('_', '\\_') +
                  ',%';
              }
              break;
            case 'defined':
            case '!defined':
              for (const curVar of curValue) {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                curQuery +=
                  ieTable +
                  '."guid" ' +
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'IN (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE "name"=@' +
                  name +
                  ')';
                params[name] = curVar;
              }
              break;
            case 'truthy':
            case '!truthy':
              for (const curVar of curValue) {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                if (curVar === 'cdate') {
                  curQuery +=
                    (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                    '(' +
                    ieTable +
                    '."cdate" NOT NULL)';
                  break;
                } else if (curVar === 'mdate') {
                  curQuery +=
                    (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                    '(' +
                    ieTable +
                    '."mdate" NOT NULL)';
                  break;
                } else {
                  const name = `param${++count.i}`;
                  curQuery +=
                    (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                    'EXISTS (SELECT "guid" FROM ' +
                    SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                    ' WHERE "guid"=' +
                    ieTable +
                    '."guid" AND "name"=@' +
                    name +
                    ' AND "truthy"=1)';
                  params[name] = curVar;
                }
              }
              break;
            case 'equal':
            case '!equal':
              if (curValue[0] === 'cdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const cdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  ieTable +
                  '."cdate"=@' +
                  cdate;
                params[cdate] = Number(curValue[1]);
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  ieTable +
                  '."mdate"=@' +
                  mdate;
                params[mdate] = Number(curValue[1]);
                break;
              } else if (typeof curValue[1] === 'number') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE "guid"=' +
                  ieTable +
                  '."guid" AND "name"=@' +
                  name +
                  ' AND "number"=@' +
                  value +
                  ')';
                params[name] = curValue[0];
                params[value] = curValue[1];
              } else if (typeof curValue[1] === 'string') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE "guid"=' +
                  ieTable +
                  '."guid" AND "name"=@' +
                  name +
                  ' AND "string"=@' +
                  value +
                  ')';
                params[name] = curValue[0];
                params[value] = curValue[1];
              } else {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                let svalue: string;
                if (
                  curValue[1] instanceof Object &&
                  typeof curValue[1].toReference === 'function'
                ) {
                  svalue = JSON.stringify(curValue[1].toReference());
                } else {
                  svalue = JSON.stringify(curValue[1]);
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE "guid"=' +
                  ieTable +
                  '."guid" AND "name"=@' +
                  name +
                  ' AND "json"=jsonb(@' +
                  value +
                  '))';
                params[name] = curValue[0];
                params[value] = svalue;
              }
              break;
            case 'contain':
            case '!contain':
              if (curValue[0] === 'cdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const cdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  ieTable +
                  '."cdate"=@' +
                  cdate;
                params[cdate] = Number(curValue[1]);
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  ieTable +
                  '."mdate"=@' +
                  mdate;
                params[mdate] = Number(curValue[1]);
                break;
              } else {
                const containTableSuffix = makeTableSuffix();
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                let svalue: string;
                if (
                  curValue[1] instanceof Object &&
                  typeof curValue[1].toReference === 'function'
                ) {
                  svalue = JSON.stringify(curValue[1].toReference());
                } else {
                  svalue = JSON.stringify(curValue[1]);
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' d' +
                  containTableSuffix +
                  ' WHERE "guid"=' +
                  ieTable +
                  '."guid" AND "name"=@' +
                  name +
                  ' AND json(@' +
                  value +
                  ') IN (SELECT json_quote("value") FROM json_each(d' +
                  containTableSuffix +
                  '."json")))';
                params[name] = curValue[0];
                params[value] = svalue;
              }
              break;
            case 'match':
            case '!match':
              if (curValue[0] === 'cdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const cdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  '(' +
                  ieTable +
                  '."cdate" REGEXP @' +
                  cdate +
                  ')';
                params[cdate] = curValue[1];
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  '(' +
                  ieTable +
                  '."mdate" REGEXP @' +
                  mdate +
                  ')';
                params[mdate] = curValue[1];
                break;
              } else {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE "guid"=' +
                  ieTable +
                  '."guid" AND "name"=@' +
                  name +
                  ' AND "string" REGEXP @' +
                  value +
                  ')';
                params[name] = curValue[0];
                params[value] = curValue[1];
              }
              break;
            case 'imatch':
            case '!imatch':
              if (curValue[0] === 'cdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const cdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  '(' +
                  ieTable +
                  '."cdate" REGEXP @' +
                  cdate +
                  ')';
                params[cdate] = curValue[1];
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  '(' +
                  ieTable +
                  '."mdate" REGEXP @' +
                  mdate +
                  ')';
                params[mdate] = curValue[1];
                break;
              } else {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE "guid"=' +
                  ieTable +
                  '."guid" AND "name"=@' +
                  name +
                  ' AND lower("string") REGEXP lower(@' +
                  value +
                  '))';
                params[name] = curValue[0];
                params[value] = curValue[1];
              }
              break;
            case 'like':
            case '!like':
              if (curValue[0] === 'cdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const cdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  '(' +
                  ieTable +
                  '."cdate" LIKE @' +
                  cdate +
                  " ESCAPE '\\')";
                params[cdate] = curValue[1];
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  '(' +
                  ieTable +
                  '."mdate" LIKE @' +
                  mdate +
                  " ESCAPE '\\')";
                params[mdate] = curValue[1];
                break;
              } else {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE "guid"=' +
                  ieTable +
                  '."guid" AND "name"=@' +
                  name +
                  ' AND "string" LIKE @' +
                  value +
                  " ESCAPE '\\')";
                params[name] = curValue[0];
                params[value] = curValue[1];
              }
              break;
            case 'ilike':
            case '!ilike':
              if (curValue[0] === 'cdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const cdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  '(' +
                  ieTable +
                  '."cdate" LIKE @' +
                  cdate +
                  " ESCAPE '\\')";
                params[cdate] = curValue[1];
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  '(' +
                  ieTable +
                  '."mdate" LIKE @' +
                  mdate +
                  " ESCAPE '\\')";
                params[mdate] = curValue[1];
                break;
              } else {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE "guid"=' +
                  ieTable +
                  '."guid" AND "name"=@' +
                  name +
                  ' AND lower("string") LIKE lower(@' +
                  value +
                  ") ESCAPE '\\')";
                params[name] = curValue[0];
                params[value] = curValue[1];
              }
              break;
            case 'gt':
            case '!gt':
              if (curValue[0] === 'cdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const cdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  ieTable +
                  '."cdate">@' +
                  cdate;
                params[cdate] = Number(curValue[1]);
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  ieTable +
                  '."mdate">@' +
                  mdate;
                params[mdate] = Number(curValue[1]);
                break;
              } else {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE "guid"=' +
                  ieTable +
                  '."guid" AND "name"=@' +
                  name +
                  ' AND "number">@' +
                  value +
                  ')';
                params[name] = curValue[0];
                params[value] = Number(curValue[1]);
              }
              break;
            case 'gte':
            case '!gte':
              if (curValue[0] === 'cdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const cdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  ieTable +
                  '."cdate">=@' +
                  cdate;
                params[cdate] = Number(curValue[1]);
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  ieTable +
                  '."mdate">=@' +
                  mdate;
                params[mdate] = Number(curValue[1]);
                break;
              } else {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE "guid"=' +
                  ieTable +
                  '."guid" AND "name"=@' +
                  name +
                  ' AND "number">=@' +
                  value +
                  ')';
                params[name] = curValue[0];
                params[value] = Number(curValue[1]);
              }
              break;
            case 'lt':
            case '!lt':
              if (curValue[0] === 'cdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const cdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  ieTable +
                  '."cdate"<@' +
                  cdate;
                params[cdate] = Number(curValue[1]);
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  ieTable +
                  '."mdate"<@' +
                  mdate;
                params[mdate] = Number(curValue[1]);
                break;
              } else {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE "guid"=' +
                  ieTable +
                  '."guid" AND "name"=@' +
                  name +
                  ' AND "number"<@' +
                  value +
                  ')';
                params[name] = curValue[0];
                params[value] = Number(curValue[1]);
              }
              break;
            case 'lte':
            case '!lte':
              if (curValue[0] === 'cdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const cdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  ieTable +
                  '."cdate"<=@' +
                  cdate;
                params[cdate] = Number(curValue[1]);
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  ieTable +
                  '."mdate"<=@' +
                  mdate;
                params[mdate] = Number(curValue[1]);
                break;
              } else {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE "guid"=' +
                  ieTable +
                  '."guid" AND "name"=@' +
                  name +
                  ' AND "number"<=@' +
                  value +
                  ')';
                params[name] = curValue[0];
                params[value] = Number(curValue[1]);
              }
              break;
            case 'ref':
            case '!ref':
              let curQguid: string;
              if (typeof curValue[1] === 'string') {
                curQguid = curValue[1];
              } else if ('guid' in curValue[1]) {
                curQguid = curValue[1].guid;
              } else {
                curQguid = `${curValue[1]}`;
              }
              if (curQuery) {
                curQuery += typeIsOr ? ' OR ' : ' AND ';
              }
              const name = `param${++count.i}`;
              const guid = `param${++count.i}`;
              curQuery +=
                (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                'EXISTS (SELECT "guid" FROM ' +
                SQLite3Driver.escape(this.prefix + 'references_' + etype) +
                ' WHERE "guid"=' +
                ieTable +
                '."guid" AND "name"=@' +
                name +
                ' AND "reference"=@' +
                guid +
                ')';
              params[name] = curValue[0];
              params[guid] = curQguid;
              break;
            case 'selector':
            case '!selector':
              const subquery = this.makeEntityQuery(
                options,
                [curValue],
                etype,
                count,
                params,
                true,
                tableSuffix,
                etypes,
              );
              if (curQuery) {
                curQuery += typeIsOr ? ' OR ' : ' AND ';
              }
              curQuery +=
                (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                '(' +
                subquery.query +
                ')';
              break;
            case 'qref':
            case '!qref':
              const referenceTableSuffix = makeTableSuffix();
              const [qrefOptions, ...qrefSelectors] = curValue[1] as [
                Options,
                ...FormattedSelector[],
              ];
              const QrefEntityClass = qrefOptions.class as EntityConstructor;
              etypes.push(QrefEntityClass.ETYPE);
              const qrefQuery = this.makeEntityQuery(
                { ...qrefOptions, return: 'guid', class: QrefEntityClass },
                qrefSelectors,
                QrefEntityClass.ETYPE,
                count,
                params,
                false,
                makeTableSuffix(),
                etypes,
                'r' + referenceTableSuffix + '."reference"',
              );
              if (curQuery) {
                curQuery += typeIsOr ? ' OR ' : ' AND ';
              }
              const qrefName = `param${++count.i}`;
              curQuery +=
                (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                'EXISTS (SELECT "guid" FROM ' +
                SQLite3Driver.escape(this.prefix + 'references_' + etype) +
                ' r' +
                referenceTableSuffix +
                ' WHERE r' +
                referenceTableSuffix +
                '."guid"=' +
                ieTable +
                '."guid" AND r' +
                referenceTableSuffix +
                '."name"=@' +
                qrefName +
                ' AND EXISTS (' +
                qrefQuery.query +
                '))';
              params[qrefName] = curValue[0];
              break;
          }
        }
        return curQuery;
      },
    );

    let sortBy: string;
    let sortByInner: string;
    let sortJoin = '';
    const order = options.reverse ? ' DESC' : '';
    switch (sort) {
      case 'mdate':
        sortBy = `${eTable}."mdate"${order}`;
        sortByInner = `${ieTable}."mdate"${order}`;
        break;
      case 'cdate':
        sortBy = `${eTable}."cdate"${order}`;
        sortByInner = `${ieTable}."cdate"${order}`;
        break;
      default:
        const name = `param${++count.i}`;
        sortJoin = `LEFT JOIN (
            SELECT "guid", "string", "number"
            FROM ${SQLite3Driver.escape(this.prefix + 'data_' + etype)}
            WHERE "name"=@${name}
            ORDER BY "number"${order}, "string"${order}
          ) ${sTable} USING ("guid")`;
        sortBy = `${sTable}."number"${order}, ${sTable}."string"${order}`;
        sortByInner = sortBy;
        params[name] = sort;
        break;
    }

    let query: string;
    if (queryParts.length) {
      if (subquery) {
        query = '(' + queryParts.join(') AND (') + ')';
      } else {
        let limit = '';
        if ('limit' in options) {
          limit = ` LIMIT ${Math.floor(Number(options.limit))}`;
        }
        let offset = '';
        if ('offset' in options) {
          offset = ` OFFSET ${Math.floor(Number(options.offset))}`;
        }
        const whereClause = queryParts.join(') AND (');
        const guidClause = guidSelector
          ? `${ieTable}."guid"=${guidSelector} AND `
          : '';
        if (options.return === 'count') {
          if (limit || offset) {
            query = `SELECT COUNT("guid") AS "count" FROM (
                SELECT "guid"
                FROM ${SQLite3Driver.escape(
                  this.prefix + 'entities_' + etype,
                )} ${ieTable}
                WHERE ${guidClause}(${whereClause})${limit}${offset}
              )`;
          } else {
            query = `SELECT COUNT("guid") AS "count"
              FROM ${SQLite3Driver.escape(
                this.prefix + 'entities_' + etype,
              )} ${ieTable}
              WHERE ${guidClause}(${whereClause})`;
          }
        } else if (options.return === 'guid') {
          query = `SELECT "guid"
            FROM ${SQLite3Driver.escape(
              this.prefix + 'entities_' + etype,
            )} ${ieTable}
            ${sortJoin}
            WHERE ${guidClause}(${whereClause})
            ORDER BY ${sortByInner}, "guid"${limit}${offset}`;
        } else {
          query = `SELECT
              ${eTable}."guid",
              ${eTable}."tags",
              ${eTable}."cdate",
              ${eTable}."mdate",
              ${dTable}."name",
              ${dTable}."value",
              json(${dTable}."json") as "json",
              ${dTable}."string",
              ${dTable}."number"
            FROM ${SQLite3Driver.escape(
              this.prefix + 'entities_' + etype,
            )} ${eTable}
            LEFT JOIN ${SQLite3Driver.escape(
              this.prefix + 'data_' + etype,
            )} ${dTable} USING ("guid")
            ${sortJoin}
            INNER JOIN (
              SELECT "guid"
              FROM ${SQLite3Driver.escape(
                this.prefix + 'entities_' + etype,
              )} ${ieTable}
              ${sortJoin}
              WHERE ${guidClause}(${whereClause})
              ORDER BY ${sortByInner}${limit}${offset}
            ) ${fTable} USING ("guid")
            ORDER BY ${sortBy}, ${eTable}."guid"`;
        }
      }
    } else {
      if (subquery) {
        query = '';
      } else {
        let limit = '';
        if ('limit' in options) {
          limit = ` LIMIT ${Math.floor(Number(options.limit))}`;
        }
        let offset = '';
        if ('offset' in options) {
          offset = ` OFFSET ${Math.floor(Number(options.offset))}`;
        }
        const guidClause = guidSelector
          ? ` WHERE ${ieTable}."guid"=${guidSelector}`
          : '';
        if (options.return === 'count') {
          if (limit || offset) {
            query = `SELECT COUNT("guid") AS "count" FROM (
                SELECT "guid"
                FROM ${SQLite3Driver.escape(
                  this.prefix + 'entities_' + etype,
                )} ${ieTable}${guidClause}${limit}${offset}
              )`;
          } else {
            query = `SELECT COUNT("guid") AS "count"
              FROM ${SQLite3Driver.escape(
                this.prefix + 'entities_' + etype,
              )} ${ieTable}${guidClause}`;
          }
        } else if (options.return === 'guid') {
          query = `SELECT "guid"
            FROM ${SQLite3Driver.escape(
              this.prefix + 'entities_' + etype,
            )} ${ieTable}
            ${sortJoin}
            ${guidClause}
            ORDER BY ${sortByInner}, "guid"${limit}${offset}`;
        } else {
          if (limit || offset) {
            query = `SELECT
                ${eTable}."guid",
                ${eTable}."tags",
                ${eTable}."cdate",
                ${eTable}."mdate",
                ${dTable}."name",
                ${dTable}."value",
                json(${dTable}."json") as "json",
                ${dTable}."string",
                ${dTable}."number"
              FROM ${SQLite3Driver.escape(
                this.prefix + 'entities_' + etype,
              )} ${eTable}
              LEFT JOIN ${SQLite3Driver.escape(
                this.prefix + 'data_' + etype,
              )} ${dTable} USING ("guid")
              ${sortJoin}
              INNER JOIN (
                SELECT "guid"
                FROM ${SQLite3Driver.escape(
                  this.prefix + 'entities_' + etype,
                )} ${ieTable}
                ${sortJoin}
                ${guidClause}
                ORDER BY ${sortByInner}${limit}${offset}
              ) ${fTable} USING ("guid")
              ORDER BY ${sortBy}, ${eTable}."guid"`;
          } else {
            query = `SELECT
                ${eTable}."guid",
                ${eTable}."tags",
                ${eTable}."cdate",
                ${eTable}."mdate",
                ${dTable}."name",
                ${dTable}."value",
                json(${dTable}."json") as "json",
                ${dTable}."string",
                ${dTable}."number"
              FROM ${SQLite3Driver.escape(
                this.prefix + 'entities_' + etype,
              )} ${eTable}
              LEFT JOIN ${SQLite3Driver.escape(
                this.prefix + 'data_' + etype,
              )} ${dTable} USING ("guid")
              ${sortJoin}
              ${guidSelector ? `WHERE ${eTable}."guid"=${guidSelector}` : ''}
              ORDER BY ${sortBy}, ${eTable}."guid"`;
          }
        }
      }
    }

    if (etypes.indexOf(etype) === -1) {
      etypes.push(etype);
    }

    return {
      query,
      params,
      etypes,
    };
  }

  protected performQuery(
    options: Options,
    formattedSelectors: FormattedSelector[],
    etype: string,
  ): {
    result: any;
  } {
    const { query, params, etypes } = this.makeEntityQuery(
      options,
      formattedSelectors,
      etype,
    );
    const result = this.queryArray(query, { etypes, params })[
      Symbol.iterator
    ]();
    return {
      result,
    };
  }

  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'count' },
    ...selectors: Selector[]
  ): Promise<number>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string[]>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'object' },
    ...selectors: Selector[]
  ): Promise<EntityObjectType<T>[]>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options?: Options<T>,
    ...selectors: Selector[]
  ): Promise<EntityInstanceType<T>[]>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> = {},
    ...selectors: Selector[]
  ): Promise<
    EntityInstanceType<T>[] | EntityObjectType<T>[] | string[] | number
  > {
    const { result, process } = this.getEntitiesRowLike<T>(
      options,
      selectors,
      ({ options, selectors, etype }) =>
        this.performQuery(options, selectors, etype),
      () => {
        const next: any = result.next();
        return next.done ? null : next.value;
      },
      () => undefined,
      (row) => Number(row.count),
      (row) => row.guid,
      (row) => ({
        tags:
          row.tags.length > 2
            ? row.tags
                .slice(1, -1)
                .split(',')
                .filter((tag: string) => tag)
            : [],
        cdate: Number(row.cdate),
        mdate: Number(row.mdate),
      }),
      (row) => ({
        name: row.name,
        svalue:
          row.value === 'N'
            ? JSON.stringify(row.number)
            : row.value === 'S'
              ? JSON.stringify(row.string)
              : row.value === 'J'
                ? row.json
                : row.value,
      }),
    );
    const value = process();
    if (value instanceof Error) {
      throw value;
    }
    return value;
  }

  public async getUID(name: string) {
    if (name == null) {
      throw new InvalidParametersError('Name not given for UID.');
    }
    const result: any = this.queryGet(
      `SELECT "cur_uid" FROM ${SQLite3Driver.escape(
        `${this.prefix}uids`,
      )} WHERE "name"=@name;`,
      {
        params: {
          name: name,
        },
      },
    );
    return (result?.cur_uid as number | null) ?? null;
  }

  public async importEntity({
    guid,
    cdate,
    mdate,
    tags,
    sdata,
    etype,
  }: {
    guid: string;
    cdate: number;
    mdate: number;
    tags: string[];
    sdata: SerializedEntityData;
    etype: string;
  }) {
    try {
      this.queryRun(
        `DELETE FROM ${SQLite3Driver.escape(
          `${this.prefix}entities_${etype}`,
        )} WHERE "guid"=@guid;`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
      this.queryRun(
        `DELETE FROM ${SQLite3Driver.escape(
          `${this.prefix}data_${etype}`,
        )} WHERE "guid"=@guid;`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
      this.queryRun(
        `DELETE FROM ${SQLite3Driver.escape(
          `${this.prefix}references_${etype}`,
        )} WHERE "guid"=@guid;`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
      this.queryRun(
        `DELETE FROM ${SQLite3Driver.escape(
          `${this.prefix}uniques_${etype}`,
        )} WHERE "guid"=@guid;`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );

      this.queryRun(
        `INSERT INTO ${SQLite3Driver.escape(
          `${this.prefix}entities_${etype}`,
        )} ("guid", "tags", "cdate", "mdate") VALUES (@guid, @tags, @cdate, @mdate);`,
        {
          etypes: [etype],
          params: {
            guid,
            tags: ',' + tags.join(',') + ',',
            cdate,
            mdate,
          },
        },
      );
      for (const name in sdata) {
        const value = sdata[name];
        const uvalue = JSON.parse(value);
        if (value === undefined) {
          continue;
        }
        const storageValue =
          typeof uvalue === 'number'
            ? 'N'
            : typeof uvalue === 'string'
              ? 'S'
              : 'J';
        const jsonValue = storageValue === 'J' ? value : null;
        this.queryRun(
          `INSERT INTO ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`,
          )} ("guid", "name", "value", "json", "string", "number", "truthy") VALUES (@guid, @name, @storageValue, jsonb(@jsonValue), @string, @number, @truthy);`,
          {
            etypes: [etype],
            params: {
              guid,
              name,
              storageValue,
              jsonValue,
              string: storageValue === 'J' ? null : `${uvalue}`,
              number: Number(uvalue),
              truthy: uvalue ? 1 : 0,
            },
          },
        );
        const references = this.findReferences(value);
        for (const reference of references) {
          this.queryRun(
            `INSERT INTO ${SQLite3Driver.escape(
              `${this.prefix}references_${etype}`,
            )} ("guid", "name", "reference") VALUES (@guid, @name, @reference);`,
            {
              etypes: [etype],
              params: {
                guid,
                name,
                reference,
              },
            },
          );
        }
      }
      const uniques = await this.nymph
        .getEntityClassByEtype(etype)
        .getUniques({ guid, cdate, mdate, tags, data: {}, sdata });
      for (const unique of uniques) {
        try {
          this.queryRun(
            `INSERT INTO ${SQLite3Driver.escape(
              `${this.prefix}uniques_${etype}`,
            )} ("guid", "unique") VALUES (@guid, @unique);`,
            {
              etypes: [etype],
              params: {
                guid,
                unique,
              },
            },
          );
        } catch (e: any) {
          if (e instanceof EntityUniqueConstraintError) {
            this.nymph.config.debugError(
              'sqlite3',
              `Import entity unique constraint violation for GUID "${guid}" on etype "${etype}": "${unique}"`,
            );
          }
          throw e;
        }
      }
    } catch (e: any) {
      this.nymph.config.debugError('sqlite3', `Import entity error: "${e}"`);
      throw e;
    }
  }

  public async importUID({ name, value }: { name: string; value: number }) {
    try {
      await this.startTransaction(`nymph-import-uid-${name}`);
      this.queryRun(
        `DELETE FROM ${SQLite3Driver.escape(
          `${this.prefix}uids`,
        )} WHERE "name"=@name;`,
        {
          params: {
            name,
          },
        },
      );
      this.queryRun(
        `INSERT INTO ${SQLite3Driver.escape(
          `${this.prefix}uids`,
        )} ("name", "cur_uid") VALUES (@name, @value);`,
        {
          params: {
            name,
            value,
          },
        },
      );
      await this.commit(`nymph-import-uid-${name}`);
    } catch (e: any) {
      this.nymph.config.debugError('sqlite3', `Import UID error: "${e}"`);
      await this.rollback(`nymph-import-uid-${name}`);
      throw e;
    }
  }

  public async newUID(name: string) {
    if (name == null) {
      throw new InvalidParametersError('Name not given for UID.');
    }
    await this.startTransaction('nymph-newuid');
    let curUid: number | undefined = undefined;
    try {
      curUid =
        (
          this.queryGet(
            `SELECT "cur_uid" FROM ${SQLite3Driver.escape(
              `${this.prefix}uids`,
            )} WHERE "name"=@name;`,
            {
              params: {
                name,
              },
            },
          ) as any
        )?.cur_uid ?? null;
      if (curUid == null) {
        curUid = 1;
        this.queryRun(
          `INSERT INTO ${SQLite3Driver.escape(
            `${this.prefix}uids`,
          )} ("name", "cur_uid") VALUES (@name, @curUid);`,
          {
            params: {
              name,
              curUid,
            },
          },
        );
      } else {
        curUid++;
        this.queryRun(
          `UPDATE ${SQLite3Driver.escape(
            `${this.prefix}uids`,
          )} SET "cur_uid"=@curUid WHERE "name"=@name;`,
          {
            params: {
              curUid,
              name,
            },
          },
        );
      }
    } catch (e: any) {
      this.nymph.config.debugError('sqlite3', `New UID error: "${e}"`);
      await this.rollback('nymph-newuid');
      throw e;
    }

    await this.commit('nymph-newuid');
    return curUid as number;
  }

  public async renameUID(oldName: string, newName: string) {
    if (oldName == null || newName == null) {
      throw new InvalidParametersError('Name not given for UID.');
    }
    await this.startTransaction('nymph-rename-uid');
    this.queryRun(
      `UPDATE ${SQLite3Driver.escape(
        `${this.prefix}uids`,
      )} SET "name"=@newName WHERE "name"=@oldName;`,
      {
        params: {
          newName,
          oldName,
        },
      },
    );
    await this.commit('nymph-rename-uid');
    return true;
  }

  public async rollback(name: string) {
    if (name == null || typeof name !== 'string' || name.length === 0) {
      throw new InvalidParametersError(
        'Transaction rollback attempted without a name.',
      );
    }
    if (this.store.transactionsStarted === 0) {
      return true;
    }
    this.queryRun(`ROLLBACK TO SAVEPOINT ${SQLite3Driver.escape(name)};`);
    this.store.transactionsStarted--;

    if (
      this.store.transactionsStarted === 0 &&
      this.store.linkWrite &&
      !this.config.explicitWrite
    ) {
      this.store.linkWrite.exec('PRAGMA optimize;');
      this.store.linkWrite.close();
      this.store.linkWrite = undefined;
    }

    return true;
  }

  public async saveEntity(entity: EntityInterface) {
    const insertData = (
      guid: string,
      data: EntityData,
      sdata: SerializedEntityData,
      uniques: string[],
      etype: string,
    ) => {
      const runInsertQuery = (name: string, value: any, svalue: string) => {
        if (value === undefined) {
          return;
        }
        const storageValue =
          typeof value === 'number'
            ? 'N'
            : typeof value === 'string'
              ? 'S'
              : 'J';
        const jsonValue = storageValue === 'J' ? svalue : null;
        this.queryRun(
          `INSERT INTO ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`,
          )} ("guid", "name", "value", "json", "string", "number", "truthy") VALUES (@guid, @name, @storageValue, jsonb(@jsonValue), @string, @number, @truthy);`,
          {
            etypes: [etype],
            params: {
              guid,
              name,
              storageValue,
              jsonValue,
              string: storageValue === 'J' ? null : `${value}`,
              number: Number(value),
              truthy: value ? 1 : 0,
            },
          },
        );
        const references = this.findReferences(svalue);
        for (const reference of references) {
          this.queryRun(
            `INSERT INTO ${SQLite3Driver.escape(
              `${this.prefix}references_${etype}`,
            )} ("guid", "name", "reference") VALUES (@guid, @name, @reference);`,
            {
              etypes: [etype],
              params: {
                guid,
                name,
                reference,
              },
            },
          );
        }
      };
      for (const unique of uniques) {
        try {
          this.queryRun(
            `INSERT INTO ${SQLite3Driver.escape(
              `${this.prefix}uniques_${etype}`,
            )} ("guid", "unique") VALUES (@guid, @unique);`,
            {
              etypes: [etype],
              params: {
                guid,
                unique,
              },
            },
          );
        } catch (e: any) {
          if (e instanceof EntityUniqueConstraintError) {
            this.nymph.config.debugError(
              'sqlite3',
              `Save entity unique constraint violation for GUID "${guid}" on etype "${etype}": "${unique}"`,
            );
          }
          throw e;
        }
      }
      for (const name in data) {
        runInsertQuery(name, data[name], JSON.stringify(data[name]));
      }
      for (const name in sdata) {
        runInsertQuery(name, JSON.parse(sdata[name]), sdata[name]);
      }
    };
    let inTransaction = false;
    try {
      return this.saveEntityRowLike(
        entity,
        async ({ guid, tags, data, sdata, uniques, cdate, etype }) => {
          if (
            Object.keys(data).length === 0 &&
            Object.keys(sdata).length === 0
          ) {
            return false;
          }
          this.queryRun(
            `INSERT INTO ${SQLite3Driver.escape(
              `${this.prefix}entities_${etype}`,
            )} ("guid", "tags", "cdate", "mdate") VALUES (@guid, @tags, @cdate, @cdate);`,
            {
              etypes: [etype],
              params: {
                guid,
                tags: ',' + tags.join(',') + ',',
                cdate,
              },
            },
          );
          insertData(guid, data, sdata, uniques, etype);
          return true;
        },
        async ({ entity, guid, tags, data, sdata, uniques, mdate, etype }) => {
          if (
            Object.keys(data).length === 0 &&
            Object.keys(sdata).length === 0
          ) {
            return false;
          }
          const info = this.queryRun(
            `UPDATE ${SQLite3Driver.escape(
              `${this.prefix}entities_${etype}`,
            )} SET "tags"=@tags, "mdate"=@mdate WHERE "guid"=@guid AND "mdate" <= @emdate;`,
            {
              etypes: [etype],
              params: {
                tags: ',' + tags.join(',') + ',',
                mdate,
                guid,
                emdate: Number(entity.mdate),
              },
            },
          );
          let success = false;
          if (info.changes === 1) {
            this.queryRun(
              `DELETE FROM ${SQLite3Driver.escape(
                `${this.prefix}data_${etype}`,
              )} WHERE "guid"=@guid;`,
              {
                etypes: [etype],
                params: {
                  guid,
                },
              },
            );
            this.queryRun(
              `DELETE FROM ${SQLite3Driver.escape(
                `${this.prefix}references_${etype}`,
              )} WHERE "guid"=@guid;`,
              {
                etypes: [etype],
                params: {
                  guid,
                },
              },
            );
            this.queryRun(
              `DELETE FROM ${SQLite3Driver.escape(
                `${this.prefix}uniques_${etype}`,
              )} WHERE "guid"=@guid;`,
              {
                etypes: [etype],
                params: {
                  guid,
                },
              },
            );
            insertData(guid, data, sdata, uniques, etype);
            success = true;
          }
          return success;
        },
        async () => {
          await this.startTransaction('nymph-save');
          inTransaction = true;
        },
        async (success) => {
          if (inTransaction) {
            inTransaction = false;
            if (success) {
              await this.commit('nymph-save');
            } else {
              await this.rollback('nymph-save');
            }
          }
          return success;
        },
      );
    } catch (e: any) {
      this.nymph.config.debugError('sqlite3', `Save entity error: "${e}"`);
      if (inTransaction) {
        await this.rollback('nymph-save');
      }
      throw e;
    }
  }

  public async setUID(name: string, curUid: number) {
    if (name == null) {
      throw new InvalidParametersError('Name not given for UID.');
    }
    await this.startTransaction('nymph-set-uid');
    this.queryRun(
      `DELETE FROM ${SQLite3Driver.escape(
        `${this.prefix}uids`,
      )} WHERE "name"=@name;`,
      {
        params: {
          name,
        },
      },
    );
    this.queryRun(
      `INSERT INTO ${SQLite3Driver.escape(
        `${this.prefix}uids`,
      )} ("name", "cur_uid") VALUES (@name, @curUid);`,
      {
        params: {
          name,
          curUid,
        },
      },
    );
    await this.commit('nymph-set-uid');
    return true;
  }

  public async internalTransaction(name: string) {
    await this.startTransaction(name);
  }

  public async startTransaction(name: string) {
    if (name == null || typeof name !== 'string' || name.length === 0) {
      throw new InvalidParametersError(
        'Transaction start attempted without a name.',
      );
    }
    if (!this.config.explicitWrite && !this.store.linkWrite) {
      this._connect(true);
    }
    this.queryRun(`SAVEPOINT ${SQLite3Driver.escape(name)};`);
    this.store.transactionsStarted++;
    return this.nymph;
  }

  public async needsMigration(): Promise<boolean> {
    const table: any = this.queryGet(
      "SELECT `name` FROM `sqlite_master` WHERE `type`='table' AND `name` LIKE @prefix LIMIT 1;",
      {
        params: {
          prefix: this.prefix + 'data_' + '%',
        },
      },
    );
    if (table?.name) {
      const result: any = this.queryGet(
        "SELECT 1 AS `exists` FROM pragma_table_info(@table) WHERE `name`='json';",
        {
          params: {
            table: table.name,
          },
        },
      );
      return !result?.exists;
    }
    return false;
  }
}
