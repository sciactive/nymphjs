# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 1.0.0-alpha.1 (2021-09-06)

### Bug Fixes

- don't attempt to save undefined props and only report query in dev mode ([f18a3f8](https://github.com/sciactive/nymphjs/commit/f18a3f8ff7dd0a7bd1be6853fe15cb2be56cfd68))
- entities waking up when accessing just guid or a property ([25ebdc7](https://github.com/sciactive/nymphjs/commit/25ebdc7046d79cdc7a4935df4172a6ec38322a0f))
- entity save not returned correctly in server ([6814fea](https://github.com/sciactive/nymphjs/commit/6814fea5986e4e43b6998c61c893348d84fc80a0))
- export all defaults also as named exports ([7555190](https://github.com/sciactive/nymphjs/commit/7555190e24ea4d8cf5f2a79cab6944661cf8f609))
- getEntity should never return empty array ([07bee0a](https://github.com/sciactive/nymphjs/commit/07bee0a90e7171ba13b0492f4e408d5c10a62b73))
- pubsub server and client are working now. needs more tests ([add109c](https://github.com/sciactive/nymphjs/commit/add109cfa7e9476a7925c80ab8f3f74e89112756))
- tilmeld register and login ([99b12d2](https://github.com/sciactive/nymphjs/commit/99b12d2799d8ccf2d8fb7bdb3e3b86051e7e7f88))
- typescript errors because caught errors were unknown type ([73425ab](https://github.com/sciactive/nymphjs/commit/73425abb321263d96605f40397162b3e8a0ed1a8))

### Features

- began migrating Nymph code to TypeScript ([07a741d](https://github.com/sciactive/nymphjs/commit/07a741dd088bfb5b83439d4644cd931f99dde3c7))
- convert MySQL driver to use connection pool ([6d95735](https://github.com/sciactive/nymphjs/commit/6d9573577ec13be91d274e8a74cb9595d9c88700))
- finished migrating Tilmeld user/group system ([8074b74](https://github.com/sciactive/nymphjs/commit/8074b74b58dba9d87f1f87cef09d3ca0befaafac))
- make entity factories async and provide a sync version ([e6babb1](https://github.com/sciactive/nymphjs/commit/e6babb1c7f7113dc5dd1bfe4e08821fbf8a73b8a))
- migrated entity query check code ([a0234ba](https://github.com/sciactive/nymphjs/commit/a0234ba3df18fc29cf1862fe3e6d53d687496f8e))
- migrated entity testing code ([d7dbe0b](https://github.com/sciactive/nymphjs/commit/d7dbe0b4bf7f9abaadf995d40264effda3252ff2))
- migrated more driver code ([c0e35b0](https://github.com/sciactive/nymphjs/commit/c0e35b02295eb4894c4dc49f362c07b4181ac4ca))
- migrated more driver code ([20afbbc](https://github.com/sciactive/nymphjs/commit/20afbbcaad0ad6841cd1bc3a5e82b93875faec67))
- migrated more driver code ([1fc3263](https://github.com/sciactive/nymphjs/commit/1fc326359edfb101b46c2b54346b5e17a27eca4f))
- migrated more driver code ([b6230c0](https://github.com/sciactive/nymphjs/commit/b6230c0e20d1074fe6a13957ac334a6a313450af))
- migrated MySQL driver ([3375a81](https://github.com/sciactive/nymphjs/commit/3375a8187a65e8e33c35eabac910e9457f9cb6df))
- migrated SQLite3 driver and driver tests ([a5a3b3e](https://github.com/sciactive/nymphjs/commit/a5a3b3e715fcfa280967dfad710a80faf60a06ce))
- nested and named transactions ([858ba43](https://github.com/sciactive/nymphjs/commit/858ba434cd752817a8054bb2a83ba26a978c4107))
- support ad hoc transactions and don't duplicate string and number data ([efd7e9d](https://github.com/sciactive/nymphjs/commit/efd7e9de9dd89a4bfb2ee603ba94337e954408b4))