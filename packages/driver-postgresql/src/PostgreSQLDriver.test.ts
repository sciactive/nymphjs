import { Nymph, QueriesTest, UIDTest, ExportImportTest } from '@nymphjs/nymph';

import PostgreSQLDriver from './PostgreSQLDriver';

const postgresqlConfig = {
  host: 'localhost',
  database: 'nymph',
  user: 'nymph',
  password: 'nymph',
};

const nymph = new Nymph({}, new PostgreSQLDriver(postgresqlConfig));

describe('PostgreSQLDriver', () => {
  QueriesTest(nymph, it);
  UIDTest(nymph, it);
  ExportImportTest(nymph, it);

  afterAll(async () => {
    await nymph.driver.disconnect(); // avoid jest open handle error
  });
});
