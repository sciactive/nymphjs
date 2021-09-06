# Nymph.js

Powerful object data storage and querying.

Note: this library is being migrated from a PHP backend with JS frontend to a Node.js/TS backend with a TS frontend. This is a work in progress.

# Getting Started

All you need to start using Nymph is the `@nymphjs/nymph` package and one of the drivers, `@nymphjs/driver-mysql` or `@nymphjs/driver-sqlite3`. Check out the [readme for the Nymph package](packages/nymph/README.md).

# Nymph.js Packages

## [Nymph](packages/nymph)

The Nymph core provides the base level classes and utilities to query the database, save data to it, and define different data types.

## [MySQL Driver](packages/driver-mysql)

The MySQL driver lets you configure Nymph to query and save data to a MySQL database.

## [SQLite3 Driver](packages/driver-sqlite3)

The SQLite3 driver lets you configure Nymph to query and save data to a SQLite3 database. This includes an in memory SQLite3 database.

## [REST Server](packages/server)

The REST server lets you configure an endpoint for the Nymph client to query and push data to. The server provides this endpoint as an Express middleware, which can be used in a new or existing Express (or compatible) server.

## [PubSub Server](packages/pubsub)

The PubSub server provides a WebSocket server that allows Nymph to publish changes and the Nymph Client to subscribe to those changes. You can subscribe to individual entities, entity queries, or UIDs.

## [Client](packages/client)

The Nymph Client allows you to query and push data to a Nymph REST server from the browser. You can also subscribe to entities and queries on a Nymph PubSub server and be notified of changes.

## [Node Client](packages/client-node)

The Nymph Node Client let's you do everything the Nymph Client does, but from Node instead of the browser.

## [Tilmeld](packages/tilmeld)

Tilmeld (the d is silent) is a user and group management system for Nymph. It provides strict access controls to protect entities from unauthorized access/modification. It allows for granting and revoking ad hoc abilities to users and groups, then checking for those abilities. It provides authentication services and features protection against XSRF attacks.

## [Tilmeld Client](packages/tilmeld-client)

The Tilmeld Client lets you register, login, and perform user account related functions remotely on a Nymph server.

## [Tilmeld Setup](packages/tilmeld-setup)

The Tilmeld Setup App allows administrators to create, modify, and delete users and groups and configure how Tilmeld works. It also acts as the endpoint for email address verification.

## [Query Parser](packages/query-parser)

The Query Parser is a utility for creating complex Nymph entity queries from a simple text input. Essentially, it turns a string into a Nymph query.

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
