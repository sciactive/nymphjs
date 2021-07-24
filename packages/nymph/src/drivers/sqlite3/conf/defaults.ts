import { SQLite3DriverConfig } from './d';

export default {
  filename: ':memory:',
  prefix: 'nymph_',
  busyTimeout: 10000,
  openFlags: null,
  encryptionKey: null,
} as SQLite3DriverConfig;
