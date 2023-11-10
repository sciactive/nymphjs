# Tilmeld - User/Group System for Nymph

Powerful object data storage and querying.

Tilmeld (the d is silent) is a user and group management system for Nymph. It provides strict access controls to protect entities from unauthorized access/modification. It allows for granting and revoking ad hoc abilities to users and groups, then checking for those abilities. It provides authentication services and features protection against XSRF attacks.

## Installation

```sh
npm install --save @nymphjs/tilmeld
```

## Usage

When you initialize Nymph, provide it with an instance of the Tilmeld class from this package. You now have access to the User and Group classes that are specific to that instance of Nymph/Tilmeld.

Here's an overview.

```ts
import SQLite3Driver from '@nymphjs/driver-sqlite3';
import { Tilmeld } from '@nymphjs/tilmeld';
import { Nymph } from '@nymphjs/nymph';

const tilmeld = new Tilmeld({
  appName: 'My App',
  appUrl: 'http://localhost',
  cookieDomain: 'localhost',
  cookiePath: '/',
  setupPath: '/user',
  verifyRedirect: 'http://localhost',
  verifyChangeRedirect: 'http://localhost',
  cancelChangeRedirect: 'http://localhost',
  jwtSecret: 'shhhhh',
});

const nymph = new Nymph(
  {},
  new SQLite3Driver({
    filename: ':memory:',
  }),
  tilmeld,
);

// These are the classes specific to this instance of Tilmeld.
const { User, Group } = tilmeld;
```

## Options

See the [config declaration file](src/conf/d.ts).

## Abilities

There are a few abilities that Tilmeld uses internally:

- `system/admin` - A user with this ability has **all** abilities.
- `tilmeld/admin` - Allow the user to manage and edit other user's account and group information and grant/revoke abilities.
- `tilmeld/switch` - Allow the user to switch to other users (log in as them without their password).
- `uid/get/[name]` - Allow the user to read the named UID.
- `uid/new/[name]` - Allow the user to read, create, and increment the named UID.
- `uid/set/[name]` - Allow the user to read, create, increment, set, and delete the named UID.

The admin and switch abilities cannot be inherited from groups.

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
