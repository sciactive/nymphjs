# Nymph MySQL Driver

Powerful object data storage and querying.

Note: this library is being migrated from a PHP backend with JS frontend to a Node.js/TS backend with a TS frontend. This is a work in progress.

## Installation

```sh
npm install --save @nymphjs/driver-mysql
```

## Usage

Supply an instance of this driver with its configuration to Nymph's init function.

```ts
import { Nymph } from '@nymphjs/nymph';
import MySQLDriver from '@nymphjs/driver-mysql';

const mysqlConfig = {
  host: 'your_db_host',
  database: 'your_database',
  user: 'your_user',
  password: 'your_password',
};

Nymph.init({}, new MySQLDriver(mysqlConfig));

// All done. Nymph is ready to use.
```

## Options

See the [config declaration file](src/conf/d.ts).

## API Docs

Check out the [API Docs in the wiki](https://github.com/sciactive/nymph/wiki/API-Docs).
