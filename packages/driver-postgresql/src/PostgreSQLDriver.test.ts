import { jest } from '@jest/globals';

import { Nymph, EntitiesTest, UIDTest, ExportImportTest } from '@nymphjs/nymph';

import PostgreSQLDriver from './PostgreSQLDriver.js';

// When using remote server, this can be helpful.
jest.setTimeout(60000);

const postgresqlConfig = {
  host: 'localhost',
  database: 'nymph',
  user: 'nymph',
  password: 'nymph',
};

const nymph = new Nymph({}, new PostgreSQLDriver(postgresqlConfig));

describe('PostgreSQLDriver', () => {
  EntitiesTest(nymph, it);
  UIDTest(nymph, it);
  ExportImportTest(nymph, it);

  afterAll(async () => {
    await nymph.driver.disconnect(); // avoid jest open handle error
  });
});
