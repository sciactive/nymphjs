import { PostgreSQLDriverConfig } from './d';

export default {
  connectionType: 'host',
  host: 'localhost',
  port: 5432,
  user: 'nymph',
  password: 'password',
  database: 'nymph',
  prefix: 'nymph_',
  usePlperl: false,
  allowPersistent: true,
} as PostgreSQLDriverConfig;
