import { NymphDriver } from '..';
import {
  MySQLDriverConfig,
  MySQLDriverConfigDefaults as defaults,
} from './conf';

/**
 * The MySQL Nymph database driver.
 */
export default class MySQLDriver extends NymphDriver {
  public config: MySQLDriverConfig;

  constructor(config: Partial<MySQLDriverConfig>) {
    super();
    this.config = { ...defaults, ...config };
  }
}
