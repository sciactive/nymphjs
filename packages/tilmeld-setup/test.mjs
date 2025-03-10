import express from 'express';
import { SQLite3Driver } from '@nymphjs/driver-sqlite3';
import { Nymph } from '@nymphjs/nymph';
import { Tilmeld } from '@nymphjs/tilmeld';
import createServer from '@nymphjs/server';
import setup from './dist/index.js';

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
    domainSupport: true,
    clientEnabledUIDs: ['test'],
    verifyRedirect: 'http://localhost:8080',
    verifyChangeRedirect: 'http://localhost:8080',
    cancelChangeRedirect: 'http://localhost:8080',
    jwtSecret: 'shhhhh',
  }),
);

const app = express();

app.use('/rest', createServer(nymph));
app.use(
  '/user',
  setup(
    {
      restUrl: 'http://localhost:8080/rest',
    },
    nymph,
    {
      allowRegistration: true,
    },
  ),
);

app.listen(8080, () => {
  console.log('App is loaded. Go here in your browser:');
  console.log('    http://localhost:8080/user/');
});
