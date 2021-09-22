import { Nymph, QueriesTest, UIDTest, ExportImportTest } from '@nymphjs/nymph';

import SQLite3Driver from './SQLite3Driver';

const sqliteConfig = {
  // filename: __dirname + '/test.db',
  filename: ':memory:',
};

const nymph = new Nymph({}, new SQLite3Driver(sqliteConfig));

describe('SQLite3Driver', () => {
  if (nymph.driver.isConnected()) {
    nymph.driver.disconnect();
    nymph.driver.connect();
  }
  QueriesTest(nymph, it);
  UIDTest(nymph, it);
  ExportImportTest(nymph, it);
});
