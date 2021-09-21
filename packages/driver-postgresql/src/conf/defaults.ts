import { PostgreSQLDriverConfig } from './d';

export default {
  host: 'localhost',
  port: 5432,
  user: 'nymph',
  password: 'password',
  database: 'nymph',
  customPoolConfig: null,
  prefix: 'nymph_',
} as PostgreSQLDriverConfig;
