import { NymphDriver } from '..';
import {
  SQLite3DriverConfig,
  SQLite3DriverConfigDefaults as defaults,
} from './conf';

/**
 * The SQLite3 Nymph database driver.
 */
export default class SQLite3Driver extends NymphDriver {
  protected config: SQLite3DriverConfig;

  constructor(config: Partial<SQLite3DriverConfig>) {
    super();
    this.config = { ...defaults, ...config };
  }
}
