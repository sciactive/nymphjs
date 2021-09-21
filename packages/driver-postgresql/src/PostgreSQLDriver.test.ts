import nymph, { QueriesTest, UIDTest, ExportImportTest } from '@nymphjs/nymph';

import PostgreSQLDriver from './PostgreSQLDriver';

const postgresqlConfig = {
  host: 'localhost',
  database: 'nymph',
  user: 'nymph',
  password: 'nymph',
};

nymph.init({}, new PostgreSQLDriver(postgresqlConfig));

describe('PostgreSQLDriver', () => {
  QueriesTest(it);
  UIDTest(it);
  ExportImportTest(it);

  afterAll(async () => {
    await nymph.driver.disconnect(); // avoid jest open handle error
  });
});
