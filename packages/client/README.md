# Nymph Client

Powerful object data storage and querying.

Note: this library is being migrated from a PHP backend with JS frontend to a Node.js/TS backend with a TS frontend. This is a work in progress.

## Installation

```sh
npm install --save @nymphjs/client
```

This package is the Nymph client for browsers. You can find UMD in `dist`, or TS source in `src`. There is also a **[Node.js client](https://github.com/sciactive/nymphjs/packages/client-node)**.

## Setup

```html
<head>
  <!-- Nymph setup -->
  <script>
    NymphOptions = {
      restUrl: 'https://yournymphrestserver/path/to/your/endpoint',
      pubsubUrl: 'wss://yournymphpubsubserver',
    };
  </script>
  <!-- End Nymph setup -->

  <!-- Old school JS -->
  <script src="node_modules/nymph-client/dist/NymphClient.js"></script>
  <script src="path/to/your/entity/js/Todo.js"></script>
  <!-- End Old school JS -->
</head>
```

## Usage

For detailed docs, check out the wiki:

- [Entity Class](https://github.com/sciactive/nymph/wiki/Entity-Class)
- [Entity Querying](https://github.com/sciactive/nymph/wiki/Entity-Querying)
- [Extending the Entity Class](https://github.com/sciactive/nymph/wiki/Extending-the-Entity-Class)
- [Subscribing to Queries](https://github.com/sciactive/nymph/wiki/Subscribing-to-Queries)

Here's an overview:

```js
import { Nymph, PubSub } from '@nymphjs/client';
import Todo from 'Todo';

// Now you can use Nymph and PubSub.
const myTodo = new Todo();
myTodo.name = 'This is a new todo!';
myTodo.done = false;
await myTodo.$save();

let allMyTodos = await Nymph.getEntities({ class: Todo });

let subscription = PubSub.subscribeWith(myTodo, () => {
  // When this is called, the entity will already contain new data from the
  // publish event. If the entity is deleted, the GUID will be set to null.
  if (myTodo.guid != null) {
    alert('Somebody touched my todo!');
  } else {
    alert('Somebody deleted my todo!');
    subscription.unsubscribe();
  }
});

// ...

// Subscribing to a query.
let todos = [];
let userCount = 0;
let subscription = PubSub.subscribeEntities(
  {
    class: Todo.class,
  },
  {
    type: '&',
    '!tag': 'archived',
  }
)(
  (update) => {
    // The first time this is called, `update` will be an array of Todo
    // entities. After that, `update` will be a publish event object.

    // This takes an existing array of entities and either updates it to match
    // another array, or performs actions from a publish event object to update
    // it.
    PubSub.updateArray(todos, update);

    // `todos` is now up to date with the latest publishes from the server.
  },
  (err) => alert(err),
  (count) => {
    // If you provide this callback, the server will send updates of how many
    // clients are subscribed to this query.
    userCount = count;
  }
);

// ...

// Remember to clean up your subscriptions when you no longer need them.
subscription.unsubscribe();
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
