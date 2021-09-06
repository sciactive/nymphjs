import { SQLite3Driver } from '@nymphjs/driver-sqlite3';
import { Nymph } from '@nymphjs/nymph';

import Tilmeld from './Tilmeld';
import User from './User';
import defaults from './conf/defaults';

const sqliteConfig = {
  filename: ':memory:',
};

Nymph.init({}, new SQLite3Driver(sqliteConfig), Tilmeld);
Tilmeld.init({
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

  it("doesn't allow unknown keys", async () => {
    const invalidUser = await makeNewUser();

    // @ts-ignore: testing unknown keys
    invalidUser.unknown = 'I should cause an error.';

    expect(() => {
      defaults.validatorUser(invalidUser);
    }).toThrow('Invalid User:  "unknown" is not allowed');
  });
});