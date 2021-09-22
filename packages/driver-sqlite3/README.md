# Nymph SQLite3 Driver

Powerful object data storage and querying.

The SQLite3 driver lets you configure Nymph to query and save data to a SQLite3 database. This includes an in memory SQLite3 database.

## Installation

```sh
npm install --save @nymphjs/driver-sqlite3
```

## Usage

Supply an instance of this driver with its configuration to Nymph's init function.

```ts
import { Nymph } from '@nymphjs/nymph';
import SQLite3Driver from '@nymphjs/driver-sqlite3';

const sqliteConfig = {
  filename: __dirname + '/mydatabase.db',
};

const nymph = new Nymph({}, new SQLite3Driver(sqliteConfig));

// All done. Nymph is ready to use.
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
