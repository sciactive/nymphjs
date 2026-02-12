# Nymph

Powerful object data storage and querying.

The Nymph core provides the base level classes and utilities to query the database, save data to it, and define different data types.

## Installation

```sh
npm install --save @nymphjs/nymph
```

## Drivers

To use Nymph, you need a database driver. Nymph.js provides a [MySQL driver](../driver-mysql/README.md), a [PostgreSQL driver](../driver-postgresql/README.md), and a [SQLite3 driver](../driver-sqlite3/README.md). They all provide the exact same functionality (with the exception of how the database returns sorted data).

## Usage

Here's an overview:

```ts
// main.ts
import { Nymph } from '@nymphjs/nymph';
import MySQLDriver from '@nymphjs/driver-mysql';
import TodoClass from './Todo';

const mysqlConfig = {
  host: 'your_db_host',
  database: 'your_database',
  user: 'your_user',
  password: 'your_password',
};

// Create a new instance of Nymph.
const nymph = new Nymph({}, new MySQLDriver(mysqlConfig));
// addEntityClass returns the class you should use for this instance of Nymph.
const Todo = nymph.addEntityClass(TodoClass);

// You are set up. Now you can use entity classes like `Todo` to store data,
// and Nymph's query methods like `getEntities` to retrieve them.

async function run() {
  const myEntity = await Todo.factory();
  myEntity.text = 'Get it done!';
  await myEntity.$save();

  const otherPendingTodos = await nymph.getEntities(
    { class: Todo },
    { type: '&', '!guid': myEntity.guid, equal: ['done', false] },
  );

  const total = otherPendingTodos.length;
  const single = total === 1;
  console.log(
    `Besides the one I just created, there ${
      single ? 'is' : 'are'
    } ${total} pending todo${single ? '' : 's'} in the database.`,
  );
}
```

```ts
// Todo.ts
import { Entity } from '@nymphjs/nymph';

export type TodoData = {
  text: string;
  done: boolean;
};

export default class Todo extends Entity<TodoData> {
  static ETYPE = 'todo'; // This is used for the table name(s) in the DB.
  static class = 'Todo'; // This is used to map references to their class.

  constructor() {
    super();

    // Within the methods of an entity, you will use `this.$data` to access
    // its data. Outside, you don't need the $data part.
    this.$data.text = '';
    this.$data.done = false;
  }

  async $getOtherTodos() {
    // this.$nymph (or this.nymph in a static function) is the instance of Nymph
    // this entity was loaded with. Creating transactions will create a new
    // instance of Nymph, so it could be a transactional instance.
    const otherTodos = await this.$nymph.getEntities(
      { class: Todo },
      { type: '!&', guid: this.guid },
    );
    return otherTodos;
  }
}
```

## Options

See the [config declaration file](src/conf/d.ts).

# Live Migrations

Sometimes database changes can be live migrated. In these cases, running `needsMigration()` will tell you about them, and the docblock for that method will give you more information. You should always run this method after updating to a new version of Nymph to see what needs to be migrated, if anything.

If a migration is needed, you should export the DB in the version you were using before, in case anything goes wrong during the migration.

The next step is to use the `liveMigration(migrationType)` method with the correct migration type.

If required (explained in the docblock), you might then need to run a specific import on all of your entities. This is very important, and you might not be able to use new features or upgrade further without performing this step.

Note that you can always export the DB in the version you were previously using, completely clear the DB (drop all of the tables), then import the DB in the new version.

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
