import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import fs from 'node:fs';
import { Nymph, QueriesTest, UIDTest, ExportImportTest } from '@nymphjs/nymph';

import SQLite3Driver from './SQLite3Driver';

describe('SQLite3Driver In-Memory', () => {
  const sqliteConfig = {
    filename: ':memory:',
  };
  const nymph = new Nymph({}, new SQLite3Driver(sqliteConfig));

  if (nymph.driver.isConnected()) {
    nymph.driver.disconnect();
    nymph.driver.connect();
  }
  QueriesTest(nymph, it);
  UIDTest(nymph, it);
  ExportImportTest(nymph, it);
});

describe('SQLite3Driver DB File', () => {
  const filename = resolve(tmpdir(), `nymph-test-${new Date().getTime()}.db`);
  const sqliteConfig = {
    filename,
  };
  const nymph = new Nymph({}, new SQLite3Driver(sqliteConfig));

  if (nymph.driver.isConnected()) {
    nymph.driver.disconnect();
    nymph.driver.connect();
  }
  QueriesTest(nymph, it);
  UIDTest(nymph, it);
  ExportImportTest(nymph, it);

  it('cleans up the db', () => {
    try {
      fs.unlinkSync(filename);
    } catch (e: any) {
      // ignore errors
    }
    try {
      fs.unlinkSync(filename + '-shm');
    } catch (e: any) {
      // ignore errors
    }
    try {
      fs.unlinkSync(filename + '-wal');
    } catch (e: any) {
      // ignore errors
    }
  });
});
