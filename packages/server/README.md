# Nymph REST Server

Powerful object data storage and querying.

The REST server lets you configure an endpoint for the Nymph client to query and push data to. The server provides this endpoint as an Express middleware, which can be used in a new or existing Express (or compatible) server.

## Installation

```sh
npm install --save @nymphjs/server
```

## Usage

You need to install Express, Nymph, and a Nymph driver, then you can use the REST server with an optional path. For this example, I'll use the SQLite3 driver with an in-memory database.

```ts
import express from 'express';
import { Nymph } from '@nymphjs/nymph';
import SQLite3Driver from '@nymphjs/driver-sqlite3';
import createServer from '@nymphjs/server';

// Import all the entities you will be using on the server.
import MyEntity from './entities/MyEntity';

// Configure Nymph.
const nymph = new Nymph(
  {},
  new SQLite3Driver({
    filename: ':memory:',
  })
);
nymph.addEntityClass(MyEntity);

// Create your Express app.
const app = express();

// Create and use the REST server (with an optional path).
app.use('/rest', createServer(nymph));

// Do anything else you need to do...

// Start your server.
app.listen(80);
```

You will need to import any entities you use on the server, so they are available to Nymph.

Now you can configure your client using your server's address (and the optional path, if set).

```ts
import { Nymph } from '@nymphjs/client';

import MyEntity from './entities/MyEntityClient';

const nymph = new Nymph({
  // You should configure your Express server to
  // use HTTPS, but you don't have to.
  restUrl: 'https://mydomain.tld/rest',
});
nymph.addEntityClass(MyEntity);
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
