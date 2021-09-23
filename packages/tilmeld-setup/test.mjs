import express from 'express';
import { SQLite3Driver } from '@nymphjs/driver-sqlite3';
import { Nymph } from '@nymphjs/nymph';
import { Tilmeld } from '@nymphjs/tilmeld';
import server from '@nymphjs/server';
import setupApp from './dist/index.js';

const createServer = server.default;
const setup = setupApp.default;

const nymph = new Nymph(
  {},
  new SQLite3Driver({
    filename: ':memory:',
  }),
  new Tilmeld({
    appName: 'My App',
    appUrl: 'http://localhost:8080',
    cookieDomain: 'localhost',
    cookiePath: '/',
    setupPath: '/user',
    emailUsernames: false,
    clientEnabledUIDs: ['test'],
    verifyRedirect: 'http://localhost:8080',
    verifyChangeRedirect: 'http://localhost:8080',
    cancelChangeRedirect: 'http://localhost:8080',
    jwtSecret: 'shhhhh',
  })
);

const app = express();

app.use('/rest', createServer(nymph));
app.use(
  '/user',
  setup(
    {
      restUrl: 'http://localhost:8080/rest',
    },
    nymph
  )
);

app.listen(8080);
