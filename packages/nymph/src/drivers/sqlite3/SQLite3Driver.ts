import SQLite3 from 'better-sqlite3';

import { NymphDriver } from '..';
import {
  EntityConstructor,
  EntityData,
  EntityInterface,
  SerializedEntityData,
} from '../../Entity.d';
import {
  InvalidParametersError,
  NotConfiguredError,
  QueryFailedError,
  UnableToConnectError,
} from '../../errors';
import {
  SQLite3DriverConfig,
  SQLite3DriverConfigDefaults as defaults,
} from './conf';
import { FormattedSelector, Options, Selector } from '../../Nymph.d';
import { xor } from '../../utils';
import Nymph from '../../Nymph';

/**
 * The SQLite3 Nymph database driver.
 */
export default class SQLite3Driver extends NymphDriver {
  public config: SQLite3DriverConfig;
  protected prefix: string;
  protected connected: boolean = false;
  // @ts-ignore: this is assigned in connect(), which is called by the constructor.
  protected link: SQLite3.Database;
  protected typesAlreadyChecked: (keyof Selector)[] = [
    'guid',
    '!guid',
    'tag',
    '!tag',
    'ref',
    '!ref',
    'defined',
    '!defined',
    'truthy',
    '!truthy',
    'equal',
    '!equal',
    'like',
    '!like',
    'ilike',
    '!ilike',
    'match',
    '!match',
    'imatch',
    '!imatch',
    'gt',
    '!gt',
    'gte',
    '!gte',
    'lt',
    '!lt',
    'lte',
    '!lte',
  ];

  static escape(input: string) {
    if (input.indexOf('\x00') !== -1) {
      throw new InvalidParametersError(
        'SQLite3 identifiers (like entity ETYPE) cannot contain null characters.'
      );
    }

    return '"' + input.replace(/"/g, () => '""') + '"';
  }

  constructor(config: Partial<SQLite3DriverConfig>) {
    super();
    this.config = { ...defaults, ...config };
    this.prefix = this.config.prefix;
    this.connect();
  }

  /**
   * Connect to the SQLite3 database.
   *
   * @returns Whether this instance is connected to a SQLite3 database after the method has run.
   */
  public async connect() {
    const { filename, fileMustExist, timeout, readonly, verbose } = this.config;
    // Connecting
    if (!this.connected) {
      try {
        this.link = new SQLite3(filename, {
          readonly,
          fileMustExist,
          timeout,
          verbose,
        });
        this.connected = true;
        // Set database and connection options.
        this.link.pragma('encoding = "UTF-8";');
        this.link.pragma('foreign_keys = 1;');
        this.link.pragma('case_sensitive_like = 1;');
        // Create the preg_match and regexp functions.
        this.link.function(
          'regexp',
          { deterministic: true },
          (pattern: string, subject: string) =>
            this.posixRegexMatch(pattern, subject) ? 1 : 0
        );
      } catch (e) {
        this.connected = false;
        if (filename === ':memory:') {
          throw new NotConfiguredError(
            "It seems the config hasn't been set up correctly."
          );
        } else {
          throw new UnableToConnectError('Could not connect: ' + e.message);
        }
      }
    }
    return this.connected;
  }

  /**
   * Disconnect from the SQLite3 database.
   *
   * @returns Whether this instance is connected to a SQLite3 database after the method has run.
   */
  public async disconnect() {
    if (this.connected) {
      this.link.exec('PRAGMA optimize;');
      this.link.close();
      this.connected = false;
    }
    return this.connected;
  }

  /**
   * Check connection status.
   *
   * @returns Whether this instance is connected to a SQLite3 database.
   */
  public isConnected() {
    return this.connected;
  }

  /**
   * Check if SQLite3 DB is read only and throw error if so.
   */
  private checkReadOnlyMode() {
    if (this.config.readonly) {
      throw new InvalidParametersError(
        'Attempt to write to SQLite3 DB in read only mode.'
      );
    }
  }

  /**
   * Create entity tables in the database.
   *
   * @param etype The entity type to create a table for. If this is blank, the default tables are created.
   */
  private createTables(etype: string | null = null) {
    this.checkReadOnlyMode();
    this.queryRun("SAVEPOINT 'tablecreation';");
    try {
      if (etype != null) {
        // Create the entity table.
        this.queryRun(
          `CREATE TABLE IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`
          )} ("guid" CHARACTER(24) PRIMARY KEY, "tags" TEXT, "cdate" REAL NOT NULL, "mdate" REAL NOT NULL);`
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}_id_cdate`
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`
          )} ("cdate");`
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}_id_mdate`
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`
          )} ("mdate");`
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}_id_tags`
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`
          )} ("tags");`
        );
        // Create the data table.
        this.queryRun(
          `CREATE TABLE IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`
          )} ("guid" CHARACTER(24) NOT NULL REFERENCES ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`
          )} ("guid") ON DELETE CASCADE, "name" TEXT NOT NULL, "value" TEXT NOT NULL, PRIMARY KEY("guid", "name"));`
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}_id_guid`
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`
          )} ("guid");`
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}_id_name`
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`
          )} ("name");`
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}_id_value`
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`
          )} ("value");`
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}_id_guid__name_user`
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`
          )} ("guid") WHERE "name" = \'user\';`
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}_id_guid__name_group`
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`
          )} ("guid") WHERE "name" = \'group\';`
        );
        // Create the comparisons table.
        this.queryRun(
          `CREATE TABLE IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}comparisons_${etype}`
          )} ("guid" CHARACTER(24) NOT NULL REFERENCES ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`
          )} ("guid") ON DELETE CASCADE, "name" TEXT NOT NULL, "truthy" INTEGER, "string" TEXT, "number" REAL, PRIMARY KEY("guid", "name"));`
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}comparisons_${etype}_id_guid`
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}comparisons_${etype}`
          )} ("guid");`
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}comparisons_${etype}_id_name`
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}comparisons_${etype}`
          )} ("name");`
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}comparisons_${etype}_id_name__truthy`
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}comparisons_${etype}`
          )} ("name") WHERE "truthy" = 1;`
        );
        // Create the references table.
        this.queryRun(
          `CREATE TABLE IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}`
          )} ("guid" CHARACTER(24) NOT NULL REFERENCES ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`
          )} ("guid") ON DELETE CASCADE, "name" TEXT NOT NULL, "reference" CHARACTER(24) NOT NULL, PRIMARY KEY("guid", "name", "reference"));`
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}_id_guid`
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}`
          )} ("guid");`
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}_id_name`
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}`
          )} ("name");`
        );
        this.queryRun(
          `CREATE INDEX IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}_id_reference`
          )} ON ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}`
          )} ("reference");`
        );
      } else {
        // Create the UID table.
        this.queryRun(
          `CREATE TABLE IF NOT EXISTS ${SQLite3Driver.escape(
            `${this.prefix}uids`
          )} ("name" TEXT PRIMARY KEY NOT NULL, "cur_uid" INTEGER NOT NULL);`
        );
      }
    } catch (e) {
      this.queryRun("ROLLBACK TO 'tablecreation';");

      throw e;
    }
    this.queryRun("RELEASE 'tablecreation';");
    return true;
  }

  private query<T extends () => any>(
    runQuery: T,
    query: string,
    etype?: string
  ): ReturnType<T> {
    try {
      return runQuery();
    } catch (e) {
      const errorCode = e.code;
      const errorMsg = e.message;
      if (
        errorCode === 'SQLITE_ERROR' &&
        errorMsg.match(/^no such table: /) &&
        this.createTables()
      ) {
        if (etype != null) {
          this.createTables(etype);
        }
        try {
          return runQuery();
        } catch (e2) {
          throw new QueryFailedError(
            'Query failed: ' + e2.code + ' - ' + e2.message,
            query
          );
        }
      } else {
        throw e;
      }
    }
  }

  private queryIter(
    query: string,
    {
      etype,
      params = {},
    }: { etype?: string; params?: { [k: string]: any } } = {}
  ) {
    return this.query(
      () => this.link.prepare(query).iterate(params),
      query,
      etype
    );
  }

  private queryGet(
    query: string,
    {
      etype,
      params = {},
    }: { etype?: string; params?: { [k: string]: any } } = {}
  ) {
    return this.query(() => this.link.prepare(query).get(params), query, etype);
  }

  private queryRun(
    query: string,
    {
      etype,
      params = {},
    }: { etype?: string; params?: { [k: string]: any } } = {}
  ) {
    return this.query(() => this.link.prepare(query).run(params), query, etype);
  }

  public async deleteEntityByID(
    guid: string,
    className?: EntityConstructor | string | null
  ) {
    let EntityClass: EntityConstructor;
    if (typeof className === 'string' || className == null) {
      const GetEntityClass = Nymph.getEntityClass(className ?? 'Entity');
      EntityClass = GetEntityClass;
    } else {
      EntityClass = className;
    }
    const etype = EntityClass.ETYPE;
    this.checkReadOnlyMode();
    this.queryRun("SAVEPOINT 'deleteentity';");
    this.queryRun(
      `DELETE FROM ${SQLite3Driver.escape(
        `${this.prefix}entities_${etype}`
      )} WHERE "guid"=@guid;`,
      {
        etype,
        params: {
          guid,
        },
      }
    );
    this.queryRun(
      `DELETE FROM ${SQLite3Driver.escape(
        `${this.prefix}data_${etype}`
      )} WHERE "guid"=@guid;`,
      {
        etype,
        params: {
          guid,
        },
      }
    );
    this.queryRun(
      `DELETE FROM ${SQLite3Driver.escape(
        `${this.prefix}comparisons_${etype}`
      )} WHERE "guid"=@guid;`,
      {
        etype,
        params: {
          guid,
        },
      }
    );
    this.queryRun(
      `DELETE FROM ${SQLite3Driver.escape(
        `${this.prefix}references_${etype}`
      )} WHERE "guid"=@guid;`,
      {
        etype,
        params: {
          guid,
        },
      }
    );
    this.queryRun("RELEASE 'deleteentity';");
    // Remove any cached versions of this entity.
    if (Nymph.config.cache) {
      this.cleanCache(guid);
    }
    return true;
  }

  public async deleteUID(name: string) {
    if (!name) {
      throw new InvalidParametersError('Name not given for UID');
    }
    this.checkReadOnlyMode();
    this.queryRun(
      `DELETE FROM ${SQLite3Driver.escape(
        `${this.prefix}uids`
      )} WHERE "name"=@name;`,
      {
        params: {
          name,
        },
      }
    );
    return true;
  }

  protected async exportEntities(writeLine: (line: string) => void) {
    writeLine('#nex2');
    writeLine('# Nymph Entity Exchange v2');
    writeLine('# http://nymph.io');
    writeLine('#');
    writeLine('# Generation Time: ' + new Date().toLocaleString());
    writeLine('');

    writeLine('#');
    writeLine('# UIDs');
    writeLine('#');
    writeLine('');

    // Export UIDs.
    let uids = this.queryIter(
      `SELECT * FROM ${SQLite3Driver.escape(
        `${this.prefix}uids`
      )} ORDER BY "name";`
    );
    for (const uid of uids) {
      writeLine(`<${uid.name}>[${uid.cur_uid}]`);
    }

    writeLine('');
    writeLine('#');
    writeLine('# Entities');
    writeLine('#');
    writeLine('');

    // Get the etypes.
    const tables = this.queryIter(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;"
    );
    const etypes = [];
    for (const table of tables) {
      if (table.name.startsWith(this.prefix + 'entities_')) {
        etypes.push(table.name.substr((this.prefix + 'entities_').length));
      }
    }

    for (const etype of etypes) {
      // Export entities.
      const dataIterator = this.queryIter(
        `SELECT e.*, d."name" AS "dname", d."value" AS "dvalue" FROM ${SQLite3Driver.escape(
          `${this.prefix}entities_${etype}`
        )} e LEFT JOIN ${SQLite3Driver.escape(
          `${this.prefix}data_${etype}`
        )} d ON e."guid"=d."guid" ORDER BY e."guid";`
      )[Symbol.iterator]();
      let datum = dataIterator.next();
      while (!datum.done) {
        const guid = datum.value.guid;
        const tags = datum.value.tags.slice(1, -1);
        const cdate = datum.value.cdate;
        const mdate = datum.value.mdate;
        writeLine(`{${guid}}<${etype}>[${tags}]`);
        writeLine(`\tcdate=${JSON.stringify(cdate)}`);
        writeLine(`\tmdate=${JSON.stringify(mdate)}`);
        if (datum.value.dname != null) {
          // This do will keep going and adding the data until the
          // next entity is reached. $row will end on the next entity.
          do {
            writeLine(
              `\t${datum.value.dname}=${JSON.stringify(datum.value.dvalue)}`
            );
            datum = dataIterator.next();
          } while (!datum.done && datum.value.guid === guid);
        } else {
          // Make sure that $row is incremented :)
          datum = dataIterator.next();
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
    subquery = false
  ) {
    let fullCoverage = true;
    const sort = options.sort ?? 'cdate';
    const queryParts = this.iterateSelectorsForQuery(
      formattedSelectors,
      (key, value, typeIsOr, typeIsNot) => {
        const clauseNot = key.startsWith('!');
        let curQuery = '';
        // Any options having to do with data only return if the
        // entity has the specified variables.
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
                  'ie."guid"=@' +
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
                  'ie."tags" LIKE @' +
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
                  'ie."guid" ' +
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
                    '(ie."cdate" NOT NULL)';
                  break;
                } else if (curVar === 'mdate') {
                  curQuery +=
                    (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                    '(ie."mdate" NOT NULL)';
                  break;
                } else {
                  const name = `param${++count.i}`;
                  curQuery +=
                    (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                    'ie."guid" IN (SELECT "guid" FROM ' +
                    SQLite3Driver.escape(this.prefix + 'comparisons_' + etype) +
                    ' WHERE "name"=@' +
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
                  'ie."cdate"=@' +
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
                  'ie."mdate"=@' +
                  mdate;
                params[mdate] = Number(curValue[1]);
                break;
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
                  'ie."guid" IN (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE "name"=@' +
                  name +
                  ' AND "value"=@' +
                  value +
                  ')';
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
                  'instr(ie."cdate", @' +
                  cdate +
                  ')';
                params[cdate] = Number(curValue[1]);
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'instr(ie."mdate", @' +
                  mdate +
                  ')';
                params[mdate] = Number(curValue[1]);
                break;
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
                  'ie."guid" IN (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE "name"=@' +
                  name +
                  ' AND instr("value", @' +
                  value +
                  '))';
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
                  '(ie."cdate" REGEXP @' +
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
                  '(ie."mdate" REGEXP @' +
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
                  'ie."guid" IN (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE "name"=@' +
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
                  '(ie."cdate" REGEXP @' +
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
                  '(ie."mdate" REGEXP @' +
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
                  'ie."guid" IN (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE "name"=@' +
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
                  '(ie."cdate" LIKE @' +
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
                  '(ie."mdate" LIKE @' +
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
                  'ie."guid" IN (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE "name"=@' +
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
                  '(ie."cdate" LIKE @' +
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
                  '(ie."mdate" LIKE @' +
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
                  'ie."guid" IN (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE "name"=@' +
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
                  'ie."cdate">@' +
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
                  'ie."mdate">@' +
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
                  'ie."guid" IN (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE "name"=@' +
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
                  'ie."cdate">=@' +
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
                  'ie."mdate">=@' +
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
                  'ie."guid" IN (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE "name"=@' +
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
                  'ie."cdate"<@' +
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
                  'ie."mdate"<@' +
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
                  'ie."guid" IN (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE "name"=@' +
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
                  'ie."cdate"<=@' +
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
                  'ie."mdate"<=@' +
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
                  'ie."guid" IN (SELECT "guid" FROM ' +
                  SQLite3Driver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE "name"=@' +
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
                'ie."guid" IN (SELECT "guid" FROM ' +
                SQLite3Driver.escape(this.prefix + 'references_' + etype) +
                ' WHERE "name"=@' +
                name +
                ' AND "reference"=@' +
                guid +
                ')';
              params[name] = curValue[0];
              params[guid] = curQguid;
              break;
            case 'selector':
              const subquery = this.makeEntityQuery(
                options,
                [curValue],
                etype,
                count,
                params,
                true
              );
              fullCoverage = fullCoverage && subquery.fullCoverage;
              if (curQuery) {
                curQuery += typeIsOr ? ' OR ' : ' AND ';
              }
              curQuery +=
                (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                '(' +
                subquery.query +
                ')';
              break;
          }
        }
        return curQuery;
      }
    );

    let sortBy: string;
    switch (sort) {
      case 'mdate':
        sortBy = '"mdate"';
        break;
      case 'cdate':
      default:
        sortBy = '"cdate"';
        break;
    }
    if (options.reverse) {
      sortBy += ' DESC';
    }

    let query: string;
    if (queryParts.length) {
      if (subquery) {
        query = '(' + queryParts.join(') AND (') + ')';
      } else {
        let limit = '';
        if (fullCoverage && 'limit' in options) {
          limit = ` LIMIT ${Math.floor(Number(options.limit))}`;
        }
        let offset = '';
        if (fullCoverage && 'offset' in options) {
          offset = ` OFFSET ${Math.floor(Number(options.offset))}`;
        }
        const whereClause = queryParts.join(') AND (');
        query = `SELECT e."guid", e."tags", e."cdate", e."mdate", d."name", d."value"
          FROM ${SQLite3Driver.escape(this.prefix + 'entities_' + etype)} e
          LEFT JOIN ${SQLite3Driver.escape(
            this.prefix + 'data_' + etype
          )} d USING ("guid")
          INNER JOIN (
            SELECT "guid"
            FROM ${SQLite3Driver.escape(this.prefix + 'entities_' + etype)} ie
            WHERE (${whereClause})
            ORDER BY ie.${sortBy}${limit}${offset}
          ) f USING ("guid")
          ORDER BY ${sortBy};`;
      }
    } else {
      if (subquery) {
        query = '';
      } else {
        let limit = '';
        if (fullCoverage && 'limit' in options) {
          limit = ` LIMIT ${Math.floor(Number(options.limit))}`;
        }
        let offset = '';
        if (fullCoverage && 'offset' in options) {
          offset = ` OFFSET ${Math.floor(Number(options.offset))}`;
        }
        if (limit || offset) {
          query = `SELECT e."guid", e."tags", e."cdate", e."mdate", d."name", d."value"
            FROM ${SQLite3Driver.escape(this.prefix + 'entities_' + etype)} e
            LEFT JOIN ${SQLite3Driver.escape(
              this.prefix + 'data_' + etype
            )} d USING ("guid")
            INNER JOIN (
              SELECT "guid"
              FROM ${SQLite3Driver.escape(this.prefix + 'entities_' + etype)} ie
              ORDER BY ie.${sortBy}${limit}${offset}
            ) f USING ("guid")
            ORDER BY ${sortBy};`;
        } else {
          query = `SELECT e."guid", e."tags", e."cdate", e."mdate", d."name", d."value"
            FROM ${SQLite3Driver.escape(this.prefix + 'entities_' + etype)} e
            LEFT JOIN ${SQLite3Driver.escape(
              this.prefix + 'data_' + etype
            )} d USING ("guid")
            ORDER BY ${sortBy};`;
        }
      }
    }

    return {
      query,
      params,
      fullCoverage,
    };
  }

  protected performQuery(
    options: Options,
    formattedSelectors: FormattedSelector[],
    etype: string
  ): {
    result: any;
    fullCoverage: boolean;
    limitOffsetCoverage: boolean;
  } {
    const { query, params, fullCoverage } = this.makeEntityQuery(
      options,
      formattedSelectors,
      etype
    );
    const result = this.queryIter(query, { etype, params })[Symbol.iterator]();
    return {
      result,
      fullCoverage,
      limitOffsetCoverage: fullCoverage,
    };
  }

  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): Promise<string[]>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options?: Options<T>,
    ...selectors: Selector[]
  ): Promise<ReturnType<T['factory']>[]>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> = {},
    ...selectors: Selector[]
  ): Promise<ReturnType<T['factory']>[] | string[]> {
    return this.getEntitiesSync(options, ...selectors);
  }

  protected getEntitiesSync<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): string[];
  protected getEntitiesSync<T extends EntityConstructor = EntityConstructor>(
    options?: Options<T>,
    ...selectors: Selector[]
  ): ReturnType<T['factory']>[];
  protected getEntitiesSync<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> = {},
    ...selectors: Selector[]
  ): ReturnType<T['factory']>[] | string[] {
    const { result, process } = this.getEntitesRowLike<T>(
      options,
      selectors,
      this.typesAlreadyChecked,
      (options, formattedSelectors, etype) =>
        this.performQuery(options, formattedSelectors, etype),
      () => {
        const next: any = result.next();
        return next.done ? null : next.value;
      },
      () => undefined,
      (row) => row.guid,
      (row) => ({
        tags: row.tags.length > 2 ? row.tags.slice(1, -1).split(',') : [],
        cdate: Number(row.cdate),
        mdate: Number(row.mdate),
      }),
      (row) => ({
        name: row.name,
        svalue: row.value,
      })
    );
    return process();
  }

  public async getUID(name: string) {
    if (name == null) {
      throw new InvalidParametersError('Name not given for UID.');
    }
    const result = this.queryGet(
      `SELECT "cur_uid" FROM ${SQLite3Driver.escape(
        `${this.prefix}uids`
      )} WHERE "name"=@name;`,
      {
        params: {
          name: name,
        },
      }
    );
    return (result?.cur_uid as number | null) ?? null;
  }

  public async import(filename: string) {
    this.checkReadOnlyMode();
    return this.importFromFile(
      filename,
      async (guid, tags, sdata, etype) => {
        this.queryRun(
          `DELETE FROM ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`
          )} WHERE "guid"=@guid;`,
          {
            etype,
            params: {
              guid,
            },
          }
        );
        this.queryRun(
          `DELETE FROM ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`
          )} WHERE "guid"=@guid;`,
          {
            etype,
            params: {
              guid,
            },
          }
        );
        this.queryRun(
          `DELETE FROM ${SQLite3Driver.escape(
            `${this.prefix}comparisons_${etype}`
          )} WHERE "guid"=@guid;`,
          {
            etype,
            params: {
              guid,
            },
          }
        );
        this.queryRun(
          `DELETE FROM ${SQLite3Driver.escape(
            `${this.prefix}references_${etype}`
          )} WHERE "guid"=@guid;`,
          {
            etype,
            params: {
              guid,
            },
          }
        );
        this.queryRun(
          `INSERT INTO ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`
          )} ("guid", "tags", "cdate", "mdate") VALUES (@guid, @tags, @cdate, @mdate);`,
          {
            etype,
            params: {
              guid,
              tags: ',' + tags.join(',') + ',',
              cdate: Number(JSON.parse(sdata.cdate)),
              mdate: Number(JSON.parse(sdata.mdate)),
            },
          }
        );
        delete sdata.cdate;
        delete sdata.mdate;
        for (const name in sdata) {
          const value = sdata[name];
          const uvalue = JSON.parse(value);
          this.queryRun(
            `INSERT INTO ${SQLite3Driver.escape(
              `${this.prefix}data_${etype}`
            )} ("guid", "name", "value") VALUES (@guid, @name, @value);`,
            {
              etype,
              params: {
                guid,
                name,
                value,
              },
            }
          );
          this.queryRun(
            `INSERT INTO ${SQLite3Driver.escape(
              `${this.prefix}comparisons_${etype}`
            )} ("guid", "name", "truthy", "string", "number") VALUES (@guid, @name, @truthy, @string, @number);`,
            {
              etype,
              params: {
                guid,
                name,
                truthy: uvalue ? 1 : 0,
                string: `${uvalue}`,
                number: Number(uvalue),
              },
            }
          );
          const references = this.findReferences(value);
          for (const reference of references) {
            this.queryRun(
              `INSERT INTO ${SQLite3Driver.escape(
                `${this.prefix}references_${etype}`
              )} ("guid", "name", "reference") VALUES (@guid, @name, @reference);`,
              {
                etype,
                params: {
                  guid,
                  name,
                  reference,
                },
              }
            );
          }
        }
      },
      async (name, curUid) => {
        this.queryRun(
          `DELETE FROM ${SQLite3Driver.escape(
            `${this.prefix}uids`
          )} WHERE "name"=@name;`,
          {
            params: {
              name,
            },
          }
        );
        this.queryRun(
          `INSERT INTO ${SQLite3Driver.escape(
            `${this.prefix}uids`
          )} ("name", "cur_uid") VALUES (@name, @curUid);`,
          {
            params: {
              name,
              curUid,
            },
          }
        );
      },
      async () => {
        this.queryRun("SAVEPOINT 'import';");
      },
      async () => {
        this.queryRun("RELEASE 'import';");
      }
    );
  }

  public async newUID(name: string) {
    if (name == null) {
      throw new InvalidParametersError('Name not given for UID.');
    }
    this.checkReadOnlyMode();
    this.queryRun("SAVEPOINT 'newuid';");
    let curUid =
      this.queryGet(
        `SELECT "cur_uid" FROM ${SQLite3Driver.escape(
          `${this.prefix}uids`
        )} WHERE "name"=@name;`,
        {
          params: {
            name,
          },
        }
      )?.cur_uid ?? null;
    if (curUid == null) {
      curUid = 1;
      this.queryRun(
        `INSERT INTO ${SQLite3Driver.escape(
          `${this.prefix}uids`
        )} ("name", "cur_uid") VALUES (@name, @curUid);`,
        {
          params: {
            name,
            curUid,
          },
        }
      );
    } else {
      curUid++;
      this.queryRun(
        `UPDATE ${SQLite3Driver.escape(
          `${this.prefix}uids`
        )} SET "cur_uid"=@curUid WHERE "name"=@name;`,
        {
          params: {
            curUid,
            name,
          },
        }
      );
    }
    this.queryRun("RELEASE 'newuid';");
    return curUid as number;
  }

  public async renameUID(oldName: string, newName: string) {
    if (oldName == null || newName == null) {
      throw new InvalidParametersError('Name not given for UID.');
    }
    this.checkReadOnlyMode();
    this.queryRun(
      `UPDATE ${SQLite3Driver.escape(
        `${this.prefix}uids`
      )} SET "name"=@newName WHERE "name"=@oldName;`,
      {
        params: {
          newName,
          oldName,
        },
      }
    );
    return true;
  }

  public async saveEntity(entity: EntityInterface) {
    this.checkReadOnlyMode();
    const insertData = (
      guid: string,
      data: EntityData,
      sdata: SerializedEntityData,
      etype: string
    ) => {
      const runInsertQuery = (name: string, value: any, svalue: string) => {
        this.queryRun(
          `INSERT INTO ${SQLite3Driver.escape(
            `${this.prefix}data_${etype}`
          )} ("guid", "name", "value") VALUES (@guid, @name, @svalue);`,
          {
            etype,
            params: {
              guid,
              name,
              svalue,
            },
          }
        );
        this.queryRun(
          `INSERT INTO ${SQLite3Driver.escape(
            `${this.prefix}comparisons_${etype}`
          )} ("guid", "name", "truthy", "string", "number") VALUES (@guid, @name, @truthy, @string, @number);`,
          {
            etype,
            params: {
              guid,
              name,
              truthy: value ? 1 : 0,
              string: `${value}`,
              number: Number(value),
            },
          }
        );
        const references = this.findReferences(svalue);
        for (const reference of references) {
          this.queryRun(
            `INSERT INTO ${SQLite3Driver.escape(
              `${this.prefix}references_${etype}`
            )} ("guid", "name", "reference") VALUES (@guid, @name, @reference);`,
            {
              etype,
              params: {
                guid,
                name,
                reference,
              },
            }
          );
        }
      };
      for (const name in data) {
        runInsertQuery(name, data[name], JSON.stringify(data[name]));
      }
      for (const name in sdata) {
        runInsertQuery(name, JSON.parse(sdata[name]), sdata[name]);
      }
    };
    return this.saveEntityRowLike(
      entity,
      async (_entity, guid, tags, data, sdata, cdate, etype) => {
        this.queryRun(
          `INSERT INTO ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`
          )} ("guid", "tags", "cdate", "mdate") VALUES (@guid, @tags, @cdate, @cdate);`,
          {
            etype,
            params: {
              guid,
              tags: ',' + tags.join(',') + ',',
              cdate,
            },
          }
        );
        insertData(guid, data, sdata, etype);
        return true;
      },
      async (entity, guid, tags, data, sdata, mdate, etype) => {
        const info = this.queryRun(
          `UPDATE ${SQLite3Driver.escape(
            `${this.prefix}entities_${etype}`
          )} SET "tags"=@tags, "mdate"=@mdate WHERE "guid"=@guid AND "mdate" <= @emdate;`,
          {
            etype,
            params: {
              tags: ',' + tags.join(',') + ',',
              mdate,
              guid,
              emdate: Number(entity.mdate),
            },
          }
        );
        let success = false;
        if (info.changes === 1) {
          this.queryRun(
            `DELETE FROM ${SQLite3Driver.escape(
              `${this.prefix}data_${etype}`
            )} WHERE "guid"=@guid;`,
            {
              etype,
              params: {
                guid,
              },
            }
          );
          this.queryRun(
            `DELETE FROM ${SQLite3Driver.escape(
              `${this.prefix}comparisons_${etype}`
            )} WHERE "guid"=@guid;`,
            {
              etype,
              params: {
                guid,
              },
            }
          );
          this.queryRun(
            `DELETE FROM ${SQLite3Driver.escape(
              `${this.prefix}references_${etype}`
            )} WHERE "guid"=@guid;`,
            {
              etype,
              params: {
                guid,
              },
            }
          );
          insertData(guid, data, sdata, etype);
          success = true;
        }
        return success;
      },
      async () => {
        this.queryRun("SAVEPOINT 'save';");
      },
      async (success) => {
        if (success) {
          this.queryRun("RELEASE 'save';");
        } else {
          this.queryRun("ROLLBACK TO 'save';");
        }
        return true;
      }
    );
  }

  public async setUID(name: string, curUid: number) {
    if (name == null) {
      throw new InvalidParametersError('Name not given for UID.');
    }
    this.checkReadOnlyMode();
    this.queryRun(
      `DELETE FROM ${SQLite3Driver.escape(
        `${this.prefix}uids`
      )} WHERE "name"=@name;`,
      {
        params: {
          name,
        },
      }
    );
    this.queryRun(
      `INSERT INTO ${SQLite3Driver.escape(
        `${this.prefix}uids`
      )} ("name", "cur_uid") VALUES (@name, @curUid);`,
      {
        params: {
          name,
          curUid,
        },
      }
    );
    return true;
  }

  private findReferences(svalue: string): string[] {
    const re = /\["nymph_entity_reference","([0-9a-fA-F]+)",/g;
    const matches = svalue.match(re);
    if (matches == null) {
      return [];
    }
    return matches.map((match) => match.replace(re, '$1'));
  }
}
