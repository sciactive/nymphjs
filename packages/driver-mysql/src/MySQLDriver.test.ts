import nymph, { QueriesTest, UIDTest, ExportImportTest } from '@nymphjs/nymph';

import MySQLDriver from './MySQLDriver';

const mysqlConfig = {
  host: 'localhost',
  database: 'nymph',
  user: 'nymph',
  password: 'nymph',
};

nymph.init({}, new MySQLDriver(mysqlConfig));

describe('MySQLDriver', () => {
  QueriesTest(it);
  UIDTest(it);
  ExportImportTest(it);

  afterAll(async () => {
    await nymph.driver.disconnect(); // avoid jest open handle error
  });
});
