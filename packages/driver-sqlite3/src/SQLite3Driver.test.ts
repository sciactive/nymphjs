import nymph, { QueriesTest, UIDTest, ExportImportTest } from '@nymphjs/nymph';

import SQLite3Driver from './SQLite3Driver';

const sqliteConfig = {
  // filename: __dirname + '/test.db',
  filename: ':memory:',
};

nymph.init({}, new SQLite3Driver(sqliteConfig));

describe('SQLite3Driver', () => {
  if (nymph.driver.isConnected()) {
    nymph.driver.disconnect();
    nymph.driver.connect();
  }
  QueriesTest(it);
  UIDTest(it);
  ExportImportTest(it);
});
