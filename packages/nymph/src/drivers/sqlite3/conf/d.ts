import { NymphDriverConfig } from '../../NymphDriver.d';

/**
 * SQLite3 Driver Config
 */
export interface SQLite3DriverConfig extends NymphDriverConfig {
  /**
   * Filename
   * The filename of the SQLite3 DB. Use ':memory:' for an in-memory DB.
   */
  filename: string;
  /**
   * Table Prefix
   * The SQLite3 table name prefix.
   */
  prefix: string;
  /**
   * Busy Timeout
   * The timeout to use for waiting for the DB to become available.
   * See SQLite3::busyTimeout
   */
  busyTimeout: number;
  /**
   * Open Flags
   * The flags used to open the SQLite3 db. (Can be used to programmatically
   * open for readonly, which is needed for PubSub.)
   */
  openFlags: null;
  /**
   * Encryption Key
   * The encryption key to use to open the database.
   */
  encryptionKey: string | null;
}
