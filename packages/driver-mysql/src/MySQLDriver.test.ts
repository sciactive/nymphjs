import Nymph, { QueriesTest, UIDTest, ExportImportTest } from '@nymphjs/nymph';

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

  afterAll(async () => {
    await Nymph.driver.disconnect(); // avoid jest open handle error
  });
});
