# Tilmeld - User/Group System for Nymph

Powerful object data storage and querying.

Tilmeld (the d is silent) is a user and group management system for Nymph. It provides strict access controls to protect entities from unauthorized access/modification. It allows for granting and revoking ad hoc abilities to users and groups, then checking for those abilities. It provides authentication services and features protection against XSRF attacks.

## Installation

```sh
npm install --save @nymphjs/tilmeld
```

## Usage

When you initialize Nymph, provide it with the Tilmeld class from this package. Then you can initialize Tilmeld itself with its own configuration.

Here's an overview.

```ts
import SQLite3Driver from '@nymphjs/driver-sqlite3';
import Tilmeld from '@nymphjs/tilmeld';
import nymph from '@nymphjs/nymph';

nymph.init(
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
```

## Options

See the [config declaration file](src/conf/d.ts).

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
