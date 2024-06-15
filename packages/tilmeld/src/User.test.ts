import { SQLite3Driver } from '@nymphjs/driver-sqlite3';
import { Nymph, EntityUniqueConstraintError } from '@nymphjs/nymph';

import Tilmeld from './Tilmeld';
import defaults from './conf/defaults';

const tilmeld = new Tilmeld({
  appName: 'My App',
  appUrl: 'http://localhost:8080',
  cookieDomain: 'localhost',
  cookiePath: '/',
  setupPath: '/user',
  emailUsernames: false,
  verifyRedirect: 'http://localhost:8080',
  verifyChangeRedirect: 'http://localhost:8080',
  cancelChangeRedirect: 'http://localhost:8080',
  jwtSecret: 'shhhhh',
});
const _nymph = new Nymph(
  {},
  new SQLite3Driver({
    filename: ':memory:',
  }),
  tilmeld,
);

const User = tilmeld.User;

describe('User', () => {
  async function makeNewUser() {
    const newUser = await User.factory();

    newUser.username = 'new-user';
    newUser.email = 'newuser@localhost';
    newUser.nameFirst = 'New';
    newUser.nameLast = 'User';
    newUser.name = 'New User';
    newUser.$password('password');

    return newUser;
  }

  it('new user passes validation', async () => {
    const validUser = await makeNewUser();

    expect(() => {
      defaults.validatorUser({ config: defaults } as Tilmeld, validUser);
    }).not.toThrow();
  });

  it("doesn't allow unknown keys", async () => {
    const invalidUser = await makeNewUser();

    // @ts-ignore: testing unknown keys
    invalidUser.unknown = 'I should cause an error.';

    expect(() => {
      defaults.validatorUser({ config: defaults } as Tilmeld, invalidUser);
    }).toThrow('Invalid User:  "unknown" is not allowed');
  });

  it("doesn't allow duplicate usernames", async () => {
    const newUserA = await User.factory();

    newUserA.username = 'new-user';
    newUserA.email = 'newusera@localhost';
    newUserA.nameFirst = 'New';
    newUserA.nameLast = 'User';
    newUserA.name = 'New User';
    newUserA.$password('password');

    const newUserB = await User.factory();

    newUserB.username = 'new-user';
    newUserB.email = 'newuserb@localhost';
    newUserB.nameFirst = 'New';
    newUserB.nameLast = 'User';
    newUserB.name = 'New User';
    newUserB.$password('password');

    const promises = [newUserA.$saveSkipAC(), newUserB.$saveSkipAC()];

    try {
      await Promise.all(promises);

      throw new Error("Shouldn't get here because of unique constraint.");
    } catch (e: any) {
      expect(e).toBeInstanceOf(EntityUniqueConstraintError);
    }

    await Promise.allSettled(promises);

    for (const user of [newUserA, newUserB]) {
      if (user.guid != null) {
        expect(await user.$deleteSkipAC()).toEqual(true);
      }
    }
  });

  it("doesn't allow duplicate emails", async () => {
    const newUserA = await User.factory();

    newUserA.username = 'new-user-a';
    newUserA.email = 'newuser@localhost';
    newUserA.nameFirst = 'New';
    newUserA.nameLast = 'User';
    newUserA.name = 'New User';
    newUserA.$password('password');

    const newUserB = await User.factory();

    newUserB.username = 'new-user-b';
    newUserB.email = 'newuser@localhost';
    newUserB.nameFirst = 'New';
    newUserB.nameLast = 'User';
    newUserB.name = 'New User';
    newUserB.$password('password');

    const promises = [newUserA.$saveSkipAC(), newUserB.$saveSkipAC()];

    try {
      await Promise.all(promises);

      throw new Error("Shouldn't get here because of unique constraint.");
    } catch (e: any) {
      expect(e).toBeInstanceOf(EntityUniqueConstraintError);
    }

    await Promise.allSettled(promises);

    for (const user of [newUserA, newUserB]) {
      if (user.guid != null) {
        expect(await user.$deleteSkipAC()).toEqual(true);
      }
    }
  });
});
