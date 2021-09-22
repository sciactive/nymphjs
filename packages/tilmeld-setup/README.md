# Tilmeld Setup App - User/Group System for Nymph

Powerful object data storage and querying.

The Tilmeld Setup App allows administrators to create, modify, and delete users and groups and configure how Tilmeld works. It also acts as the endpoint for email address verification.

## Installation

```sh
npm install --save @nymphjs/tilmeld-setup
```

## Usage

You need to setup a Nymph REST endpoint, then you can use the Tilmeld Setup App as another endpoint in your Express server.

IMPORTANT: Within the setup app, Tilmeld **does not** check for XSRF tokens, so **do not** put your REST endpoint under the setup app's path, or you will be vulnerable to XSRF attacks!

For this example, I'll use the SQLite3 driver with an in-memory database.

```ts
import express from 'express';
import SQLite3Driver from '@nymphjs/driver-sqlite3';
import { Nymph } from '@nymphjs/nymph';
import { Tilmeld } from '@nymphjs/tilmeld';
import createServer from '@nymphjs/server';
import setup from '@nymphjs/tilmeld-setup';

// Import all the entities you will be using on the server.
import './entities/MyEntity';

// Configure Nymph.
const nymph = new Nymph(
  {},
  new SQLite3Driver({
    filename: ':memory:',
  }),
  new Tilmeld({
    appName: 'My App',
    appUrl: 'http://localhost',
    cookieDomain: 'localhost',
    cookiePath: '/',
    setupPath: '/user',
    verifyRedirect: 'http://localhost',
    verifyChangeRedirect: 'http://localhost',
    cancelChangeRedirect: 'http://localhost',
    jwtSecret: 'shhhhh',
  })
);

// Create your Express app.
const app = express();

// Use the REST server.
app.use('/rest', createServer(nymph));
// Use the Tilmeld Setup App, passing in the Nymph Client Config.
app.use(
  '/user',
  setup(
    {
      restUrl: 'http://localhost/rest',
    },
    nymph
  )
);

// Do anything else you need to do...

// Start your server.
app.listen(80);
```

# License

Copyright 2021 SciActive Inc

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
