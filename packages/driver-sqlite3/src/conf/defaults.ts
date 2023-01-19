import { SQLite3DriverConfig } from './d';

export default {
  filename: ':memory:',
  fileMustExist: false,
  prefix: 'nymph_',
  timeout: 10000,
  readonly: false,
  wal: false,
  verbose: undefined,
} as SQLite3DriverConfig;
