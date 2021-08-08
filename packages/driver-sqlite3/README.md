# Nymph SQLite3 Driver

Powerful object data storage and querying.

Note: this library is being migrated from a PHP backend with JS frontend to a Node.js/TS backend with a TS frontend. This is a work in progress.

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

Nymph.init({}, new SQLite3Driver(sqliteConfig));

// All done. Nymph is ready to use.
```

## Options

See the [config declaration file](src/conf/d.ts).

## API Docs

Check out the [API Docs in the wiki](https://github.com/sciactive/nymph/wiki/API-Docs).
