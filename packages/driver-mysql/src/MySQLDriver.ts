import { Pool, PoolOptions, PoolConnection } from 'mysql2';
import mysql from 'mysql2';
import SqlString from 'sqlstring';
import {
  NymphDriver,
  type EntityConstructor,
  type EntityData,
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
  MySQLDriverConfig,
  MySQLDriverConfigDefaults as defaults,
} from './conf';

type MySQLDriverTransaction = {
  connection: PoolConnection | null;
  count: number;
};

/**
 * The MySQL Nymph database driver.
 */
export default class MySQLDriver extends NymphDriver {
  public config: MySQLDriverConfig;
  private mysqlConfig: PoolOptions;
  protected prefix: string;
  protected connected: boolean = false;
  // @ts-ignore: this is assigned in connect(), which is called by the constructor.
  protected link: Pool;
  protected transaction: MySQLDriverTransaction | null = null;

  static escape(input: string) {
    return SqlString.escapeId(input, true);
  }

  static escapeValue(input: string) {
    return mysql.escape(input);
  }

  constructor(
    config: Partial<MySQLDriverConfig>,
    link?: Pool,
    transaction?: MySQLDriverTransaction,
  ) {
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
    if (link != null) {
      this.link = link;
      this.connected = true;
    }
    if (transaction != null) {
      this.transaction = transaction;
    }
    if (link == null) {
      this.connect();
    }
  }

  /**
   * This is used internally by Nymph. Don't call it yourself.
   *
   * @returns A clone of this instance.
   */
  public clone() {
    return new MySQLDriver(
      this.config,
      this.link,
      this.transaction ?? undefined,
    );
  }

  private getConnection(): Promise<PoolConnection> {
    if (this.transaction != null && this.transaction.connection != null) {
      return Promise.resolve(this.transaction.connection);
    }
    return new Promise((resolve, reject) =>
      this.link.getConnection((err, con) => (err ? reject(err) : resolve(con))),
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
        const connection: PoolConnection = await new Promise(
          (resolve, reject) =>
            this.link.getConnection((err, con) =>
              err ? reject(err) : resolve(con),
            ),
        );
        connection.release();
      }
    } catch (e: any) {
      this.connected = false;
    }

    // Connecting, selecting database
    if (!this.connected) {
      try {
        this.link = mysql.createPool({
          ...this.mysqlConfig,
          charset: 'utf8mb4_bin',
        });
        this.connected = true;
      } catch (e: any) {
        if (
          this.mysqlConfig.host === 'localhost' &&
          this.mysqlConfig.user === 'nymph' &&
          this.mysqlConfig.password === 'password' &&
          this.mysqlConfig.database === 'nymph'
        ) {
          throw new NotConfiguredError(
            "It seems the config hasn't been set up correctly.",
          );
        } else {
          throw new UnableToConnectError('Could not connect: ' + e?.message);
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
      await new Promise((resolve) => this.link.end(() => resolve(0)));
      this.connected = false;
    }
    return this.connected;
  }

  public async inTransaction() {
    return !!this.transaction;
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
  private async createTables(etype: string | null = null) {
    await this.queryRun('SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";');
    let foreignKeyDataTableGuid = '';
    let foreignKeyReferencesTableGuid = '';
    let foreignKeyUniquesTableGuid = '';
    if (this.config.foreignKeys) {
      foreignKeyDataTableGuid = ` REFERENCES ${MySQLDriver.escape(
        `${this.prefix}entities_${etype}`,
      )}(\`guid\`) ON DELETE CASCADE`;
      foreignKeyReferencesTableGuid = ` REFERENCES ${MySQLDriver.escape(
        `${this.prefix}entities_${etype}`,
      )}(\`guid\`) ON DELETE CASCADE`;
      foreignKeyUniquesTableGuid = ` REFERENCES ${MySQLDriver.escape(
        `${this.prefix}entities_${etype}`,
      )}(\`guid\`) ON DELETE CASCADE`;
    }
    if (etype != null) {
      // Create the entity table.
      await this.queryRun(
        `CREATE TABLE IF NOT EXISTS ${MySQLDriver.escape(
          `${this.prefix}entities_${etype}`,
        )} (
          \`guid\` BINARY(12) NOT NULL,
          \`tags\` LONGTEXT,
          \`cdate\` DOUBLE PRECISION NOT NULL,
          \`mdate\` DOUBLE PRECISION NOT NULL,
          PRIMARY KEY (\`guid\`),
          INDEX \`id_guid\` USING HASH (\`guid\`),
          INDEX \`id_cdate\` USING BTREE (\`cdate\`),
          INDEX \`id_mdate\` USING BTREE (\`mdate\`),
          FULLTEXT \`id_tags\` (\`tags\`)
        ) ENGINE ${this.config.engine}
        CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;`,
      );
      // Create the data table.
      await this.queryRun(
        `CREATE TABLE IF NOT EXISTS ${MySQLDriver.escape(
          `${this.prefix}data_${etype}`,
        )} (
          \`guid\` BINARY(12) NOT NULL${foreignKeyDataTableGuid},
          \`name\` TEXT NOT NULL,
          \`value\` CHAR(1) NOT NULL,
          \`json\` JSON,
          \`string\` LONGTEXT,
          \`number\` DOUBLE,
          \`truthy\` BOOLEAN,
          PRIMARY KEY (\`guid\`, \`name\`(255)),
          INDEX \`id_guid\` USING HASH (\`guid\`),
          INDEX \`id_guid_name\` USING HASH (\`guid\`, \`name\`(255)),
          INDEX \`id_name\` USING BTREE (\`name\`(255)),
          INDEX \`id_name_truthy\` USING HASH (\`name\`(255), \`truthy\`),
          INDEX \`id_name_string\` USING BTREE (\`name\`(255), \`string\`(512)),
          INDEX \`id_name_number\` USING BTREE (\`name\`(255), \`number\`)
        ) ENGINE ${this.config.engine}
        CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;`,
      );
      // Create the references table.
      await this.queryRun(
        `CREATE TABLE IF NOT EXISTS ${MySQLDriver.escape(
          `${this.prefix}references_${etype}`,
        )} (
          \`guid\` BINARY(12) NOT NULL${foreignKeyReferencesTableGuid},
          \`name\` TEXT NOT NULL,
          \`reference\` BINARY(12) NOT NULL,
          PRIMARY KEY (\`guid\`, \`name\`(255), \`reference\`),
          INDEX \`id_guid\` USING HASH (\`guid\`),
          INDEX \`id_guid_name\` USING HASH (\`guid\`, \`name\`(255)),
          INDEX \`id_guid_name_reference\` USING HASH (\`guid\`, \`name\`(255), \`reference\`),
          INDEX \`id_name_reference\` USING HASH (\`name\`(255), \`reference\`),
          INDEX \`id_name_reference_guid\` USING BTREE (\`name\`(255), \`reference\`, \`guid\`)
        ) ENGINE ${this.config.engine}
        CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;`,
      );
      // Create the unique strings table.
      // 255 key is max length for charset UTF8.
      await this.queryRun(
        `CREATE TABLE IF NOT EXISTS ${MySQLDriver.escape(
          `${this.prefix}uniques_${etype}`,
        )} (
          \`guid\` BINARY(12) NOT NULL${foreignKeyUniquesTableGuid},
          \`unique\` TEXT NOT NULL,
          PRIMARY KEY (\`guid\`, \`unique\`(255)),
          INDEX \`id_guid\` USING HASH (\`guid\`),
          CONSTRAINT \`uc_unique\` UNIQUE (\`unique\`(255))
        ) ENGINE ${this.config.engine}
        CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;`,
      );
    } else {
      // Create the UID table.
      await this.queryRun(
        `CREATE TABLE IF NOT EXISTS ${MySQLDriver.escape(
          `${this.prefix}uids`,
        )} (
          \`name\` TEXT NOT NULL,
          \`cur_uid\` BIGINT(20) UNSIGNED NOT NULL,
          PRIMARY KEY (\`name\`(100))
        ) ENGINE ${this.config.engine}
        CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;`,
      );
    }
    if (
      this.transaction &&
      this.transaction.count > 0 &&
      this.config.transactions
    ) {
      this.transaction.count = 0;
      this.transaction.connection?.release();
      this.transaction.connection = null;
      this.transaction = null;
    }
    return true;
  }

  private translateQuery(
    origQuery: string,
    origParams: { [k: string]: any },
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
    etypes: string[] = [],
    // @ts-ignore: The return type of T is a promise.
  ): ReturnType<T> {
    try {
      this.nymph.config.debugInfo('mysql:query', query);
      return await runQuery();
    } catch (e: any) {
      const errorCode = e?.errno;
      if (errorCode === 1146 && (await this.createTables())) {
        // If the tables don't exist yet, create them.
        for (let etype of etypes) {
          await this.createTables(etype);
        }
        try {
          return await runQuery();
        } catch (e2: any) {
          throw new QueryFailedError(
            'Query failed: ' + e2?.errno + ' - ' + e2?.message,
            query,
          );
        }
      } else if (errorCode === 1062) {
        throw new EntityUniqueConstraintError(`Unique constraint violation.`);
      } else if (errorCode === 2006) {
        // If the MySQL server disconnected, reconnect to it.
        if (!this.connect()) {
          throw new QueryFailedError(
            'Query failed: ' + e?.errno + ' - ' + e?.message,
            query,
          );
        }
        try {
          return await runQuery();
        } catch (e2: any) {
          throw new QueryFailedError(
            'Query failed: ' + e2?.errno + ' - ' + e2?.message,
            query,
          );
        }
      } else {
        throw new QueryFailedError(
          'Query failed: ' + e?.errno + ' - ' + e?.message,
          query,
        );
      }
    }
  }

  private queryIter(
    query: string,
    {
      etypes = [],
      params = {},
    }: {
      etypes?: string[];
      params?: { [k: string]: any };
    } = {},
  ) {
    const { query: newQuery, params: newParams } = this.translateQuery(
      query,
      params,
    );
    return this.query(
      async () => {
        const results: any = await new Promise((resolve, reject) => {
          try {
            (this.transaction?.connection ?? this.link).query(
              newQuery,
              newParams,
              (error, results) => {
                if (error) {
                  reject(error);
                }
                resolve(results);
              },
            );
          } catch (e) {
            reject(e);
          }
        });
        return results;
      },
      `${query} -- ${JSON.stringify(params)}`,
      etypes,
    );
  }

  private queryGet(
    query: string,
    {
      etypes = [],
      params = {},
    }: {
      etypes?: string[];
      params?: { [k: string]: any };
    } = {},
  ) {
    const { query: newQuery, params: newParams } = this.translateQuery(
      query,
      params,
    );
    return this.query(
      async () => {
        const results: any = await new Promise((resolve, reject) => {
          try {
            (this.transaction?.connection ?? this.link).query(
              newQuery,
              newParams,
              (error, results) => {
                if (error) {
                  reject(error);
                }
                resolve(results);
              },
            );
          } catch (e) {
            reject(e);
          }
        });
        return results[0];
      },
      `${query} -- ${JSON.stringify(params)}`,
      etypes,
    );
  }

  private queryRun(
    query: string,
    {
      etypes = [],
      params = {},
    }: {
      etypes?: string[];
      params?: { [k: string]: any };
    } = {},
  ) {
    const { query: newQuery, params: newParams } = this.translateQuery(
      query,
      params,
    );
    return this.query(
      async () => {
        const results: any = await new Promise((resolve, reject) => {
          try {
            (this.transaction?.connection ?? this.link).query(
              newQuery,
              newParams,
              (error, results) => {
                if (error) {
                  reject(error);
                }
                resolve(results);
              },
            );
          } catch (e) {
            reject(e);
          }
        });
        return { changes: results.changedRows ?? 0 };
      },
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
    if (!this.transaction || this.transaction.count === 0) {
      this.transaction = null;
      return true;
    }
    if (this.config.transactions) {
      await this.queryRun(`RELEASE SAVEPOINT ${MySQLDriver.escape(name)};`);
    }
    this.transaction.count--;
    if (this.transaction.count === 0) {
      await this.queryRun('COMMIT;');
      this.transaction.connection?.release();
      this.transaction.connection = null;
      this.transaction = null;
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
    await this.internalTransaction('nymph-delete');
    try {
      await this.queryRun(
        `DELETE FROM ${MySQLDriver.escape(
          `${this.prefix}entities_${etype}`,
        )} WHERE \`guid\`=UNHEX(@guid);`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
      await this.queryRun(
        `DELETE FROM ${MySQLDriver.escape(
          `${this.prefix}data_${etype}`,
        )} WHERE \`guid\`=UNHEX(@guid);`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
      await this.queryRun(
        `DELETE FROM ${MySQLDriver.escape(
          `${this.prefix}references_${etype}`,
        )} WHERE \`guid\`=UNHEX(@guid);`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
      await this.queryRun(
        `DELETE FROM ${MySQLDriver.escape(
          `${this.prefix}uniques_${etype}`,
        )} WHERE \`guid\`=UNHEX(@guid);`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
    } catch (e: any) {
      this.nymph.config.debugError('mysql', `Delete entity error: "${e}"`);
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
    await this.queryRun(
      `DELETE FROM ${MySQLDriver.escape(
        `${this.prefix}uids`,
      )} WHERE \`name\`=@name;`,
      {
        params: {
          name,
        },
      },
    );
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
    let uids = await this.queryIter(
      `SELECT * FROM ${MySQLDriver.escape(
        `${this.prefix}uids`,
      )} ORDER BY \`name\`;`,
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
    const tables = await this.queryIter(
      'SELECT `table_name` AS `table_name` FROM `information_schema`.`tables` WHERE `table_schema`=@db AND `table_name` LIKE @prefix;',
      {
        params: {
          db: this.config.database,
          prefix: this.prefix + 'entities_' + '%',
        },
      },
    );
    const etypes = [];
    for (const table of tables) {
      etypes.push(table.table_name.substr((this.prefix + 'entities_').length));
    }

    for (const etype of etypes) {
      // Export entities.
      const dataIterator = (
        await this.queryIter(
          `SELECT LOWER(HEX(e.\`guid\`)) AS \`guid\`, e.\`tags\`, e.\`cdate\`, e.\`mdate\`, d.\`name\`, d.\`value\`, d.\`json\`, d.\`string\`, d.\`number\`
          FROM ${MySQLDriver.escape(`${this.prefix}entities_${etype}`)} e
          LEFT JOIN ${MySQLDriver.escape(
            `${this.prefix}data_${etype}`,
          )} d ON e.\`guid\`=d.\`guid\`
          ORDER BY e.\`guid\`;`,
        )
      )[Symbol.iterator]();
      let datum = dataIterator.next();
      while (!datum.done) {
        const guid = datum.value.guid;
        const tags = datum.value.tags
          .slice(1, -1)
          .split(' ')
          .filter((tag: string) => tag)
          .join(',');
        const cdate = datum.value.cdate;
        const mdate = datum.value.mdate;
        let currentEntityExport: string[] = [];
        currentEntityExport.push(`{${guid}}<${etype}>[${tags}]`);
        currentEntityExport.push(`\tcdate=${JSON.stringify(cdate)}`);
        currentEntityExport.push(`\tmdate=${JSON.stringify(mdate)}`);
        if (datum.value.name != null) {
          // This do will keep going and adding the data until the
          // next entity is reached. $row will end on the next entity.
          do {
            const value =
              datum.value.value === 'N'
                ? JSON.stringify(datum.value.number)
                : datum.value.value === 'S'
                ? JSON.stringify(datum.value.string)
                : datum.value.value === 'J'
                ? JSON.stringify(datum.value.json)
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
    const countTable = `count${tableSuffix}`;
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
                  '.`guid`=UNHEX(@' +
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
                    curQuery += ieTable + '.`tags` NOT REGEXP @' + tag;
                    params[tag] = ' ' + curTag + ' ';
                  }
                } else {
                  const tag = `param${++count.i}`;
                  curQuery += ieTable + '.`tags` NOT REGEXP @' + tag;
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
                  'MATCH (' +
                  ieTable +
                  '.`tags`) AGAINST (@' +
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
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `guid`=' +
                  ieTable +
                  '.`guid` AND `name`=@' +
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
                    '.`cdate` NOT NULL)';
                  break;
                } else if (curVar === 'mdate') {
                  curQuery +=
                    (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                    '(' +
                    ieTable +
                    '.`mdate` NOT NULL)';
                  break;
                } else {
                  const name = `param${++count.i}`;
                  curQuery +=
                    (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                    'EXISTS (SELECT `guid` FROM ' +
                    MySQLDriver.escape(this.prefix + 'data_' + etype) +
                    ' WHERE `guid`=' +
                    ieTable +
                    '.`guid` AND `name`=@' +
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
                  ieTable +
                  '.`cdate`=@' +
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
                  ieTable +
                  '.`mdate`=@' +
                  mdate;
                params[mdate] = isNaN(Number(curValue[1]))
                  ? null
                  : Number(curValue[1]);
                break;
              } else if (typeof curValue[1] === 'number') {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `guid`=' +
                  ieTable +
                  '.`guid` AND `name`=@' +
                  name +
                  ' AND `number`=@' +
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
                  'EXISTS (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `guid`=' +
                  ieTable +
                  '.`guid` AND `name`=@' +
                  name +
                  ' AND `string`=@' +
                  value +
                  ')';
                params[name] = curValue[0];
                params[value] = curValue[1];
              } else if (curValue[1] == null) {
                if (curQuery) {
                  curQuery += typeIsOr ? ' OR ' : ' AND ';
                }
                const name = `param${++count.i}`;
                curQuery +=
                  (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                  'EXISTS (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `guid`=' +
                  ieTable +
                  '.`guid` AND `name`=@' +
                  name +
                  " AND JSON_TYPE(`json`)='NULL')";
                params[name] = curValue[0];
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
                  'EXISTS (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `guid`=' +
                  ieTable +
                  '.`guid` AND `name`=@' +
                  name +
                  ' AND `json`=@' +
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
                  ieTable +
                  '.`cdate`=@' +
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
                  ieTable +
                  '.`mdate`=@' +
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
                  'EXISTS (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `guid`=' +
                  ieTable +
                  '.`guid` AND `name`=@' +
                  name +
                  ' AND JSON_CONTAINS(`json`, @' +
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
                  '(' +
                  ieTable +
                  '.`cdate` REGEXP @' +
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
                  '.`mdate` REGEXP @' +
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
                  'EXISTS (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `guid`=' +
                  ieTable +
                  '.`guid` AND `name`=@' +
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
                  '(' +
                  ieTable +
                  '.`cdate` REGEXP @' +
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
                  '.`mdate` REGEXP @' +
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
                  'EXISTS (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `guid`=' +
                  ieTable +
                  '.`guid` AND `name`=@' +
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
                  '(' +
                  ieTable +
                  '.`cdate` LIKE @' +
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
                  '.`mdate` LIKE @' +
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
                  'EXISTS (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `guid`=' +
                  ieTable +
                  '.`guid` AND `name`=@' +
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
                  '(' +
                  ieTable +
                  '.`cdate` LIKE @' +
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
                  '.`mdate` LIKE @' +
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
                  'EXISTS (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `guid`=' +
                  ieTable +
                  '.`guid` AND `name`=@' +
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
                  ieTable +
                  '.`cdate`>@' +
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
                  ieTable +
                  '.`mdate`>@' +
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
                  'EXISTS (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `guid`=' +
                  ieTable +
                  '.`guid` AND `name`=@' +
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
                  ieTable +
                  '.`cdate`>=@' +
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
                  ieTable +
                  '.`mdate`>=@' +
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
                  'EXISTS (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `guid`=' +
                  ieTable +
                  '.`guid` AND `name`=@' +
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
                  ieTable +
                  '.`cdate`<@' +
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
                  ieTable +
                  '.`mdate`<@' +
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
                  'EXISTS (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `guid`=' +
                  ieTable +
                  '.`guid` AND `name`=@' +
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
                  ieTable +
                  '.`cdate`<=@' +
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
                  ieTable +
                  '.`mdate`<=@' +
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
                  'EXISTS (SELECT `guid` FROM ' +
                  MySQLDriver.escape(this.prefix + 'data_' + etype) +
                  ' WHERE `guid`=' +
                  ieTable +
                  '.`guid` AND `name`=@' +
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
                'EXISTS (SELECT `guid` FROM ' +
                MySQLDriver.escape(this.prefix + 'references_' + etype) +
                ' WHERE `guid`=' +
                ieTable +
                '.`guid` AND `name`=@' +
                name +
                ' AND `reference`=UNHEX(@' +
                guid +
                '))';
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
                'r' + referenceTableSuffix + '.`reference`',
              );
              if (curQuery) {
                curQuery += typeIsOr ? ' OR ' : ' AND ';
              }
              const qrefName = `param${++count.i}`;
              curQuery +=
                (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                'EXISTS (SELECT `guid` FROM ' +
                MySQLDriver.escape(this.prefix + 'references_' + etype) +
                ' r' +
                referenceTableSuffix +
                ' WHERE r' +
                referenceTableSuffix +
                '.`guid`=' +
                ieTable +
                '.`guid` AND r' +
                referenceTableSuffix +
                '.`name`=@' +
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
    let sortJoinInner = '';
    const order = options.reverse ? ' DESC' : '';
    switch (sort) {
      case 'mdate':
        sortBy = `${eTable}.\`mdate\`${order}`;
        sortByInner = `${ieTable}.\`mdate\`${order}`;
        break;
      case 'cdate':
        sortBy = `${eTable}.\`cdate\`${order}`;
        sortByInner = `${ieTable}.\`cdate\`${order}`;
        break;
      default:
        const name = `param${++count.i}`;
        sortJoin = `LEFT JOIN (
            SELECT \`guid\`, \`string\`, \`number\`
            FROM ${MySQLDriver.escape(this.prefix + 'data_' + etype)}
            WHERE \`name\`=@${name}
            ORDER BY \`number\`${order}, \`string\`${order}
          ) ${sTable} ON ${eTable}.\`guid\`=${sTable}.\`guid\``;
        sortJoinInner = `LEFT JOIN (
            SELECT \`guid\`, \`string\`, \`number\`
            FROM ${MySQLDriver.escape(this.prefix + 'data_' + etype)}
            WHERE \`name\`=@${name}
            ORDER BY \`number\`${order}, \`string\`${order}
          ) ${sTable} ON ${ieTable}.\`guid\`=${sTable}.\`guid\``;
        sortBy = `${sTable}.\`number\`${order}, ${sTable}.\`string\`${order}`;
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
          limit = ` LIMIT ${Math.floor(
            isNaN(Number(options.limit)) ? 0 : Number(options.limit),
          )}`;
        }
        let offset = '';
        if ('offset' in options) {
          offset = ` OFFSET ${Math.floor(
            isNaN(Number(options.offset)) ? 0 : Number(options.offset),
          )}`;
        }
        const whereClause = queryParts.join(') AND (');
        const guidClause = guidSelector
          ? `${ieTable}.\`guid\`=${guidSelector} AND `
          : '';
        if (options.return === 'count') {
          if (limit || offset) {
            query = `SELECT COUNT(${countTable}.\`guid\`) AS \`count\` FROM (
                SELECT ${ieTable}.\`guid\` AS \`guid\`
                FROM ${MySQLDriver.escape(
                  `${this.prefix}entities_${etype}`,
                )} ${ieTable}
                WHERE ${guidClause}(${whereClause})${limit}${offset}
              ) ${countTable}`;
          } else {
            query = `SELECT COUNT(${ieTable}.\`guid\`) AS \`count\`
              FROM ${MySQLDriver.escape(
                `${this.prefix}entities_${etype}`,
              )} ${ieTable}
              WHERE ${guidClause}(${whereClause})`;
          }
        } else if (options.return === 'guid') {
          const guidColumn =
            tableSuffix === ''
              ? `LOWER(HEX(${ieTable}.\`guid\`))`
              : `${ieTable}.\`guid\``;
          query = `SELECT ${guidColumn} AS \`guid\`
            FROM ${MySQLDriver.escape(
              `${this.prefix}entities_${etype}`,
            )} ${ieTable}
            ${sortJoinInner}
            WHERE ${guidClause}(${whereClause})
            ORDER BY ${sortByInner}, ${ieTable}.\`guid\`${limit}${offset}`;
        } else {
          query = `SELECT
              LOWER(HEX(${eTable}.\`guid\`)) AS \`guid\`,
              ${eTable}.\`tags\`,
              ${eTable}.\`cdate\`,
              ${eTable}.\`mdate\`,
              ${dTable}.\`name\`,
              ${dTable}.\`value\`,
              ${dTable}.\`json\`,
              ${dTable}.\`string\`,
              ${dTable}.\`number\`
            FROM ${MySQLDriver.escape(
              `${this.prefix}entities_${etype}`,
            )} ${eTable}
            LEFT JOIN ${MySQLDriver.escape(
              `${this.prefix}data_${etype}`,
            )} ${dTable} ON ${eTable}.\`guid\`=${dTable}.\`guid\`
            ${sortJoin}
            INNER JOIN (
              SELECT ${ieTable}.\`guid\`
              FROM ${MySQLDriver.escape(
                `${this.prefix}entities_${etype}`,
              )} ${ieTable}
              ${sortJoinInner}
              WHERE ${guidClause}(${whereClause})
              ORDER BY ${sortByInner}${limit}${offset}
            ) ${fTable} ON ${eTable}.\`guid\`=${fTable}.\`guid\`
            ORDER BY ${sortBy}, ${eTable}.\`guid\``;
        }
      }
    } else {
      if (subquery) {
        query = '';
      } else {
        let limit = '';
        if ('limit' in options) {
          limit = ` LIMIT ${Math.floor(
            isNaN(Number(options.limit)) ? 0 : Number(options.limit),
          )}`;
        }
        let offset = '';
        if ('offset' in options) {
          offset = ` OFFSET ${Math.floor(
            isNaN(Number(options.offset)) ? 0 : Number(options.offset),
          )}`;
        }
        const guidClause = guidSelector
          ? ` WHERE ${ieTable}.\`guid\`=${guidSelector}`
          : '';
        if (options.return === 'count') {
          if (limit || offset) {
            query = `SELECT COUNT(${countTable}.\`guid\`) AS \`count\` FROM (
                SELECT ${ieTable}.\`guid\` AS \`guid\`
                FROM ${MySQLDriver.escape(
                  `${this.prefix}entities_${etype}`,
                )} ${ieTable}${guidClause}${limit}${offset}
              ) ${countTable}`;
          } else {
            query = `SELECT COUNT(${ieTable}.\`guid\`) AS \`count\`
              FROM ${MySQLDriver.escape(
                `${this.prefix}entities_${etype}`,
              )} ${ieTable}${guidClause}`;
          }
        } else if (options.return === 'guid') {
          const guidColumn =
            tableSuffix === ''
              ? `LOWER(HEX(${ieTable}.\`guid\`))`
              : `${ieTable}.\`guid\``;
          query = `SELECT ${guidColumn} AS \`guid\`
            FROM ${MySQLDriver.escape(
              `${this.prefix}entities_${etype}`,
            )} ${ieTable}
            ${sortJoinInner}
            ${guidClause}
            ORDER BY ${sortByInner}, ${ieTable}.\`guid\`${limit}${offset}`;
        } else {
          if (limit || offset) {
            query = `SELECT
                LOWER(HEX(${eTable}.\`guid\`)) AS \`guid\`,
                ${eTable}.\`tags\`,
                ${eTable}.\`cdate\`,
                ${eTable}.\`mdate\`,
                ${dTable}.\`name\`,
                ${dTable}.\`value\`,
                ${dTable}.\`json\`,
                ${dTable}.\`string\`,
                ${dTable}.\`number\`
              FROM ${MySQLDriver.escape(
                `${this.prefix}entities_${etype}`,
              )} ${eTable}
              LEFT JOIN ${MySQLDriver.escape(
                `${this.prefix}data_${etype}`,
              )} ${dTable} ON ${eTable}.\`guid\`=${dTable}.\`guid\`
              ${sortJoin}
              INNER JOIN (
                SELECT ${ieTable}.\`guid\`
                FROM ${MySQLDriver.escape(
                  `${this.prefix}entities_${etype}`,
                )} ${ieTable}
                ${sortJoinInner}
                ${guidClause}
                ORDER BY ${sortByInner}${limit}${offset}
              ) ${fTable} ON ${eTable}.\`guid\`=${fTable}.\`guid\`
              ORDER BY ${sortBy}, ${eTable}.\`guid\``;
          } else {
            query = `SELECT
                LOWER(HEX(${eTable}.\`guid\`)) AS \`guid\`,
                ${eTable}.\`tags\`,
                ${eTable}.\`cdate\`,
                ${eTable}.\`mdate\`,
                ${dTable}.\`name\`,
                ${dTable}.\`value\`,
                ${dTable}.\`json\`,
                ${dTable}.\`string\`,
                ${dTable}.\`number\`
              FROM ${MySQLDriver.escape(
                `${this.prefix}entities_${etype}`,
              )} ${eTable}
              LEFT JOIN ${MySQLDriver.escape(
                `${this.prefix}data_${etype}`,
              )} ${dTable} ON ${eTable}.\`guid\`=${dTable}.\`guid\`
              ${sortJoin}
              ${guidSelector ? `WHERE ${eTable}.\`guid\`=${guidSelector}` : ''}
              ORDER BY ${sortBy}, ${eTable}.\`guid\``;
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
    const result = this.queryIter(query, { etypes, params }).then((val) =>
      val[Symbol.iterator](),
    );
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
    options?: Options<T>,
    ...selectors: Selector[]
  ): Promise<EntityInstanceType<T>[]>;
  public async getEntities<T extends EntityConstructor = EntityConstructor>(
    options: Options<T> = {},
    ...selectors: Selector[]
  ): Promise<EntityInstanceType<T>[] | string[] | number> {
    const { result: resultPromise, process } = this.getEntitiesRowLike<T>(
      // @ts-ignore: options is correct here.
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
                .split(' ')
                .filter((tag: string) => tag)
            : [],
        cdate: isNaN(Number(row.cdate)) ? null : Number(row.cdate),
        mdate: isNaN(Number(row.mdate)) ? null : Number(row.mdate),
      }),
      (row) => ({
        name: row.name,
        svalue:
          row.value === 'N'
            ? JSON.stringify(row.number)
            : row.value === 'S'
            ? JSON.stringify(row.string)
            : row.value === 'J'
            ? JSON.stringify(row.json)
            : row.value,
      }),
    );

    const result = await resultPromise;
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
    const result = await this.queryGet(
      `SELECT \`cur_uid\` FROM ${MySQLDriver.escape(
        `${this.prefix}uids`,
      )} WHERE \`name\`=@name;`,
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
      let promises = [];
      promises.push(
        this.queryRun(
          `DELETE FROM ${MySQLDriver.escape(
            `${this.prefix}entities_${etype}`,
          )} WHERE \`guid\`=UNHEX(@guid);`,
          {
            etypes: [etype],
            params: {
              guid,
            },
          },
        ),
      );
      promises.push(
        this.queryRun(
          `DELETE FROM ${MySQLDriver.escape(
            `${this.prefix}data_${etype}`,
          )} WHERE \`guid\`=UNHEX(@guid);`,
          {
            etypes: [etype],
            params: {
              guid,
            },
          },
        ),
      );
      promises.push(
        this.queryRun(
          `DELETE FROM ${MySQLDriver.escape(
            `${this.prefix}references_${etype}`,
          )} WHERE \`guid\`=UNHEX(@guid);`,
          {
            etypes: [etype],
            params: {
              guid,
            },
          },
        ),
      );
      promises.push(
        this.queryRun(
          `DELETE FROM ${MySQLDriver.escape(
            `${this.prefix}uniques_${etype}`,
          )} WHERE \`guid\`=UNHEX(@guid);`,
          {
            etypes: [etype],
            params: {
              guid,
            },
          },
        ),
      );
      await Promise.all(promises);
      promises = [];
      await this.queryRun(
        `INSERT INTO ${MySQLDriver.escape(
          `${this.prefix}entities_${etype}`,
        )} (\`guid\`, \`tags\`, \`cdate\`, \`mdate\`) VALUES (UNHEX(@guid), @tags, @cdate, @mdate);`,
        {
          etypes: [etype],
          params: {
            guid,
            tags: ' ' + tags.join(' ') + ' ',
            cdate: isNaN(cdate) ? null : cdate,
            mdate: isNaN(mdate) ? null : mdate,
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
        promises.push(
          this.queryRun(
            `INSERT INTO ${MySQLDriver.escape(
              `${this.prefix}data_${etype}`,
            )} (\`guid\`, \`name\`, \`value\`, \`json\`, \`string\`, \`number\`, \`truthy\`) VALUES (UNHEX(@guid), @name, @storageValue, @jsonValue, @string, @number, @truthy);`,
            {
              etypes: [etype],
              params: {
                guid,
                name,
                storageValue,
                jsonValue,
                string: storageValue === 'J' ? null : `${uvalue}`,
                number: isNaN(Number(uvalue)) ? null : Number(uvalue),
                truthy: !!uvalue,
              },
            },
          ),
        );
        const references = this.findReferences(value);
        for (const reference of references) {
          promises.push(
            this.queryRun(
              `INSERT INTO ${MySQLDriver.escape(
                `${this.prefix}references_${etype}`,
              )} (\`guid\`, \`name\`, \`reference\`) VALUES (UNHEX(@guid), @name, UNHEX(@reference));`,
              {
                etypes: [etype],
                params: {
                  guid,
                  name,
                  reference,
                },
              },
            ),
          );
        }
      }
      const uniques = await this.nymph
        .getEntityClassByEtype(etype)
        .getUniques({ guid, cdate, mdate, tags, data: {}, sdata });
      for (const unique of uniques) {
        promises.push(
          this.queryRun(
            `INSERT INTO ${MySQLDriver.escape(
              `${this.prefix}uniques_${etype}`,
            )} (\`guid\`, \`unique\`) VALUES (UNHEX(@guid), @unique);`,
            {
              etypes: [etype],
              params: {
                guid,
                unique,
              },
            },
          ).catch((e: any) => {
            if (e instanceof EntityUniqueConstraintError) {
              this.nymph.config.debugError(
                'mysql',
                `Import entity unique constraint violation for GUID "${guid}" on etype "${etype}": "${unique}"`,
              );
            }
            return e;
          }),
        );
      }
      await Promise.all(promises);
    } catch (e: any) {
      this.nymph.config.debugError('mysql', `Import entity error: "${e}"`);
      throw e;
    }
  }

  public async importUID({ name, value }: { name: string; value: number }) {
    try {
      await this.internalTransaction(`nymph-import-uid-${name}`);
      await this.queryRun(
        `INSERT INTO ${MySQLDriver.escape(
          `${this.prefix}uids`,
        )} (\`name\`, \`cur_uid\`) VALUES (@name, @value) ON DUPLICATE KEY UPDATE \`cur_uid\`=@value;`,
        {
          params: {
            name,
            value,
          },
        },
      );
      await this.commit(`nymph-import-uid-${name}`);
    } catch (e: any) {
      this.nymph.config.debugError('mysql', `Import UID error: "${e}"`);
      await this.rollback(`nymph-import-uid-${name}`);
      throw e;
    }
  }

  public async newUID(name: string) {
    if (name == null) {
      throw new InvalidParametersError('Name not given for UID.');
    }
    await this.internalTransaction('nymph-newuid');
    let curUid: number | null = null;
    try {
      const lock = await this.queryGet(
        `SELECT GET_LOCK(${MySQLDriver.escapeValue(
          `${this.prefix}uids_${name}`,
        )}, 10) AS \`lock\`;`,
      );
      if (lock.lock !== 1) {
        throw new QueryFailedError("Couldn't get lock for UID: " + name);
      }
      await this.queryRun(
        `INSERT INTO ${MySQLDriver.escape(
          `${this.prefix}uids`,
        )} (\`name\`, \`cur_uid\`) VALUES (@name, 1) ON DUPLICATE KEY UPDATE \`cur_uid\`=\`cur_uid\`+1;`,
        {
          params: {
            name,
          },
        },
      );
      const result = await this.queryGet(
        `SELECT \`cur_uid\` FROM ${MySQLDriver.escape(
          `${this.prefix}uids`,
        )} WHERE \`name\`=@name;`,
        {
          params: {
            name,
          },
        },
      );
      await this.queryRun(
        `SELECT RELEASE_LOCK(${MySQLDriver.escapeValue(
          `${this.prefix}uids_${name}`,
        )});`,
      );
      curUid = result.cur_uid ?? null;
    } catch (e: any) {
      this.nymph.config.debugError('mysql', `New UID error: "${e}"`);
      if (e?.message !== "Couldn't get lock for UID: " + name) {
        await this.queryRun(
          `SELECT RELEASE_LOCK(${MySQLDriver.escapeValue(
            `${this.prefix}uids_${name}`,
          )});`,
        );
      }
      await this.rollback('nymph-newuid');
      throw e;
    }

    await this.commit('nymph-newuid');
    return curUid;
  }

  public async renameUID(oldName: string, newName: string) {
    if (oldName == null || newName == null) {
      throw new InvalidParametersError('Name not given for UID.');
    }
    await this.queryRun(
      `UPDATE ${MySQLDriver.escape(
        `${this.prefix}uids`,
      )} SET \`name\`=@newName WHERE \`name\`=@oldName;`,
      {
        params: {
          newName,
          oldName,
        },
      },
    );
    return true;
  }

  public async rollback(name: string) {
    if (name == null || typeof name !== 'string' || name.length === 0) {
      throw new InvalidParametersError(
        'Transaction rollback attempted without a name.',
      );
    }
    if (!this.transaction || this.transaction.count === 0) {
      this.transaction = null;
      return true;
    }
    if (this.config.transactions) {
      await this.queryRun(`ROLLBACK TO SAVEPOINT ${MySQLDriver.escape(name)};`);
    }
    this.transaction.count--;
    if (this.transaction.count === 0) {
      await this.queryRun('ROLLBACK;');
      this.transaction.connection?.release();
      this.transaction.connection = null;
      this.transaction = null;
    }
    return true;
  }

  public async saveEntity(entity: EntityInterface) {
    const insertData = async (
      guid: string,
      data: EntityData,
      sdata: SerializedEntityData,
      uniques: string[],
      etype: string,
    ) => {
      const runInsertQuery = async (
        name: string,
        value: any,
        svalue: string,
      ) => {
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
        const promises = [];
        promises.push(
          this.queryRun(
            `INSERT INTO ${MySQLDriver.escape(
              `${this.prefix}data_${etype}`,
            )} (\`guid\`, \`name\`, \`value\`, \`json\`, \`string\`, \`number\`, \`truthy\`) VALUES (UNHEX(@guid), @name, @storageValue, @jsonValue, @string, @number, @truthy);`,
            {
              etypes: [etype],
              params: {
                guid,
                name,
                storageValue,
                jsonValue,
                string: storageValue === 'J' ? null : `${value}`,
                number: isNaN(Number(value)) ? null : Number(value),
                truthy: !!value,
              },
            },
          ),
        );
        const references = this.findReferences(svalue);
        for (const reference of references) {
          promises.push(
            this.queryRun(
              `INSERT INTO ${MySQLDriver.escape(
                `${this.prefix}references_${etype}`,
              )} (\`guid\`, \`name\`, \`reference\`) VALUES (UNHEX(@guid), @name, UNHEX(@reference));`,
              {
                etypes: [etype],
                params: {
                  guid,
                  name,
                  reference,
                },
              },
            ),
          );
        }
        await Promise.all(promises);
      };
      for (const unique of uniques) {
        try {
          await this.queryRun(
            `INSERT INTO ${MySQLDriver.escape(
              `${this.prefix}uniques_${etype}`,
            )} (\`guid\`, \`unique\`) VALUES (UNHEX(@guid), @unique);`,
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
              'mysql',
              `Save entity unique constraint violation for GUID "${guid}" on etype "${etype}": "${unique}"`,
            );
          }
          throw e;
        }
      }
      for (const name in data) {
        await runInsertQuery(name, data[name], JSON.stringify(data[name]));
      }
      for (const name in sdata) {
        await runInsertQuery(name, JSON.parse(sdata[name]), sdata[name]);
      }
    };
    let inTransaction = false;
    try {
      const result = await this.saveEntityRowLike(
        entity,
        async ({ guid, tags, data, sdata, uniques, cdate, etype }) => {
          if (
            Object.keys(data).length === 0 &&
            Object.keys(sdata).length === 0
          ) {
            return false;
          }
          await this.queryRun(
            `INSERT INTO ${MySQLDriver.escape(
              `${this.prefix}entities_${etype}`,
            )} (\`guid\`, \`tags\`, \`cdate\`, \`mdate\`) VALUES (UNHEX(@guid), @tags, @cdate, @cdate);`,
            {
              etypes: [etype],
              params: {
                guid,
                tags: ' ' + tags.join(' ') + ' ',
                cdate,
              },
            },
          );
          await insertData(guid, data, sdata, uniques, etype);
          return true;
        },
        async ({ entity, guid, tags, data, sdata, uniques, mdate, etype }) => {
          if (
            Object.keys(data).length === 0 &&
            Object.keys(sdata).length === 0
          ) {
            return false;
          }
          if (this.config.rowLocking) {
            const promises = [];
            promises.push(
              this.queryRun(
                `SELECT 1 FROM ${MySQLDriver.escape(
                  `${this.prefix}entities_${etype}`,
                )} WHERE \`guid\`=UNHEX(@guid) GROUP BY 1 FOR UPDATE;`,
                {
                  etypes: [etype],
                  params: {
                    guid,
                  },
                },
              ),
            );
            promises.push(
              this.queryRun(
                `SELECT 1 FROM ${MySQLDriver.escape(
                  `${this.prefix}data_${etype}`,
                )} WHERE \`guid\`=UNHEX(@guid) GROUP BY 1 FOR UPDATE;`,
                {
                  etypes: [etype],
                  params: {
                    guid,
                  },
                },
              ),
            );
            promises.push(
              this.queryRun(
                `SELECT 1 FROM ${MySQLDriver.escape(
                  `${this.prefix}references_${etype}`,
                )} WHERE \`guid\`=UNHEX(@guid) GROUP BY 1 FOR UPDATE;`,
                {
                  etypes: [etype],
                  params: {
                    guid,
                  },
                },
              ),
            );
            promises.push(
              this.queryRun(
                `SELECT 1 FROM ${MySQLDriver.escape(
                  `${this.prefix}uniques_${etype}`,
                )} WHERE \`guid\`=UNHEX(@guid) GROUP BY 1 FOR UPDATE;`,
                {
                  etypes: [etype],
                  params: {
                    guid,
                  },
                },
              ),
            );
            await Promise.all(promises);
          }
          if (this.config.tableLocking) {
            await this.queryRun(
              `LOCK TABLES ${MySQLDriver.escape(
                `${this.prefix}entities_${etype}`,
              )} WRITE, ${MySQLDriver.escape(
                `${this.prefix}data_${etype}`,
              )} WRITE, ${MySQLDriver.escape(
                `${this.prefix}references_${etype}`,
              )} WRITE, ${MySQLDriver.escape(
                `${this.prefix}uniques_${etype}`,
              )} WRITE;`,
            );
          }
          const info = await this.queryRun(
            `UPDATE ${MySQLDriver.escape(
              `${this.prefix}entities_${etype}`,
            )} SET \`tags\`=@tags, \`mdate\`=@mdate WHERE \`guid\`=UNHEX(@guid) AND \`mdate\` <= @emdate;`,
            {
              etypes: [etype],
              params: {
                tags: ' ' + tags.join(' ') + ' ',
                mdate,
                guid,
                emdate: isNaN(Number(entity.mdate)) ? 0 : Number(entity.mdate),
              },
            },
          );
          let success = false;
          if (info.changes === 1) {
            const promises = [];
            promises.push(
              this.queryRun(
                `DELETE FROM ${MySQLDriver.escape(
                  `${this.prefix}data_${etype}`,
                )} WHERE \`guid\`=UNHEX(@guid);`,
                {
                  etypes: [etype],
                  params: {
                    guid,
                  },
                },
              ),
            );
            promises.push(
              this.queryRun(
                `DELETE FROM ${MySQLDriver.escape(
                  `${this.prefix}references_${etype}`,
                )} WHERE \`guid\`=UNHEX(@guid);`,
                {
                  etypes: [etype],
                  params: {
                    guid,
                  },
                },
              ),
            );
            promises.push(
              this.queryRun(
                `DELETE FROM ${MySQLDriver.escape(
                  `${this.prefix}uniques_${etype}`,
                )} WHERE \`guid\`=UNHEX(@guid);`,
                {
                  etypes: [etype],
                  params: {
                    guid,
                  },
                },
              ),
            );
            await Promise.all(promises);
            await insertData(guid, data, sdata, uniques, etype);
            success = true;
          }
          if (this.config.tableLocking) {
            await this.queryRun('UNLOCK TABLES;');
          }
          return success;
        },
        async () => {
          await this.internalTransaction('nymph-save');
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

      return result;
    } catch (e: any) {
      this.nymph.config.debugError('mysql', `Save entity error: "${e}"`);
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
    await this.queryRun(
      `INSERT INTO ${MySQLDriver.escape(
        `${this.prefix}uids`,
      )} (\`name\`, \`cur_uid\`) VALUES (@name, @curUid) ON DUPLICATE KEY UPDATE \`cur_uid\`=@curUid;`,
      {
        params: {
          name,
          curUid,
        },
      },
    );
    return true;
  }

  protected async internalTransaction(name: string) {
    if (name == null || typeof name !== 'string' || name.length === 0) {
      throw new InvalidParametersError(
        'Transaction start attempted without a name.',
      );
    }

    if (!this.transaction || this.transaction.count === 0) {
      // Lock to one connection.
      this.transaction = {
        count: 0,
        connection: await this.getConnection(),
      };
      if (this.config.transactions) {
        // We're not in a transaction yet, so start one.
        await this.queryRun('START TRANSACTION;');
      }
    }

    if (this.config.transactions) {
      await this.queryRun(`SAVEPOINT ${MySQLDriver.escape(name)};`);
    }

    this.transaction.count++;

    return this.transaction;
  }

  public async startTransaction(name: string) {
    const inTransaction = await this.inTransaction();
    const transaction = await this.internalTransaction(name);
    if (!inTransaction) {
      this.transaction = null;
    }

    const nymph = this.nymph.clone();
    (nymph.driver as MySQLDriver).transaction = transaction;

    return nymph;
  }

  public async needsMigration(): Promise<boolean> {
    const table = await this.queryGet(
      'SELECT `table_name` AS `table_name` FROM `information_schema`.`tables` WHERE `table_schema`=@db AND `table_name` LIKE @prefix LIMIT 1;',
      {
        params: {
          db: this.config.database,
          prefix: this.prefix + 'data_' + '%',
        },
      },
    );
    if (table?.table_name) {
      const result = await this.queryGet(
        "SELECT 1 AS `exists` FROM `information_schema`.`columns` WHERE `table_schema`=@db AND `table_name`=@table AND `column_name`='json';",
        {
          params: {
            db: this.config.database,
            table: table.table_name,
          },
        },
      );
      return !result?.exists;
    }
    return false;
  }
}
