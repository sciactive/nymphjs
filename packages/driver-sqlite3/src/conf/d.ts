/**
 * SQLite3 Driver Config
 */
export interface SQLite3DriverConfig {
  /**
   * The filename of the SQLite3 DB. Use ':memory:' for an in-memory DB.
   */
  filename: string;
  /**
   * If the file does not exist, an Error will be thrown instead of creating a
   * new file.
   *
   * This option is ignored for in-memory, temporary, or readonly database
   * connections.
   */
  fileMustExist: boolean;
  /**
   * The SQLite3 table name prefix.
   */
  prefix: string;
  /**
   * The timeout to use for waiting for the DB to become available.
   */
  timeout: number;
  /**
   * Open explicitly for writing.
   *
   * By default, the driver will always open the DB as readonly, and attempt to
   * open another link to perform write operations. If you know that only one
   * instance will be writing, you can force the driver to open for writing by
   * default, which will block any other instance from opening it for writing.
   *
   * One thing to note is that starting a transaction is a write operation, so
   * as long as an instance is in a transaction, no other instances can write.
   *
   * PubSub also needs to open the DB, and it only needs read access.
   */
  explicitWrite: boolean;
  /**
   * Turn on WAL mode.
   *
   * This will generally increase performance, but does mean that the DB must be
   * on a local disk.
   *
   * See: https://www.sqlite.org/wal.html
   */
  wal: boolean;
  /**
   * Additional pragma statements to run upon connection.
   *
   * The default pragmas:
   *
   * - journal_mode = WAL;
   *   (if wal is set to true)
   * - encoding = "UTF-8";
   * - foreign_keys = 1;
   * - case_sensitive_like = 1;
   *
   * (Don't include the PRAGMA keyword, but do include the semicolon.)
   */
  pragmas: string[];
  /**
   * Function that gets called with every SQL string executed.
   */
  verbose: ((message?: any, ...additionalArgs: any[]) => void) | undefined;
}
