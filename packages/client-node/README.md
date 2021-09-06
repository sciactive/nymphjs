# Nymph Node Client

Powerful object data storage and querying.

The Nymph Node Client let's you do everything the Nymph Client does, but from Node.JS instead of the browser.

## Installation

```sh
npm install --save @nymphjs/client-node
```

This package is the Nymph client for Node.js. You can find CJS in `dist`, or TS source in `src`. There is also a **[browser client](https://github.com/sciactive/nymphjs/packages/client)**.

This package provides fetch and WebSocket ponyfills to Nymph, handles Tilmeld auth tokens, and sets up `Nymph.init` to also call `PubSub.init` with your configs if you provide a `pubsubUrl`.

## Usage

To use, require it instead of `@nymphjs/client`:

```js
const { Nymph } = require('@nymphjs/client-node');
```

Then provide the options to Nymph.init:

```js
Nymph.init({
  restUrl: 'https://yournymphrestserver/path/to/your/endpoint',
  pubsubUrl: 'wss://yournymphpubsubserver',
});
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
