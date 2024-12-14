import { type Server } from 'node:http';
import express from 'express';
import SQLite3Driver from '@nymphjs/driver-sqlite3';
import { Nymph as NymphServer } from '@nymphjs/nymph';
import { Nymph } from '@nymphjs/client-node';
import { type NymphOptions } from '@nymphjs/client';
import {
  Tilmeld,
  type Config as TilmeldConfig,
  User as UserModelClass,
  Group as GroupModelClass,
} from '@nymphjs/tilmeld';
import createServer from '@nymphjs/server';

import {
  User as UserClass,
  Group as GroupClass,
  CurrentUserData,
} from './index.js';

describe('Tilmeld Client', () => {
  let server: Server | undefined = undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      if (server) {
        server.close(() => resolve()); // avoid jest open handle error
      } else {
        resolve();
      }
    });
  });

  async function createNymphTilmeldServer(
    config?: Partial<TilmeldConfig>,
    clientConfig?: Partial<NymphOptions>,
  ) {
    // Wait for next event loop.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const sqliteConfig = {
      filename: ':memory:',
    };

    const tilmeld = new Tilmeld({
      jwtSecret: 'supersecrettestingsecret',
      allowRegistration: true,
      verifyEmail: false,
      emailUsernames: false,
      ...config,
    });
    const nymphServer = new NymphServer(
      {},
      new SQLite3Driver(sqliteConfig),
      tilmeld,
    );
    const UserModel = nymphServer.addEntityClass(UserModelClass);
    const GroupModel = nymphServer.addEntityClass(GroupModelClass);

    const app = express();
    app.use('/test', createServer(nymphServer));
    server = app.listen(5084);

    const nymph = new Nymph({
      restUrl: 'http://localhost:5084/test/',
      ...(clientConfig ?? {}),
    });
    const User = nymph.addEntityClass(UserClass);
    User.init(nymph);
    const Group = nymph.addEntityClass(GroupClass);

    return {
      tilmeld,
      nymphServer,
      UserModel,
      GroupModel,
      app,
      nymph,
      User,
      Group,
    };
  }

  async function createAdmin(User: typeof UserClass) {
    const admin = User.factorySync() as UserClass & CurrentUserData;
    admin.username = 'admin';
    admin.email = 'root@localhost';
    admin.nameFirst = 'Admin';
    admin.nameLast = 'User';

    try {
      const result = await admin.$register({
        password: 'supersecretadminpassword',
      });

      return { result, admin };
    } catch (e: any) {
      console.error('Error creating admin:', e);
      throw e;
    }
  }

  async function createUser(User: typeof UserClass) {
    const user = User.factorySync() as UserClass & CurrentUserData;
    user.username = 'user';
    user.email = 'user@localhost';
    user.nameFirst = 'Some';
    user.nameLast = 'User';

    try {
      const result = await user.$register({
        password: 'supersecretuserpassword',
      });

      return { result, user };
    } catch (e: any) {
      console.error('Error creating user:', e);
      throw e;
    }
  }

  it('get client config', async () => {
    const { User } = await createNymphTilmeldServer();

    const result = await User.getClientConfig();

    expect(result).not.toBeNull();
    expect(result.verifyEmail).toBeFalsy();
  });

  it('produce errors when register data is incorrect', async () => {
    const { User } = await createNymphTilmeldServer();

    try {
      const admin = User.factorySync() as UserClass & CurrentUserData;

      let result = await admin.$register({
        password: 'supersecretadminpassword',
      });

      expect(result.result).toBeFalsy();
      expect(result.loggedin).toBeFalsy();
      expect(result.message).toEqual('Please specify a username.');
      expect(admin.guid).toBeNull();

      admin.username = 'admin';
      try {
        expect(
          (result = await admin.$register({
            password: 'supersecretadminpassword',
          })),
        ).toThrow();
      } catch (e: any) {
        expect(e.status).toEqual(400);
        expect(e.message).toEqual('Please specify a valid email.');
      }

      admin.email = 'root@localhost';
      try {
        expect(
          (result = await admin.$register({
            password: 'supersecretadminpassword',
          })),
        ).toThrow();
      } catch (e: any) {
        expect(e.status).toEqual(400);
        expect(e.message).toEqual('Invalid Group:  "name" is required');
      }

      expect(admin.guid).toBeNull();
    } catch (e: any) {
      console.error('Error running test: ', e);
      throw e;
    }
  });

  it('create admin user', async () => {
    const { User } = await createNymphTilmeldServer();

    try {
      const { result, admin } = await createAdmin(User);

      expect(result.result).toBeTruthy();
      expect(result.loggedin).toBeTruthy();
      expect(result.message).toEqual("You're now registered and logged in!");

      expect(admin.guid).not.toBeNull();
      expect(typeof admin.guid).toEqual('string');

      const permission = await admin.$gatekeeper('system/admin');

      expect(permission).toBeTruthy();
    } catch (e: any) {
      console.error('Error running test: ', e);
      throw e;
    }
  });

  it('logout', async () => {
    const { User } = await createNymphTilmeldServer();

    try {
      const { admin } = await createAdmin(User);

      const user1 = await User.current();

      expect(user1?.guid).toEqual(admin.guid);

      expect((await admin.$logout()).result).toBeTruthy();

      const user2 = await User.current();

      expect(user2).toBeNull();
    } catch (e: any) {
      console.error('Error running test: ', e);
      throw e;
    }
  });

  it('second user', async () => {
    const { User } = await createNymphTilmeldServer();

    try {
      const { admin } = await createAdmin(User);
      expect((await admin.$logout()).result).toBeTruthy();

      const { result, user } = await createUser(User);

      expect(result.result).toBeTruthy();
      expect(result.loggedin).toBeTruthy();
      expect(result.message).toEqual("You're now registered and logged in!");

      expect(user.guid).not.toBeNull();
      expect(typeof user.guid).toEqual('string');

      const permission = await user.$gatekeeper('system/admin');

      expect(permission).toBeFalsy();
    } catch (e: any) {
      console.error('Error running test: ', e);
      throw e;
    }
  });

  it("doesn't issue renewed token when not needed", async () => {
    const { User, nymph } = await createNymphTilmeldServer({
      jwtExpire: 5,
      jwtRenew: 0,
    });

    let responses = 0;
    nymph.on('response', (response) => {
      if (responses === 0) {
        expect(response.headers.get('set-cookie')).toMatch(
          /^TILMELDAUTH=[^;]+; Max-Age=5; Domain=localhost; Path=\/; Expires=[^;]+; SameSite=Strict$/,
        );
      } else {
        expect(response.headers.has('set-cookie')).toBeFalsy();
      }
      responses++;
    });

    try {
      const { admin } = await createAdmin(User);

      expect(await admin.$gatekeeper()).toBeTruthy();

      expect(responses).toEqual(2);
    } catch (e: any) {
      console.error('Error running test: ', e);
      throw e;
    }
  });

  it('issues renewed token when needed', async () => {
    const { User, nymph } = await createNymphTilmeldServer({
      jwtExpire: 5,
      jwtRenew: 5,
    });

    let responses = 0;
    nymph.on('response', (response) => {
      expect(response.headers.get('set-cookie')).toMatch(
        /^TILMELDAUTH=[^;]+; Max-Age=5; Domain=localhost; Path=\/; Expires=[^;]+; SameSite=Strict$/,
      );
      responses++;
    });

    try {
      const { admin } = await createAdmin(User);

      expect(await admin.$gatekeeper()).toBeTruthy();

      expect(responses).toEqual(2);
    } catch (e: any) {
      console.error('Error running test: ', e);
      throw e;
    }
  });

  it("doesn't issue renewed token when requested", async () => {
    const { User, nymph } = await createNymphTilmeldServer(
      {
        jwtExpire: 5,
        jwtRenew: 5,
      },
      { renewTokens: false },
    );

    let responses = 0;
    nymph.on('response', (response) => {
      if (responses === 0) {
        expect(response.headers.get('set-cookie')).toMatch(
          /^TILMELDAUTH=[^;]+; Max-Age=5; Domain=localhost; Path=\/; Expires=[^;]+; SameSite=Strict$/,
        );
      } else {
        expect(response.headers.has('set-cookie')).toBeFalsy();
      }
      responses++;
    });

    try {
      const { admin } = await createAdmin(User);

      expect(await admin.$gatekeeper()).toBeTruthy();

      expect(responses).toEqual(2);
    } catch (e: any) {
      console.error('Error running test: ', e);
      throw e;
    }
  });
});
