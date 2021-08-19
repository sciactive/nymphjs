import express from 'express';
import SQLite3Driver from '@nymphjs/driver-sqlite3';
import NymphServer from '@nymphjs/nymph';
import { Nymph } from '@nymphjs/client-node';

import rest from './index';

const sqliteConfig = {
  filename: ':memory:',
};

NymphServer.init({ pubsub: false }, new SQLite3Driver(sqliteConfig));

const app = express();
app.use('/test', rest);
const server = app.listen(5080);

Nymph.init({
  restURL: 'http://localhost:5080/test/',
});

describe('Nymph REST Server', () => {
  it('works at all', async () => {
    expect(await Nymph.newUID('testUID')).toEqual(1);
    expect(await Nymph.getUID('testUID')).toEqual(1);
  });

  afterAll(() => {
    server.close(); // avoid jest open handle error
  });
});
