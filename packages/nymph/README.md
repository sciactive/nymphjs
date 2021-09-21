# Nymph

Powerful object data storage and querying.

The Nymph core provides the base level classes and utilities to query the database, save data to it, and define different data types.

## Installation

```sh
npm install --save @nymphjs/nymph
```

## Drivers

To use Nymph, you need a database driver. Nymph provides a [MySQL driver](../driver-mysql/README.md) and a [SQLite3 driver](../driver-sqlite3/README.md).

## Usage

Here's an overview:

```ts
// main.ts
import nymph from '@nymphjs/nymph';
import MySQLDriver from '@nymphjs/driver-mysql';
import Todo from './Todo';

const mysqlConfig = {
  host: 'your_db_host',
  database: 'your_database',
  user: 'your_user',
  password: 'your_password',
};

nymph.init({}, new MySQLDriver(mysqlConfig));

// You are set up. Now you can use entity classes like `Todo` to store data,
// and Nymph's query methods like `getEntities` to retrieve them.

async function run() {
  const myEntity = await Todo.factory();
  myEntity.text = 'Get it done!';
  await myEntity.$save();

  const otherPendingTodos = await nymph.getEntities(
    { class: Todo },
    { type: '&', '!guid': myEntity.guid, equal: ['done', false] }
  );

  const total = otherPendingTodos.length;
  const single = total === 1;
  console.log(
    `Besides the one I just created, there ${
      single ? 'is' : 'are'
    } ${total} pending todo${single ? '' : 's'} in the database.`
  );
}
```

```ts
// Todo.ts
import { Nymph, Entity } from '@nymphjs/nymph';

export type TodoData = {
  text: string;
  done: boolean;
};

export default class Todo extends Entity<TodoData> {
  static ETYPE = 'todo'; // This is used for the table name(s) in the DB.
  static class = 'Todo'; // This is used to map references to their class.

  static async factory(guid?: string): Promise<Todo & TodoData> {
    return (await super.factory(guid)) as Todo & TodoData;
  }

  static factorySync(guid?: string): Todo & TodoData {
    return super.factorySync(guid) as Todo & TodoData;
  }

  constructor(guid?: string) {
    super(guid);

    if (this.guid == null) {
      // Within the methods of an entity, you will use `this.$data` to access
      // its data. Outside, you don't need the $data part.
      this.$data.text = '';
      this.$data.done = false;
    }
  }
}

Nymph.setEntityClass(Todo.class, Todo);
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
