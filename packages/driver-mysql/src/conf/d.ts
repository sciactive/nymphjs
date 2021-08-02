// @ts-ignore: types are wonky with @vlasky/mysql.
import { default as MySQLType } from '@types/mysql';

/**
 * MySQL Driver Config
 */
export interface MySQLDriverConfig {
  /**
   * The host on which to connect to MySQL. Can include a port, like
   * hostname:port.
   */
  host: string;
  /**
   * The port on which to connect to MySQL.
   */
  port: number;
  /**
   * The MySQL user.
   */
  user: string;
  /**
   * The MySQL password.
   */
  password: string;
  /**
   * The MySQL database.
   */
  database: string;
  /**
   * If you need to use custom options, like SSL, you can provide them here in
   * place of the above options.
   */
  customPoolConfig: MySQLType.PoolConfig | null;
  /**
   * The MySQL table name prefix.
   */
  prefix: string;
  /**
   * The MySQL table engine.
   *
   * You should use MYISAM if you are using MySQL < 5.6.
   *
   * Options are: Any MySQL storage engine supported on your server.
   */
  engine: string;
  /**
   * Whether to use transactions. If your table engine doesn't support
   * it (like MYISAM), you should turn this off.
   */
  transactions: boolean;
  /**
   * Whether to use foreign keys. If your table engine doesn't support
   * it (like MYISAM), you should turn this off.
   */
  foreignKeys: boolean;
  /**
   * Whether to use row locking. If your table engine doesn't support
   * it (like MYISAM), you should turn this off.
   */
  rowLocking: boolean;
  /**
   * Whether to use table locking. If you use row locking, this should be off.
   * If you can't use row locking (like with MYISAM), you can use table
   * locking to ensure data consistency.
   */
  tableLocking: boolean;
}
