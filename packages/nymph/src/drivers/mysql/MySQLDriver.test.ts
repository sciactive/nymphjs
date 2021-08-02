import { QueriesTest, UIDTest, ExportImportTest } from '../testArtifacts';
import Nymph from '../../Nymph';
import MySQLDriver from './MySQLDriver';

const mysqlConfig = {
  host: 'localhost',
  database: 'nymph',
  user: 'nymph',
  password: 'nymph',
};

Nymph.init({ pubsub: false }, new MySQLDriver(mysqlConfig));

describe('MySQLDriver', () => {
  QueriesTest(it);
  UIDTest(it);
  ExportImportTest(it);
});
