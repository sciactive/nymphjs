import { MySQLDriverConfig } from './d';

export default {
  host: 'localhost',
  port: 3306,
  user: 'nymph',
  password: 'password',
  database: 'nymph',
  customPoolConfig: null,
  prefix: 'nymph_',
  engine: 'InnoDB',
  transactions: true,
  foreignKeys: true,
  rowLocking: true,
  tableLocking: false,
} as MySQLDriverConfig;
