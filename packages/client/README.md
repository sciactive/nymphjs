# Nymph Client

Powerful object data storage and querying.

The Nymph Client allows you to query and push data to a Nymph REST server from the browser. You can also subscribe to entities and queries on a Nymph PubSub server and be notified of changes.

## Installation

```sh
npm install --save @nymphjs/client
```

This package is the Nymph client for browsers. You can find UMD in `dist`, or TS source in `src`. There is also a **[Node.js client](https://github.com/sciactive/nymphjs/packages/client-node)**.

## Usage

Here's an overview:

```ts
import { Nymph, PubSub } from '@nymphjs/client';
import Todo from 'Todo';

const nymphOptions = {
  restUrl: 'https://yournymphrestserver/path/to/your/endpoint',
  pubsubUrl: 'wss://yournymphpubsubserver',
};
const nymph = new Nymph(nymphOptions);
const pubsub = new PubSub(nymphOptions, nymph);
nymph.addEntityClass(Todo);

// Now you can use Nymph and PubSub.
const myTodo = new Todo();
myTodo.name = 'This is a new todo!';
myTodo.done = false;
await myTodo.$save();

let allMyTodos = await nymph.getEntities({ class: Todo });

let subscription = pubsub.subscribeWith(myTodo, () => {
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
let subscription = pubsub.subscribeEntities(
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
    pubsub.updateArray(todos, update);

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
