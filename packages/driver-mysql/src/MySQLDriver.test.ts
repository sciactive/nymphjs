import { jest } from '@jest/globals';

import { Nymph, EntitiesTest, UIDTest, ExportImportTest } from '@nymphjs/nymph';
import { TilmeldTest } from '@nymphjs/tilmeld/dist/testArtifacts.js';

import MySQLDriver from './MySQLDriver.js';

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
  EntitiesTest(nymph, it);
  UIDTest(nymph, it);
  ExportImportTest(nymph, it);

  const tilmeldNymph = nymph.clone();
  TilmeldTest(tilmeldNymph, it);

  afterAll(async () => {
    await nymph.driver.disconnect(); // avoid jest open handle error
  });
});
