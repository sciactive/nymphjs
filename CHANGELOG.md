# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.0.0-beta.99](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.98...v1.0.0-beta.99) (2025-11-26)

### Bug Fixes

- add check for tokens table to needsMigration functions ([ebffa66](https://github.com/sciactive/nymphjs/commit/ebffa6671d040c5064f0e47193ba14e2e115796a))
- refresh user and group before user delete ([dee2444](https://github.com/sciactive/nymphjs/commit/dee2444d99a187e9a90c98fe514eb6a8d4fbb7fd))
- update tokenizer and fix issue with tilmeld test ([1df81fd](https://github.com/sciactive/nymphjs/commit/1df81fdeab2c639dc669bd92c09faa220bb9a6ff))

### Features

- add full-text-search, but this is interim and will be redesigned ([56333db](https://github.com/sciactive/nymphjs/commit/56333dbe6a25755baed4e108ba4d71b3187fe8d0))
- add live migration and token import functions ([b81037d](https://github.com/sciactive/nymphjs/commit/b81037d5d9fd0676e98760d51dcdc3e414951287))
- add sciactive tokenizer based full text search ([173c96e](https://github.com/sciactive/nymphjs/commit/173c96e02827e8ca155f55e08f33e8cdef475ab9))
- clean up old fts code, get ready for new implementation ([e8d7a6d](https://github.com/sciactive/nymphjs/commit/e8d7a6d6c6cdbb3dd74bd3e6a104e02a4caf283b))

# [1.0.0-beta.98](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.97...v1.0.0-beta.98) (2025-10-24)

### Bug Fixes

- node client dependency ([574a20f](https://github.com/sciactive/nymphjs/commit/574a20f02b480b840d49d886184512a40665eab3))

### Features

- add identical resolver options to sorter ([7710dea](https://github.com/sciactive/nymphjs/commit/7710deac439134fc14eaf0ed9fdecaa2d62609f0))
- add new indexes for better access control performance ([f76b001](https://github.com/sciactive/nymphjs/commit/f76b001c07aea38f21cb5a3373ad5a9eaadbb242))

# [1.0.0-beta.97](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.96...v1.0.0-beta.97) (2025-10-04)

### Bug Fixes

- add missing rollback ([8763ecb](https://github.com/sciactive/nymphjs/commit/8763ecbc0ad2bfa9ac302c9e72262e45f8383548))
- more query parser issues ([38e9cfb](https://github.com/sciactive/nymphjs/commit/38e9cfb2f77f4696d601361825183493bba99065))
- npm audit fix ([108e377](https://github.com/sciactive/nymphjs/commit/108e3777f93fdfd8b7b842885f26f74f948bdcfb))
- password verify on user edit page when password is empty ([bf797f7](https://github.com/sciactive/nymphjs/commit/bf797f77cc08f73731b9e20e413be6e7c0cec213))
- query parser issues ([1760e15](https://github.com/sciactive/nymphjs/commit/1760e15b252781cc745b9310f25ef73734b4b10e))
- variable names and complex json in query parser ([7e475d3](https://github.com/sciactive/nymphjs/commit/7e475d3ef997c8ddd245b2f14c033e3fdda2d4bd))

# [1.0.0-beta.96](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.95...v1.0.0-beta.96) (2025-09-01)

### Bug Fixes

- add ilike clauses to checkdata ([da77767](https://github.com/sciactive/nymphjs/commit/da777674b299b3c9de2e65cf3e9a408e193874cb))

# [1.0.0-beta.95](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.94...v1.0.0-beta.95) (2025-08-30)

### Features

- add a delay when a login attempt fails ([93e6d3f](https://github.com/sciactive/nymphjs/commit/93e6d3f79a077b102b04fd1155ffd1b81cf262e1))

# [1.0.0-beta.94](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.93...v1.0.0-beta.94) (2025-08-25)

### Features

- add returnNullOnNotFound client option, and some tilmeld domain checks ([20c0207](https://github.com/sciactive/nymphjs/commit/20c0207ef537a948f84f830f1db88d207e1c386b))

# [1.0.0-beta.93](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.92...v1.0.0-beta.93) (2025-08-16)

### Features

- add access control data types to tilmeld client ([65a4d3c](https://github.com/sciactive/nymphjs/commit/65a4d3c2217b8e25c909fea689f62d2732930896))

# [1.0.0-beta.92](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.91...v1.0.0-beta.92) (2025-04-06)

### Bug Fixes

- wait for an event loop after each iteration of server iterator to allow data to flush ([c0822ad](https://github.com/sciactive/nymphjs/commit/c0822ad3b7ebe56eb85915f4d950a9f656c5862a))

### Features

- add 'object' return type which returns plain entity data objects ([26a4cd3](https://github.com/sciactive/nymphjs/commit/26a4cd3226145408dc34bff52b1eafe3b046313b))

# [1.0.0-beta.91](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.90...v1.0.0-beta.91) (2025-03-07)

### Features

- add callbacks for user and group save and delete ([8119127](https://github.com/sciactive/nymphjs/commit/81191276fe1884e5ee65f41815fc72a23cf1e2f2))

# [1.0.0-beta.90](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.89...v1.0.0-beta.90) (2025-02-09)

### Bug Fixes

- don't turn new entities to references in json ([40bd388](https://github.com/sciactive/nymphjs/commit/40bd388279c80c7094a9150058031122142e30c4))

# [1.0.0-beta.89](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.88...v1.0.0-beta.89) (2025-02-09)

### Bug Fixes

- use guaranteed guid in references, update generated primary group code ([5f22f8a](https://github.com/sciactive/nymphjs/commit/5f22f8a9c71f373251cd4946c465fa29b86d91e7))

# [1.0.0-beta.88](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.87...v1.0.0-beta.88) (2025-01-30)

### Bug Fixes

- allow removing pubsub publisher ([10fa223](https://github.com/sciactive/nymphjs/commit/10fa22322447d9295ed06413f19b9c86adb4c4ab))
- don't mutate buffers and typed arrays when converting references ([e605056](https://github.com/sciactive/nymphjs/commit/e605056603839ed42c12769b621495ebe616b970))

# [1.0.0-beta.87](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.86...v1.0.0-beta.87) (2025-01-20)

### Features

- add a guaranteed GUID method for unsaved entities ([db00960](https://github.com/sciactive/nymphjs/commit/db009607a08743682a22ded38ad0802f1534b3fa))
- deprecate node client and allow multiple client instances to each log in own users ([17b42f4](https://github.com/sciactive/nymphjs/commit/17b42f449f2355a3ce896b8e86a47edd660e9277))

# [1.0.0-beta.86](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.85...v1.0.0-beta.86) (2024-12-28)

### Bug Fixes

- entity search functions handling of null values ([6ac0335](https://github.com/sciactive/nymphjs/commit/6ac0335ecb792979ecfb621395a55b68a607429f))

### Features

- add domain support ([c965008](https://github.com/sciactive/nymphjs/commit/c96500811a4d64ab4e80eca6acdfbfdfae1de076))

# [1.0.0-beta.85](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.84...v1.0.0-beta.85) (2024-12-27)

### Bug Fixes

- inTransaction could incorrectly report transaction state ([a7e2ca5](https://github.com/sciactive/nymphjs/commit/a7e2ca57f5b19e9b5b2a04dcc8b79e3937db20e5))

# [1.0.0-beta.84](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.83...v1.0.0-beta.84) (2024-12-21)

### Features

- add option to update mdate by a specific number ([b94995e](https://github.com/sciactive/nymphjs/commit/b94995e8daf5a02bd8464ae9a5ddfe6771e0d861))

# [1.0.0-beta.83](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.82...v1.0.0-beta.83) (2024-12-20)

### Bug Fixes

- flaky pubsub tests ([b580f78](https://github.com/sciactive/nymphjs/commit/b580f78461d78c11682dc2bba99dc5a8d82f6f5b))

### Features

- add option to turn off mdate updates ([778885b](https://github.com/sciactive/nymphjs/commit/778885bcbe2482eba443273073b10a092167d17c))

# [1.0.0-beta.82](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.81...v1.0.0-beta.82) (2024-12-15)

### Bug Fixes

- use async generator for data export in postgres to solve out of memory issue ([25abf2a](https://github.com/sciactive/nymphjs/commit/25abf2a30b401a6d5d0fe42e057176ed258e4e29))

### Features

- migrate to es modules, upgrade all packages, migrate to Svelte 5 ([3f2b9e5](https://github.com/sciactive/nymphjs/commit/3f2b9e517b39934eddce66601d7fc747fbf3f9e6))

# [1.0.0-beta.81](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.80...v1.0.0-beta.81) (2024-09-28)

### Features

- add index to json column in mysql ([afe684f](https://github.com/sciactive/nymphjs/commit/afe684ffe54b105e878a8aa5324085bb6571966e))

# [1.0.0-beta.80](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.79...v1.0.0-beta.80) (2024-09-28)

### Bug Fixes

- more mysql json queries ([33a72e6](https://github.com/sciactive/nymphjs/commit/33a72e679c02a4f49a6fa232305c4228841754d3))

# [1.0.0-beta.79](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.78...v1.0.0-beta.79) (2024-09-28)

### Bug Fixes

- mysql equal clause with null value ([63fce80](https://github.com/sciactive/nymphjs/commit/63fce80cc9461027664d0a2e83bf14e4aee2bfbb))

# [1.0.0-beta.78](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.77...v1.0.0-beta.78) (2024-09-27)

### Bug Fixes

- another flaky test ([0825249](https://github.com/sciactive/nymphjs/commit/082524955a3aea87d38bae3710f710d4b12d499c))
- don't use transactions for import, to avoid issues when creating tables ([2f8f715](https://github.com/sciactive/nymphjs/commit/2f8f71545de6ca2f3235a9f3a3c91107f58129bf))
- flaky test ([8098714](https://github.com/sciactive/nymphjs/commit/8098714026c92c9b97917a766b0f9453b0804699))
- hopefully fix flaky test ([bc746f0](https://github.com/sciactive/nymphjs/commit/bc746f077243502fa749be3bc5b1baf2bab511e5))
- potential bug with nulls in postgres ([1d8bc50](https://github.com/sciactive/nymphjs/commit/1d8bc500d752b1ef59d6591f3045bf4976eb7c00))

### Features

- add json column to mysql and store json values there ([542d762](https://github.com/sciactive/nymphjs/commit/542d762c6f6f41bfbbe775c859e1d9df0990042b))
- add json column to sqlite and store json values there ([55a8a84](https://github.com/sciactive/nymphjs/commit/55a8a840fb7d23561d60fda602c410b79f76b0da))
- add method to detect if migration is needed ([274f7c3](https://github.com/sciactive/nymphjs/commit/274f7c39aa4e0d251a38c01593775e1270fc9621))
- move comparison fields to data table and remove comparison table ([3d7fe7e](https://github.com/sciactive/nymphjs/commit/3d7fe7e614327ecf8903ee7143e559549793e8fc))

### BREAKING CHANGES

- This is a breaking change, and requires export and
  import of the database if you are using the SQLite driver.
- This is a breaking change, and requires export and
  import of the database if you are using the MySQL driver.
- This is a breaking change, and requires export and
  import of the database.

# [1.0.0-beta.77](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.76...v1.0.0-beta.77) (2024-09-26)

### Bug Fixes

- broken queries where param wasn't preceded by at sign ([de183bf](https://github.com/sciactive/nymphjs/commit/de183bf1ab440ee34a7b27b51c42867e9c035bc4))

# [1.0.0-beta.76](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.75...v1.0.0-beta.76) (2024-09-25)

### Features

- add info level logging and log queries at this level ([afad941](https://github.com/sciactive/nymphjs/commit/afad941f46c4e594f0981de6443e4dd0b9ffdf4c))
- add json column to postgres and store json values there ([b9ccfd8](https://github.com/sciactive/nymphjs/commit/b9ccfd8d4877870d2662c60423e916ddf46244b2))

### BREAKING CHANGES

- This is a breaking change, and requires export and
  import of the database if you are using the Postgres driver.

# [1.0.0-beta.75](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.74...v1.0.0-beta.75) (2024-09-24)

### Bug Fixes

- shrink btree index and use trigram index in postgres to support very long strings ([7f7bc78](https://github.com/sciactive/nymphjs/commit/7f7bc783f1daf04f443ae12dc2139d45a5570cb9))

# [1.0.0-beta.74](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.73...v1.0.0-beta.74) (2024-09-21)

### Bug Fixes

- make sure tags don't contain empty strings when pulled from the db ([b67382f](https://github.com/sciactive/nymphjs/commit/b67382f3e23e616696373366d25148b8f2b93a47))

# [1.0.0-beta.73](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.72...v1.0.0-beta.73) (2024-09-20)

### Bug Fixes

- optimize another mysql query ([33d06f4](https://github.com/sciactive/nymphjs/commit/33d06f461a5557e80fe8f6fbd5bccc349a066b13))

# [1.0.0-beta.72](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.71...v1.0.0-beta.72) (2024-09-20)

### Bug Fixes

- optimize qref queries the same way ([6fcd92f](https://github.com/sciactive/nymphjs/commit/6fcd92f3289b2762fdf4549a88e80e4918cf8e19))
- postgres count queries with limit or offset ([edd586e](https://github.com/sciactive/nymphjs/commit/edd586e3e8c7f80093a258a9c328b7a298c555d7))

# [1.0.0-beta.71](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.70...v1.0.0-beta.71) (2024-09-20)

### Bug Fixes

- optimize mysql and sqlite queries the same way ([91d0abd](https://github.com/sciactive/nymphjs/commit/91d0abd3bbaeeb673a1bd0181eceb7cfb77da4d8))

# [1.0.0-beta.70](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.69...v1.0.0-beta.70) (2024-09-20)

### Bug Fixes

- optimize postgres queries ([764c95c](https://github.com/sciactive/nymphjs/commit/764c95c626290204b162245892e93c14bffd46a6))

# [1.0.0-beta.69](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.68...v1.0.0-beta.69) (2024-09-19)

### Bug Fixes

- create postgres tables outside of transaction ([d95e320](https://github.com/sciactive/nymphjs/commit/d95e32025432540fea3523d8a6c6081122d5fc14))

# [1.0.0-beta.68](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.67...v1.0.0-beta.68) (2024-09-19)

### Features

- add more indexes for postgres and sqlite ([704993e](https://github.com/sciactive/nymphjs/commit/704993ef10f049a886c36de15827736ef5d54c78))

# [1.0.0-beta.67](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.66...v1.0.0-beta.67) (2024-09-03)

### Bug Fixes

- include modifications to subquery selectors from query callbacks ([dc73455](https://github.com/sciactive/nymphjs/commit/dc73455fe05867d2b38f1ea84e139ae57acb5ebb))
- remove index hinting from mysql driver ([0aff4a8](https://github.com/sciactive/nymphjs/commit/0aff4a8dab33952c1ce5b2d710dd7a7854352f75))

# [1.0.0-beta.66](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.65...v1.0.0-beta.66) (2024-08-06)

### Bug Fixes

- improve performance of loading an entity's ac values ([8f716ae](https://github.com/sciactive/nymphjs/commit/8f716ae8208e2b8e5ffa1ebe4e28a6f09dd49c6a))

# [1.0.0-beta.65](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.64...v1.0.0-beta.65) (2024-08-05)

### Bug Fixes

- hsort exponential time complexity ([47dc370](https://github.com/sciactive/nymphjs/commit/47dc370a88478dfb7fbfa2d6a257427395451013))

# [1.0.0-beta.64](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.63...v1.0.0-beta.64) (2024-08-04)

### Bug Fixes

- correctly split lines in importData ([121aa11](https://github.com/sciactive/nymphjs/commit/121aa1105942b275c94e7c7b8c083579d233b330))

### Features

- add more mysql indexes to speed up certain queries ([9ac5004](https://github.com/sciactive/nymphjs/commit/9ac50048d2e3ddbe3d918f000772dcd655ff236d))
- fix and add more mysql indexes ([0f0f475](https://github.com/sciactive/nymphjs/commit/0f0f47506312d7b86c3826e22aeac27e1f04339f))
- use index for ordering by cdate and mdate, speeding up many queries ([d5d2f3c](https://github.com/sciactive/nymphjs/commit/d5d2f3c081b5c2ad7586b5b1ae0ebe45937e501b))

# [1.0.0-beta.63](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.62...v1.0.0-beta.63) (2024-06-18)

### Bug Fixes

- undo ts compilation to module change ([84be6d4](https://github.com/sciactive/nymphjs/commit/84be6d434be29f8afd53907d15be2eb77d1736ce))

### Features

- allow importing from text and iterables ([9d766bd](https://github.com/sciactive/nymphjs/commit/9d766bdad4b0f17bc2dd68b0336a0064857eb4e9))
- export data iterator ([b86aa19](https://github.com/sciactive/nymphjs/commit/b86aa19fc77d744b5a683046dfb697fc4746df5c))

# [1.0.0-beta.62](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.61...v1.0.0-beta.62) (2024-06-15)

### Bug Fixes

- assign generated and default groups to users created through admin app ([7ea0baa](https://github.com/sciactive/nymphjs/commit/7ea0baaf3a2c1285a63ee95ec153f38c169af6b6))
- update test with new error message ([05afe42](https://github.com/sciactive/nymphjs/commit/05afe42470d975278858edbe65ec1b29c1c43207))

### Features

- use unique constraint to guarantee username, groupname, and email uniqueness ([eff5cc4](https://github.com/sciactive/nymphjs/commit/eff5cc43fbbf31e66ede17f42d38de07a0344ede))

# [1.0.0-beta.61](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.60...v1.0.0-beta.61) (2024-06-14)

### Bug Fixes

- clear transaction in mysql when tables are created ([9fd8d8f](https://github.com/sciactive/nymphjs/commit/9fd8d8fa219e47a08fcf4a69235521858de1b751))

# [1.0.0-beta.60](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.59...v1.0.0-beta.60) (2024-06-14)

**Note:** Version bump only for package nymphjs

# [1.0.0-beta.59](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.58...v1.0.0-beta.59) (2024-06-14)

### Features

- add uniqueness constraint feature, refactor some types ([8133d32](https://github.com/sciactive/nymphjs/commit/8133d32b2c04907182dca2e9171b8217ed1b57e4))

# [1.0.0-beta.58](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.57...v1.0.0-beta.58) (2024-06-12)

**Note:** Version bump only for package nymphjs

# [1.0.0-beta.57](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.56...v1.0.0-beta.57) (2024-06-12)

### Features

- add debug logs to tilmeld ([52dfc26](https://github.com/sciactive/nymphjs/commit/52dfc26f41401b5fe17807158d79e8ccba3ed280))

# [1.0.0-beta.56](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.55...v1.0.0-beta.56) (2024-06-11)

### Bug Fixes

- import entities without transaction ([db56609](https://github.com/sciactive/nymphjs/commit/db56609efaadc16d5d1bbc8e9b50084aa8a076b9))
- use HttpError in tilmeld ([13893d5](https://github.com/sciactive/nymphjs/commit/13893d5b27f8540c1ed6a8d75a39ce6e0c638b93))

### Features

- add debug and error logging feature ([95680ef](https://github.com/sciactive/nymphjs/commit/95680efad0a260589f32e3d8cff0f4c4e7de413b))
- allow connections where tokens are not renewed ([39071a5](https://github.com/sciactive/nymphjs/commit/39071a545644075190bd8213be25e0a0c46d2b5d))
- make transaction optional during import and off by default ([08d79f8](https://github.com/sciactive/nymphjs/commit/08d79f8f803c846ac79c0c489fc754437dae082b))

# [1.0.0-beta.55](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.54...v1.0.0-beta.55) (2024-05-26)

### Bug Fixes

- cache check with no selectors ([f3a6215](https://github.com/sciactive/nymphjs/commit/f3a6215c7b1443f039b979ed400823c6f7f88236))

# [1.0.0-beta.54](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.53...v1.0.0-beta.54) (2024-05-26)

### Features

- add index to comparison string column in sqlite3 ([330a3e1](https://github.com/sciactive/nymphjs/commit/330a3e16997b8f6a69dc85fe124ac3a826a3abd9))

# [1.0.0-beta.53](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.52...v1.0.0-beta.53) (2024-05-26)

### Features

- add pragma statements config to sqlite3 driver ([b0f27e2](https://github.com/sciactive/nymphjs/commit/b0f27e24df85663ea777565e5d352775efcad858))

# [1.0.0-beta.52](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.51...v1.0.0-beta.52) (2024-05-25)

### Bug Fixes

- support setup app and users and groups when userFields is limited ([20e25a2](https://github.com/sciactive/nymphjs/commit/20e25a2bcc35f96b3146fd9d973e34083a85f854))

# [1.0.0-beta.51](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.50...v1.0.0-beta.51) (2024-04-12)

### Bug Fixes

- query parser nested qref clauses ([10bd94d](https://github.com/sciactive/nymphjs/commit/10bd94df0329a3abc76cecb9d05f9a7fb2fdf29a))

# [1.0.0-beta.50](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.49...v1.0.0-beta.50) (2024-04-08)

### Bug Fixes

- run beforeRegister callbacks within the registration transaction ([0c50329](https://github.com/sciactive/nymphjs/commit/0c503299d8bee5bba323e23e34583b9b59823af5))

# [1.0.0-beta.49](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.48...v1.0.0-beta.49) (2024-03-04)

### Bug Fixes

- change some jwt defaults and fix nbf date ([cff5f38](https://github.com/sciactive/nymphjs/commit/cff5f38da6c1624b3fc27655e3601f409f8b86c2))

# [1.0.0-beta.48](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.47...v1.0.0-beta.48) (2023-11-10)

### Bug Fixes

- avoid trying to roll back a transaction twice ([e26ef31](https://github.com/sciactive/nymphjs/commit/e26ef312b617edcc715c81e7f92875dfaa7a904a))

# [1.0.0-beta.47](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.46...v1.0.0-beta.47) (2023-11-10)

### Bug Fixes

- nymph stays in a new transaction on the parent instance ([1857046](https://github.com/sciactive/nymphjs/commit/185704666715162d8482326eaba7c2532297432c))

# [1.0.0-beta.46](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.45...v1.0.0-beta.46) (2023-08-29)

### Bug Fixes

- make the name even much more correct this time ([8d0b381](https://github.com/sciactive/nymphjs/commit/8d0b3817925ce9b1de21d2f9248f6cdec0f7d3f0))
- secure cookies ([85d3ca4](https://github.com/sciactive/nymphjs/commit/85d3ca49f9ecdcdbaf68fee6639c3e77a4aeb109))

### Features

- add minimum username length ([fcb317a](https://github.com/sciactive/nymphjs/commit/fcb317ad8f758a89b1b24f377b506e8a38f9ad41))
- enable tilmeld admins to remove totp secret from users ([18455b3](https://github.com/sciactive/nymphjs/commit/18455b3edbbfa1188f8cf317438bbfa028ba8f47))

# [1.0.0-beta.45](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.44...v1.0.0-beta.45) (2023-07-17)

### Bug Fixes

- missing pubsub updates when new top level match uses qref with multiple results ([6dc26e2](https://github.com/sciactive/nymphjs/commit/6dc26e280453794ea9ce6c2b77482f85eb62bd23))

# [1.0.0-beta.44](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.43...v1.0.0-beta.44) (2023-07-13)

### Bug Fixes

- wake before gatekeeper check ([1b7e985](https://github.com/sciactive/nymphjs/commit/1b7e985c41bd758c478503b9e51efcc2df5e6a91))

# [1.0.0-beta.43](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.42...v1.0.0-beta.43) (2023-07-12)

### Bug Fixes

- update calls to gatekeeper to not use await ([ad36172](https://github.com/sciactive/nymphjs/commit/ad361725b67054aeb9e8e1c1a221c8e150a2c737))

# [1.0.0-beta.42](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.41...v1.0.0-beta.42) (2023-07-12)

### Features

- make fillSession async so that gatekeeper can be sync ([fb6def4](https://github.com/sciactive/nymphjs/commit/fb6def45cd031516c9bcd3438f905e2ff881707b))

# [1.0.0-beta.41](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.40...v1.0.0-beta.41) (2023-07-12)

### Features

- remove synchronous database queries ([b579fb2](https://github.com/sciactive/nymphjs/commit/b579fb2eacd96cdd1b386a62c5c00cdbb2438f6e))
- rewrite server side async api to match client side api ([9c537a8](https://github.com/sciactive/nymphjs/commit/9c537a8be49e9b989af0822a4c2236e8c2d20f87))

# [1.0.0-beta.40](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.39...v1.0.0-beta.40) (2023-07-10)

### Bug Fixes

- rewrite updateArray function to fix it ([22185c7](https://github.com/sciactive/nymphjs/commit/22185c7627f6dc616f9d3187ee8c9a383ca71441))

# [1.0.0-beta.39](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.38...v1.0.0-beta.39) (2023-07-09)

### Bug Fixes

- go back to older code for updateArray, but better number handling ([7a58c98](https://github.com/sciactive/nymphjs/commit/7a58c983eac73839544361b4d32fb2dbb0881da2))

# [1.0.0-beta.38](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.37...v1.0.0-beta.38) (2023-07-09)

### Bug Fixes

- pull value from the array in updateArray function ([352d1ea](https://github.com/sciactive/nymphjs/commit/352d1eab0cf8868f672ce0350564eb75ac9d4a45))
- simplify updateArray code ([348154c](https://github.com/sciactive/nymphjs/commit/348154c4d42b1e2b54bc491c1588a59c7c48984c))

# [1.0.0-beta.37](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.36...v1.0.0-beta.37) (2023-07-09)

### Bug Fixes

- correctly iterate through new arrays on updateArray pubsub method ([27d7cc8](https://github.com/sciactive/nymphjs/commit/27d7cc847d93300e3d76cf6fa528176c3d06ae67))

# [1.0.0-beta.36](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.35...v1.0.0-beta.36) (2023-07-09)

### Bug Fixes

- use code 1000 for closing pubsub connection ([cbd56af](https://github.com/sciactive/nymphjs/commit/cbd56af98d0775dee36025d909a82a0af0633d72))

# [1.0.0-beta.35](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.34...v1.0.0-beta.35) (2023-06-14)

### Bug Fixes

- get class from nymph instead of using constructor ([fc8538e](https://github.com/sciactive/nymphjs/commit/fc8538ea24be79b845ab1e00f930542f34517bfb))

### Features

- add iteratable server call support using event streams ([fa7c1ec](https://github.com/sciactive/nymphjs/commit/fa7c1ec869e1fb52db20c8245e98a681f73dbf83))

# [1.0.0-beta.34](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.33...v1.0.0-beta.34) (2023-05-13)

### Bug Fixes

- subscribeWith making guid null ([dbb38d4](https://github.com/sciactive/nymphjs/commit/dbb38d424f2395bbfa01ab4a0663dcaebf0c7aa7))

# [1.0.0-beta.33](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.32...v1.0.0-beta.33) (2023-05-13)

### Bug Fixes

- don't send initial entities for qref subscriptions ([b07ed5c](https://github.com/sciactive/nymphjs/commit/b07ed5cb0404aa85dd58dc951261a2b4e3d2bcbf))

# [1.0.0-beta.32](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.31...v1.0.0-beta.32) (2023-05-13)

### Features

- issue initial request with pubsub instead of rest on subscribe ([8a232d2](https://github.com/sciactive/nymphjs/commit/8a232d2faeb8622924f9c35a01a8f71a70659bb3))

# [1.0.0-beta.31](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.30...v1.0.0-beta.31) (2023-05-12)

### Bug Fixes

- pubsub client reconnect multiple times issue ([bba0897](https://github.com/sciactive/nymphjs/commit/bba08974fadf318d040f8844a2d583f6bc15b486))

# [1.0.0-beta.30](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.29...v1.0.0-beta.30) (2023-05-12)

### Features

- allow providing getEntityClass with a class instead of string ([ecd64c1](https://github.com/sciactive/nymphjs/commit/ecd64c1bf92e3657889613b76bcc46652f371ead))

# [1.0.0-beta.29](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.28...v1.0.0-beta.29) (2023-05-08)

### Bug Fixes

- use 4 byte utf8 encoding in mysql ([c335b6e](https://github.com/sciactive/nymphjs/commit/c335b6e8416f935c9116e7f54de753d4b2255a73))

# [1.0.0-beta.28](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.27...v1.0.0-beta.28) (2023-05-05)

### Bug Fixes

- pubsub client auth ([979d913](https://github.com/sciactive/nymphjs/commit/979d9138abc86c7cef8b80b4f63c519b7b7ded78))

# [1.0.0-beta.27](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.26...v1.0.0-beta.27) (2023-05-04)

### Bug Fixes

- properly escape mysql ids with dots ([64bfaa5](https://github.com/sciactive/nymphjs/commit/64bfaa5d606f97a753ca7e6c5d2d86f7c0f7729a))

# [1.0.0-beta.26](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.25...v1.0.0-beta.26) (2023-05-04)

### Bug Fixes

- broken pubsub test ([99de0e4](https://github.com/sciactive/nymphjs/commit/99de0e4e7a79420bae1c5df5fb8fcbfafe894ace))

### Features

- update packages and migrate to mysql2 ([72ad611](https://github.com/sciactive/nymphjs/commit/72ad611bd2bf7bf85c3ba8a3486503d9b50c49d6))

# [1.0.0-beta.25](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.24...v1.0.0-beta.25) (2023-05-04)

### Bug Fixes

- don't create empty entities ([1d4d2e9](https://github.com/sciactive/nymphjs/commit/1d4d2e99af2e9cdc647bcf58ac34572836f41176))
- tilmeld uses wrong class when cloned with user ([059c2ce](https://github.com/sciactive/nymphjs/commit/059c2cedf1b07b9681e87c240eb36723a4581918))

### Features

- add flags to disable rest and pubsub support on an entity class ([52106a3](https://github.com/sciactive/nymphjs/commit/52106a3d44065bcfec40d361344bf1eba59a5136)), closes [#1](https://github.com/sciactive/nymphjs/issues/1)

# [1.0.0-beta.24](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.23...v1.0.0-beta.24) (2023-05-02)

### Bug Fixes

- fill session after setting current user clone ([7bae7cf](https://github.com/sciactive/nymphjs/commit/7bae7cf1bf236b8efc00cb7b5ed53cd21f1370c7))

# [1.0.0-beta.23](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.22...v1.0.0-beta.23) (2023-05-02)

### Bug Fixes

- rare case where currentUser isn't corrent ([97f233a](https://github.com/sciactive/nymphjs/commit/97f233a5fcfd4b97dd282562b0c99097ac3ef41d))

# [1.0.0-beta.22](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.21...v1.0.0-beta.22) (2023-05-01)

### Bug Fixes

- export two factor component ([9c3b162](https://github.com/sciactive/nymphjs/commit/9c3b162257b221aee4b544f402a7e429b07f056e))

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

### Bug Fixes

- svelte warnings ([6be46fd](https://github.com/sciactive/nymphjs/commit/6be46fdd64e6d8daa133480dc44c25f775e4219b))

### Features

- add spa router to user admin app ([25bb344](https://github.com/sciactive/nymphjs/commit/25bb344f4d358eeb2254df98782f1cba229b5f50))
- use a long lived worker thread for synchronous mysql and postgres queries ([7e2bf84](https://github.com/sciactive/nymphjs/commit/7e2bf84a2d584d6906c31f44147025b793a05026))

# [1.0.0-beta.16](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.15...v1.0.0-beta.16) (2023-03-31)

### Features

- add ability to tell tilmeld to log in a specific user during authentication ([922e145](https://github.com/sciactive/nymphjs/commit/922e1452adae44bed2aa9655be16e19796acb39b))
- username check callback ([372e95c](https://github.com/sciactive/nymphjs/commit/372e95c39664c0d718e497ec1b09426e7cfa8862))

# [1.0.0-beta.15](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.14...v1.0.0-beta.15) (2023-03-23)

### Features

- add option to sort results by a property ([16384e7](https://github.com/sciactive/nymphjs/commit/16384e7bdab88abb55ccccabb06ac09f92fa8a03))

# [1.0.0-beta.14](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.13...v1.0.0-beta.14) (2023-03-17)

### Bug Fixes

- run pragma and function on write link on new sqlite3 db ([6c28ba1](https://github.com/sciactive/nymphjs/commit/6c28ba1a396f7cec098d4e550c7b82c93979eaec))

# [1.0.0-beta.13](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.12...v1.0.0-beta.13) (2023-03-16)

### Bug Fixes

- pubsub publishing changes before transaction is finished ([a918cc1](https://github.com/sciactive/nymphjs/commit/a918cc1451e03015ecce20f1c9bf6ceb62b7dff1))

### Features

- add noAutoconnect option to pubsub client ([266e715](https://github.com/sciactive/nymphjs/commit/266e715988b34f3e0d58ac68178677d2086b5160))
- open sqlite in readonly unless actively writing to db ([0443b91](https://github.com/sciactive/nymphjs/commit/0443b9188df3ebd557b96baf873abc4e4ddd9137))

# [1.0.0-beta.12](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.11...v1.0.0-beta.12) (2023-03-04)

### Bug Fixes

- make sure all default exports are also named exports ([06da9a6](https://github.com/sciactive/nymphjs/commit/06da9a61d444860f70b7f5b95b824547d9880500))

# [1.0.0-beta.11](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.10...v1.0.0-beta.11) (2023-02-27)

### Features

- allow customizing HTTP status codes in response from server called methods ([8c5c3d4](https://github.com/sciactive/nymphjs/commit/8c5c3d4af741edabc1a8947aaebf026ba546c46a))

# [1.0.0-beta.10](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.9...v1.0.0-beta.10) (2023-01-19)

### Bug Fixes

- explicitly set skipAc to false in PubSub server ([33f96f7](https://github.com/sciactive/nymphjs/commit/33f96f7ccabaedb9e226fe302a996259e0158315))

### Features

- add wal mode setting to sqlite driver ([0071d66](https://github.com/sciactive/nymphjs/commit/0071d6628534b8b35d49c0238a99fe143fd03207))

# [1.0.0-beta.9](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.8...v1.0.0-beta.9) (2023-01-09)

### Bug Fixes

- reworked $is and $equals to better work with new instance based classes ([b1f3f0c](https://github.com/sciactive/nymphjs/commit/b1f3f0cca3e2b0dd392cd9da31167a6bd9487b40))

# [1.0.0-beta.8](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.7...v1.0.0-beta.8) (2023-01-09)

### Features

- make entities in nymph client instance specific too ([1029f06](https://github.com/sciactive/nymphjs/commit/1029f061a1ad193e4a8a2dab0186b9a4b517f646))

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

### Bug Fixes

- client entity patch returning opposite result ([c29260c](https://github.com/sciactive/nymphjs/commit/c29260c6c9037134dbf51091810823edcab44b4a))

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

### Bug Fixes

- allow queryIterSync to fail silently for undefined result ([ace517e](https://github.com/sciactive/nymphjs/commit/ace517ecdf7fb3124982fd3c4a6853cd64d8e9af))

# [1.0.0-alpha.39](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.38...v1.0.0-alpha.39) (2022-03-05)

### Bug Fixes

- tilmeld after registration callbacks don't have login info ([1e98a9b](https://github.com/sciactive/nymphjs/commit/1e98a9b337e359763bc9baf290463e6da0373efe))

# [1.0.0-alpha.38](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.37...v1.0.0-alpha.38) (2022-02-10)

### Bug Fixes

- queryParser props in setup app ([effba3f](https://github.com/sciactive/nymphjs/commit/effba3f3bbc30723b29874f20d54690c8a17adce))

# [1.0.0-alpha.37](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.36...v1.0.0-alpha.37) (2022-02-02)

### Bug Fixes

- wrap response.text call in try block ([26b457a](https://github.com/sciactive/nymphjs/commit/26b457a934fa082e5d94ba32eb84574a67950e03))

# [1.0.0-alpha.36](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.35...v1.0.0-alpha.36) (2022-01-26)

### Features

- entity count return option ([f1e34e8](https://github.com/sciactive/nymphjs/commit/f1e34e8f74d9fdda58989fc101f4381243a86ec3))
- support subscribing to queries with qref in pubsub server ([6d9a0af](https://github.com/sciactive/nymphjs/commit/6d9a0afea653ae00130c47087b21d87c5666d229))

# [1.0.0-alpha.35](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.34...v1.0.0-alpha.35) (2022-01-19)

### Bug Fixes

- add new props to tilmeld components in setup app ([0afb20b](https://github.com/sciactive/nymphjs/commit/0afb20b4a901951401b7696eec1033a5488e38c5))
- remove getClientConfig helper, which didn't support multiple nymph instances ([5a4b898](https://github.com/sciactive/nymphjs/commit/5a4b898ac2bf37dbd2a2dd4d32f2f1f805704739))
- split limit issue in query parser ([df2d610](https://github.com/sciactive/nymphjs/commit/df2d610c2c999400412c2023efc9204fa9df338e))

### Features

- add bareHandler option to query parser ([de06691](https://github.com/sciactive/nymphjs/commit/de066910403242af8c44668b310d2594abc5b817))

# [1.0.0-alpha.34](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.33...v1.0.0-alpha.34) (2022-01-08)

### Bug Fixes

- packaging issue ([a61120c](https://github.com/sciactive/nymphjs/commit/a61120ca240e2758136e6b57c3f897bd32519984))

# [1.0.0-alpha.33](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.32...v1.0.0-alpha.33) (2022-01-08)

### Bug Fixes

- require passing the user class to tilmeld components ([5b8d07e](https://github.com/sciactive/nymphjs/commit/5b8d07eba15318bf6046a5cb4a64fb550a3a4545))

# [1.0.0-alpha.32](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.31...v1.0.0-alpha.32) (2022-01-08)

### Bug Fixes

- add nymph getter and setter to user clone ([aa72399](https://github.com/sciactive/nymphjs/commit/aa723998d75c72f3d9cd00b3a735607e99390cde))

# [1.0.0-alpha.31](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.30...v1.0.0-alpha.31) (2022-01-08)

### Features

- tilmeld client user can now be cloned ([c360fd3](https://github.com/sciactive/nymphjs/commit/c360fd312839aef221c2562dc45797cd270fa936))

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

- add prop forwarding for svelte components within tilmeld components ([42b60e2](https://github.com/sciactive/nymphjs/commit/42b60e29638f04036eff3f7e4876e96a1c66c0bf))
- update smui to latest versions ([7ed7bd3](https://github.com/sciactive/nymphjs/commit/7ed7bd34d01a155c7001a2671de25ef2f3363682))

# [1.0.0-alpha.26](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.25...v1.0.0-alpha.26) (2021-12-30)

### Features

- add json options rest server option ([35cbff4](https://github.com/sciactive/nymphjs/commit/35cbff4b8dbc3e112604119efe05b813f5948dff))

# [1.0.0-alpha.25](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.24...v1.0.0-alpha.25) (2021-12-30)

### Bug Fixes

- import types correctly in Tilmeld components (again) ([4961a4e](https://github.com/sciactive/nymphjs/commit/4961a4e8feb5133864a43a0031b18d784cdca088))

# [1.0.0-alpha.24](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.23...v1.0.0-alpha.24) (2021-12-30)

### Bug Fixes

- import types correctly in Tilmeld components ([02cba14](https://github.com/sciactive/nymphjs/commit/02cba144dfae649ff61b4661e56f3ab9115cbf81))

# [1.0.0-alpha.23](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.22...v1.0.0-alpha.23) (2021-12-30)

### Features

- add optional weakly referenced cache to client lib ([fbb184c](https://github.com/sciactive/nymphjs/commit/fbb184c6a721968bb92cc9b05c328594618554ed))

# [1.0.0-alpha.22](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.21...v1.0.0-alpha.22) (2021-12-14)

### Features

- update smui to latest versions ([912873b](https://github.com/sciactive/nymphjs/commit/912873b863d1ae5d51c359a3c0558bff38ce85cd))

# [1.0.0-alpha.21](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.20...v1.0.0-alpha.21) (2021-11-29)

### Features

- open sleeping reference props to protected, allow custom property definitions in data proxies ([79779c3](https://github.com/sciactive/nymphjs/commit/79779c35123f8b829f3eb847088e68a58865c76d))

# [1.0.0-alpha.20](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.19...v1.0.0-alpha.20) (2021-11-24)

### Features

- update smui to latest versions ([73ab4e8](https://github.com/sciactive/nymphjs/commit/73ab4e843623c25dc2efeb3c4b2cdd91237018b8))

# [1.0.0-alpha.19](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.18...v1.0.0-alpha.19) (2021-11-18)

### Features

- update smui and other packages to latest versions ([2465340](https://github.com/sciactive/nymphjs/commit/24653400d887bc04c41c3c4ee0c73ce2f2289e0d))

# [1.0.0-alpha.18](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.17...v1.0.0-alpha.18) (2021-11-09)

### Features

- move entity sorter to its own package and add more features ([ef57460](https://github.com/sciactive/nymphjs/commit/ef57460d88c927a0e3a44b0071f553f1c92708bc))

# [1.0.0-alpha.17](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.16...v1.0.0-alpha.17) (2021-10-14)

### Bug Fixes

- remove unsupported syntax in svelte markup ([8bf4da0](https://github.com/sciactive/nymphjs/commit/8bf4da02a03eeb1e7d3647ee54a280c0a971a52d))

# [1.0.0-alpha.16](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.15...v1.0.0-alpha.16) (2021-10-14)

### Bug Fixes

- don't ignore built files in npm packages ([7d688db](https://github.com/sciactive/nymphjs/commit/7d688dbec362f1f71fb451a1d0dbcaecc15d99fc))

# [1.0.0-alpha.15](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.14...v1.0.0-alpha.15) (2021-10-14)

### Bug Fixes

- export untyped svelte files in tilmeld-components ([b15a4ca](https://github.com/sciactive/nymphjs/commit/b15a4ca48abeef02ecfbcde25fd686391e6d0f1f))

# [1.0.0-alpha.14](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.13...v1.0.0-alpha.14) (2021-10-14)

### Bug Fixes

- don't set ts file as default svelte import for tilmeld components ([74d74a0](https://github.com/sciactive/nymphjs/commit/74d74a010f3cb18bbf5ae1fed716965ff3acbf7b))

# [1.0.0-alpha.13](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.12...v1.0.0-alpha.13) (2021-10-14)

### Bug Fixes

- tilmeld not adding permission checks correctly ([ddeb3d1](https://github.com/sciactive/nymphjs/commit/ddeb3d155af971a89fb1403c34530826448af2b8))

# [1.0.0-alpha.12](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.11...v1.0.0-alpha.12) (2021-10-13)

### Features

- add tag syntax to query parser ([6898200](https://github.com/sciactive/nymphjs/commit/689820055ec218d0998a0a2bb9496cebc1395247))

# [1.0.0-alpha.11](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.10...v1.0.0-alpha.11) (2021-10-13)

### Bug Fixes

- pubsub token extraction didn't wait for promise ([abdc57e](https://github.com/sciactive/nymphjs/commit/abdc57ecef3776c4944fab41195b2ce187a97790))

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

- allow multiple instances of Nymph Client ([81eacd7](https://github.com/sciactive/nymphjs/commit/81eacd7caff6f3c209d7d6dbfdac0414a1857c6d))
- migrate Tilmeld Client to new instance based Nymph Client ([dffe83b](https://github.com/sciactive/nymphjs/commit/dffe83b3900171a56d703cd491536b5d21360198))
- move to fully instance based design, no more globals ([c036220](https://github.com/sciactive/nymphjs/commit/c0362209b90a475b8b85269a829b0ec6bed4465f))

# [1.0.0-alpha.2](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) (2021-09-21)

### Bug Fixes

- strict type checking in Tilmeld setup app ([43a22e9](https://github.com/sciactive/nymphjs/commit/43a22e940769b4870d712709eb3a62c4e49d57a3))

### Features

- allow multiple instances of Nymph, including transactional instances ([8ff8bcf](https://github.com/sciactive/nymphjs/commit/8ff8bcf4d549998faa2b3d86440394d75bcdc202))
- implement qref selector clause ([7763324](https://github.com/sciactive/nymphjs/commit/776332482ec91f15b62a4b59d3f6ca97d1f16b99))
- migrate PostgreSQL driver ([7cbe71b](https://github.com/sciactive/nymphjs/commit/7cbe71bd48bc5e70f292e2babdf7adff96ac0b93))
- split out Tilmeld components into own package ([66eb98f](https://github.com/sciactive/nymphjs/commit/66eb98f81b502236cf7ff8439194759278154a20))
- support qref queries from the client ([3c8bef0](https://github.com/sciactive/nymphjs/commit/3c8bef0251111983b06eb13ad42a2afef80a1446))
- support qref queries in the query parser ([71169a2](https://github.com/sciactive/nymphjs/commit/71169a2aa33f11d791e93bb23d377a6c270b42f2))

# 1.0.0-alpha.1 (2021-09-06)

### Bug Fixes

- ability granting and level calculation with regard to disabled groups ([8c3c17b](https://github.com/sciactive/nymphjs/commit/8c3c17bf4e7f10e59260f2ca700b36fb36bead25))
- add factorySync on client ([c1591f3](https://github.com/sciactive/nymphjs/commit/c1591f3348585ef39422971745e21b1b22095df2))
- avatar loading and guids on admin pages ([9a588be](https://github.com/sciactive/nymphjs/commit/9a588be89af8e49963f9f6f49b7eeb6142cfe003))
- circular progress not showing in setup app ([72ae10b](https://github.com/sciactive/nymphjs/commit/72ae10b742001fe46d7cb90f5a8b49d23b4e07b4))
- clean lib dirs correctly ([ef7663e](https://github.com/sciactive/nymphjs/commit/ef7663edf3939912d732fa30191ef0b68664c6ff))
- don't attempt to save undefined props and only report query in dev mode ([f18a3f8](https://github.com/sciactive/nymphjs/commit/f18a3f8ff7dd0a7bd1be6853fe15cb2be56cfd68))
- entities waking up when accessing just guid or a property ([25ebdc7](https://github.com/sciactive/nymphjs/commit/25ebdc7046d79cdc7a4935df4172a6ec38322a0f))
- entity save not returned correctly in server ([6814fea](https://github.com/sciactive/nymphjs/commit/6814fea5986e4e43b6998c61c893348d84fc80a0))
- export all defaults also as named exports ([7555190](https://github.com/sciactive/nymphjs/commit/7555190e24ea4d8cf5f2a79cab6944661cf8f609))
- gatekeeper should always return a boolean ([d3f9c7f](https://github.com/sciactive/nymphjs/commit/d3f9c7f3cbef76bb5de9696ec19970773499838c))
- getEntity should never return empty array ([07bee0a](https://github.com/sciactive/nymphjs/commit/07bee0a90e7171ba13b0492f4e408d5c10a62b73))
- new user email used wrong name ([e092f3f](https://github.com/sciactive/nymphjs/commit/e092f3f770457d39b22f234f9e227b05f8a61237))
- pubsub server and client are working now. needs more tests ([add109c](https://github.com/sciactive/nymphjs/commit/add109cfa7e9476a7925c80ab8f3f74e89112756))
- pubsub subscriptions for a query with a limit now work as expected ([d9af654](https://github.com/sciactive/nymphjs/commit/d9af6546a29b0b899b9f4450330cbe6d18f2104c))
- require class in query options on client ([20b0731](https://github.com/sciactive/nymphjs/commit/20b0731b3af0fe1bc1d9c7fbfb66f3573d77ee75))
- return boolean from entity delete ([7cb644d](https://github.com/sciactive/nymphjs/commit/7cb644dbe50cefe6c0ce8b0171991f1b739dfef0))
- server error response was caught early ([34e807d](https://github.com/sciactive/nymphjs/commit/34e807de8c5487bfeb9348447f975b1f0b3aa0e1))
- server method calls not decoded correctly ([506855a](https://github.com/sciactive/nymphjs/commit/506855ab56117cb73f10c5b863daad58134b18ba))
- subscriptions to single entity changes and uids ([dd4f75e](https://github.com/sciactive/nymphjs/commit/dd4f75e6e856ff630788b797051378cdb7ac7d48))
- throw error when transaction is attempted without a name ([28ad2ca](https://github.com/sciactive/nymphjs/commit/28ad2cadc3a1172abec44e12f1b8b777f6659b50))
- tilmeld register and login ([99b12d2](https://github.com/sciactive/nymphjs/commit/99b12d2799d8ccf2d8fb7bdb3e3b86051e7e7f88))
- typescript errors because caught errors were unknown type ([73425ab](https://github.com/sciactive/nymphjs/commit/73425abb321263d96605f40397162b3e8a0ed1a8))

### Features

- add guid, ref, and contain clause support to query parser ([26e02e5](https://github.com/sciactive/nymphjs/commit/26e02e54e0f281ce70ea1c9e6d8dfb3532fa93a4))
- added user and group validation functions ([cc4704e](https://github.com/sciactive/nymphjs/commit/cc4704e06162d580dfd7672602060814b294fa66))
- began migrating Nymph code to TypeScript ([07a741d](https://github.com/sciactive/nymphjs/commit/07a741dd088bfb5b83439d4644cd931f99dde3c7))
- began migrating Tilmeld ([f44013b](https://github.com/sciactive/nymphjs/commit/f44013b7436272baa49d3920c814aa32676e2156))
- convert MySQL driver to use connection pool ([6d95735](https://github.com/sciactive/nymphjs/commit/6d9573577ec13be91d274e8a74cb9595d9c88700))
- finish migrating Tilmeld User class ([f40afa6](https://github.com/sciactive/nymphjs/commit/f40afa63fe03988251dcd76752d41254c233a966))
- finished migrating Tilmeld user/group system ([8074b74](https://github.com/sciactive/nymphjs/commit/8074b74b58dba9d87f1f87cef09d3ca0befaafac))
- finished personal account registration and management ([b7d0935](https://github.com/sciactive/nymphjs/commit/b7d09358ce6055abe721aace9b8d797d6b95ac50))
- finished Tilmeld setup/admin app. fixed some user/group issues ([1c51dd5](https://github.com/sciactive/nymphjs/commit/1c51dd52768b14f6f6674f6d06001c883b46ef51))
- implement query parser on primary and secondary group search ([3fea057](https://github.com/sciactive/nymphjs/commit/3fea057f646296541d47adf18b96920afc795ca9))
- implement Tilmeld auth with cookies/headers ([6caf280](https://github.com/sciactive/nymphjs/commit/6caf2804ca72df2a80a62d61077129e3a53d6dae))
- make entity factories async and provide a sync version ([e6babb1](https://github.com/sciactive/nymphjs/commit/e6babb1c7f7113dc5dd1bfe4e08821fbf8a73b8a))
- migrate PubSub server ([b406b57](https://github.com/sciactive/nymphjs/commit/b406b570eb84617c2cc92184dfac3d4a0acf4b02))
- migrate REST server and write simple test for it ([f69dab6](https://github.com/sciactive/nymphjs/commit/f69dab6de586ce71905892f5419b95c18a6f5495))
- migrated entity query check code ([a0234ba](https://github.com/sciactive/nymphjs/commit/a0234ba3df18fc29cf1862fe3e6d53d687496f8e))
- migrated entity testing code ([d7dbe0b](https://github.com/sciactive/nymphjs/commit/d7dbe0b4bf7f9abaadf995d40264effda3252ff2))
- migrated more driver code ([c0e35b0](https://github.com/sciactive/nymphjs/commit/c0e35b02295eb4894c4dc49f362c07b4181ac4ca))
- migrated more driver code ([20afbbc](https://github.com/sciactive/nymphjs/commit/20afbbcaad0ad6841cd1bc3a5e82b93875faec67))
- migrated more driver code ([1fc3263](https://github.com/sciactive/nymphjs/commit/1fc326359edfb101b46c2b54346b5e17a27eca4f))
- migrated more driver code ([b6230c0](https://github.com/sciactive/nymphjs/commit/b6230c0e20d1074fe6a13957ac334a6a313450af))
- migrated MySQL driver ([3375a81](https://github.com/sciactive/nymphjs/commit/3375a8187a65e8e33c35eabac910e9457f9cb6df))
- migrated Nymph client code ([605109e](https://github.com/sciactive/nymphjs/commit/605109ea5c56f7514fa978eb7c4174869fd87a69))
- migrated Nymph Node client code ([43a8f55](https://github.com/sciactive/nymphjs/commit/43a8f55017a7128f07ce5f55d2ab81f8662b9a6b))
- migrated SQLite3 driver and driver tests ([a5a3b3e](https://github.com/sciactive/nymphjs/commit/a5a3b3e715fcfa280967dfad710a80faf60a06ce))
- migrated Tilmeld client ([fc7e380](https://github.com/sciactive/nymphjs/commit/fc7e3809949630f92177ca295c06771985815cb4))
- migrated Tilmeld setup app ([0c851fa](https://github.com/sciactive/nymphjs/commit/0c851fa22e011896762ee65b2250f532789af2e5))
- move query parser to its own package. it's awesome ([f9ed8f2](https://github.com/sciactive/nymphjs/commit/f9ed8f289bce98d467a40decedacd716420b586b))
- nested and named transactions ([858ba43](https://github.com/sciactive/nymphjs/commit/858ba434cd752817a8054bb2a83ba26a978c4107))
- support ad hoc transactions and don't duplicate string and number data ([efd7e9d](https://github.com/sciactive/nymphjs/commit/efd7e9de9dd89a4bfb2ee603ba94337e954408b4))
- support conditional connection based on origin ([fec0102](https://github.com/sciactive/nymphjs/commit/fec010276756f80f28d6e60ca1755b873c980d76))
