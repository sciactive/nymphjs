import { type Nymph, EntityUniqueConstraintError } from '@nymphjs/nymph';

import type Tilmeld from './Tilmeld.js';
import defaults from './conf/defaults.js';
import { AccessControlError } from './errors/index.js';

export function UserTest(
  nymph: Nymph,
  tilmeld: Tilmeld,
  describe: (name: string, fn: () => void) => void,
  it: (name: string, fn: () => void) => void,
) {
  const User = tilmeld.User;
  const Group = tilmeld.Group;

  describe('User', () => {
    beforeAll(async () => {
      // Ensure the tables exist.
      try {
        await User.factoryUsername('user');
        await Group.factoryGroupname('group');
      } catch (e) {
        // ignore
      }
    });

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
      tilmeld.config.generatePrimary = false;
      class NoUsernameCheckUser extends User {
        public async $checkUsername() {
          return {
            result: true,
            message: 'No problem here!',
          };
        }
      }

      const newUserA = await NoUsernameCheckUser.factory();

      newUserA.username = 'new-user';
      newUserA.email = 'newusera@localhost';
      newUserA.nameFirst = 'New';
      newUserA.nameLast = 'User';
      newUserA.name = 'New User';
      newUserA.$password('password');

      await newUserA.$saveSkipAC();

      const newUserB = await NoUsernameCheckUser.factory();

      newUserB.username = 'new-user';
      newUserB.email = 'newuserb@localhost';
      newUserB.nameFirst = 'New';
      newUserB.nameLast = 'User';
      newUserB.name = 'New User';
      newUserB.$password('password');

      try {
        await newUserB.$saveSkipAC();

        throw new Error("Shouldn't get here because of unique constraint.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(EntityUniqueConstraintError);
      }

      await newUserA.$deleteSkipAC();

      tilmeld.config.generatePrimary = true;
    });

    it("doesn't allow duplicate emails", async () => {
      tilmeld.config.generatePrimary = false;
      class NoEmailCheckUser extends User {
        public async $checkEmail() {
          return {
            result: true,
            message: 'No problem here!',
          };
        }
      }

      const newUserA = await NoEmailCheckUser.factory();

      newUserA.username = 'new-user-a';
      newUserA.email = 'newuser@localhost';
      newUserA.nameFirst = 'New';
      newUserA.nameLast = 'User';
      newUserA.name = 'New User';
      newUserA.$password('password');

      await newUserA.$saveSkipAC();

      const newUserB = await NoEmailCheckUser.factory();

      newUserB.username = 'new-user-b';
      newUserB.email = 'newuser@localhost';
      newUserB.nameFirst = 'New';
      newUserB.nameLast = 'User';
      newUserB.name = 'New User';
      newUserB.$password('password');

      try {
        await newUserB.$saveSkipAC();

        throw new Error("Shouldn't get here because of unique constraint.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(EntityUniqueConstraintError);
      }

      await newUserA.$deleteSkipAC();

      tilmeld.config.generatePrimary = true;
    });

    it('allows a domain user', async () => {
      const domainAdmin = await User.factory();

      domainAdmin.username = 'admin';
      domainAdmin.email = 'admin@localhost';
      domainAdmin.nameFirst = 'Admin';
      domainAdmin.nameLast = 'User';
      domainAdmin.name = 'Admin User';
      domainAdmin.$password('password');
      domainAdmin.$grant('tilmeld/domain/example.com/admin');

      await domainAdmin.$saveSkipAC();

      // Log in the domain admin.
      await tilmeld.fillSession(domainAdmin);

      const domainUser = await User.factory();

      domainUser.username = 'new-user@example.com';
      domainUser.email = 'newuser@localhost';
      domainUser.nameFirst = 'New';
      domainUser.nameLast = 'User';
      domainUser.name = 'New User';
      domainUser.$password('password');

      await domainUser.$save();

      tilmeld.clearSession();

      for (const user of [domainAdmin, domainUser]) {
        if (user.guid != null) {
          await user.$deleteSkipAC();
        }
      }
    });

    it('disallows a domain user with no admin permission', async () => {
      const domainAdmin = await User.factory();

      domainAdmin.username = 'admin';
      domainAdmin.email = 'admin@localhost';
      domainAdmin.nameFirst = 'Admin';
      domainAdmin.nameLast = 'User';
      domainAdmin.name = 'Admin User';
      domainAdmin.$password('password');
      domainAdmin.$grant('tilmeld/domain/example.com/admin');

      await domainAdmin.$saveSkipAC();

      // Log in the domain admin.
      await tilmeld.fillSession(domainAdmin);

      const domainUser = await User.factory();

      // The wrong domain name.
      domainUser.username = 'new-user@example.net';
      domainUser.email = 'newuser@localhost';
      domainUser.nameFirst = 'New';
      domainUser.nameLast = 'User';
      domainUser.name = 'New User';
      domainUser.$password('password');

      try {
        await domainUser.$save();

        throw new Error("Shouldn't get here because of access control.");
      } catch (e: any) {
        expect(e).toBeInstanceOf(AccessControlError);
      }

      tilmeld.clearSession();

      for (const user of [domainAdmin, domainUser]) {
        if (user.guid != null) {
          await user.$deleteSkipAC();
        }
      }
    });
  });
}
