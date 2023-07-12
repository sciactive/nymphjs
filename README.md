# Nymph.js

Powerful object data storage and querying.

# Getting Started

All you need to start using Nymph is the `@nymphjs/nymph` package and one of the drivers, `@nymphjs/driver-mysql`, `@nymphjs/driver-postgresql`, or `@nymphjs/driver-sqlite3`. Check out the [readme for the Nymph package](packages/nymph/README.md).

You can also set up a REST server to use Nymph remotely, a PubSub server to receive updates for queries, and a user and group management system to provide registration and access control.

Check out the [user guide](https://nymph.io/user-guide/introduction) for information about how to use Nymph once you have it set up.

# Nymph.js Packages

## [Nymph](packages/nymph)

The Nymph core provides the base level classes and utilities to query the database, save data to it, and define different data types.

## [MySQL Driver](packages/driver-mysql)

The MySQL driver lets you configure Nymph to query and save data to a MySQL database.

## [PostgreSQL Driver](packages/driver-postgresql)

The PostgreSQL driver lets you configure Nymph to query and save data to a Postgres database.

## [SQLite3 Driver](packages/driver-sqlite3)

The SQLite3 driver lets you configure Nymph to query and save data to a SQLite3 database. This includes an in memory SQLite3 database.

## [REST Server](packages/server)

The REST server lets you configure an endpoint for the Nymph client to query and push data to. The server provides this endpoint as an Express middleware, which can be used in a new or existing Express (or compatible) server.

## [PubSub Server](packages/pubsub)

The PubSub server provides a WebSocket server that allows Nymph to publish changes and the Nymph Client to subscribe to those changes. You can subscribe to individual entities, entity queries, or UIDs.

## [Client](packages/client)

The Nymph Client allows you to query and push data to a Nymph REST server from the browser. You can also subscribe to entities and queries on a Nymph PubSub server and be notified of changes.

## [Node Client](packages/client-node)

The Nymph Node Client let's you do everything the Nymph Client does, but from Node.JS instead of the browser.

## [Tilmeld](packages/tilmeld)

Tilmeld (the d is silent) is a user and group management system for Nymph. It provides strict access controls to protect entities from unauthorized access/modification. It allows for granting and revoking ad hoc abilities to users and groups, then checking for those abilities. It provides authentication services and features protection against XSRF attacks.

## [Tilmeld Client](packages/tilmeld-client)

The Tilmeld Client lets you register, login, and perform user account related functions remotely on a Nymph server.

## [Tilmeld Components](packages/tilmeld-components)

The Tilmeld Components are front end registration/login, account recovery, account details, and password change components build with [Svelte](https://svelte.dev/) and [SMUI](https://sveltematerialui.com/).

## [Tilmeld Setup](packages/tilmeld-setup)

The Tilmeld Setup App allows administrators to create, modify, and delete users and groups and configure how Tilmeld works. It also acts as the endpoint for email address verification.

## [Entity Sorter](packages/sorter)

The Nymph Entity Sorter lets you sort entities by their properties, including hierarchically.

## [Query Parser](packages/query-parser)

The Query Parser is a utility for creating complex Nymph entity queries from a simple text input. Essentially, it turns a string into a Nymph query.

## [GUID / Unique Code Generator](packages/guid)

The GUID and unique code generators are used to generate new GUIDs for Nymph objects and various random unique strings.

# Breaking Changes

In version 1.0.0-beta.41, the server side API was rewritten to match the client side API. All synchronous database calls were removed. This is to prevent a very rare potential bug, because synchronous database calls were made outside of transactions. Here is a list of some things that changed that could break your code:

- `$gatekeeper` is now async
- no guid on `constructor` or `factorySync`
- `checkClientUIDPermissions` is now async
- `authenticate` is now async
- `fillSession` is now async
- `login` is now async
- `loginSwitch` is now async
- `logout` is now async
- `logoutSwitch` is now async
- `$addGroup` is now async
- `$delGroup` is now async
- `$inGroup` is now async
- `$getLevel` is now async
- `$ready` changed to `$wake`
- `$readyAll` changed to `$wakeAll`

You will also now need to call `$wake` on sleeping references before you access their data or they will throw and error.

# Development

To develop Nymph.js, checkout the repo and run:

```sh
npm i
npm run bootstrap
rm packages/*/package-lock.json
```

Once you make changes in one package, you can either build that package directly or build all packages with `bootstrap`, then the other packages will be aware of the changes.

## Testing

When you're ready to run all the tests, in a separate shell, bring up the test DBs.

```sh
npm run test:db:start
```

Now in your main terminal, you can run the tests.

```sh
npm run test
```

Once you're all done, in your main terminal, you can bring down the test DBs (don't use Ctrl-C where the tests are running).

```sh
npm run test:db:stop
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
