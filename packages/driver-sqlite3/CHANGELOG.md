# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.0.0-alpha.4](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.3...v1.0.0-alpha.4) (2021-09-27)

**Note:** Version bump only for package @nymphjs/driver-sqlite3

# [1.0.0-alpha.3](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.2...v1.0.0-alpha.3) (2021-09-22)

### Features

- move to fully instance based design, no more globals ([c036220](https://github.com/sciactive/nymphjs/commit/c0362209b90a475b8b85269a829b0ec6bed4465f))

# [1.0.0-alpha.2](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) (2021-09-21)

### Features

- allow multiple instances of Nymph, including transactional instances ([8ff8bcf](https://github.com/sciactive/nymphjs/commit/8ff8bcf4d549998faa2b3d86440394d75bcdc202))
- implement qref selector clause ([7763324](https://github.com/sciactive/nymphjs/commit/776332482ec91f15b62a4b59d3f6ca97d1f16b99))
- migrate PostgreSQL driver ([7cbe71b](https://github.com/sciactive/nymphjs/commit/7cbe71bd48bc5e70f292e2babdf7adff96ac0b93))

# 1.0.0-alpha.1 (2021-09-06)

### Bug Fixes

- don't attempt to save undefined props and only report query in dev mode ([f18a3f8](https://github.com/sciactive/nymphjs/commit/f18a3f8ff7dd0a7bd1be6853fe15cb2be56cfd68))
- export all defaults also as named exports ([7555190](https://github.com/sciactive/nymphjs/commit/7555190e24ea4d8cf5f2a79cab6944661cf8f609))
- pubsub server and client are working now. needs more tests ([add109c](https://github.com/sciactive/nymphjs/commit/add109cfa7e9476a7925c80ab8f3f74e89112756))
- throw error when transaction is attempted without a name ([28ad2ca](https://github.com/sciactive/nymphjs/commit/28ad2cadc3a1172abec44e12f1b8b777f6659b50))
- typescript errors because caught errors were unknown type ([73425ab](https://github.com/sciactive/nymphjs/commit/73425abb321263d96605f40397162b3e8a0ed1a8))

### Features

- finished migrating Tilmeld user/group system ([8074b74](https://github.com/sciactive/nymphjs/commit/8074b74b58dba9d87f1f87cef09d3ca0befaafac))
- nested and named transactions ([858ba43](https://github.com/sciactive/nymphjs/commit/858ba434cd752817a8054bb2a83ba26a978c4107))
- support ad hoc transactions and don't duplicate string and number data ([efd7e9d](https://github.com/sciactive/nymphjs/commit/efd7e9de9dd89a4bfb2ee603ba94337e954408b4))
