import { SQLite3Driver } from '@nymphjs/driver-sqlite3';
import { Nymph } from '@nymphjs/nymph';

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

const Group = tilmeld.Group;

describe('Group', () => {
  async function makeNewGroup() {
    const newGroup = await Group.factory();

    newGroup.groupname = 'new-group';
    newGroup.email = 'newgroup@localhost';
    newGroup.name = 'New Group';

    return newGroup;
  }

  it('new group passes validation', async () => {
    const validGroup = await makeNewGroup();

    expect(() => {
      defaults.validatorGroup({ config: defaults } as Tilmeld, validGroup);
    }).not.toThrow();
  });

  it("doesn't allow unknown keys", async () => {
    const invalidGroup = await makeNewGroup();

    // @ts-ignore: testing unknown keys
    invalidGroup.unknown = 'I should cause an error.';

    expect(() => {
      defaults.validatorGroup({ config: defaults } as Tilmeld, invalidGroup);
    }).toThrow('Invalid Group:  "unknown" is not allowed');
  });
});
