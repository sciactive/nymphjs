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
   * Open for readonly, which is needed for PubSub.
   */
  readonly: boolean;
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
   * Function that gets called with every SQL string executed.
   */
  verbose: ((message?: any, ...additionalArgs: any[]) => void) | undefined;
}
