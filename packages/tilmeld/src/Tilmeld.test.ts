import { Nymph } from '@nymphjs/nymph';
import { SQLite3Driver } from '@nymphjs/driver-sqlite3';

import { TilmeldTest } from './testArtifacts.js';

const nymph = new Nymph(
  {},
  new SQLite3Driver({
    filename: ':memory:',
  }),
);

describe('Tilmeld', () => {
  TilmeldTest(nymph, it);
});
