import { type Nymph, EntityUniqueConstraintError } from '@nymphjs/nymph';

import type Tilmeld from './Tilmeld.js';
import defaults from './conf/defaults.js';

export function GroupTest(
  nymph: Nymph,
  tilmeld: Tilmeld,
  describe: (name: string, fn: () => void) => void,
  it: (name: string, fn: () => void) => void,
) {
  const User = tilmeld.User;
  const Group = tilmeld.Group;

  describe('Group', () => {
    beforeAll(async () => {
      // Ensure the tables exist.
      try {
        await User.factoryUsername('user');
        await Group.factoryGroupname('group');
      } catch (e) {
        // ignore
      }
    });

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
      class NoGroupnameCheckGroup extends Group {
        public async $checkGroupname() {
          return {
            result: true,
            message: 'No problem here!',
          };
        }
      }

      const newGroupA = await NoGroupnameCheckGroup.factory();

      newGroupA.groupname = 'new-group';
      newGroupA.email = 'newgroupa@localhost';
      newGroupA.name = 'New Group';

      await newGroupA.$saveSkipAC();

      const newGroupB = await NoGroupnameCheckGroup.factory();

      newGroupB.groupname = 'new-group';
      newGroupB.email = 'newgroupb@localhost';
      newGroupB.name = 'New Group';

      try {
        await newGroupB.$saveSkipAC();

        throw new Error("Shouldn't get here because of unique constraint.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(EntityUniqueConstraintError);
      }

      await newGroupA.$deleteSkipAC();
    });

    it("doesn't allow duplicate emails", async () => {
      class NoEmailCheckGroup extends Group {
        public async $checkEmail() {
          return {
            result: true,
            message: 'No problem here!',
          };
        }
      }

      const newGroupA = await NoEmailCheckGroup.factory();

      newGroupA.groupname = 'new-group-a';
      newGroupA.email = 'newgroup@localhost';
      newGroupA.name = 'New Group';

      await newGroupA.$saveSkipAC();

      const newGroupB = await NoEmailCheckGroup.factory();

      newGroupB.groupname = 'new-group-b';
      newGroupB.email = 'newgroup@localhost';
      newGroupB.name = 'New Group';

      try {
        await newGroupB.$saveSkipAC();

        throw new Error("Shouldn't get here because of unique constraint.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(EntityUniqueConstraintError);
      }

      await newGroupA.$deleteSkipAC();
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
          await group.$deleteSkipAC();
        }
      }
    });
  });
}
