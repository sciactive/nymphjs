import cp from 'child_process';
// @ts-ignore: types are wonky with @vlasky/mysql.
import { default as MySQLType } from '@types/mysql';
// @ts-ignore: replace with mysql once https://github.com/mysqljs/mysql/pull/2233 is merged.
import vlaskyMysql from '@vlasky/mysql';

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
import { FormattedSelector, Options, Selector } from '../../Nymph.d';
import { xor } from '../../utils';
import Nymph from '../../Nymph';
import {
  MySQLDriverConfig,
  MySQLDriverConfigDefaults as defaults,
} from './conf';

const mysql = vlaskyMysql as typeof MySQLType;

/**
 * The MySQL Nymph database driver.
 */
export default class MySQLDriver extends NymphDriver {
  public config: MySQLDriverConfig;
  private mysqlConfig: MySQLType.PoolConfig;
  protected prefix: string;
  protected connected: boolean = false;
  // @ts-ignore: this is assigned in connect(), which is called by the constructor.
  protected link: MySQLType.Pool;

  static escape(input: string) {
    return mysql.escapeId(input);
  }

  static escapeValue(input: string) {
    return mysql.escape(input);
  }

  constructor(config: Partial<MySQLDriverConfig>) {
    super();
    this.config = { ...defaults, ...config };
    const { host, user, password, database, port, customPoolConfig } =
      this.config;
    this.mysqlConfig = customPoolConfig ?? {
      host,
      user,
      password,
      database,
      port,
    };
    this.prefix = this.config.prefix;
    this.connect();
  }

  private getConnection(): Promise<MySQLType.PoolConnection> {
    return new Promise((resolve, reject) =>
      this.link.getConnection((err, con) => (err ? reject(err) : resolve(con)))
    );
  }

  /**
   * Connect to the MySQL database.
   *
   * @returns Whether this instance is connected to a MySQL database.
   */
  public async connect() {
    // If we think we're connected, try pinging the server.
    try {
      if (this.connected) {
        const connection = await this.getConnection();
        await connection.ping();
        connection.release();
      }
    } catch (e) {
      this.connected = false;
    }

    // Connecting, selecting database
    if (!this.connected) {
      try {
        this.link = await mysql.createPool(this.mysqlConfig);
        this.connected = true;
      } catch (e) {
        if (
          this.mysqlConfig.host === 'localhost' &&
          this.mysqlConfig.user === 'nymph' &&
          this.mysqlConfig.password === 'password' &&
          this.mysqlConfig.database === 'nymph'
        ) {
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
   * Disconnect from the MySQL database.
   *
   * @returns Whether this instance is connected to a MySQL database.
   */
  public async disconnect() {
    if (this.connected) {
      await this.link.end();
      this.connected = false;
    }
    return this.connected;
  }

  /**
   * Check connection status.
   *
   * @returns Whether this instance is connected to a MySQL database.
   */
  public isConnected() {
    return this.connected;
  }

  /**
   * Create entity tables in the database.
   *
   * @param etype The entity type to create a table for. If this is blank, the default tables are created.
   * @returns True on success, false on failure.
   */
  private createTables(etype: string | null = null) {
    this.queryRunSync('SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";');
    let foreignKeyDataTableGuid = '';
    let foreignKeyDataComparisonsTableGuid = '';
    let foreignKeyReferencesTableGuid = '';
    if (this.config.foreignKeys) {
      foreignKeyDataTableGuid = ` REFERENCES ${MySQLDriver.escape(
        `${this.prefix}entities_${etype}`
      )}(\`guid\`) ON DELETE CASCADE`;
      foreignKeyDataComparisonsTableGuid = ` REFERENCES ${MySQLDriver.escape(
        `${this.prefix}entities_${etype}`
      )}(\`guid\`) ON DELETE CASCADE`;
      foreignKeyReferencesTableGuid = ` REFERENCES ${MySQLDriver.escape(
        `${this.prefix}entities_${etype}`
      )}(\`guid\`) ON DELETE CASCADE`;
    }
    if (etype != null) {
      // Create the entity table.
      this.queryRunSync(
        `CREATE TABLE IF NOT EXISTS ${MySQLDriver.escape(
          `${this.prefix}entities_${etype}`
        )} (
          \`guid\` BINARY(12) NOT NULL,
          \`tags\` LONGTEXT,
          \`cdate\` BIGINT NOT NULL,
          \`mdate\` BIGINT NOT NULL,
          PRIMARY KEY (\`guid\`),
          INDEX \`id_cdate\` USING BTREE (\`cdate\`),
          INDEX \`id_mdate\` USING BTREE (\`mdate\`),
          FULLTEXT \`id_tags\` (\`tags\`)
        ) ENGINE ${this.config.engine}
        CHARACTER SET utf8 COLLATE utf8_bin;`
      );
      // Create the data table.
      this.queryRunSync(
        `CREATE TABLE IF NOT EXISTS ${MySQLDriver.escape(
          `${this.prefix}data_${etype}`
        )} (
          \`guid\` BINARY(12) NOT NULL${foreignKeyDataTableGuid},
          \`name\` TEXT NOT NULL,
          \`value\` LONGTEXT NOT NULL,
          PRIMARY KEY (\`guid\`,\`name\`(255)),
          INDEX \`id_name\` USING HASH (\`name\`(255)),
          INDEX \`id_name_value\` USING BTREE (\`name\`(255), \`value\`(512))
        ) ENGINE ${this.config.engine}
        CHARACTER SET utf8 COLLATE utf8_bin;`
      );
      // Create the data comparisons table.
      this.queryRunSync(
        `CREATE TABLE IF NOT EXISTS ${MySQLDriver.escape(
          `${this.prefix}comparisons_${etype}`
        )} (
          \`guid\` BINARY(12) NOT NULL${foreignKeyDataComparisonsTableGuid},
          \`name\` TEXT NOT NULL,
          \`truthy\` BOOLEAN,
          \`string\` LONGTEXT,
          \`number\` DOUBLE,
          PRIMARY KEY (\`guid\`, \`name\`(255)),
          INDEX \`id_name\` USING HASH (\`name\`(255))
        ) ENGINE ${this.config.engine}
        CHARACTER SET utf8 COLLATE utf8_bin;`
      );
      // Create the references table.
      this.queryRunSync(
        `CREATE TABLE IF NOT EXISTS ${MySQLDriver.escape(
          `${this.prefix}references_${etype}`
        )} (
          \`guid\` BINARY(12) NOT NULL${foreignKeyReferencesTableGuid},
          \`name\` TEXT NOT NULL,
          \`reference\` BINARY(12) NOT NULL,
          PRIMARY KEY (\`guid\`, \`name\`(255), \`reference\`),
          INDEX \`id_name_reference\` USING BTREE (\`name\`(255), \`reference\`)
        ) ENGINE ${this.config.engine}
        CHARACTER SET utf8 COLLATE utf8_bin;`
      );
    } else {
      // Create the UID table.
      this.queryRunSync(
        `CREATE TABLE IF NOT EXISTS ${MySQLDriver.escape(
          `${this.prefix}uids`
        )} (
          \`name\` TEXT NOT NULL,
          \`cur_uid\` BIGINT(20) UNSIGNED NOT NULL,
          PRIMARY KEY (\`name\`(100))
        ) ENGINE ${this.config.engine}
        CHARACTER SET utf8 COLLATE utf8_bin;`
      );
    }
    return true;
  }

  private translateQuery(
    origQuery: string,
    origParams: { [k: string]: any }
  ): { query: string; params: any[] } {
    const params: any[] = [];
    let query = origQuery;

    let paramRegex = /@[a-zA-Z0-9]+/;
    let match;
    while ((match = query.match(paramRegex))) {
      const param = match[0].substr(1);
      params.push(origParams[param]);
      query = query.replace(paramRegex, () => '?');
    }

    return { query, params };
  }

  private async query<T extends () => any>(
    runQuery: T,
    query: string,
    etype?: string
    // @ts-ignore: The return type of T is a promise.
  ): ReturnType<T> {
    try {
      return await runQuery();
    } catch (e) {
      const errorCode = e.errno;
      if (errorCode === 1146 && this.createTables()) {
        // If the tables don't exist yet, create them.
        if (etype != null) {
          this.createTables(etype);
        }
        try {
          return await runQuery();
        } catch (e2) {
          throw new QueryFailedError(
            'Query failed: ' + e2.code + ' - ' + e2.message,
            query
          );
        }
      } else if (errorCode === 2006) {
        // If the MySQL server disconnected, reconnect to it.
        if (!this.connect()) {
          throw new QueryFailedError(
            'Query failed: ' + e.code + ' - ' + e.message,
            query
          );
        }
        try {
          return await runQuery();
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

  private querySync<T extends () => any>(
    runQuery: T,
    query: string,
    etype?: string
  ): ReturnType<T> {
    try {
      return runQuery();
    } catch (e) {
      const errorCode = e.errno;
      if (errorCode === 1146 && this.createTables()) {
        // If the tables don't exist yet, create them.
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
      } else if (errorCode === 2006) {
        // If the MySQL server disconnected, reconnect to it.
        if (!this.connect()) {
          throw new QueryFailedError(
            'Query failed: ' + e.code + ' - ' + e.message,
            query
          );
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
      connection,
      params = {},
    }: {
      etype?: string;
      connection?: MySQLType.PoolConnection;
      params?: { [k: string]: any };
    } = {}
  ) {
    const { query: newQuery, params: newParams } = this.translateQuery(
      query,
      params
    );
    return this.query(
      async () => {
        const results: any = await new Promise((resolve, reject) =>
          (connection ?? this.link).query(
            newQuery,
            newParams,
            (error, results) => {
              if (error) {
                reject(error);
              }
              resolve(results);
            }
          )
        );
        return results;
      },
      query,
      etype
    );
  }

  private queryIterSync(
    query: string,
    {
      etype,
      params = {},
    }: { etype?: string; params?: { [k: string]: any } } = {}
  ) {
    const { query: newQuery, params: newParams } = this.translateQuery(
      query,
      params
    );
    return this.querySync(
      () => {
        const output = cp.spawnSync(
          process.argv0,
          [__dirname + '/runMysqlSync.js'],
          {
            input: JSON.stringify({
              mysqlConfig: this.mysqlConfig,
              query: newQuery,
              params: newParams,
            }),
            timeout: 30000,
            maxBuffer: 100 * 1024 * 1024,
            encoding: 'utf8',
            windowsHide: true,
          }
        );
        const { results } = JSON.parse(output.stdout);
        const err = output.status === 0 ? null : JSON.parse(output.stderr);
        if (err) {
          throw new Error(err);
        }
        return results;
      },
      query,
      etype
    );
  }

  private queryGet(
    query: string,
    {
      etype,
      connection,
      params = {},
    }: {
      etype?: string;
      connection?: MySQLType.PoolConnection;
      params?: { [k: string]: any };
    } = {}
  ) {
    const { query: newQuery, params: newParams } = this.translateQuery(
      query,
      params
    );
    return this.query(
      async () => {
        const results: any = await new Promise((resolve, reject) =>
          (connection ?? this.link).query(
            newQuery,
            newParams,
            (error, results) => {
              if (error) {
                reject(error);
              }
              resolve(results);
            }
          )
        );
        return results[0];
      },
      query,
      etype
    );
  }

  private queryRun(
    query: string,
    {
      etype,
      connection,
      params = {},
    }: {
      etype?: string;
      connection?: MySQLType.PoolConnection;
      params?: { [k: string]: any };
    } = {}
  ) {
    const { query: newQuery, params: newParams } = this.translateQuery(
      query,
      params
    );
    return this.query(
      async () => {
        const results: any = await new Promise((resolve, reject) => {
          (connection ?? this.link).query(
            newQuery,
            newParams,
            (error, results) => {
              if (error) {
                reject(error);
              }
              resolve(results);
            }
          );
        });
        return { changes: results.changedRows ?? 0 };
      },
      query,
      etype
    );
  }

  private queryRunSync(
    query: string,
    {
      etype,
      params = {},
    }: { etype?: string; params?: { [k: string]: any } } = {}
  ) {
    const { query: newQuery, params: newParams } = this.translateQuery(
      query,
      params
    );
    return this.querySync(
      () => {
        const output = cp.spawnSync(
          process.argv0,
          [__dirname + '/runMysqlSync.js'],
          {
            input: JSON.stringify({
              mysqlConfig: this.mysqlConfig,
              query: newQuery,
              params: newParams,
            }),
            timeout: 30000,
            maxBuffer: 100 * 1024 * 1024,
            encoding: 'utf8',
            windowsHide: true,
          }
        );
        const { results } = JSON.parse(output.stdout);
        const err = output.status === 0 ? null : JSON.parse(output.stderr);
        if (err) {
          throw new Error(err);
        }
        return { changes: results.changedRows ?? 0 };
      },
      query,
      etype
    );
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
    const connection = await this.getConnection();
    if (this.config.transactions) {
      await this.queryRun('BEGIN;', { connection });
    }
    await this.queryRun(
      `DELETE FROM ${MySQLDriver.escape(
        `${this.prefix}entities_${etype}`
      )} WHERE \`guid\`=UNHEX(@guid);`,
      {
        etype,
        connection,
        params: {
          guid,
        },
      }
    );
    await this.queryRun(
      `DELETE FROM ${MySQLDriver.escape(
        `${this.prefix}data_${etype}`
      )} WHERE \`guid\`=UNHEX(@guid);`,
      {
        etype,
        connection,
        params: {
          guid,
        },
      }
    );
    await this.queryRun(
      `DELETE FROM ${MySQLDriver.escape(
        `${this.prefix}comparisons_${etype}`
      )} WHERE \`guid\`=UNHEX(@guid);`,
      {
        etype,
        connection,
        params: {
          guid,
        },
      }
    );
    await this.queryRun(
      `DELETE FROM ${MySQLDriver.escape(
        `${this.prefix}references_${etype}`
      )} WHERE \`guid\`=UNHEX(@guid);`,
      {
        etype,
        connection,
        params: {
          guid,
        },
      }
    );
    if (this.config.transactions) {
      await this.queryRun('COMMIT;', { connection });
    }
    // Remove any cached versions of this entity.
    if (Nymph.config.cache) {
      this.cleanCache(guid);
    }
    connection.release();
    return true;
  }

  public async deleteUID(name: string) {
    if (!name) {
      throw new InvalidParametersError('Name not given for UID');
    }
    await this.queryRun(
      `DELETE FROM ${MySQLDriver.escape(
        `${this.prefix}uids`
      )} WHERE \`name\`=@name;`,
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
    let uids = await this.queryIter(
      `SELECT * FROM ${MySQLDriver.escape(
        `${this.prefix}uids`
      )} ORDER BY \`name\`;`
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
    const tables = await this.queryIter('SHOW TABLES;');
    const etypes = [];
    for (const tableRow of tables) {
      const table = tableRow[Object.keys(tableRow)[0]];
      if (table.startsWith(this.prefix + 'entities_')) {
        etypes.push(table.substr((this.prefix + 'entities_').length));
      }
    }

    for (const etype of etypes) {
      // Export entities.
      const dataIterator = (
        await this.queryIter(
          `SELECT LOWER(HEX(e.\`guid\`)) as \`guid\`, e.\`tags\`, e.\`cdate\`, e.\`mdate\`, d.\`name\` AS \`dname\`, d.\`value\` AS \`dvalue\`
        FROM ${MySQLDriver.escape(`${this.prefix}entities_${etype}`)} e
        LEFT JOIN ${MySQLDriver.escape(
          `${this.prefix}data_${etype}`
        )} d ON e.\`guid\`=d.\`guid\`
        ORDER BY e.\`guid\`;`
        )
      )[Symbol.iterator]();
      let datum = dataIterator.next();
      while (!datum.done) {
        const guid = datum.value.guid;
        const tags = datum.value.tags.slice(1, -1).split(' ').join(',');
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
          // Make sure that datum is incremented :)
          datum = dataIterator.next();
        }
      }
    }

    return;
  }

  /**
   * Generate the MySQL query.
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
    const sort = options.sort ?? 'cdate';
    const queryParts = this.iterateSelectorsForQuery(
      formattedSelectors,
      (key, value, typeIsOr, typeIsNot) => {
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
                  'ie.`guid`=UNHEX(@' +
                  guid +
                  ')';
                params[guid] = curGuid;
              }
              break;
            case 'tag':
            case '!tag':
              if (xor(typeIsNot, clauseNot)) {
                if (typeIsOr) {
                  for (const curTag of curValue) {
                    if (curQuery) {
                      curQuery += ' OR ';
                    }
                    const tag = `param${++count.i}`;
                    curQuery += 'ie.`tags` NOT REGEXP @' + tag;
                    params[tag] = ' ' + curTag + ' ';
                  }
                } else {
                  const tag = `param${++count.i}`;
                  curQuery += 'ie.`tags` NOT REGEXP @' + tag;
                  params[tag] = ' (' + curValue.join('|') + ') ';
                }
              } else {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const groupQueryParam = `param${++count.i}`;
                let groupQuery = '';
                for (const curTag of curValue) {
                  groupQuery += (typeIsOr ? ' ' : ' +') + curTag;
                }
                curQuery +=
                  'MATCH (ie.`tags`) AGAINST (@' +
                  groupQueryParam +
                  ' IN BOOLEAN MODE)';
                params[groupQueryParam] = groupQuery;
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
                  'ie.`guid` ' +
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'IN (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `name`=@' +
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
                    '(ie.`cdate` NOT NULL)';
                  break;
                } else if (curVar === 'mdate') {
                  curQuery +=
                    (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                    '(ie.`mdate` NOT NULL)';
                  break;
                } else {
                  const name = `param${++count.i}`;
                  curQuery +=
                    (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                    'ie.`guid` IN (SELECT `guid` FROM ' +
                    MySQLDriver.escape(this.prefix + 'comparisons_' + etype) +
                    ' WHERE `name`=@' +
                    name +
                    ' AND `truthy`=TRUE)';
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
                  'ie.`cdate`=@' +
                  cdate;
                params[cdate] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'ie.`mdate`=@' +
                  mdate;
                params[mdate] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
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
                  'ie.`guid` IN (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `name`=@' +
                  name +
                  ' AND `value`=@' +
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
                  'ie.`cdate`=' +
                  cdate;
                params[cdate] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'ie.`mdate`=' +
                  mdate;
                params[mdate] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
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
                  'ie.`guid` IN (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `name`=@' +
                  name +
                  ' AND INSTR(`value`, @' +
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
                  '(ie.`cdate` REGEXP @' +
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
                  '(ie.`mdate` REGEXP @' +
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
                  'ie.`guid` IN (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE `name`=@' +
                  name +
                  ' AND `string` REGEXP @' +
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
                  '(ie.`cdate` REGEXP @' +
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
                  '(ie.`mdate` REGEXP @' +
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
                  'ie.`guid` IN (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE `name`=@' +
                  name +
                  ' AND LOWER(`string`) REGEXP LOWER(@' +
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
                  '(ie.`cdate` LIKE @' +
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
                  '(ie.`mdate` LIKE @' +
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
                  'ie.`guid` IN (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE `name`=@' +
                  name +
                  ' AND `string` LIKE @' +
                  value +
                  ')';
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
                  '(ie.`cdate` LIKE @' +
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
                  '(ie.`mdate` LIKE @' +
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
                  'ie.`guid` IN (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE `name`=@' +
                  name +
                  ' AND LOWER(`string`) LIKE LOWER(@' +
                  value +
                  '))';
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
                  'ie.`cdate`>@' +
                  cdate;
                params[cdate] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'ie.`mdate`>@' +
                  mdate;
                params[mdate] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
                break;
              } else {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'ie.`guid` IN (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE `name`=@' +
                  name +
                  ' AND `number`>@' +
                  value +
                  ')';
                params[name] = curValue[0];
                params[value] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
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
                  'ie.`cdate`>=@' +
                  cdate;
                params[cdate] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'ie.`mdate`>=@' +
                  mdate;
                params[mdate] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
                break;
              } else {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'ie.`guid` IN (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE `name`=@' +
                  name +
                  ' AND `number`>=@' +
                  value +
                  ')';
                params[name] = curValue[0];
                params[value] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
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
                  'ie.`cdate`<@' +
                  cdate;
                params[cdate] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'ie.`mdate`<@' +
                  mdate;
                params[mdate] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
                break;
              } else {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'ie.`guid` IN (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE `name`=@' +
                  name +
                  ' AND `number`<@' +
                  value +
                  ')';
                params[name] = curValue[0];
                params[value] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
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
                  'ie.`cdate`<=@' +
                  cdate;
                params[cdate] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
                break;
              } else if (curValue[0] === 'mdate') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const mdate = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'ie.`mdate`<=@' +
                  mdate;
                params[mdate] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
                break;
              } else {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'ie.`guid` IN (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'comparisons_' + etype) +
                  ' WHERE `name`=@' +
                  name +
                  ' AND `number`<=@' +
                  value +
                  ')';
                params[name] = curValue[0];
                params[value] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
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
                'ie.`guid` IN (SELECT `guid` FROM ' +
                MySQLDriver.escape(this.prefix + 'references_' + etype) +
                ' WHERE `name`=@' +
                name +
                ' AND `reference`=UNHEX(@' +
                guid +
                '))';
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
        sortBy = '`mdate`';
        break;
      case 'cdate':
      default:
        sortBy = '`cdate`';
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
        if ('limit' in options) {
          limit = ` LIMIT ${Math.floor(
            isNaN(Number(options.limit)) ? 0 : Number(options.limit)
          )}`;
        }
        let offset = '';
        if ('offset' in options) {
          offset = ` OFFSET ${Math.floor(
            isNaN(Number(options.offset)) ? 0 : Number(options.offset)
          )}`;
        }
        const whereClause = queryParts.join(') AND (');
        query = `SELECT LOWER(HEX(e.\`guid\`)) as \`guid\`, e.\`tags\`, e.\`cdate\`, e.\`mdate\`, d.\`name\`, d.\`value\`
          FROM ${MySQLDriver.escape(`${this.prefix}entities_${etype}`)} e
          LEFT JOIN ${MySQLDriver.escape(
            `${this.prefix}data_${etype}`
          )} d ON e.\`guid\`=d.\`guid\`
          INNER JOIN (
            SELECT ie.\`guid\`
            FROM ${MySQLDriver.escape(`${this.prefix}entities_${etype}`)} ie
            WHERE (${whereClause})
            ORDER BY ie.${sortBy}${limit}${offset}
          ) f ON e.\`guid\`=f.\`guid\`
          ORDER BY e.${sortBy};`;
      }
    } else {
      if (subquery) {
        query = '';
      } else {
        let limit = '';
        if ('limit' in options) {
          limit = ` LIMIT ${Math.floor(
            isNaN(Number(options.limit)) ? 0 : Number(options.limit)
          )}`;
        }
        let offset = '';
        if ('offset' in options) {
          offset = ` OFFSET ${Math.floor(
            isNaN(Number(options.offset)) ? 0 : Number(options.offset)
          )}`;
        }
        if (limit || offset) {
          query = `SELECT LOWER(HEX(e.\`guid\`)) as \`guid\`, e.\`tags\`, e.\`cdate\`, e.\`mdate\`, d.\`name\`, d.\`value\`
            FROM ${MySQLDriver.escape(`${this.prefix}entities_${etype}`)} e
            LEFT JOIN ${MySQLDriver.escape(
              `${this.prefix}data_${etype}`
            )} d ON e.\`guid\`=d.\`guid\`
            INNER JOIN (
              SELECT ie.\`guid\`
              FROM ${MySQLDriver.escape(`${this.prefix}entities_${etype}`)} ie
              ORDER BY ie.${sortBy}${limit}${offset}
            ) f ON e.\`guid\`=f.\`guid\`
            ORDER BY e.${sortBy};`;
        } else {
          query = `SELECT LOWER(HEX(e.\`guid\`)) as \`guid\`, e.\`tags\`, e.\`cdate\`, e.\`mdate\`, d.\`name\`, d.\`value\`
            FROM ${MySQLDriver.escape(`${this.prefix}entities_${etype}`)} e
            LEFT JOIN ${MySQLDriver.escape(
              `${this.prefix}data_${etype}`
            )} d ON e.\`guid\`=d.\`guid\`
            ORDER BY e.${sortBy};`;
        }
      }
    }

    return {
      query,
      params,
    };
  }

  protected performQuery(
    options: Options,
    formattedSelectors: FormattedSelector[],
    etype: string
  ): {
    result: any;
  } {
    const { query, params } = this.makeEntityQuery(
      options,
      formattedSelectors,
      etype
    );
    const result = this.queryIter(query, { etype, params }).then((val) =>
      val[Symbol.iterator]()
    );
    return {
      result,
    };
  }

  protected performQuerySync(
    options: Options,
    formattedSelectors: FormattedSelector[],
    etype: string
  ): {
    result: any;
  } {
    const { query, params } = this.makeEntityQuery(
      options,
      formattedSelectors,
      etype
    );
    const result = this.queryIterSync(query, { etype, params })[
      Symbol.iterator
    ]();
    return {
      result,
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
    const { result: resultPromise, process } = this.getEntitesRowLike<T>(
      // @ts-ignore: options is correct here.
      options,
      selectors,
      (options, formattedSelectors, etype) =>
        this.performQuery(options, formattedSelectors, etype),
      () => {
        const next: any = result.next();
        return next.done ? null : next.value;
      },
      () => undefined,
      (row) => row.guid,
      (row) => ({
        tags: row.tags.length > 2 ? row.tags.slice(1, -1).split(' ') : [],
        cdate: isNaN(Number(row.cdate)) ? null : Number(row.cdate),
        mdate: isNaN(Number(row.mdate)) ? null : Number(row.mdate),
      }),
      (row) => ({
        name: row.name,
        svalue: row.value,
      })
    );

    const result = await resultPromise;
    return process();
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
      // @ts-ignore: options is correct here.
      options,
      selectors,
      (options, formattedSelectors, etype) =>
        this.performQuerySync(options, formattedSelectors, etype),
      () => {
        const next: any = result.next();
        return next.done ? null : next.value;
      },
      () => undefined,
      (row) => row.guid,
      (row) => ({
        tags: row.tags.length > 2 ? row.tags.slice(1, -1).split(',') : [],
        cdate: isNaN(Number(row.cdate)) ? null : Number(row.cdate),
        mdate: isNaN(Number(row.mdate)) ? null : Number(row.mdate),
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
    const result = await this.queryGet(
      `SELECT \`cur_uid\` FROM ${MySQLDriver.escape(
        `${this.prefix}uids`
      )} WHERE \`name\`=@name;`,
      {
        params: {
          name: name,
        },
      }
    );
    return (result?.cur_uid as number | null) ?? null;
  }

  public async import(filename: string) {
    const connection = await this.getConnection();
    const result = await this.importFromFile(
      filename,
      async (guid, tags, sdata, etype) => {
        await this.queryRun(
          `REPLACE INTO ${MySQLDriver.escape(
            `${this.prefix}entities_${etype}`
          )} (\`guid\`, \`tags\`, \`cdate\`, \`mdate\`) VALUES (UNHEX(@guid), @tags, @cdate, @mdate);`,
          {
            etype,
            connection,
            params: {
              guid,
              tags: ' ' + tags.join(' ') + ' ',
              cdate: isNaN(Number(JSON.parse(sdata.cdate)))
                ? null
                : Number(JSON.parse(sdata.cdate)),
              mdate: isNaN(Number(JSON.parse(sdata.mdate)))
                ? null
                : Number(JSON.parse(sdata.mdate)),
            },
          }
        );
        const promises = [];
        promises.push(
          this.queryRun(
            `DELETE FROM ${MySQLDriver.escape(
              `${this.prefix}data_${etype}`
            )} WHERE \`guid\`=UNHEX(@guid);`,
            {
              etype,
              connection,
              params: {
                guid,
              },
            }
          )
        );
        promises.push(
          this.queryRun(
            `DELETE FROM ${MySQLDriver.escape(
              `${this.prefix}comparisons_${etype}`
            )} WHERE \`guid\`=UNHEX(@guid);`,
            {
              etype,
              connection,
              params: {
                guid,
              },
            }
          )
        );
        promises.push(
          this.queryRun(
            `DELETE FROM ${MySQLDriver.escape(
              `${this.prefix}references_${etype}`
            )} WHERE \`guid\`=UNHEX(@guid);`,
            {
              etype,
              connection,
              params: {
                guid,
              },
            }
          )
        );
        await Promise.all(promises);
        delete sdata.cdate;
        delete sdata.mdate;
        for (const name in sdata) {
          const value = sdata[name];
          const uvalue = JSON.parse(value);
          const promises = [];
          promises.push(
            this.queryRun(
              `INSERT INTO ${MySQLDriver.escape(
                `${this.prefix}data_${etype}`
              )} (\`guid\`, \`name\`, \`value\`) VALUES (UNHEX(@guid), @name, @value);`,
              {
                etype,
                connection,
                params: {
                  guid,
                  name,
                  value,
                },
              }
            )
          );
          promises.push(
            this.queryRun(
              `INSERT INTO ${MySQLDriver.escape(
                `${this.prefix}comparisons_${etype}`
              )} (\`guid\`, \`name\`, \`truthy\`, \`string\`, \`number\`) VALUES (UNHEX(@guid), @name, @truthy, @string, @number);`,
              {
                etype,
                connection,
                params: {
                  guid,
                  name,
                  truthy: !!uvalue,
                  string: `${uvalue}`,
                  number: isNaN(Number(uvalue)) ? null : Number(uvalue),
                },
              }
            )
          );
          const references = this.findReferences(value);
          for (const reference of references) {
            promises.push(
              this.queryRun(
                `INSERT INTO ${MySQLDriver.escape(
                  `${this.prefix}references_${etype}`
                )} (\`guid\`, \`name\`, \`reference\`) VALUES {UNHEX(@guid), @name, UNHEX(@reference)};`,
                {
                  etype,
                  connection,
                  params: {
                    guid,
                    name,
                    reference,
                  },
                }
              )
            );
          }
        }
        await Promise.all(promises);
      },
      async (name, curUid) => {
        await this.queryRun(
          `INSERT INTO ${MySQLDriver.escape(
            `${this.prefix}uids`
          )} (\`name\`, \`cur_uid\`) VALUES (@name, @curUid) ON DUPLICATE KEY UPDATE \`cur_uid\`=@curUid;`,
          {
            connection,
            params: {
              name,
              curUid,
            },
          }
        );
      },
      this.config.transactions
        ? async () => {
            await this.queryRun('BEGIN;', { connection });
          }
        : null,
      this.config.transactions
        ? async () => {
            await this.queryRun('COMMIT;', { connection });
          }
        : null
    );

    connection.release();
    return result;
  }

  public async newUID(name: string) {
    if (name == null) {
      throw new InvalidParametersError('Name not given for UID.');
    }
    const connection = await this.getConnection();
    const lock = await this.queryGet(
      `SELECT GET_LOCK(${MySQLDriver.escapeValue(
        `${this.prefix}uids_${name}`
      )}, 10) AS \`lock\`;`,
      { connection }
    );
    if (lock.lock !== 1) {
      throw new QueryFailedError("Couldn't get lock for UID: " + name);
    }
    if (this.config.transactions) {
      await this.queryRun('BEGIN;', { connection });
    }
    await this.queryRun(
      `INSERT INTO ${MySQLDriver.escape(
        `${this.prefix}uids`
      )} (\`name\`, \`cur_uid\`) VALUES (@name, 1) ON DUPLICATE KEY UPDATE \`cur_uid\`=\`cur_uid\`+1;`,
      {
        connection,
        params: {
          name,
        },
      }
    );
    const result = await this.queryGet(
      `SELECT \`cur_uid\` FROM ${MySQLDriver.escape(
        `${this.prefix}uids`
      )} WHERE \`name\`=@name;`,
      {
        connection,
        params: {
          name,
        },
      }
    );
    if (this.config.transactions) {
      await this.queryRun('COMMIT;', { connection });
    }
    await this.queryRun(
      `SELECT RELEASE_LOCK(${MySQLDriver.escapeValue(
        `${this.prefix}uids_${name}`
      )});`,
      { connection }
    );
    connection.release();
    return result.cur_uid ?? null;
  }

  public async renameUID(oldName: string, newName: string) {
    if (oldName == null || newName == null) {
      throw new InvalidParametersError('Name not given for UID.');
    }
    await this.queryRun(
      `UPDATE ${MySQLDriver.escape(
        `${this.prefix}uids`
      )} SET \`name\`=@newName WHERE \`name\`=@oldName;`,
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
    const connection = await this.getConnection();
    const insertData = async (
      guid: string,
      data: EntityData,
      sdata: SerializedEntityData,
      etype: string
    ) => {
      const runInsertQuery = async (
        name: string,
        value: any,
        svalue: string
      ) => {
        const promises = [];
        promises.push(
          this.queryRun(
            `INSERT INTO ${MySQLDriver.escape(
              `${this.prefix}data_${etype}`
            )} (\`guid\`, \`name\`, \`value\`) VALUES (UNHEX(@guid), @name, @svalue);`,
            {
              etype,
              connection,
              params: {
                guid,
                name,
                svalue,
              },
            }
          )
        );
        promises.push(
          this.queryRun(
            `INSERT INTO ${MySQLDriver.escape(
              `${this.prefix}comparisons_${etype}`
            )} (\`guid\`, \`name\`, \`truthy\`, \`string\`, \`number\`) VALUES (UNHEX(@guid), @name, @truthy, @string, @number);`,
            {
              etype,
              connection,
              params: {
                guid,
                name,
                truthy: !!value,
                string: `${value}`,
                number: isNaN(Number(value)) ? null : Number(value),
              },
            }
          )
        );
        const references = this.findReferences(svalue);
        for (const reference of references) {
          promises.push(
            this.queryRun(
              `INSERT INTO ${MySQLDriver.escape(
                `${this.prefix}references_${etype}`
              )} (\`guid\`, \`name\`, \`reference\`) VALUES (UNHEX(@guid), @name, UNHEX(@reference));`,
              {
                etype,
                connection,
                params: {
                  guid,
                  name,
                  reference,
                },
              }
            )
          );
        }
        await Promise.all(promises);
      };
      for (const name in data) {
        await runInsertQuery(name, data[name], JSON.stringify(data[name]));
      }
      for (const name in sdata) {
        await runInsertQuery(name, JSON.parse(sdata[name]), sdata[name]);
      }
    };
    const result = await this.saveEntityRowLike(
      entity,
      async (_entity, guid, tags, data, sdata, cdate, etype) => {
        await this.queryRun(
          `INSERT INTO ${MySQLDriver.escape(
            `${this.prefix}entities_${etype}`
          )} (\`guid\`, \`tags\`, \`cdate\`, \`mdate\`) VALUES (UNHEX(@guid), @tags, @cdate, @cdate);`,
          {
            etype,
            connection,
            params: {
              guid,
              tags: ' ' + tags.join(' ') + ' ',
              cdate,
            },
          }
        );
        await insertData(guid, data, sdata, etype);
        return true;
      },
      async (entity, guid, tags, data, sdata, mdate, etype) => {
        if (this.config.rowLocking) {
          const promises = [];
          promises.push(
            this.queryRun(
              `SELECT 1 FROM ${MySQLDriver.escape(
                `${this.prefix}entities_${etype}`
              )} WHERE \`guid\`=UNHEX(@guid) GROUP BY 1 FOR UPDATE;`,
              {
                etype,
                connection,
                params: {
                  guid,
                },
              }
            )
          );
          promises.push(
            this.queryRun(
              `SELECT 1 FROM ${MySQLDriver.escape(
                `${this.prefix}data_${etype}`
              )} WHERE \`guid\`=UNHEX(@guid) GROUP BY 1 FOR UPDATE;`,
              {
                etype,
                connection,
                params: {
                  guid,
                },
              }
            )
          );
          promises.push(
            this.queryRun(
              `SELECT 1 FROM ${MySQLDriver.escape(
                `${this.prefix}comparisons_${etype}`
              )} WHERE \`guid\`=UNHEX(@guid) GROUP BY 1 FOR UPDATE;`,
              {
                etype,
                connection,
                params: {
                  guid,
                },
              }
            )
          );
          promises.push(
            this.queryRun(
              `SELECT 1 FROM ${MySQLDriver.escape(
                `${this.prefix}references_${etype}`
              )} WHERE \`guid\`=UNHEX(@guid) GROUP BY 1 FOR UPDATE;`,
              {
                etype,
                connection,
                params: {
                  guid,
                },
              }
            )
          );
          await Promise.all(promises);
        }
        if (this.config.tableLocking) {
          await this.queryRun(
            `LOCK TABLES ${MySQLDriver.escape(
              `${this.prefix}entities_${etype}`
            )} WRITE, ${MySQLDriver.escape(
              `${this.prefix}data_${etype}`
            )} WRITE, ${MySQLDriver.escape(
              `${this.prefix}comparisons_${etype}`
            )} WRITE, ${MySQLDriver.escape(
              `${this.prefix}references_${etype}`
            )} WRITE;`,
            { connection }
          );
        }
        const info = await this.queryRun(
          `UPDATE ${MySQLDriver.escape(
            `${this.prefix}entities_${etype}`
          )} SET \`tags\`=@tags, \`mdate\`=@mdate WHERE \`guid\`=UNHEX(@guid) AND \`mdate\` <= @emdate;`,
          {
            etype,
            connection,
            params: {
              tags: ' ' + tags.join(' ') + ' ',
              mdate,
              guid,
              emdate: isNaN(Number(entity.mdate)) ? 0 : Number(entity.mdate),
            },
          }
        );
        let success = false;
        if (info.changes === 1) {
          const promises = [];
          promises.push(
            this.queryRun(
              `DELETE FROM ${MySQLDriver.escape(
                `${this.prefix}data_${etype}`
              )} WHERE \`guid\`=UNHEX(@guid);`,
              {
                etype,
                connection,
                params: {
                  guid,
                },
              }
            )
          );
          promises.push(
            this.queryRun(
              `DELETE FROM ${MySQLDriver.escape(
                `${this.prefix}comparisons_${etype}`
              )} WHERE \`guid\`=UNHEX(@guid);`,
              {
                etype,
                connection,
                params: {
                  guid,
                },
              }
            )
          );
          promises.push(
            this.queryRun(
              `DELETE FROM ${MySQLDriver.escape(
                `${this.prefix}references_${etype}`
              )} WHERE \`guid\`=UNHEX(@guid);`,
              {
                etype,
                connection,
                params: {
                  guid,
                },
              }
            )
          );
          await Promise.all(promises);
          await insertData(guid, data, sdata, etype);
          success = true;
        }
        if (this.config.tableLocking) {
          await this.queryRun('UNLOCK TABLES;', { connection });
        }
        return success;
      },
      this.config.transactions
        ? async () => {
            await this.queryRun('BEGIN;', { connection });
          }
        : null,
      this.config.transactions
        ? async (success) => {
            if (success) {
              await this.queryRun('COMMIT;', { connection });
            } else {
              await this.queryRun('ROLLBACK;', { connection });
            }
            return success;
          }
        : null
    );

    connection.release();
    return result;
  }

  public async setUID(name: string, curUid: number) {
    if (name == null) {
      throw new InvalidParametersError('Name not given for UID.');
    }
    await this.queryRun(
      `INSERT INTO ${MySQLDriver.escape(
        `${this.prefix}uids`
      )} (\`name\`, \`cur_uid\`) VALUES (@name, @curUid) ON DUPLICATE KEY UPDATE \`cur_uid\`=@curUid;`,
      {
        params: {
          name,
          curUid,
        },
      }
    );
    return true;
  }
}
