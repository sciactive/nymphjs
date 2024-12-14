# Tilmeld Client - User/Group System for Nymph

Powerful object data storage and querying.

The Tilmeld Client lets you register, login, and perform user account related functions remotely on a Nymph server.

## Installation

```sh
npm install --save @nymphjs/tilmeld-client
```

You can find ES modules in `dist`, or TS source in `src`.

## Usage

The Tilmeld client contains the client versions of the `User` and `Group` entities. It also contains helpers, `login`, `register`, and `checkUsername`.

Once you've initialized Nymph Client, set the User and Group classes on it. Then initialize the new User class with the Nymph instance. (This allows the class to set up authentication listeners.)

```ts
import { Nymph } from '@nymphjs/client';
import {
  User as UserClass,
  Group as GroupClass,
} from '@nymphjs/tilmeld-client';

const nymph = new Nymph({
  restUrl: 'https://yournymphrestserver/path/to/your/endpoint',
});
const User = nymph.addEntityClass(UserClass);
const Group = nymph.addEntityClass(GroupClass);
User.init(nymph);
```

If you're running more than one instance of Nymph client, be sure to use the classes returned by `addEntityClass`, so as not to accidentally submit entities from one instances to another instance.

# License

Copyright 2021-2024 SciActive Inc

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
