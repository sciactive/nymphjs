import { NymphDriver } from '..';
import {
  PostgreSQLDriverConfig,
  PostgreSQLDriverConfigDefaults as defaults,
} from './conf';

/**
 * The PostgreSQL Nymph database driver.
 */
export default class PostgreSQLDriver extends NymphDriver {
  protected config: PostgreSQLDriverConfig;

  constructor(config: Partial<PostgreSQLDriverConfig>) {
    super();
    this.config = { ...defaults, ...config };
  }
}
