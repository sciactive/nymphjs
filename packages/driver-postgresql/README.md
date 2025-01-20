# Nymph PostgreSQL Driver

Powerful object data storage and querying.

The PostgreSQL driver lets you configure Nymph to query and save data to a Postgres database.

## Installation

```sh
npm install --save @nymphjs/driver-postgresql
```

## Usage

Supply an instance of this driver with its configuration to Nymph's constructor.

```ts
import { Nymph } from '@nymphjs/nymph';
import PostgreSQLDriver from '@nymphjs/driver-postgresql';

const postgresqlConfig = {
  host: 'your_db_host',
  database: 'your_database',
  user: 'your_user',
  password: 'your_password',
};

const nymph = new Nymph({}, new PostgreSQLDriver(postgresqlConfig));

// All done. Nymph is ready to use.
```

## Options

See the [config declaration file](src/conf/d.ts).

# License

Copyright 2021-2025 SciActive Inc

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
