# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.0.0-alpha.5](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.4...v1.0.0-alpha.5) (2021-09-30)

### Features

- provide Joi prop checks for Nymph and Tilmeld as exports ([8180861](https://github.com/sciactive/nymphjs/commit/8180861c6631f7fd25a2d2a3c57924b8f4147cf3))

# [1.0.0-alpha.4](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.3...v1.0.0-alpha.4) (2021-09-27)

### Features

- gate UIDs on Tilmeld with config and abilities ([99a9141](https://github.com/sciactive/nymphjs/commit/99a9141cc92fe3d1ad68d21e42de4e9b5493e4d9))
- use new instances of nymph for server and pubsub requests ([0c18fab](https://github.com/sciactive/nymphjs/commit/0c18faba2b55fe82c16806d221fc54d2cd42c992))

# [1.0.0-alpha.3](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.2...v1.0.0-alpha.3) (2021-09-22)

### Features

- move to fully instance based design, no more globals ([c036220](https://github.com/sciactive/nymphjs/commit/c0362209b90a475b8b85269a829b0ec6bed4465f))

# [1.0.0-alpha.2](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) (2021-09-21)

### Features

- allow multiple instances of Nymph, including transactional instances ([8ff8bcf](https://github.com/sciactive/nymphjs/commit/8ff8bcf4d549998faa2b3d86440394d75bcdc202))
- implement qref selector clause ([7763324](https://github.com/sciactive/nymphjs/commit/776332482ec91f15b62a4b59d3f6ca97d1f16b99))

# 1.0.0-alpha.1 (2021-09-06)

### Bug Fixes

- ability granting and level calculation with regard to disabled groups ([8c3c17b](https://github.com/sciactive/nymphjs/commit/8c3c17bf4e7f10e59260f2ca700b36fb36bead25))
- export all defaults also as named exports ([7555190](https://github.com/sciactive/nymphjs/commit/7555190e24ea4d8cf5f2a79cab6944661cf8f609))
- gatekeeper should always return a boolean ([d3f9c7f](https://github.com/sciactive/nymphjs/commit/d3f9c7f3cbef76bb5de9696ec19970773499838c))
- new user email used wrong name ([e092f3f](https://github.com/sciactive/nymphjs/commit/e092f3f770457d39b22f234f9e227b05f8a61237))
- tilmeld register and login ([99b12d2](https://github.com/sciactive/nymphjs/commit/99b12d2799d8ccf2d8fb7bdb3e3b86051e7e7f88))
- typescript errors because caught errors were unknown type ([73425ab](https://github.com/sciactive/nymphjs/commit/73425abb321263d96605f40397162b3e8a0ed1a8))

### Features

- added user and group validation functions ([cc4704e](https://github.com/sciactive/nymphjs/commit/cc4704e06162d580dfd7672602060814b294fa66))
- began migrating Tilmeld ([f44013b](https://github.com/sciactive/nymphjs/commit/f44013b7436272baa49d3920c814aa32676e2156))
- finish migrating Tilmeld User class ([f40afa6](https://github.com/sciactive/nymphjs/commit/f40afa63fe03988251dcd76752d41254c233a966))
- finished migrating Tilmeld user/group system ([8074b74](https://github.com/sciactive/nymphjs/commit/8074b74b58dba9d87f1f87cef09d3ca0befaafac))
- finished personal account registration and management ([b7d0935](https://github.com/sciactive/nymphjs/commit/b7d09358ce6055abe721aace9b8d797d6b95ac50))
- finished Tilmeld setup/admin app. fixed some user/group issues ([1c51dd5](https://github.com/sciactive/nymphjs/commit/1c51dd52768b14f6f6674f6d06001c883b46ef51))
- implement query parser on primary and secondary group search ([3fea057](https://github.com/sciactive/nymphjs/commit/3fea057f646296541d47adf18b96920afc795ca9))
- implement Tilmeld auth with cookies/headers ([6caf280](https://github.com/sciactive/nymphjs/commit/6caf2804ca72df2a80a62d61077129e3a53d6dae))
- migrated Tilmeld client ([fc7e380](https://github.com/sciactive/nymphjs/commit/fc7e3809949630f92177ca295c06771985815cb4))
