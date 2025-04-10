# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.0.0-beta.92](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.91...v1.0.0-beta.92) (2025-04-06)

### Features

- add 'object' return type which returns plain entity data objects ([26a4cd3](https://github.com/sciactive/nymphjs/commit/26a4cd3226145408dc34bff52b1eafe3b046313b))

# [1.0.0-beta.91](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.90...v1.0.0-beta.91) (2025-03-07)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.90](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.89...v1.0.0-beta.90) (2025-02-09)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.89](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.88...v1.0.0-beta.89) (2025-02-09)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.88](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.87...v1.0.0-beta.88) (2025-01-30)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.87](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.86...v1.0.0-beta.87) (2025-01-20)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.86](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.85...v1.0.0-beta.86) (2024-12-28)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.85](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.84...v1.0.0-beta.85) (2024-12-27)

### Bug Fixes

- inTransaction could incorrectly report transaction state ([a7e2ca5](https://github.com/sciactive/nymphjs/commit/a7e2ca57f5b19e9b5b2a04dcc8b79e3937db20e5))

# [1.0.0-beta.84](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.83...v1.0.0-beta.84) (2024-12-21)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.83](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.82...v1.0.0-beta.83) (2024-12-20)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.82](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.81...v1.0.0-beta.82) (2024-12-15)

### Bug Fixes

- use async generator for data export in postgres to solve out of memory issue ([25abf2a](https://github.com/sciactive/nymphjs/commit/25abf2a30b401a6d5d0fe42e057176ed258e4e29))

### Features

- migrate to es modules, upgrade all packages, migrate to Svelte 5 ([3f2b9e5](https://github.com/sciactive/nymphjs/commit/3f2b9e517b39934eddce66601d7fc747fbf3f9e6))

# [1.0.0-beta.81](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.80...v1.0.0-beta.81) (2024-09-28)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.80](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.79...v1.0.0-beta.80) (2024-09-28)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.79](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.78...v1.0.0-beta.79) (2024-09-28)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.78](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.77...v1.0.0-beta.78) (2024-09-27)

### Bug Fixes

- don't use transactions for import, to avoid issues when creating tables ([2f8f715](https://github.com/sciactive/nymphjs/commit/2f8f71545de6ca2f3235a9f3a3c91107f58129bf))
- potential bug with nulls in postgres ([1d8bc50](https://github.com/sciactive/nymphjs/commit/1d8bc500d752b1ef59d6591f3045bf4976eb7c00))

### Features

- add method to detect if migration is needed ([274f7c3](https://github.com/sciactive/nymphjs/commit/274f7c39aa4e0d251a38c01593775e1270fc9621))
- move comparison fields to data table and remove comparison table ([3d7fe7e](https://github.com/sciactive/nymphjs/commit/3d7fe7e614327ecf8903ee7143e559549793e8fc))

### BREAKING CHANGES

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

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.72](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.71...v1.0.0-beta.72) (2024-09-20)

### Bug Fixes

- optimize qref queries the same way ([6fcd92f](https://github.com/sciactive/nymphjs/commit/6fcd92f3289b2762fdf4549a88e80e4918cf8e19))
- postgres count queries with limit or offset ([edd586e](https://github.com/sciactive/nymphjs/commit/edd586e3e8c7f80093a258a9c328b7a298c555d7))

# [1.0.0-beta.71](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.70...v1.0.0-beta.71) (2024-09-20)

**Note:** Version bump only for package @nymphjs/driver-postgresql

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

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.66](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.65...v1.0.0-beta.66) (2024-08-06)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.65](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.64...v1.0.0-beta.65) (2024-08-05)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.64](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.63...v1.0.0-beta.64) (2024-08-04)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.63](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.62...v1.0.0-beta.63) (2024-06-18)

### Bug Fixes

- undo ts compilation to module change ([84be6d4](https://github.com/sciactive/nymphjs/commit/84be6d434be29f8afd53907d15be2eb77d1736ce))

### Features

- allow importing from text and iterables ([9d766bd](https://github.com/sciactive/nymphjs/commit/9d766bdad4b0f17bc2dd68b0336a0064857eb4e9))
- export data iterator ([b86aa19](https://github.com/sciactive/nymphjs/commit/b86aa19fc77d744b5a683046dfb697fc4746df5c))

# [1.0.0-beta.62](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.61...v1.0.0-beta.62) (2024-06-15)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.61](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.60...v1.0.0-beta.61) (2024-06-14)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.60](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.59...v1.0.0-beta.60) (2024-06-14)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.59](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.58...v1.0.0-beta.59) (2024-06-14)

### Features

- add uniqueness constraint feature, refactor some types ([8133d32](https://github.com/sciactive/nymphjs/commit/8133d32b2c04907182dca2e9171b8217ed1b57e4))

# [1.0.0-beta.58](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.57...v1.0.0-beta.58) (2024-06-12)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.57](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.56...v1.0.0-beta.57) (2024-06-12)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.56](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.55...v1.0.0-beta.56) (2024-06-11)

### Bug Fixes

- import entities without transaction ([db56609](https://github.com/sciactive/nymphjs/commit/db56609efaadc16d5d1bbc8e9b50084aa8a076b9))

### Features

- make transaction optional during import and off by default ([08d79f8](https://github.com/sciactive/nymphjs/commit/08d79f8f803c846ac79c0c489fc754437dae082b))

# [1.0.0-beta.55](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.54...v1.0.0-beta.55) (2024-05-26)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.54](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.53...v1.0.0-beta.54) (2024-05-26)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.53](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.52...v1.0.0-beta.53) (2024-05-26)

### Features

- add pragma statements config to sqlite3 driver ([b0f27e2](https://github.com/sciactive/nymphjs/commit/b0f27e24df85663ea777565e5d352775efcad858))

# [1.0.0-beta.52](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.51...v1.0.0-beta.52) (2024-05-25)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.51](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.50...v1.0.0-beta.51) (2024-04-12)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.50](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.49...v1.0.0-beta.50) (2024-04-08)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.49](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.48...v1.0.0-beta.49) (2024-03-04)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.48](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.47...v1.0.0-beta.48) (2023-11-10)

### Bug Fixes

- avoid trying to roll back a transaction twice ([e26ef31](https://github.com/sciactive/nymphjs/commit/e26ef312b617edcc715c81e7f92875dfaa7a904a))

# [1.0.0-beta.47](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.46...v1.0.0-beta.47) (2023-11-10)

### Bug Fixes

- nymph stays in a new transaction on the parent instance ([1857046](https://github.com/sciactive/nymphjs/commit/185704666715162d8482326eaba7c2532297432c))

# [1.0.0-beta.46](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.45...v1.0.0-beta.46) (2023-08-29)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.45](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.44...v1.0.0-beta.45) (2023-07-17)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.44](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.43...v1.0.0-beta.44) (2023-07-13)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.43](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.42...v1.0.0-beta.43) (2023-07-12)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.42](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.41...v1.0.0-beta.42) (2023-07-12)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.41](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.40...v1.0.0-beta.41) (2023-07-12)

### Features

- remove synchronous database queries ([b579fb2](https://github.com/sciactive/nymphjs/commit/b579fb2eacd96cdd1b386a62c5c00cdbb2438f6e))

# [1.0.0-beta.40](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.39...v1.0.0-beta.40) (2023-07-10)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.39](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.38...v1.0.0-beta.39) (2023-07-09)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.38](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.37...v1.0.0-beta.38) (2023-07-09)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.37](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.36...v1.0.0-beta.37) (2023-07-09)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.36](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.35...v1.0.0-beta.36) (2023-07-09)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.35](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.34...v1.0.0-beta.35) (2023-06-14)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.34](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.33...v1.0.0-beta.34) (2023-05-13)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.33](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.32...v1.0.0-beta.33) (2023-05-13)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.32](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.31...v1.0.0-beta.32) (2023-05-13)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.31](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.30...v1.0.0-beta.31) (2023-05-12)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.30](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.29...v1.0.0-beta.30) (2023-05-12)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.29](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.28...v1.0.0-beta.29) (2023-05-08)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.28](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.27...v1.0.0-beta.28) (2023-05-05)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.27](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.26...v1.0.0-beta.27) (2023-05-04)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.26](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.25...v1.0.0-beta.26) (2023-05-04)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.25](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.24...v1.0.0-beta.25) (2023-05-04)

### Bug Fixes

- don't create empty entities ([1d4d2e9](https://github.com/sciactive/nymphjs/commit/1d4d2e99af2e9cdc647bcf58ac34572836f41176))

# [1.0.0-beta.24](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.23...v1.0.0-beta.24) (2023-05-02)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.23](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.22...v1.0.0-beta.23) (2023-05-02)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.22](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.21...v1.0.0-beta.22) (2023-05-01)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.21](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.20...v1.0.0-beta.21) (2023-05-01)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.20](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.19...v1.0.0-beta.20) (2023-04-30)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.19](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.18...v1.0.0-beta.19) (2023-04-29)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.18](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.17...v1.0.0-beta.18) (2023-04-27)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.17](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.16...v1.0.0-beta.17) (2023-04-24)

### Features

- use a long lived worker thread for synchronous mysql and postgres queries ([7e2bf84](https://github.com/sciactive/nymphjs/commit/7e2bf84a2d584d6906c31f44147025b793a05026))

# [1.0.0-beta.16](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.15...v1.0.0-beta.16) (2023-03-31)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.15](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.14...v1.0.0-beta.15) (2023-03-23)

### Features

- add option to sort results by a property ([16384e7](https://github.com/sciactive/nymphjs/commit/16384e7bdab88abb55ccccabb06ac09f92fa8a03))

# [1.0.0-beta.14](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.13...v1.0.0-beta.14) (2023-03-17)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.13](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.12...v1.0.0-beta.13) (2023-03-16)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.12](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.11...v1.0.0-beta.12) (2023-03-04)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.11](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.10...v1.0.0-beta.11) (2023-02-27)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.10](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.9...v1.0.0-beta.10) (2023-01-19)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.9](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.8...v1.0.0-beta.9) (2023-01-09)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.8](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.7...v1.0.0-beta.8) (2023-01-09)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.7](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.6...v1.0.0-beta.7) (2023-01-05)

### Bug Fixes

- sqlite transaction returns wrong instance of nymph if it has been cloned ([b278c76](https://github.com/sciactive/nymphjs/commit/b278c7633722cb1cca7a941187ae2f1ff8ebdc7b))

# [1.0.0-beta.6](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.5...v1.0.0-beta.6) (2023-01-05)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.5](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.4...v1.0.0-beta.5) (2022-11-24)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.4](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.3...v1.0.0-beta.4) (2022-11-23)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.3](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.2...v1.0.0-beta.3) (2022-11-21)

### Bug Fixes

- don't run query callbacks asynchronously ([02ab89d](https://github.com/sciactive/nymphjs/commit/02ab89d174d6dd366e417d070672587937b4d4b3))

# [1.0.0-beta.2](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.1...v1.0.0-beta.2) (2022-11-21)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-beta.1](https://github.com/sciactive/nymphjs/compare/v1.0.0-beta.0...v1.0.0-beta.1) (2022-11-21)

### Bug Fixes

- adjust typescript targets to output node 16 code ([36f15a6](https://github.com/sciactive/nymphjs/commit/36f15a601362ed54f4465ef6527402c026bbcf61))

# [1.0.0-beta.0](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.43...v1.0.0-beta.0) (2022-11-16)

### Features

- update packages and fix issues, new guid package to use latest esm nanoid ([fd66aab](https://github.com/sciactive/nymphjs/commit/fd66aab465e6b1d83f4238bb16bc88d851ef5e92))

# [1.0.0-alpha.43](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.42...v1.0.0-alpha.43) (2022-03-07)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.42](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.41...v1.0.0-alpha.42) (2022-03-06)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.41](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.40...v1.0.0-alpha.41) (2022-03-06)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.40](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.39...v1.0.0-alpha.40) (2022-03-05)

### Bug Fixes

- allow queryIterSync to fail silently for undefined result ([ace517e](https://github.com/sciactive/nymphjs/commit/ace517ecdf7fb3124982fd3c4a6853cd64d8e9af))

# [1.0.0-alpha.39](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.38...v1.0.0-alpha.39) (2022-03-05)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.38](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.37...v1.0.0-alpha.38) (2022-02-10)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.37](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.36...v1.0.0-alpha.37) (2022-02-02)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.36](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.35...v1.0.0-alpha.36) (2022-01-26)

### Features

- entity count return option ([f1e34e8](https://github.com/sciactive/nymphjs/commit/f1e34e8f74d9fdda58989fc101f4381243a86ec3))

# [1.0.0-alpha.35](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.34...v1.0.0-alpha.35) (2022-01-19)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.34](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.33...v1.0.0-alpha.34) (2022-01-08)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.33](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.32...v1.0.0-alpha.33) (2022-01-08)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.32](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.31...v1.0.0-alpha.32) (2022-01-08)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.31](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.30...v1.0.0-alpha.31) (2022-01-08)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.30](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.29...v1.0.0-alpha.30) (2022-01-07)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.29](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.28...v1.0.0-alpha.29) (2022-01-07)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.28](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.27...v1.0.0-alpha.28) (2022-01-07)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.27](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.26...v1.0.0-alpha.27) (2022-01-05)

### Features

- update smui to latest versions ([7ed7bd3](https://github.com/sciactive/nymphjs/commit/7ed7bd34d01a155c7001a2671de25ef2f3363682))

# [1.0.0-alpha.26](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.25...v1.0.0-alpha.26) (2021-12-30)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.25](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.24...v1.0.0-alpha.25) (2021-12-30)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.24](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.23...v1.0.0-alpha.24) (2021-12-30)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.23](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.22...v1.0.0-alpha.23) (2021-12-30)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.22](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.21...v1.0.0-alpha.22) (2021-12-14)

### Features

- update smui to latest versions ([912873b](https://github.com/sciactive/nymphjs/commit/912873b863d1ae5d51c359a3c0558bff38ce85cd))

# [1.0.0-alpha.21](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.20...v1.0.0-alpha.21) (2021-11-29)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.20](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.19...v1.0.0-alpha.20) (2021-11-24)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.19](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.18...v1.0.0-alpha.19) (2021-11-18)

### Features

- update smui and other packages to latest versions ([2465340](https://github.com/sciactive/nymphjs/commit/24653400d887bc04c41c3c4ee0c73ce2f2289e0d))

# [1.0.0-alpha.18](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.17...v1.0.0-alpha.18) (2021-11-09)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.17](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.16...v1.0.0-alpha.17) (2021-10-14)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.16](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.15...v1.0.0-alpha.16) (2021-10-14)

### Bug Fixes

- don't ignore built files in npm packages ([7d688db](https://github.com/sciactive/nymphjs/commit/7d688dbec362f1f71fb451a1d0dbcaecc15d99fc))

# [1.0.0-alpha.15](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.14...v1.0.0-alpha.15) (2021-10-14)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.14](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.13...v1.0.0-alpha.14) (2021-10-14)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.13](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.12...v1.0.0-alpha.13) (2021-10-14)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.12](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.11...v1.0.0-alpha.12) (2021-10-13)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.11](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.10...v1.0.0-alpha.11) (2021-10-13)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.10](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.9...v1.0.0-alpha.10) (2021-10-12)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.9](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.8...v1.0.0-alpha.9) (2021-10-12)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.8](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.7...v1.0.0-alpha.8) (2021-10-12)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.7](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.6...v1.0.0-alpha.7) (2021-10-05)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.6](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.5...v1.0.0-alpha.6) (2021-10-05)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.5](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.4...v1.0.0-alpha.5) (2021-09-30)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.4](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.3...v1.0.0-alpha.4) (2021-09-27)

**Note:** Version bump only for package @nymphjs/driver-postgresql

# [1.0.0-alpha.3](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.2...v1.0.0-alpha.3) (2021-09-22)

### Features

- move to fully instance based design, no more globals ([c036220](https://github.com/sciactive/nymphjs/commit/c0362209b90a475b8b85269a829b0ec6bed4465f))

# [1.0.0-alpha.2](https://github.com/sciactive/nymphjs/compare/v1.0.0-alpha.1...v1.0.0-alpha.2) (2021-09-21)

### Features

- migrate PostgreSQL driver ([7cbe71b](https://github.com/sciactive/nymphjs/commit/7cbe71bd48bc5e70f292e2babdf7adff96ac0b93))
