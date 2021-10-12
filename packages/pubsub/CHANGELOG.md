# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.0.0-alpha.9](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.8...v1.0.0-alpha.9) (2021-10-12)

**Note:** Version bump only for package @nymphjs/pubsub

# [1.0.0-alpha.8](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.7...v1.0.0-alpha.8) (2021-10-12)

**Note:** Version bump only for package @nymphjs/pubsub

# [1.0.0-alpha.7](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.6...v1.0.0-alpha.7) (2021-10-05)

**Note:** Version bump only for package @nymphjs/pubsub

# [1.0.0-alpha.6](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.5...v1.0.0-alpha.6) (2021-10-05)

**Note:** Version bump only for package @nymphjs/pubsub

# [1.0.0-alpha.5](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.4...v1.0.0-alpha.5) (2021-09-30)

**Note:** Version bump only for package @nymphjs/pubsub

# [1.0.0-alpha.4](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.3...v1.0.0-alpha.4) (2021-09-27)

### Features

- use new instances of nymph for server and pubsub requests ([0c18fab](https://github.com/sciactive/nymphjs/commit/0c18faba2b55fe82c16806d221fc54d2cd42c992))

# [1.0.0-alpha.3](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.2...v1.0.0-alpha.3) (2021-09-22)

### Features

- allow multiple instances of Nymph Client ([81eacd7](https://github.com/sciactive/nymphjs/commit/81eacd7caff6f3c209d7d6dbfdac0414a1857c6d))
- move to fully instance based design, no more globals ([c036220](https://github.com/sciactive/nymphjs/commit/c0362209b90a475b8b85269a829b0ec6bed4465f))

# [1.0.0-alpha.2](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) (2021-09-21)

### Features

- allow multiple instances of Nymph, including transactional instances ([8ff8bcf](https://github.com/sciactive/nymphjs/commit/8ff8bcf4d549998faa2b3d86440394d75bcdc202))

# 1.0.0-alpha.1 (2021-09-06)

### Bug Fixes

- export all defaults also as named exports ([7555190](https://github.com/sciactive/nymphjs/commit/7555190e24ea4d8cf5f2a79cab6944661cf8f609))
- pubsub server and client are working now. needs more tests ([add109c](https://github.com/sciactive/nymphjs/commit/add109cfa7e9476a7925c80ab8f3f74e89112756))
- pubsub subscriptions for a query with a limit now work as expected ([d9af654](https://github.com/sciactive/nymphjs/commit/d9af6546a29b0b899b9f4450330cbe6d18f2104c))
- subscriptions to single entity changes and uids ([dd4f75e](https://github.com/sciactive/nymphjs/commit/dd4f75e6e856ff630788b797051378cdb7ac7d48))
- typescript errors because caught errors were unknown type ([73425ab](https://github.com/sciactive/nymphjs/commit/73425abb321263d96605f40397162b3e8a0ed1a8))

### Features

- migrate PubSub server ([b406b57](https://github.com/sciactive/nymphjs/commit/b406b570eb84617c2cc92184dfac3d4a0acf4b02))
- support conditional connection based on origin ([fec0102](https://github.com/sciactive/nymphjs/commit/fec010276756f80f28d6e60ca1755b873c980d76))
