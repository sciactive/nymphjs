import { Entity, Nymph, TilmeldAccessLevels } from '@nymphjs/nymph';

import Tilmeld from './Tilmeld.js';
import { AccessControlError } from './errors/index.js';
import { TestModel as TestModelClass } from './testArtifacts.js';
import type { AccessControlData } from './Tilmeld.types';

export type TestModelData = {
  name?: string;
} & AccessControlData;

/**
 * This class is a test class that extends the Entity class.
 */
export class TestModel extends Entity<TestModelData> {
  static ETYPE = 'tilmeld_test_model';
  static class = 'TestModel';
  /**
   * This should only be used by the backend.
   */
  private $skipAcWhenDeleting = false;

  /*
   * This should *never* be accessible on the client.
   */
  async $deleteSkipAC() {
    this.$skipAcWhenDeleting = true;
    return await this.$delete();
  }

  $tilmeldDeleteSkipAC() {
    if (this.$skipAcWhenDeleting) {
      this.$skipAcWhenDeleting = false;
      return true;
    }
    return false;
  }
}

export function TilmeldTest(
  nymphBase: Nymph,
  it: (name: string, fn: () => void) => void,
) {
  const tilmeld = new Tilmeld({
    appName: 'My App',
    appUrl: 'http://localhost:8080',
    cookieDomain: 'localhost',
    cookiePath: '/',
    setupPath: '/user',
    emailUsernames: false,
    domainSupport: true,
    verifyRedirect: 'http://localhost:8080',
    verifyChangeRedirect: 'http://localhost:8080',
    cancelChangeRedirect: 'http://localhost:8080',
    jwtSecret: 'shhhhh',
    sendEmail: async (_tilmeld, _options, _user) => {
      return true;
    },
  });
  const nymph = new Nymph(nymphBase.config, nymphBase.driver, tilmeld);

  const User = tilmeld.User;
  const Group = tilmeld.Group;
  const TestModel = nymph.addEntityClass(TestModelClass);

  async function makeUsers() {
    const admin = await User.factoryUsername('admin');
    const bob = await User.factoryUsername('bob');
    const alice = await User.factoryUsername('alice');
    const abgroup = await Group.factoryGroupname('abgroup');

    if (admin.guid == null) {
      admin.username = 'admin';
      admin.email = 'admin@localhost';
      admin.nameFirst = 'Admin';
      admin.nameLast = 'User';
      admin.name = 'Admin User';
      admin.$password('password');
      admin.$grant('system/admin');
      await admin.$saveSkipAC();
    }

    if (abgroup.guid == null) {
      abgroup.groupname = 'abgroup';
      abgroup.email = 'abgroup@localhost';
      abgroup.name = 'AB Group';
      await abgroup.$saveSkipAC();
    }

    if (bob.guid == null) {
      bob.username = 'bob';
      bob.email = 'bob@localhost';
      bob.nameFirst = 'Bob';
      bob.nameLast = 'User';
      bob.name = 'Bob User';
      bob.$password('password');
      bob.$addGroup(abgroup);
      await bob.$saveSkipAC();
    }

    if (alice.guid == null) {
      alice.username = 'alice';
      alice.email = 'alice@localhost';
      alice.nameFirst = 'Alice';
      alice.nameLast = 'User';
      alice.name = 'Alice User';
      alice.$password('password');
      alice.$addGroup(abgroup);
      await alice.$saveSkipAC();
    }

    return { admin, bob, alice, abgroup };
  }

  it('users can log in', async () => {
    const { admin, bob, alice } = await makeUsers();

    let result = await admin.$login({
      username: 'admin',
      password: 'password',
    });

    expect(result.result).toEqual(true);
    expect(admin.$is(User.current())).toEqual(true);

    result = await admin.$logout();

    expect(result.result).toEqual(true);
    expect(User.current()).toBeNull();

    result = await bob.$login({
      username: 'bob',
      password: 'password',
    });

    expect(result.result).toEqual(true);
    expect(bob.$is(User.current())).toEqual(true);

    result = await bob.$logout();

    expect(result.result).toEqual(true);
    expect(User.current()).toBeNull();

    result = await alice.$login({
      username: 'alice',
      password: 'password',
    });

    expect(result.result).toEqual(true);
    expect(alice.$is(User.current())).toEqual(true);

    result = await alice.$logout();

    expect(result.result).toEqual(true);
    expect(User.current()).toBeNull();
  });

  it('creates tables for test model', async () => {
    const testEntity = await nymph.getEntity({ class: TestModel });
    expect(testEntity).toBeNull();
  });

  it('user ownership, group ownership, and access controls are added on entities', async () => {
    const { bob } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);
    expect(testEntityBob?.user?.$is(bob)).toEqual(true);
    expect(testEntityBob?.group?.$is(bob.group)).toEqual(true);
    expect(testEntityBob?.acUser).toEqual(TilmeldAccessLevels.FULL_ACCESS);
    expect(testEntityBob?.acGroup).toEqual(TilmeldAccessLevels.READ_ACCESS);
    expect(testEntityBob?.acOther).toEqual(TilmeldAccessLevels.NO_ACCESS);
    expect(testEntityBob?.acRead).toEqual([]);
    expect(testEntityBob?.acWrite).toEqual([]);
    expect(testEntityBob?.acFull).toEqual([]);
  });

  it("alice can't access an entity owned by bob", async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).toBeNull();
  });

  it("alice can't write to an entity she doesn't have write permission for", async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acRead = [alice];
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    testEntityAlice.name = "Haha! It's mine now!";
    try {
      await testEntityAlice.$save();
      throw new Error('It should have thrown AccessControlError.');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AccessControlError);
    }

    expect(await testEntityAlice.$refresh()).toEqual(true);
    expect(testEntityAlice.name).toEqual("Bob's Entity");
  });

  it('alice can write to an entity she has write permission for', async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acWrite = [alice];
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    testEntityAlice.name = "Haha! It's mine now!";
    expect(await testEntityAlice.$save()).toEqual(true);

    expect(await testEntityAlice.$refresh()).toEqual(true);
    expect(testEntityAlice.name).toEqual("Haha! It's mine now!");
  });

  it("alice can't delete an entity she doesn't have full permission for", async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acWrite = [alice];
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    try {
      await testEntityAlice.$delete();
      throw new Error('It should have thrown AccessControlError.');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AccessControlError);
    }

    expect(await testEntityAlice.$refresh()).toEqual(true);
    expect(testEntityAlice.guid).toEqual(bobsEntity.guid);
  });

  it('alice can delete an entity she has full permission for', async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acFull = [alice];
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    expect(await testEntityAlice.$delete()).toEqual(true);
    const verifyEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );
    expect(verifyEntityAlice).toBeNull();
  });

  it('alice can access an entity her group has permission for', async () => {
    const { bob, alice, abgroup } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acRead = [abgroup];
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);
  });

  it("alice can't write to an entity her group doesn't have write permission for", async () => {
    const { bob, alice, abgroup } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acRead = [abgroup];
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    testEntityAlice.name = "Haha! It's mine now!";
    try {
      await testEntityAlice.$save();
      throw new Error('It should have thrown AccessControlError.');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AccessControlError);
    }

    expect(await testEntityAlice.$refresh()).toEqual(true);
    expect(testEntityAlice.name).toEqual("Bob's Entity");
  });

  it('alice can write to an entity her group has write permission for', async () => {
    const { bob, alice, abgroup } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acWrite = [abgroup];
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    testEntityAlice.name = "Haha! It's mine now!";
    expect(await testEntityAlice.$save()).toEqual(true);

    expect(await testEntityAlice.$refresh()).toEqual(true);
    expect(testEntityAlice.name).toEqual("Haha! It's mine now!");
  });

  it("alice can't delete an entity her group doesn't have full permission for", async () => {
    const { bob, alice, abgroup } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acWrite = [abgroup];
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    try {
      await testEntityAlice.$delete();
      throw new Error('It should have thrown AccessControlError.');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AccessControlError);
    }

    expect(await testEntityAlice.$refresh()).toEqual(true);
    expect(testEntityAlice.guid).toEqual(bobsEntity.guid);
  });

  it('alice can delete an entity her group has full permission for', async () => {
    const { bob, alice, abgroup } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acFull = [abgroup];
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    expect(await testEntityAlice.$delete()).toEqual(true);
    const verifyEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );
    expect(verifyEntityAlice).toBeNull();
  });

  it('alice can access an entity her primary group has permission for', async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.group = alice.group;
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);
  });

  it("alice can't write to an entity her primary group doesn't have write permission for", async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.group = alice.group;
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    testEntityAlice.name = "Haha! It's mine now!";
    try {
      await testEntityAlice.$save();
      throw new Error('It should have thrown AccessControlError.');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AccessControlError);
    }

    expect(await testEntityAlice.$refresh()).toEqual(true);
    expect(testEntityAlice.name).toEqual("Bob's Entity");
  });

  it('alice can write to an entity her primary group has write permission for', async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.group = alice.group;
    bobsEntity.acGroup = TilmeldAccessLevels.WRITE_ACCESS;
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    testEntityAlice.name = "Haha! It's mine now!";
    expect(await testEntityAlice.$save()).toEqual(true);

    expect(await testEntityAlice.$refresh()).toEqual(true);
    expect(testEntityAlice.name).toEqual("Haha! It's mine now!");
  });

  it("alice can't delete an entity her primary group doesn't have full permission for", async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.group = alice.group;
    bobsEntity.acGroup = TilmeldAccessLevels.WRITE_ACCESS;
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    try {
      await testEntityAlice.$delete();
      throw new Error('It should have thrown AccessControlError.');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AccessControlError);
    }

    expect(await testEntityAlice.$refresh()).toEqual(true);
    expect(testEntityAlice.guid).toEqual(bobsEntity.guid);
  });

  it('alice can delete an entity her primary group has full permission for', async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.group = alice.group;
    bobsEntity.acGroup = TilmeldAccessLevels.FULL_ACCESS;
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    expect(await testEntityAlice.$delete()).toEqual(true);
    const verifyEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );
    expect(verifyEntityAlice).toBeNull();
  });

  it('alice can access an entity everyone has permission for', async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acOther = TilmeldAccessLevels.READ_ACCESS;
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);
  });

  it("alice can't write to an entity everyone doesn't have write permission for", async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acOther = TilmeldAccessLevels.READ_ACCESS;
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    testEntityAlice.name = "Haha! It's mine now!";
    try {
      await testEntityAlice.$save();
      throw new Error('It should have thrown AccessControlError.');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AccessControlError);
    }

    expect(await testEntityAlice.$refresh()).toEqual(true);
    expect(testEntityAlice.name).toEqual("Bob's Entity");
  });

  it('alice can write to an entity everyone has write permission for', async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acOther = TilmeldAccessLevels.WRITE_ACCESS;
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    testEntityAlice.name = "Haha! It's mine now!";
    expect(await testEntityAlice.$save()).toEqual(true);

    expect(await testEntityAlice.$refresh()).toEqual(true);
    expect(testEntityAlice.name).toEqual("Haha! It's mine now!");
  });

  it("alice can't delete an entity everyone doesn't have full permission for", async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acOther = TilmeldAccessLevels.WRITE_ACCESS;
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    try {
      await testEntityAlice.$delete();
      throw new Error('It should have thrown AccessControlError.');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AccessControlError);
    }

    expect(await testEntityAlice.$refresh()).toEqual(true);
    expect(testEntityAlice.guid).toEqual(bobsEntity.guid);
  });

  it('alice can delete an entity everyone has full permission for', async () => {
    const { bob, alice } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acOther = TilmeldAccessLevels.FULL_ACCESS;
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();
    await tilmeld.fillSession(alice);

    const testEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityAlice).not.toBeNull();
    expect(testEntityAlice?.guid).toEqual(bobsEntity.guid);

    if (testEntityAlice == null) {
      throw new Error();
    }

    expect(await testEntityAlice.$delete()).toEqual(true);
    const verifyEntityAlice = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );
    expect(verifyEntityAlice).toBeNull();
  });

  it('a clear session can delete an entity everyone has full permission for', async () => {
    const { bob } = await makeUsers();

    await tilmeld.fillSession(bob);

    const bobsEntity = await TestModel.factory();
    bobsEntity.name = "Bob's Entity";
    bobsEntity.acOther = TilmeldAccessLevels.FULL_ACCESS;
    expect(await bobsEntity.$save()).toEqual(true);

    expect(bobsEntity.guid).not.toBeNull();
    expect(bob.$is(bobsEntity.user)).toEqual(true);

    const testEntityBob = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityBob).not.toBeNull();
    expect(testEntityBob?.guid).toEqual(bobsEntity.guid);

    tilmeld.clearSession();

    const testEntityNobody = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );

    expect(testEntityNobody).not.toBeNull();
    expect(testEntityNobody?.guid).toEqual(bobsEntity.guid);

    if (testEntityNobody == null) {
      throw new Error();
    }

    expect(await testEntityNobody.$delete()).toEqual(true);
    const verifyEntityNobody = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: bobsEntity.guid || '' },
    );
    expect(verifyEntityNobody).toBeNull();
  });

  it('allows skip ac deletions', async () => {
    const allEntities = [
      ...(await nymph.getEntities({ class: TestModel, skipAc: true })),
      ...(await nymph.getEntities({ class: User, skipAc: true })),
      ...(await nymph.getEntities({ class: Group, skipAc: true })),
    ];
    for (let entity of allEntities) {
      expect(await entity.$deleteSkipAC()).toEqual(true);
    }
  });
}
