# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.0.0-alpha.6](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.5...v1.0.0-alpha.6) (2021-10-05)

**Note:** Version bump only for package @nymphjs/client

# [1.0.0-alpha.5](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.4...v1.0.0-alpha.5) (2021-09-30)

**Note:** Version bump only for package @nymphjs/client

# [1.0.0-alpha.4](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.3...v1.0.0-alpha.4) (2021-09-27)

### Features

- use new instances of nymph for server and pubsub requests ([0c18fab](https://github.com/sciactive/nymphjs/commit/0c18faba2b55fe82c16806d221fc54d2cd42c992))

# [1.0.0-alpha.3](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.2...v1.0.0-alpha.3) (2021-09-22)

### Features

- allow multiple instances of Nymph Client ([81eacd7](https://github.com/sciactive/nymphjs/commit/81eacd7caff6f3c209d7d6dbfdac0414a1857c6d))
- migrate Tilmeld Client to new instance based Nymph Client ([dffe83b](https://github.com/sciactive/nymphjs/commit/dffe83b3900171a56d703cd491536b5d21360198))
- move to fully instance based design, no more globals ([c036220](https://github.com/sciactive/nymphjs/commit/c0362209b90a475b8b85269a829b0ec6bed4465f))

# [1.0.0-alpha.2](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) (2021-09-21)

### Features

- support qref queries from the client ([3c8bef0](https://github.com/sciactive/nymphjs/commit/3c8bef0251111983b06eb13ad42a2afef80a1446))
- support qref queries in the query parser ([71169a2](https://github.com/sciactive/nymphjs/commit/71169a2aa33f11d791e93bb23d377a6c270b42f2))

# 1.0.0-alpha.1 (2021-09-06)

### Bug Fixes

- add factorySync on client ([c1591f3](https://github.com/sciactive/nymphjs/commit/c1591f3348585ef39422971745e21b1b22095df2))
- clean lib dirs correctly ([ef7663e](https://github.com/sciactive/nymphjs/commit/ef7663edf3939912d732fa30191ef0b68664c6ff))
- entities waking up when accessing just guid or a property ([25ebdc7](https://github.com/sciactive/nymphjs/commit/25ebdc7046d79cdc7a4935df4172a6ec38322a0f))
- export all defaults also as named exports ([7555190](https://github.com/sciactive/nymphjs/commit/7555190e24ea4d8cf5f2a79cab6944661cf8f609))
- pubsub server and client are working now. needs more tests ([add109c](https://github.com/sciactive/nymphjs/commit/add109cfa7e9476a7925c80ab8f3f74e89112756))
- pubsub subscriptions for a query with a limit now work as expected ([d9af654](https://github.com/sciactive/nymphjs/commit/d9af6546a29b0b899b9f4450330cbe6d18f2104c))
- require class in query options on client ([20b0731](https://github.com/sciactive/nymphjs/commit/20b0731b3af0fe1bc1d9c7fbfb66f3573d77ee75))
- return boolean from entity delete ([7cb644d](https://github.com/sciactive/nymphjs/commit/7cb644dbe50cefe6c0ce8b0171991f1b739dfef0))
- server error response was caught early ([34e807d](https://github.com/sciactive/nymphjs/commit/34e807de8c5487bfeb9348447f975b1f0b3aa0e1))
- subscriptions to single entity changes and uids ([dd4f75e](https://github.com/sciactive/nymphjs/commit/dd4f75e6e856ff630788b797051378cdb7ac7d48))
- typescript errors because caught errors were unknown type ([73425ab](https://github.com/sciactive/nymphjs/commit/73425abb321263d96605f40397162b3e8a0ed1a8))

### Features

- finished personal account registration and management ([b7d0935](https://github.com/sciactive/nymphjs/commit/b7d09358ce6055abe721aace9b8d797d6b95ac50))
- migrate PubSub server ([b406b57](https://github.com/sciactive/nymphjs/commit/b406b570eb84617c2cc92184dfac3d4a0acf4b02))
- migrated Nymph client code ([605109e](https://github.com/sciactive/nymphjs/commit/605109ea5c56f7514fa978eb7c4174869fd87a69))
- migrated Tilmeld client ([fc7e380](https://github.com/sciactive/nymphjs/commit/fc7e3809949630f92177ca295c06771985815cb4))
