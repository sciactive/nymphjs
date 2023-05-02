# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.0.0-beta.23](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.22...v1.0.0-beta.23) (2023-05-02)

### Bug Fixes

- rare case where currentUser isn't corrent ([97f233a](https://github.com/sciactive/nymphjs/commit/97f233a5fcfd4b97dd282562b0c99097ac3ef41d))

# [1.0.0-beta.22](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.21...v1.0.0-beta.22) (2023-05-01)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-beta.21](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.20...v1.0.0-beta.21) (2023-05-01)

### Features

- add totp two factor authentication ([cc9f8ed](https://github.com/sciactive/nymphjs/commit/cc9f8edb183271fa7f51e4b182b876efb8fa0f8d))

# [1.0.0-beta.20](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.19...v1.0.0-beta.20) (2023-04-30)

### Features

- let the user revoke all current auth tokens ([63af3b9](https://github.com/sciactive/nymphjs/commit/63af3b9a31c6c221ab40c2c8a69231675f4634a2))

# [1.0.0-beta.19](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.18...v1.0.0-beta.19) (2023-04-29)

### Bug Fixes

- some type issues ([ee69d5d](https://github.com/sciactive/nymphjs/commit/ee69d5d73361dacda5745d697df18fafd47810bc))

# [1.0.0-beta.18](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.17...v1.0.0-beta.18) (2023-04-27)

### Bug Fixes

- small type issues ([b91579c](https://github.com/sciactive/nymphjs/commit/b91579c9c1e96500d903332648f5a93c9a7e7d9b))

### Features

- add enforceTilmeld function ([130faf1](https://github.com/sciactive/nymphjs/commit/130faf151dcdfbfacd6814833868907dca037d24))
- add the ability to switch to a user without their password ([ca4466a](https://github.com/sciactive/nymphjs/commit/ca4466af1704d68905ac087350a8cf151c1072d9))
- forbid modifying ac props from client ([f9e896f](https://github.com/sciactive/nymphjs/commit/f9e896f6c57b08ae100bc50d33a0234b6a431333))
- remove access control bypass for sysadmins and ownerless entities, no longer needed ([345bbf4](https://github.com/sciactive/nymphjs/commit/345bbf4fd78a8f9d6d01fd0be8337854a1277ce6))

# [1.0.0-beta.17](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.16...v1.0.0-beta.17) (2023-04-24)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-beta.16](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.15...v1.0.0-beta.16) (2023-03-31)

### Features

- add ability to tell tilmeld to log in a specific user during authentication ([922e145](https://github.com/sciactive/nymphjs/commit/922e1452adae44bed2aa9655be16e19796acb39b))
- username check callback ([372e95c](https://github.com/sciactive/nymphjs/commit/372e95c39664c0d718e497ec1b09426e7cfa8862))

# [1.0.0-beta.15](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.14...v1.0.0-beta.15) (2023-03-23)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-beta.14](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.13...v1.0.0-beta.14) (2023-03-17)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-beta.13](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.12...v1.0.0-beta.13) (2023-03-16)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-beta.12](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.11...v1.0.0-beta.12) (2023-03-04)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-beta.11](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.10...v1.0.0-beta.11) (2023-02-27)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-beta.10](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.9...v1.0.0-beta.10) (2023-01-19)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-beta.9](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.8...v1.0.0-beta.9) (2023-01-09)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-beta.8](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.7...v1.0.0-beta.8) (2023-01-09)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-beta.7](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.6...v1.0.0-beta.7) (2023-01-05)

### Bug Fixes

- sqlite transaction returns wrong instance of nymph if it has been cloned ([b278c76](https://github.com/sciactive/nymphjs/commit/b278c7633722cb1cca7a941187ae2f1ff8ebdc7b))

# [1.0.0-beta.6](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.5...v1.0.0-beta.6) (2023-01-05)

### Bug Fixes

- extend class with correct nymph property when added to instance ([1d63f45](https://github.com/sciactive/nymphjs/commit/1d63f457c16de852322d81fd9fdc25e3eb841c8d))

### Features

- addEntityClass now returns the new class, which is required to use the class ([e752c3e](https://github.com/sciactive/nymphjs/commit/e752c3e50796656bdea8f8525932ede07c8a5378))

# [1.0.0-beta.5](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.4...v1.0.0-beta.5) (2022-11-24)

### Bug Fixes

- correctly check for system admin ability in incoming data ([e777902](https://github.com/sciactive/nymphjs/commit/e77790260bd7ca5331a9d1923dc7d4f3281749dc))

# [1.0.0-beta.4](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.3...v1.0.0-beta.4) (2022-11-23)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-beta.3](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.2...v1.0.0-beta.3) (2022-11-21)

### Bug Fixes

- don't run query callbacks asynchronously ([02ab89d](https://github.com/sciactive/nymphjs/commit/02ab89d174d6dd366e417d070672587937b4d4b3))

# [1.0.0-beta.2](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.1...v1.0.0-beta.2) (2022-11-21)

### Features

- migrate all callbacks to async so errors are properly caught ([7dc8241](https://github.com/sciactive/nymphjs/commit/7dc82411eab381ad81ece044d0998b0c0707749c))

# [1.0.0-beta.1](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.0...v1.0.0-beta.1) (2022-11-21)

### Bug Fixes

- adjust typescript targets to output node 16 code ([36f15a6](https://github.com/sciactive/nymphjs/commit/36f15a601362ed54f4465ef6527402c026bbcf61))

# [1.0.0-beta.0](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.43...v1.0.0-beta.0) (2022-11-16)

### Features

- update packages and fix issues, new guid package to use latest esm nanoid ([fd66aab](https://github.com/sciactive/nymphjs/commit/fd66aab465e6b1d83f4238bb16bc88d851ef5e92))

# [1.0.0-alpha.43](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.42...v1.0.0-alpha.43) (2022-03-07)

### Features

- allow custom email config on system emails ([b8f22bb](https://github.com/sciactive/nymphjs/commit/b8f22bb4c5420664ccff6bda754d5bd83be9b625))

# [1.0.0-alpha.42](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.41...v1.0.0-alpha.42) (2022-03-06)

### Bug Fixes

- attempt to fix failure again ([0f3c071](https://github.com/sciactive/nymphjs/commit/0f3c0717c881cec2b69f96cab53bb9543d46e604))

# [1.0.0-alpha.41](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.40...v1.0.0-alpha.41) (2022-03-06)

### Bug Fixes

- attempt to fix transaction failure with azure mysql ([b5f3c8d](https://github.com/sciactive/nymphjs/commit/b5f3c8dcde684c7589c2de592d415ab4561fc002))

# [1.0.0-alpha.40](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.39...v1.0.0-alpha.40) (2022-03-05)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.39](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.38...v1.0.0-alpha.39) (2022-03-05)

### Bug Fixes

- tilmeld after registration callbacks don't have login info ([1e98a9b](https://github.com/sciactive/nymphjs/commit/1e98a9b337e359763bc9baf290463e6da0373efe))

# [1.0.0-alpha.38](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.37...v1.0.0-alpha.38) (2022-02-10)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.37](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.36...v1.0.0-alpha.37) (2022-02-02)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.36](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.35...v1.0.0-alpha.36) (2022-01-26)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.35](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.34...v1.0.0-alpha.35) (2022-01-19)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.34](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.33...v1.0.0-alpha.34) (2022-01-08)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.33](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.32...v1.0.0-alpha.33) (2022-01-08)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.32](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.31...v1.0.0-alpha.32) (2022-01-08)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.31](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.30...v1.0.0-alpha.31) (2022-01-08)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.30](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.29...v1.0.0-alpha.30) (2022-01-07)

### Features

- await for callbacks on registration ([d1e2f03](https://github.com/sciactive/nymphjs/commit/d1e2f03f3c8e03e6fd7cef892eda61e9d222e1fc))

# [1.0.0-alpha.29](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.28...v1.0.0-alpha.29) (2022-01-07)

### Features

- add additionalData in register and login data ([b906cd6](https://github.com/sciactive/nymphjs/commit/b906cd66715098019ca55c3562de72cbf7669ca7))

# [1.0.0-alpha.28](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.27...v1.0.0-alpha.28) (2022-01-07)

### Features

- add callbacks for user registration, login, and logout ([0dd621e](https://github.com/sciactive/nymphjs/commit/0dd621e85d082b9a753cafae16a120620b41164e))

# [1.0.0-alpha.27](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.26...v1.0.0-alpha.27) (2022-01-05)

### Features

- update smui to latest versions ([7ed7bd3](https://github.com/sciactive/nymphjs/commit/7ed7bd34d01a155c7001a2671de25ef2f3363682))

# [1.0.0-alpha.26](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.25...v1.0.0-alpha.26) (2021-12-30)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.25](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.24...v1.0.0-alpha.25) (2021-12-30)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.24](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.23...v1.0.0-alpha.24) (2021-12-30)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.23](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.22...v1.0.0-alpha.23) (2021-12-30)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.22](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.21...v1.0.0-alpha.22) (2021-12-14)

### Features

- update smui to latest versions ([912873b](https://github.com/sciactive/nymphjs/commit/912873b863d1ae5d51c359a3c0558bff38ce85cd))

# [1.0.0-alpha.21](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.20...v1.0.0-alpha.21) (2021-11-29)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.20](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.19...v1.0.0-alpha.20) (2021-11-24)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.19](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.18...v1.0.0-alpha.19) (2021-11-18)

### Features

- update smui and other packages to latest versions ([2465340](https://github.com/sciactive/nymphjs/commit/24653400d887bc04c41c3c4ee0c73ce2f2289e0d))

# [1.0.0-alpha.18](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.17...v1.0.0-alpha.18) (2021-11-09)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.17](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.16...v1.0.0-alpha.17) (2021-10-14)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.16](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.15...v1.0.0-alpha.16) (2021-10-14)

### Bug Fixes

- don't ignore built files in npm packages ([7d688db](https://github.com/sciactive/nymphjs/commit/7d688dbec362f1f71fb451a1d0dbcaecc15d99fc))

# [1.0.0-alpha.15](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.14...v1.0.0-alpha.15) (2021-10-14)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.14](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.13...v1.0.0-alpha.14) (2021-10-14)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.13](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.12...v1.0.0-alpha.13) (2021-10-14)

### Bug Fixes

- tilmeld not adding permission checks correctly ([ddeb3d1](https://github.com/sciactive/nymphjs/commit/ddeb3d155af971a89fb1403c34530826448af2b8))

# [1.0.0-alpha.12](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.11...v1.0.0-alpha.12) (2021-10-13)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.11](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.10...v1.0.0-alpha.11) (2021-10-13)

**Note:** Version bump only for package @nymphjs/tilmeld

# [1.0.0-alpha.10](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.9...v1.0.0-alpha.10) (2021-10-12)

### Bug Fixes

- tilmeld permission checks ([ec8c585](https://github.com/sciactive/nymphjs/commit/ec8c5858c8d3d380cfdb76f606c63475d22d7842))

# [1.0.0-alpha.9](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.8...v1.0.0-alpha.9) (2021-10-12)

### Bug Fixes

- data protection was using the same array instances ([d456e61](https://github.com/sciactive/nymphjs/commit/d456e61be316b9abe7fb391b232412222e7d748f))

# [1.0.0-alpha.8](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.7...v1.0.0-alpha.8) (2021-10-12)

### Bug Fixes

- server not running potentially important delete functions ([ce7521d](https://github.com/sciactive/nymphjs/commit/ce7521d89ca655f72f6842abf25c2817ce7b1513))

# [1.0.0-alpha.7](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.6...v1.0.0-alpha.7) (2021-10-05)

### Bug Fixes

- tilmeld group check on entities ([d55c43b](https://github.com/sciactive/nymphjs/commit/d55c43b16dde9a7a88c347db542987f0df9553d6))

# [1.0.0-alpha.6](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.5...v1.0.0-alpha.6) (2021-10-05)

### Bug Fixes

- tilmeld instance in access control functions ([7965df8](https://github.com/sciactive/nymphjs/commit/7965df8ea8cbbad7efa77ce8fe8b0f3061ac3c44))

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
