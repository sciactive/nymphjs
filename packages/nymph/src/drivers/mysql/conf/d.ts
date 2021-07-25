import { NymphDriverConfig } from '../../NymphDriver.d';

/**
 * MySQL Driver Config
 */
export interface MySQLDriverConfig extends NymphDriverConfig {
  /**
   * Host
   * The host on which to connect to MySQL. Can include a port, like
   * hostname:port.
   */
  host: string;
  /**
   * Port
   * The port on which to connect to MySQL.
   */
  port: number;
  /**
   * User
   * The MySQL user.
   */
  user: string;
  /**
   * Password
   * The MySQL password.
   */
  password: string;
  /**
   * Database
   * The MySQL database.
   */
  database: string;
  /**
   * MySQLi Link
   * If you need to use custom options, like SSL, you can provide a function
   * here to create a MySQLi resource and return it.
   */
  link: null;
  /**
   * Table Prefix
   * The MySQL table name prefix.
   */
  prefix: string;
  /**
   * Table Engine
   * The MySQL table engine. You should use MYISAM if you are using
   * MySQL < 5.6.
   *
   * Options are: Any MySQL storage engine supported on your server.
   */
  engine: string;
  /**
   * Enable Transactions
   * Whether to use transactions. If your table engine doesn't support
   * it (like MYISAM), you should turn this off.
   */
  transactions: boolean;
  /**
   * Enable Foreign Keys
   * Whether to use foreign keys. If your table engine doesn't support
   * it (like MYISAM), you should turn this off.
   */
  foreignKeys: boolean;
  /**
   * Enable Row Locking
   * Whether to use row locking. If your table engine doesn't support
   * it (like MYISAM), you should turn this off.
   */
  rowLocking: boolean;
  /**
   * Enable Table Locking
   * Whether to use table locking. If you use row locking, this should be off.
   * If you can't use row locking (like with MYISAM), you can use table
   * locking to ensure data consistency.
   */
  tableLocking: boolean;
}
