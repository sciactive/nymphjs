import { Pool, PoolClient, PoolConfig, QueryResult } from 'pg';
import format from 'pg-format';
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
  PostgreSQLDriverConfig,
  PostgreSQLDriverConfigDefaults as defaults,
} from './conf';

type PostgreSQLDriverConnection = {
  client: PoolClient;
  done: () => void;
};

type PostgreSQLDriverTransaction = {
  connection: PostgreSQLDriverConnection | null;
  count: number;
};

/**
 * The PostgreSQL Nymph database driver.
 */
export default class PostgreSQLDriver extends NymphDriver {
  public config: PostgreSQLDriverConfig;
  private postgresqlConfig: PoolConfig;
  protected prefix: string;
  protected connected: boolean = false;
  // @ts-ignore: this is assigned in connect(), which is called by the constructor.
  protected link: Pool;
  protected transaction: PostgreSQLDriverTransaction | null = null;

  static escape(input: string) {
    return format.ident(input);
  }

  static escapeValue(input: string) {
    return format.literal(input);
  }

  constructor(
    config: Partial<PostgreSQLDriverConfig>,
    link?: Pool,
    transaction?: PostgreSQLDriverTransaction,
  ) {
    super();
    this.config = { ...defaults, ...config };
    const { host, user, password, database, port, customPoolConfig } =
      this.config;
    this.postgresqlConfig = customPoolConfig ?? {
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
    return new PostgreSQLDriver(
      this.config,
      this.link,
      this.transaction ?? undefined,
    );
  }

  private getConnection(
    outsideTransaction = false,
  ): Promise<PostgreSQLDriverConnection> {
    if (
      this.transaction != null &&
      this.transaction.connection != null &&
      !outsideTransaction
    ) {
      return Promise.resolve(this.transaction.connection);
    }
    return new Promise((resolve, reject) =>
      this.link.connect((err, client, done) =>
        err
          ? reject(err)
          : client
          ? resolve({ client, done })
          : reject('No client returned from connect.'),
      ),
    );
  }

  /**
   * Connect to the PostgreSQL database.
   *
   * @returns Whether this instance is connected to a PostgreSQL database.
   */
  public async connect() {
    // If we think we're connected, try pinging the server.
    try {
      if (this.connected) {
        const connection: PostgreSQLDriverConnection = await new Promise(
          (resolve, reject) =>
            this.link.connect((err, client, done) =>
              err
                ? reject(err)
                : client
                ? resolve({ client, done })
                : reject('No client returned from connect.'),
            ),
        );
        await new Promise((resolve, reject) =>
          connection.client.query('SELECT 1;', [], (err, res) => {
            if (err) {
              reject(err);
            }
            resolve(0);
          }),
        );
        connection.done();
      }
    } catch (e: any) {
      this.connected = false;
    }

    // Connecting, selecting database
    if (!this.connected) {
      try {
        this.link = new Pool(this.postgresqlConfig);
        this.connected = true;
      } catch (e: any) {
        if (
          this.postgresqlConfig.host === 'localhost' &&
          this.postgresqlConfig.user === 'nymph' &&
          this.postgresqlConfig.password === 'password' &&
          this.postgresqlConfig.database === 'nymph'
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
   * Disconnect from the PostgreSQL database.
   *
   * @returns Whether this instance is connected to a PostgreSQL database.
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
   * @returns Whether this instance is connected to a PostgreSQL database.
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
    const connection = await this.getConnection(true);
    if (etype != null) {
      // Create the entity table.
      await this.queryRun(
        `CREATE TABLE IF NOT EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}entities_${etype}`,
        )} (
          "guid" BYTEA NOT NULL,
          "tags" TEXT[],
          "cdate" DOUBLE PRECISION NOT NULL,
          "mdate" DOUBLE PRECISION NOT NULL,
          PRIMARY KEY ("guid")
        ) WITH ( OIDS=FALSE );`,
        { connection },
      );
      await this.queryRun(
        `ALTER TABLE ${PostgreSQLDriver.escape(
          `${this.prefix}entities_${etype}`,
        )} OWNER TO ${PostgreSQLDriver.escape(this.config.user)};`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}entities_${etype}_id_cdate`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}entities_${etype}_id_cdate`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}entities_${etype}`,
        )} USING btree ("cdate");`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}entities_${etype}_id_mdate`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}entities_${etype}_id_mdate`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}entities_${etype}`,
        )} USING btree ("mdate");`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}entities_${etype}_id_tags`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}entities_${etype}_id_tags`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}entities_${etype}`,
        )} USING gin ("tags");`,
        { connection },
      );
      // Create the data table.
      await this.queryRun(
        `CREATE TABLE IF NOT EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}`,
        )} (
          "guid" BYTEA NOT NULL,
          "name" TEXT NOT NULL,
          "value" TEXT NOT NULL,
          PRIMARY KEY ("guid", "name"),
          FOREIGN KEY ("guid")
            REFERENCES ${PostgreSQLDriver.escape(
              `${this.prefix}entities_${etype}`,
            )} ("guid") MATCH SIMPLE ON UPDATE NO ACTION ON DELETE CASCADE
        ) WITH ( OIDS=FALSE );`,
        { connection },
      );
      await this.queryRun(
        `ALTER TABLE ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}`,
        )} OWNER TO ${PostgreSQLDriver.escape(this.config.user)};`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}_id_guid`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}_id_guid`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}`,
        )} USING btree ("guid");`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}_id_name`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}_id_name`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}`,
        )} USING btree ("name");`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}_id_guid_name__user`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}_id_guid_name__user`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}`,
        )} USING btree ("guid") WHERE "name" = 'user'::text;`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}_id_guid_name__group`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}_id_guid_name__group`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}`,
        )} USING btree ("guid") WHERE "name" = 'group'::text;`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}_id_name_value`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}_id_name_value`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}`,
        )} USING btree ("name", "value");`,
        { connection },
      );
      // Create the data comparisons table.
      await this.queryRun(
        `CREATE TABLE IF NOT EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}`,
        )} (
          "guid" BYTEA NOT NULL,
          "name" TEXT NOT NULL,
          "truthy" BOOLEAN,
          "string" TEXT,
          "number" DOUBLE PRECISION,
          PRIMARY KEY ("guid", "name"),
          FOREIGN KEY ("guid")
            REFERENCES ${PostgreSQLDriver.escape(
              `${this.prefix}entities_${etype}`,
            )} ("guid") MATCH SIMPLE ON UPDATE NO ACTION ON DELETE CASCADE
        ) WITH ( OIDS=FALSE );`,
        { connection },
      );
      await this.queryRun(
        `ALTER TABLE ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}`,
        )} OWNER TO ${PostgreSQLDriver.escape(this.config.user)};`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}_id_guid`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}_id_guid`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}`,
        )} USING btree ("guid");`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}_id_name`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}_id_name`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}`,
        )} USING btree ("name");`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}_id_name_truthy`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}_id_name_truthy`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}`,
        )} USING btree ("name") WHERE "truthy" = TRUE;`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}_id_name_falsy`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}_id_name_falsy`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}`,
        )} USING btree ("name") WHERE "truthy" <> TRUE;`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}_id_name_string`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}_id_name_string`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}`,
        )} USING btree ("name", "string");`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}_id_name_number`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}_id_name_number`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}`,
        )} USING btree ("name", "number");`,
        { connection },
      );
      // Create the references table.
      await this.queryRun(
        `CREATE TABLE IF NOT EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}references_${etype}`,
        )} (
          "guid" BYTEA NOT NULL,
          "name" TEXT NOT NULL,
          "reference" BYTEA NOT NULL,
          PRIMARY KEY ("guid", "name", "reference"),
          FOREIGN KEY ("guid")
            REFERENCES ${PostgreSQLDriver.escape(
              `${this.prefix}entities_${etype}`,
            )} ("guid") MATCH SIMPLE ON UPDATE NO ACTION ON DELETE CASCADE
        ) WITH ( OIDS=FALSE );`,
        { connection },
      );
      await this.queryRun(
        `ALTER TABLE ${PostgreSQLDriver.escape(
          `${this.prefix}references_${etype}`,
        )} OWNER TO ${PostgreSQLDriver.escape(this.config.user)};`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}references_${etype}_id_guid`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}references_${etype}_id_guid`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}references_${etype}`,
        )} USING btree ("guid");`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}references_${etype}_id_name`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}references_${etype}_id_name`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}references_${etype}`,
        )} USING btree ("name");`,
        { connection },
      );
      await this.queryRun(
        `DROP INDEX IF EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}references_${etype}_id_name_reference`,
        )};`,
        { connection },
      );
      await this.queryRun(
        `CREATE INDEX ${PostgreSQLDriver.escape(
          `${this.prefix}references_${etype}_id_name_reference`,
        )} ON ${PostgreSQLDriver.escape(
          `${this.prefix}references_${etype}`,
        )} USING btree ("name", "reference");`,
        { connection },
      );
      // Create the unique strings table.
      await this.queryRun(
        `CREATE TABLE IF NOT EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}uniques_${etype}`,
        )} (
          "guid" BYTEA NOT NULL,
          "unique" TEXT NOT NULL UNIQUE,
          PRIMARY KEY ("guid", "unique"),
          FOREIGN KEY ("guid")
            REFERENCES ${PostgreSQLDriver.escape(
              `${this.prefix}entities_${etype}`,
            )} ("guid") MATCH SIMPLE ON UPDATE NO ACTION ON DELETE CASCADE
        ) WITH ( OIDS=FALSE );`,
        { connection },
      );
    } else {
      // Create the UID table.
      await this.queryRun(
        `CREATE TABLE IF NOT EXISTS ${PostgreSQLDriver.escape(
          `${this.prefix}uids`,
        )} (
          "name" TEXT NOT NULL,
          "cur_uid" BIGINT NOT NULL,
          PRIMARY KEY ("name")
        ) WITH ( OIDS = FALSE );`,
        { connection },
      );
      await this.queryRun(
        `ALTER TABLE ${PostgreSQLDriver.escape(
          `${this.prefix}uids`,
        )} OWNER TO ${PostgreSQLDriver.escape(this.config.user)};`,
        { connection },
      );
    }
    connection.done();
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
    let i = 1;
    while ((match = query.match(paramRegex))) {
      const param = match[0].substr(1);
      params.push(origParams[param]);
      query = query.replace(paramRegex, () => '$' + i++);
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
      return await runQuery();
    } catch (e: any) {
      const errorCode = e?.code;
      if (errorCode === '42P01' && (await this.createTables())) {
        // If the tables don't exist yet, create them.
        for (let etype of etypes) {
          await this.createTables(etype);
        }
        try {
          return await runQuery();
        } catch (e2: any) {
          throw new QueryFailedError(
            'Query failed: ' + e2?.code + ' - ' + e2?.message,
            query,
          );
        }
      } else if (errorCode === '23505') {
        throw new EntityUniqueConstraintError(`Unique constraint violation.`);
      } else {
        throw new QueryFailedError(
          'Query failed: ' + e?.code + ' - ' + e?.message,
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
        const results: QueryResult<any> = await new Promise(
          (resolve, reject) => {
            try {
              (this.transaction?.connection?.client ?? this.link)
                .query(newQuery, newParams)
                .then(
                  (results) => resolve(results),
                  (error) => reject(error),
                );
            } catch (e) {
              reject(e);
            }
          },
        );
        return results.rows;
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
        const results: QueryResult<any> = await new Promise(
          (resolve, reject) => {
            try {
              (this.transaction?.connection?.client ?? this.link)
                .query(newQuery, newParams)
                .then(
                  (results) => resolve(results),
                  (error) => reject(error),
                );
            } catch (e) {
              reject(e);
            }
          },
        );
        return results.rows[0];
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
      connection,
    }: {
      etypes?: string[];
      params?: { [k: string]: any };
      connection?: PostgreSQLDriverConnection;
    } = {},
  ) {
    const { query: newQuery, params: newParams } = this.translateQuery(
      query,
      params,
    );
    return this.query(
      async () => {
        const results: QueryResult<any> = await new Promise(
          (resolve, reject) => {
            try {
              (
                (connection ?? this.transaction?.connection)?.client ??
                this.link
              )
                .query(newQuery, newParams)
                .then(
                  (results) => resolve(results),
                  (error) => reject(error),
                );
            } catch (e) {
              reject(e);
            }
          },
        );
        return { rowCount: results.rowCount ?? 0 };
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
    await this.queryRun(`RELEASE SAVEPOINT ${PostgreSQLDriver.escape(name)};`);
    this.transaction.count--;
    if (this.transaction.count === 0) {
      await this.queryRun('COMMIT;');
      this.transaction.connection?.done();
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
        `DELETE FROM ${PostgreSQLDriver.escape(
          `${this.prefix}entities_${etype}`,
        )} WHERE "guid"=decode(@guid, 'hex');`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
      await this.queryRun(
        `DELETE FROM ${PostgreSQLDriver.escape(
          `${this.prefix}data_${etype}`,
        )} WHERE "guid"=decode(@guid, 'hex');`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
      await this.queryRun(
        `DELETE FROM ${PostgreSQLDriver.escape(
          `${this.prefix}comparisons_${etype}`,
        )} WHERE "guid"=decode(@guid, 'hex');`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
      await this.queryRun(
        `DELETE FROM ${PostgreSQLDriver.escape(
          `${this.prefix}references_${etype}`,
        )} WHERE "guid"=decode(@guid, 'hex');`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
      await this.queryRun(
        `DELETE FROM ${PostgreSQLDriver.escape(
          `${this.prefix}uniques_${etype}`,
        )} WHERE "guid"=decode(@guid, 'hex');`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
    } catch (e: any) {
      this.nymph.config.debugError('postgresql', `Delete entity error: "${e}"`);
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
      `DELETE FROM ${PostgreSQLDriver.escape(
        `${this.prefix}uids`,
      )} WHERE "name"=@name;`,
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
      `SELECT * FROM ${PostgreSQLDriver.escape(
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
    const tables = await this.queryIter(
      'SELECT relname FROM pg_stat_user_tables ORDER BY relname;',
    );
    const etypes = [];
    for (const tableRow of tables) {
      const table = tableRow.relname;
      if (table.startsWith(this.prefix + 'entities_')) {
        etypes.push(table.substr((this.prefix + 'entities_').length));
      }
    }

    for (const etype of etypes) {
      // Export entities.
      const dataIterator = (
        await this.queryIter(
          `SELECT encode(e."guid", 'hex') AS "guid", e."tags", e."cdate", e."mdate", d."name" AS "dname", d."value" AS "dvalue", c."string", c."number"
          FROM ${PostgreSQLDriver.escape(`${this.prefix}entities_${etype}`)} e
          LEFT JOIN ${PostgreSQLDriver.escape(
            `${this.prefix}data_${etype}`,
          )} d ON e."guid"=d."guid"
          INNER JOIN ${PostgreSQLDriver.escape(
            `${this.prefix}comparisons_${etype}`,
          )} c ON d."guid"=c."guid" AND d."name"=c."name"
          ORDER BY e."guid";`,
        )
      )[Symbol.iterator]();
      let datum = dataIterator.next();
      while (!datum.done) {
        const guid = datum.value.guid;
        const tags = datum.value.tags.join(',');
        const cdate = datum.value.cdate;
        const mdate = datum.value.mdate;
        let currentEntityExport: string[] = [];
        currentEntityExport.push(`{${guid}}<${etype}>[${tags}]`);
        currentEntityExport.push(`\tcdate=${JSON.stringify(cdate)}`);
        currentEntityExport.push(`\tmdate=${JSON.stringify(mdate)}`);
        if (datum.value.dname != null) {
          // This do will keep going and adding the data until the
          // next entity is reached. $row will end on the next entity.
          do {
            const value =
              datum.value.dvalue === 'N'
                ? JSON.stringify(Number(datum.value.number))
                : datum.value.dvalue === 'S'
                ? JSON.stringify(datum.value.string)
                : datum.value.dvalue;
            currentEntityExport.push(`\t${datum.value.dname}=${value}`);
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
   * Generate the PostgreSQL query.
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
  ) {
    if (typeof options.class?.alterOptions === 'function') {
      options = options.class.alterOptions(options);
    }
    const eTable = `e${tableSuffix}`;
    const dTable = `d${tableSuffix}`;
    const cTable = `c${tableSuffix}`;
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
                  '."guid"=decode(@' +
                  guid +
                  ", 'hex')";
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
                  '@' +
                  tag +
                  ' <@ ie."tags"';
                params[tag] = [curTag];
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
                  PostgreSQLDriver.escape(this.prefix + 'data_' + etype) +
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
                    ieTable +
                    '."guid" IN (SELECT "guid" FROM ' +
                    PostgreSQLDriver.escape(
                      this.prefix + 'comparisons_' + etype,
                    ) +
                    ' WHERE "name"=@' +
                    name +
                    ' AND "truthy"=TRUE)';
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
                  '."mdate"=@' +
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
                  ieTable +
                  '."guid" IN (SELECT "guid" FROM ' +
                  PostgreSQLDriver.escape(
                    this.prefix + 'comparisons_' + etype,
                  ) +
                  ' WHERE "name"=@' +
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
                  ieTable +
                  '."guid" IN (SELECT "guid" FROM ' +
                  PostgreSQLDriver.escape(
                    this.prefix + 'comparisons_' + etype,
                  ) +
                  ' WHERE "name"=@' +
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
                  ieTable +
                  '."guid" IN (SELECT "guid" FROM ' +
                  PostgreSQLDriver.escape(this.prefix + 'data_' + etype) +
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
                  ieTable +
                  '."cdate"=' +
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
                  '."mdate"=' +
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
                let stringValue: string;
                if (
                  curValue[1] instanceof Object &&
                  typeof curValue[1].toReference === 'function'
                ) {
                  svalue = JSON.stringify(curValue[1].toReference());
                  stringValue = `${curValue[1].toReference()}`;
                } else {
                  svalue = JSON.stringify(curValue[1]);
                  stringValue = `${curValue[1]}`;
                }
                const name = `param${++count.i}`;
                const value = `param${++count.i}`;
                if (typeof curValue[1] === 'string') {
                  const stringParam = `param${++count.i}`;
                  curQuery +=
                    (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                    '(' +
                    ieTable +
                    '."guid" IN (SELECT "guid" FROM ' +
                    PostgreSQLDriver.escape(this.prefix + 'data_' + etype) +
                    ' WHERE "name"=@' +
                    name +
                    ' AND position(@' +
                    value +
                    ' IN "value")>0) OR ' +
                    ieTable +
                    '."guid" IN (SELECT "guid" FROM ' +
                    PostgreSQLDriver.escape(
                      this.prefix + 'comparisons_' + etype,
                    ) +
                    ' WHERE "name"=@' +
                    name +
                    ' AND "string"=@' +
                    stringParam +
                    '))';
                  params[stringParam] = stringValue;
                } else {
                  curQuery +=
                    (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                    ieTable +
                    '."guid" IN (SELECT "guid" FROM ' +
                    PostgreSQLDriver.escape(this.prefix + 'data_' + etype) +
                    ' WHERE "name"=@' +
                    name +
                    ' AND position(@' +
                    value +
                    ' IN "value")>0)';
                }
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
                  '."cdate" ~ @' +
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
                  '."mdate" ~ @' +
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
                  ieTable +
                  '."guid" IN (SELECT "guid" FROM ' +
                  PostgreSQLDriver.escape(
                    this.prefix + 'comparisons_' + etype,
                  ) +
                  ' WHERE "name"=@' +
                  name +
                  ' AND "string" ~ @' +
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
                  '."cdate" ~* @' +
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
                  '."mdate" ~* @' +
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
                  ieTable +
                  '."guid" IN (SELECT "guid" FROM ' +
                  PostgreSQLDriver.escape(
                    this.prefix + 'comparisons_' + etype,
                  ) +
                  ' WHERE "name"=@' +
                  name +
                  ' AND "string" ~* @' +
                  value +
                  ')';
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
                  '."mdate" LIKE @' +
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
                  ieTable +
                  '."guid" IN (SELECT "guid" FROM ' +
                  PostgreSQLDriver.escape(
                    this.prefix + 'comparisons_' + etype,
                  ) +
                  ' WHERE "name"=@' +
                  name +
                  ' AND "string" LIKE @' +
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
                  '."cdate" ILIKE @' +
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
                  '."mdate" ILIKE @' +
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
                  ieTable +
                  '."guid" IN (SELECT "guid" FROM ' +
                  PostgreSQLDriver.escape(
                    this.prefix + 'comparisons_' + etype,
                  ) +
                  ' WHERE "name"=@' +
                  name +
                  ' AND "string" ILIKE @' +
                  value +
                  ')';
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
                  '."mdate">@' +
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
                  ieTable +
                  '."guid" IN (SELECT "guid" FROM ' +
                  PostgreSQLDriver.escape(
                    this.prefix + 'comparisons_' + etype,
                  ) +
                  ' WHERE "name"=@' +
                  name +
                  ' AND "number">@' +
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
                  '."cdate">=@' +
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
                  '."mdate">=@' +
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
                  ieTable +
                  '."guid" IN (SELECT "guid" FROM ' +
                  PostgreSQLDriver.escape(
                    this.prefix + 'comparisons_' + etype,
                  ) +
                  ' WHERE "name"=@' +
                  name +
                  ' AND "number">=@' +
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
                  '."cdate"<@' +
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
                  '."mdate"<@' +
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
                  ieTable +
                  '."guid" IN (SELECT "guid" FROM ' +
                  PostgreSQLDriver.escape(
                    this.prefix + 'comparisons_' + etype,
                  ) +
                  ' WHERE "name"=@' +
                  name +
                  ' AND "number"<@' +
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
                  '."cdate"<=@' +
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
                  '."mdate"<=@' +
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
                  ieTable +
                  '."guid" IN (SELECT "guid" FROM ' +
                  PostgreSQLDriver.escape(
                    this.prefix + 'comparisons_' + etype,
                  ) +
                  ' WHERE "name"=@' +
                  name +
                  ' AND "number"<=@' +
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
                ieTable +
                '."guid" IN (SELECT "guid" FROM ' +
                PostgreSQLDriver.escape(this.prefix + 'references_' + etype) +
                ' WHERE "name"=@' +
                name +
                ' AND "reference"=decode(@' +
                guid +
                ", 'hex'))";
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
              );
              if (curQuery) {
                curQuery += typeIsOr ? ' OR ' : ' AND ';
              }
              const qrefName = `param${++count.i}`;
              curQuery +=
                (xor(typeIsNot, clauseNot) ? 'NOT ' : '') +
                ieTable +
                '."guid" IN (SELECT "guid" FROM ' +
                PostgreSQLDriver.escape(this.prefix + 'references_' + etype) +
                ' WHERE "name"=@' +
                qrefName +
                ' AND "reference" IN (' +
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
            FROM ${PostgreSQLDriver.escape(
              this.prefix + 'comparisons_' + etype,
            )}
            WHERE "name"=@${name}
            ORDER BY "number"${order}, "string"${order}
          ) ${sTable} ON ${eTable}."guid"=${sTable}."guid"`;
        sortJoinInner = `LEFT JOIN (
            SELECT "guid", "string", "number"
            FROM ${PostgreSQLDriver.escape(
              this.prefix + 'comparisons_' + etype,
            )}
            WHERE "name"=@${name}
            ORDER BY "number"${order}, "string"${order}
          ) ${sTable} ON ${ieTable}."guid"=${sTable}."guid"`;
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
        if (options.return === 'count') {
          if (limit || offset) {
            query = `SELECT COUNT(${countTable}."guid") AS "count" FROM (
                SELECT COUNT(${ieTable}."guid") AS "guid"
                FROM ${PostgreSQLDriver.escape(
                  `${this.prefix}entities_${etype}`,
                )} ${ieTable}
                WHERE (${whereClause})${limit}${offset}
              ) ${countTable}`;
          } else {
            query = `SELECT COUNT(${ieTable}."guid") AS "count"
              FROM ${PostgreSQLDriver.escape(
                `${this.prefix}entities_${etype}`,
              )} ${ieTable}
              WHERE (${whereClause})`;
          }
        } else if (options.return === 'guid') {
          const guidColumn =
            tableSuffix === ''
              ? `encode(${ieTable}."guid", 'hex')`
              : `${ieTable}."guid"`;
          query = `SELECT ${guidColumn} AS "guid"
            FROM ${PostgreSQLDriver.escape(
              `${this.prefix}entities_${etype}`,
            )} ${ieTable}
            ${sortJoinInner}
            WHERE (${whereClause})
            ORDER BY ${sortByInner}, ${ieTable}."guid"${limit}${offset}`;
        } else {
          query = `SELECT
              encode(${eTable}."guid", 'hex') AS "guid",
              ${eTable}."tags",
              ${eTable}."cdate",
              ${eTable}."mdate",
              ${dTable}."name",
              ${dTable}."value",
              ${cTable}."string",
              ${cTable}."number"
            FROM ${PostgreSQLDriver.escape(
              `${this.prefix}entities_${etype}`,
            )} ${eTable}
            LEFT JOIN ${PostgreSQLDriver.escape(
              `${this.prefix}data_${etype}`,
            )} ${dTable} ON ${eTable}."guid"=${dTable}."guid"
            INNER JOIN ${PostgreSQLDriver.escape(
              `${this.prefix}comparisons_${etype}`,
            )} ${cTable} ON ${dTable}."guid"=${cTable}."guid" AND ${dTable}."name"=${cTable}."name"
            ${sortJoin}
            INNER JOIN (
              SELECT ${ieTable}."guid"
              FROM ${PostgreSQLDriver.escape(
                `${this.prefix}entities_${etype}`,
              )} ${ieTable}
              ${sortJoinInner}
              WHERE (${whereClause})
              ORDER BY ${sortByInner}${limit}${offset}
            ) ${fTable} ON ${eTable}."guid"=${fTable}."guid"
            ORDER BY ${sortBy}, ${eTable}."guid"`;
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
        if (options.return === 'count') {
          if (limit || offset) {
            query = `SELECT COUNT(${countTable}."guid") AS "count" FROM (
                SELECT COUNT(${ieTable}."guid") AS "guid"
                FROM ${PostgreSQLDriver.escape(
                  `${this.prefix}entities_${etype}`,
                )} ${ieTable}${limit}${offset}
              ) ${countTable}`;
          } else {
            query = `SELECT COUNT(${ieTable}."guid") AS "count"
              FROM ${PostgreSQLDriver.escape(
                `${this.prefix}entities_${etype}`,
              )} ${ieTable}`;
          }
        } else if (options.return === 'guid') {
          const guidColumn =
            tableSuffix === ''
              ? `encode(${ieTable}."guid", 'hex')`
              : `${ieTable}."guid"`;
          query = `SELECT ${guidColumn} AS "guid"
            FROM ${PostgreSQLDriver.escape(
              `${this.prefix}entities_${etype}`,
            )} ${ieTable}
            ${sortJoinInner}
            ORDER BY ${sortByInner}, ${ieTable}."guid"${limit}${offset}`;
        } else {
          if (limit || offset) {
            query = `SELECT
                encode(${eTable}."guid", 'hex') AS "guid",
                ${eTable}."tags",
                ${eTable}."cdate",
                ${eTable}."mdate",
                ${dTable}."name",
                ${dTable}."value",
                ${cTable}."string",
                ${cTable}."number"
              FROM ${PostgreSQLDriver.escape(
                `${this.prefix}entities_${etype}`,
              )} ${eTable}
              LEFT JOIN ${PostgreSQLDriver.escape(
                `${this.prefix}data_${etype}`,
              )} ${dTable} ON ${eTable}."guid"=${dTable}."guid"
              INNER JOIN ${PostgreSQLDriver.escape(
                `${this.prefix}comparisons_${etype}`,
              )} ${cTable} ON ${dTable}."guid"=${cTable}."guid" AND ${dTable}."name"=${cTable}."name"
              ${sortJoin}
              INNER JOIN (
                SELECT ${ieTable}."guid"
                FROM ${PostgreSQLDriver.escape(
                  `${this.prefix}entities_${etype}`,
                )} ${ieTable}
                ${sortJoinInner}
                ORDER BY ${sortByInner}${limit}${offset}
              ) ${fTable} ON ${eTable}."guid"=${fTable}."guid"
              ORDER BY ${sortBy}, ${eTable}."guid"`;
          } else {
            query = `SELECT
                encode(${eTable}."guid", 'hex') AS "guid",
                ${eTable}."tags",
                ${eTable}."cdate",
                ${eTable}."mdate",
                ${dTable}."name",
                ${dTable}."value",
                ${cTable}."string",
                ${cTable}."number"
              FROM ${PostgreSQLDriver.escape(
                `${this.prefix}entities_${etype}`,
              )} ${eTable}
              LEFT JOIN ${PostgreSQLDriver.escape(
                `${this.prefix}data_${etype}`,
              )} ${dTable} ON ${eTable}."guid"=${dTable}."guid"
              INNER JOIN ${PostgreSQLDriver.escape(
                `${this.prefix}comparisons_${etype}`,
              )} ${cTable} ON ${dTable}."guid"=${cTable}."guid" AND ${dTable}."name"=${cTable}."name"
              ${sortJoin}
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
        tags: row.tags,
        cdate: isNaN(Number(row.cdate)) ? null : Number(row.cdate),
        mdate: isNaN(Number(row.mdate)) ? null : Number(row.mdate),
      }),
      (row) => ({
        name: row.name,
        svalue:
          row.value === 'N'
            ? JSON.stringify(Number(row.number))
            : row.value === 'S'
            ? JSON.stringify(row.string)
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
      `SELECT "cur_uid" FROM ${PostgreSQLDriver.escape(
        `${this.prefix}uids`,
      )} WHERE "name"=@name;`,
      {
        params: {
          name: name,
        },
      },
    );
    return result?.cur_uid == null ? null : Number(result.cur_uid);
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
      await this.internalTransaction(`nymph-import-entity-${guid}`);

      await this.queryRun(
        `DELETE FROM ${PostgreSQLDriver.escape(
          `${this.prefix}entities_${etype}`,
        )} WHERE "guid"=decode(@guid, 'hex');`,
        {
          etypes: [etype],
          params: {
            guid,
          },
        },
      );
      await this.queryRun(
        `INSERT INTO ${PostgreSQLDriver.escape(
          `${this.prefix}entities_${etype}`,
        )} ("guid", "tags", "cdate", "mdate") VALUES (decode(@guid, 'hex'), @tags, @cdate, @mdate);`,
        {
          etypes: [etype],
          params: {
            guid,
            tags,
            cdate: isNaN(cdate) ? null : cdate,
            mdate: isNaN(mdate) ? null : mdate,
          },
        },
      );
      const promises = [];
      promises.push(
        this.queryRun(
          `DELETE FROM ${PostgreSQLDriver.escape(
            `${this.prefix}data_${etype}`,
          )} WHERE "guid"=decode(@guid, 'hex');`,
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
          `DELETE FROM ${PostgreSQLDriver.escape(
            `${this.prefix}comparisons_${etype}`,
          )} WHERE "guid"=decode(@guid, 'hex');`,
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
          `DELETE FROM ${PostgreSQLDriver.escape(
            `${this.prefix}references_${etype}`,
          )} WHERE "guid"=decode(@guid, 'hex');`,
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
          `DELETE FROM ${PostgreSQLDriver.escape(
            `${this.prefix}uniques_${etype}`,
          )} WHERE "guid"=decode(@guid, 'hex');`,
          {
            etypes: [etype],
            params: {
              guid,
            },
          },
        ),
      );
      await Promise.all(promises);
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
            : value;
        const promises = [];
        promises.push(
          this.queryRun(
            `INSERT INTO ${PostgreSQLDriver.escape(
              `${this.prefix}data_${etype}`,
            )} ("guid", "name", "value") VALUES (decode(@guid, 'hex'), @name, @storageValue);`,
            {
              etypes: [etype],
              params: {
                guid,
                name,
                storageValue,
              },
            },
          ),
        );
        promises.push(
          this.queryRun(
            `INSERT INTO ${PostgreSQLDriver.escape(
              `${this.prefix}comparisons_${etype}`,
            )} ("guid", "name", "truthy", "string", "number") VALUES (decode(@guid, 'hex'), @name, @truthy, @string, @number);`,
            {
              etypes: [etype],
              params: {
                guid,
                name,
                truthy: !!uvalue,
                string: `${uvalue}`,
                number: isNaN(Number(uvalue)) ? null : Number(uvalue),
              },
            },
          ),
        );
        const references = this.findReferences(value);
        for (const reference of references) {
          promises.push(
            this.queryRun(
              `INSERT INTO ${PostgreSQLDriver.escape(
                `${this.prefix}references_${etype}`,
              )} ("guid", "name", "reference") VALUES (decode(@guid, 'hex'), @name, decode(@reference, 'hex'));`,
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
            `INSERT INTO ${PostgreSQLDriver.escape(
              `${this.prefix}uniques_${etype}`,
            )} ("guid", "unique") VALUES (decode(@guid, 'hex'), @unique);`,
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
                'postgresql',
                `Import entity unique constraint violation for GUID "${guid}" on etype "${etype}": "${unique}"`,
              );
            }
            return e;
          }),
        );
      }
      await Promise.all(promises);
      await this.commit(`nymph-import-entity-${guid}`);
    } catch (e: any) {
      this.nymph.config.debugError('postgresql', `Import entity error: "${e}"`);
      await this.rollback(`nymph-import-entity-${guid}`);
      throw e;
    }
  }

  public async importUID({ name, value }: { name: string; value: number }) {
    try {
      await this.internalTransaction(`nymph-import-uid-${name}`);
      await this.queryRun(
        `DELETE FROM ${PostgreSQLDriver.escape(
          `${this.prefix}uids`,
        )} WHERE "name"=@name;`,
        {
          params: {
            name,
          },
        },
      );
      await this.queryRun(
        `INSERT INTO ${PostgreSQLDriver.escape(
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
      this.nymph.config.debugError('postgresql', `Import UID error: "${e}"`);
      await this.rollback(`nymph-import-uid-${name}`);
      throw e;
    }
  }

  public async newUID(name: string) {
    if (name == null) {
      throw new InvalidParametersError('Name not given for UID.');
    }
    await this.internalTransaction('nymph-newuid');
    let curUid: number | undefined = undefined;
    try {
      const lock = await this.queryGet(
        `SELECT "cur_uid" FROM ${PostgreSQLDriver.escape(
          `${this.prefix}uids`,
        )} WHERE "name"=@name FOR UPDATE;`,
        {
          params: {
            name,
          },
        },
      );
      curUid = lock?.cur_uid == null ? undefined : Number(lock.cur_uid);
      if (curUid == null) {
        curUid = 1;
        await this.queryRun(
          `INSERT INTO ${PostgreSQLDriver.escape(
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
        await this.queryRun(
          `UPDATE ${PostgreSQLDriver.escape(
            `${this.prefix}uids`,
          )} SET "cur_uid"=@curUid WHERE "name"=@name;`,
          {
            params: {
              name,
              curUid,
            },
          },
        );
      }
    } catch (e: any) {
      this.nymph.config.debugError('postgresql', `New UID error: "${e}"`);
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
      `UPDATE ${PostgreSQLDriver.escape(
        `${this.prefix}uids`,
      )} SET "name"=@newName WHERE "name"=@oldName;`,
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
    await this.queryRun(
      `ROLLBACK TO SAVEPOINT ${PostgreSQLDriver.escape(name)};`,
    );
    this.transaction.count--;
    if (this.transaction.count === 0) {
      await this.queryRun('ROLLBACK;');
      this.transaction.connection?.done();
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
            : svalue;
        const promises = [];
        promises.push(
          this.queryRun(
            `INSERT INTO ${PostgreSQLDriver.escape(
              `${this.prefix}data_${etype}`,
            )} ("guid", "name", "value") VALUES (decode(@guid, 'hex'), @name, @storageValue);`,
            {
              etypes: [etype],
              params: {
                guid,
                name,
                storageValue,
              },
            },
          ),
        );
        promises.push(
          this.queryRun(
            `INSERT INTO ${PostgreSQLDriver.escape(
              `${this.prefix}comparisons_${etype}`,
            )} ("guid", "name", "truthy", "string", "number") VALUES (decode(@guid, 'hex'), @name, @truthy, @string, @number);`,
            {
              etypes: [etype],
              params: {
                guid,
                name,
                truthy: !!value,
                string: `${value}`,
                number: isNaN(Number(value)) ? null : Number(value),
              },
            },
          ),
        );
        const references = this.findReferences(svalue);
        for (const reference of references) {
          promises.push(
            this.queryRun(
              `INSERT INTO ${PostgreSQLDriver.escape(
                `${this.prefix}references_${etype}`,
              )} ("guid", "name", "reference") VALUES (decode(@guid, 'hex'), @name, decode(@reference, 'hex'));`,
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
            `INSERT INTO ${PostgreSQLDriver.escape(
              `${this.prefix}uniques_${etype}`,
            )} ("guid", "unique") VALUES (decode(@guid, 'hex'), @unique);`,
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
              'postgresql',
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
            `INSERT INTO ${PostgreSQLDriver.escape(
              `${this.prefix}entities_${etype}`,
            )} ("guid", "tags", "cdate", "mdate") VALUES (decode(@guid, 'hex'), @tags, @cdate, @cdate);`,
            {
              etypes: [etype],
              params: {
                guid,
                tags,
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
          const promises = [];
          promises.push(
            this.queryRun(
              `SELECT 1 FROM ${PostgreSQLDriver.escape(
                `${this.prefix}entities_${etype}`,
              )} WHERE "guid"=decode(@guid, 'hex') FOR UPDATE;`,
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
              `SELECT 1 FROM ${PostgreSQLDriver.escape(
                `${this.prefix}data_${etype}`,
              )} WHERE "guid"=decode(@guid, 'hex') FOR UPDATE;`,
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
              `SELECT 1 FROM ${PostgreSQLDriver.escape(
                `${this.prefix}comparisons_${etype}`,
              )} WHERE "guid"=decode(@guid, 'hex') FOR UPDATE;`,
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
              `SELECT 1 FROM ${PostgreSQLDriver.escape(
                `${this.prefix}references_${etype}`,
              )} WHERE "guid"=decode(@guid, 'hex') FOR UPDATE;`,
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
              `SELECT 1 FROM ${PostgreSQLDriver.escape(
                `${this.prefix}uniques_${etype}`,
              )} WHERE "guid"=decode(@guid, 'hex') FOR UPDATE;`,
              {
                etypes: [etype],
                params: {
                  guid,
                },
              },
            ),
          );
          await Promise.all(promises);
          const info = await this.queryRun(
            `UPDATE ${PostgreSQLDriver.escape(
              `${this.prefix}entities_${etype}`,
            )} SET "tags"=@tags, "mdate"=@mdate WHERE "guid"=decode(@guid, 'hex') AND "mdate" <= @emdate;`,
            {
              etypes: [etype],
              params: {
                tags,
                mdate,
                guid,
                emdate: isNaN(Number(entity.mdate)) ? 0 : Number(entity.mdate),
              },
            },
          );
          let success = false;
          if (info.rowCount === 1) {
            const promises = [];
            promises.push(
              this.queryRun(
                `DELETE FROM ${PostgreSQLDriver.escape(
                  `${this.prefix}data_${etype}`,
                )} WHERE "guid"=decode(@guid, 'hex');`,
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
                `DELETE FROM ${PostgreSQLDriver.escape(
                  `${this.prefix}comparisons_${etype}`,
                )} WHERE "guid"=decode(@guid, 'hex');`,
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
                `DELETE FROM ${PostgreSQLDriver.escape(
                  `${this.prefix}references_${etype}`,
                )} WHERE "guid"=decode(@guid, 'hex');`,
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
                `DELETE FROM ${PostgreSQLDriver.escape(
                  `${this.prefix}uniques_${etype}`,
                )} WHERE "guid"=decode(@guid, 'hex');`,
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
      this.nymph.config.debugError('postgresql', `Save entity error: "${e}"`);
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
    await this.internalTransaction('nymph-setuid');
    try {
      await this.queryRun(
        `DELETE FROM ${PostgreSQLDriver.escape(
          `${this.prefix}uids`,
        )} WHERE "name"=@name;`,
        {
          params: {
            name,
            curUid,
          },
        },
      );
      await this.queryRun(
        `INSERT INTO ${PostgreSQLDriver.escape(
          `${this.prefix}uids`,
        )} ("name", "cur_uid") VALUES (@name, @curUid);`,
        {
          params: {
            name,
            curUid,
          },
        },
      );
    } catch (e: any) {
      await this.rollback('nymph-setuid');
      throw e;
    }

    await this.commit('nymph-setuid');
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
      // We're not in a transaction yet, so start one.
      await this.queryRun('BEGIN;');
    }

    await this.queryRun(`SAVEPOINT ${PostgreSQLDriver.escape(name)};`);

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
    (nymph.driver as PostgreSQLDriver).transaction = transaction;

    return nymph;
  }
}
