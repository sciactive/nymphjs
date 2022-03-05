import { Nymph, QueriesTest, UIDTest, ExportImportTest } from '@nymphjs/nymph';

import MySQLDriver from './MySQLDriver';

// When using remote server, this can be helpful.
jest.setTimeout(60000);

const mysqlConfig = {
  host: 'localhost',
  database: 'nymph',
  user: 'nymph',
  password: 'nymph',
};

const nymph = new Nymph({}, new MySQLDriver(mysqlConfig));

describe('MySQLDriver', () => {
  QueriesTest(nymph, it);
  UIDTest(nymph, it);
  ExportImportTest(nymph, it);

  afterAll(async () => {
    await nymph.driver.disconnect(); // avoid jest open handle error
  });
});
