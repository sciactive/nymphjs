import Nymph, { QueriesTest, UIDTest, ExportImportTest } from '@nymphjs/nymph';

import SQLite3Driver from './SQLite3Driver';

const sqliteConfig = {
  // filename: __dirname + '/test.db',
  filename: ':memory:',
};

Nymph.init({}, new SQLite3Driver(sqliteConfig));

describe('SQLite3Driver', () => {
  if (Nymph.driver.isConnected()) {
    Nymph.driver.disconnect();
    Nymph.driver.connect();
  }
  QueriesTest(it);
  UIDTest(it);
  ExportImportTest(it);
});
