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

  it("doesn't allow duplicate groupnames", async () => {
    const newGroupA = await Group.factory();

    newGroupA.groupname = 'new-group';
    newGroupA.email = 'newgroupa@localhost';
    newGroupA.name = 'New Group';

    const newGroupB = await Group.factory();

    newGroupB.groupname = 'new-group';
    newGroupB.email = 'newgroupb@localhost';
    newGroupB.name = 'New Group';

    const promises = [newGroupA.$saveSkipAC(), newGroupB.$saveSkipAC()];

    try {
      await Promise.all(promises);

      throw new Error("Shouldn't get here because of unique constraint.");
    } catch (e: any) {
      expect(e).toBeInstanceOf(EntityUniqueConstraintError);
    }

    await Promise.allSettled(promises);

    for (const group of [newGroupA, newGroupB]) {
      if (group.guid != null) {
        expect(await group.$deleteSkipAC()).toEqual(true);
      }
    }
  });

  it("doesn't allow duplicate emails", async () => {
    const newGroupA = await Group.factory();

    newGroupA.groupname = 'new-group-a';
    newGroupA.email = 'newgroup@localhost';
    newGroupA.name = 'New Group';

    const newGroupB = await Group.factory();

    newGroupB.groupname = 'new-group-b';
    newGroupB.email = 'newgroup@localhost';
    newGroupB.name = 'New Group';

    const promises = [newGroupA.$saveSkipAC(), newGroupB.$saveSkipAC()];

    try {
      await Promise.all(promises);

      throw new Error("Shouldn't get here because of unique constraint.");
    } catch (e: any) {
      expect(e).toBeInstanceOf(EntityUniqueConstraintError);
    }

    await Promise.allSettled(promises);

    for (const group of [newGroupA, newGroupB]) {
      if (group.guid != null) {
        expect(await group.$deleteSkipAC()).toEqual(true);
      }
    }
  });

  it("doesn't allow two default primary groups", async () => {
    const newGroupA = await Group.factory();

    newGroupA.groupname = 'new-group-a';
    newGroupA.email = 'newgroupa@localhost';
    newGroupA.name = 'New Group';
    newGroupA.defaultPrimary = true;

    const newGroupB = await Group.factory();

    newGroupB.groupname = 'new-group-b';
    newGroupB.email = 'newgroupb@localhost';
    newGroupB.name = 'New Group';
    newGroupB.defaultPrimary = true;

    const promises = [newGroupA.$saveSkipAC(), newGroupB.$saveSkipAC()];

    try {
      await Promise.all(promises);

      throw new Error("Shouldn't get here because of unique constraint.");
    } catch (e: any) {
      expect(e).toBeInstanceOf(EntityUniqueConstraintError);
    }

    await Promise.allSettled(promises);

    for (const group of [newGroupA, newGroupB]) {
      if (group.guid != null) {
        expect(await group.$deleteSkipAC()).toEqual(true);
      }
    }
  });
});
