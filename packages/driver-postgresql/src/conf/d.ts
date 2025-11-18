import type { PoolConfig } from 'pg';

/**
 * PostgreSQL Driver Config
 */
export interface PostgreSQLDriverConfig {
  /**
   * The host on which to connect to Postgres. Can include a port, like
   * hostname:port.
   */
  host: string;
  /**
   * The port on which to connect to Postgres.
   */
  port: number;
  /**
   * The Postgres user.
   */
  user: string;
  /**
   * The Postgres password.
   */
  password: string;
  /**
   * The Postgres database.
   */
  database: string;
  /**
   * If you need to use custom options, like SSL, you can provide them here in
   * place of the above options.
   */
  customPoolConfig: PoolConfig | null;
  /**
   * The Postgres table name prefix.
   */
  prefix: string;
  /**
   * The full text search configuration to use.
   *
   * See: https://www.postgresql.org/docs/current/textsearch-tables.html
   */
  ftsConfig: string;
}
