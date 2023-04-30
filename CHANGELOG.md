# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
