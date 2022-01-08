# Tilmeld Client - User/Group System for Nymph

Powerful object data storage and querying.

The Tilmeld Client lets you register, login, and perform user account related functions remotely on a Nymph server.

## Installation

```sh
npm install --save @nymphjs/tilmeld-client
```

You can find UMD in `dist`, or TS source in `src`.

## Usage

The Tilmeld client contains the client versions of the `User` and `Group` entities. It also contains helpers, `getClientConfig`, `login`, `register`, and `checkUsername`.

Once you've initialized Nymph Client, set the User and Group classes on it.

```ts
import { Nymph } from '@nymphjs/client';
import { User, Group } from '@nymphjs/tilmeld-client';

const nymph = new Nymph({
  restUrl: 'https://yournymphrestserver/path/to/your/endpoint',
});
nymph.addEntityClass(User);
nymph.addEntityClass(Group);
```

If you're running more than one instance of Nymph client, you can clone the classes and add those instead. This will keep event listeners and Tilmeld client config separated.

```ts
import { Nymph } from '@nymphjs/client';
import { User, Group } from '@nymphjs/tilmeld-client';

const nymph = new Nymph({
  restUrl: 'https://yournymphrestserver/path/to/your/endpoint',
});
const UserClone = User.clone();
nymph.addEntityClass(UserClone);
const GroupClone = Group.clone();
nymph.addEntityClass(GroupClone);
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
