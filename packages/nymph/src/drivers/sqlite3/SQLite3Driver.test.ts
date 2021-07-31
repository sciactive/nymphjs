import { QueriesTest, UIDTest, ExportImportTest } from '../testArtifacts';
import Nymph from '../../Nymph';
import SQLite3Driver from './SQLite3Driver';

const sqliteConfig = {
  // filename: __dirname + '/test.db',
  filename: ':memory:',
};

Nymph.init({ pubsub: false }, new SQLite3Driver(sqliteConfig));

describe('SQLite3Driver', () => {
  if (Nymph.driver.isConnected()) {
    Nymph.driver.disconnect();
    Nymph.driver.connect();
  }
  QueriesTest(it);
  UIDTest(it);
  ExportImportTest(it);
});
