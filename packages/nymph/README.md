# Nymph

Powerful object data storage and querying.

Note: this library is being migrated from a PHP backend with JS frontend to a Node.js/TS backend with a TS frontend. This is a work in progress.

## Installation

```sh
npm install --save @nymphjs/nymph
```

## Usage

For detailed docs, check out the wiki:

- [Entity Class](https://github.com/sciactive/nymph/wiki/Entity-Class)
- [Entity Querying](https://github.com/sciactive/nymph/wiki/Entity-Querying)
- [Extending the Entity Class](https://github.com/sciactive/nymph/wiki/Extending-the-Entity-Class)

Here's an overview:

```ts
// main.ts
import { Nymph } from '@nymphjs/nymph';
import MySQLDriver from '@nymphjs/driver-mysql';
import Todo from './Todo';

const mysqlConfig = {
  host: 'your_db_host',
  database: 'your_database',
  user: 'your_user',
  password: 'your_password',
};

Nymph.init({ pubsub: false }, new MySQLDriver(mysqlConfig));

// You are set up. Now you can use entity classes like `Todo` to store data,
// and Nymph's query methods like `getEntities` to retrieve them.

async function run() {
  const myEntity = new Todo();
  myEntity.text = 'Get it done!';
  await myEntity.$save();

  const otherPendingTodos = await Nymph.getEntities(
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

## API Docs

Check out the [API Docs in the wiki](https://github.com/sciactive/nymph/wiki/API-Docs).
