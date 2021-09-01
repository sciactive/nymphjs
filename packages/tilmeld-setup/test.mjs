import express from 'express';
import { SQLite3Driver } from '@nymphjs/driver-sqlite3';
import { Nymph } from '@nymphjs/nymph';
import { Tilmeld } from '@nymphjs/tilmeld';
import server from '@nymphjs/server';
import setupApp from './dist/index.js';

const rest = server.default;
const setup = setupApp.default;

const sqliteConfig = {
  filename: ':memory:',
};

Nymph.init({}, new SQLite3Driver(sqliteConfig), Tilmeld);
Tilmeld.init({
  appName: 'My App',
  appUrl: 'http://localhost:8080',
  cookieDomain: 'localhost',
  cookiePath: '/',
  setupPath: '/user-setup',
  emailUsernames: false,
  jwtSecret: 'shhhhh',
});

const app = express();

app.use('/nymphrest', rest);
app.use(
  '/user-setup',
  setup({
    restUrl: 'http://localhost:8080/nymphrest',
  })
);

app.listen(8080);
