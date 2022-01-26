import express from 'express';
import SQLite3Driver from '@nymphjs/driver-sqlite3';
import { Nymph as NymphServer } from '@nymphjs/nymph';
import { Nymph, PubSub } from '@nymphjs/client-node';
import createRestServer from '@nymphjs/server';
import {
  EmployeeModel,
  Employee,
  EmployeeData,
} from '@nymphjs/server/dist/testArtifacts.js';

import createServer from './index';
import PubSubServer from './PubSub';

const sqliteConfig = {
  filename: ':memory:',
};

const pubSubConfig = {
  originIsAllowed: () => true,
  entries: ['ws://localhost:5081/'],
  logger: () => {},
};

const nymphServer = new NymphServer({}, new SQLite3Driver(sqliteConfig));
nymphServer.addEntityClass(EmployeeModel);
PubSubServer.initPublisher(pubSubConfig, nymphServer);

const app = express();
app.use(createRestServer(nymphServer));
const server = app.listen(5080);

const pubsubServer = createServer(5081, pubSubConfig, nymphServer);

const nymphOptions = {
  restUrl: 'http://localhost:5080/',
  pubsubUrl: 'ws://localhost:5081/',
  noConsole: true,
};
const nymph = new Nymph(nymphOptions);
const pubsub = new PubSub(nymphOptions, nymph);
nymph.addEntityClass(Employee);

describe('Nymph REST Server and Client', () => {
  async function createJane() {
    const jane = await Employee.factory();
    jane.name = 'Jane Doe';
    jane.current = true;
    jane.salary = 8000000;
    jane.startDate = Date.now();
    jane.subordinates = [];
    jane.title = 'Seniorer Person';
    try {
      await jane.$save();
    } catch (e: any) {
      console.error('Error creating entity: ', e);
      throw e;
    }
    return jane;
  }

  async function createBossJane() {
    const john = await Employee.factory();
    john.name = 'John Der';
    john.current = true;
    john.salary = 8000000;
    john.startDate = Date.now();
    john.subordinates = [];
    john.title = 'Junior Person';
    try {
      await john.$save();
    } catch (e: any) {
      console.error('Error creating entity: ', e);
      throw e;
    }

    const jane = await Employee.factory();
    jane.name = 'Jane Doe';
    jane.current = true;
    jane.salary = 8000000;
    jane.startDate = Date.now();
    jane.subordinates = [john];
    jane.title = 'Seniorer Person';
    try {
      await jane.$save();
    } catch (e: any) {
      console.error('Error creating entity: ', e);
      throw e;
    }
    return [jane, john];
  }

  it('notified of new match', async () => {
    let jane: Promise<Employee>;

    await new Promise((resolve) => {
      let updated = false;
      const subscription = pubsub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          equal: ['name', 'Jane Doe'],
        }
      )(async (update) => {
        if (updated) {
          expect('added' in update && update.added).toEqual((await jane).guid);
          expect('data' in update && update.data.guid).toEqual(
            (await jane).guid
          );
          subscription.unsubscribe();
          resolve(true);
        } else {
          expect(update).toEqual([]);
          updated = true;
          jane = createJane();
        }
      });
    });
  });

  it('notified of entity update', async () => {
    let jane = await createJane();
    let entities: (Employee & EmployeeData)[] = [];

    await new Promise((resolve) => {
      let mdate = 0;
      if (jane.guid == null) {
        throw new Error('Entity is null.');
      }
      const subscription = pubsub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          guid: jane.guid,
        }
      )(async (update) => {
        pubsub.updateArray(entities, update);

        if (mdate > 0 && (entities[0]?.mdate ?? -1) === mdate) {
          subscription.unsubscribe();
          resolve(true);
        } else if (Array.isArray(update)) {
          expect(update.length).toEqual(1);
          expect(entities[0].salary).toEqual(8000000);
          // Time for a raise!
          jane.salary = (jane.salary ?? 0) + 1000000;
          await jane.$save();
          mdate = jane.mdate ?? 0;
        }
      });
    });

    expect(entities[0].salary).toEqual(9000000);
  });

  it('notified of entity update for qref query', async () => {
    let [jane, john] = await createBossJane();
    let entities: (Employee & EmployeeData)[] = [];

    await new Promise((resolve) => {
      let mdate = 0;
      if (jane.guid == null || john.guid == null) {
        throw new Error('Entity is null.');
      }
      const subscription = pubsub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          qref: [
            'subordinates',
            [{ class: Employee }, { type: '&', guid: john.guid }],
          ],
        }
      )(async (update) => {
        pubsub.updateArray(entities, update);

        if (mdate > 0 && (entities[0]?.mdate ?? -1) === mdate) {
          subscription.unsubscribe();
          resolve(true);
        } else if (Array.isArray(update)) {
          expect(update.length).toEqual(1);
          expect(entities[0].salary).toEqual(8000000);
          // Time for a raise!
          jane.salary = (jane.salary ?? 0) + 1000000;
          await jane.$save();
          mdate = jane.mdate ?? 0;
        }
      });
    });

    expect(entities[0].salary).toEqual(9000000);
  });

  it('notified of new match for qref query', async () => {
    let [jane, john] = await createBossJane();
    let entities: (Employee & EmployeeData)[] = [];

    await new Promise((resolve) => {
      if (jane.guid == null || john.guid == null) {
        throw new Error('Entity is null.');
      }
      const subscription = pubsub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          guid: jane.guid,
          qref: [
            'subordinates',
            [{ class: Employee }, { type: '&', '!truthy': 'current' }],
          ],
        }
      )(async (update) => {
        pubsub.updateArray(entities, update);

        if (entities.length) {
          subscription.unsubscribe();
          resolve(true);
        } else if (Array.isArray(update)) {
          expect(update.length).toEqual(0);

          // John gets fired.
          john.current = false;
          await john.$save();
        }
      });
    });

    expect(entities.length).toEqual(1);
  });

  it('notified of removed match for qref query', async () => {
    let [jane, john] = await createBossJane();
    let entities: (Employee & EmployeeData)[] = [];

    await new Promise((resolve) => {
      if (jane.guid == null || john.guid == null) {
        throw new Error('Entity is null.');
      }
      const subscription = pubsub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          guid: jane.guid,
          qref: [
            'subordinates',
            [{ class: Employee }, { type: '&', truthy: 'current' }],
          ],
        }
      )(async (update) => {
        pubsub.updateArray(entities, update);

        if (!entities.length) {
          subscription.unsubscribe();
          resolve(true);
        } else if (Array.isArray(update)) {
          expect(update.length).toEqual(1);

          // John gets fired.
          john.current = false;
          await john.$save();
        }
      });
    });

    expect(entities.length).toEqual(0);
  });

  it('receives correct number of updates', async () => {
    let jane = await createJane();
    let entities: (Employee & EmployeeData)[] = [];

    // Wait for change to propagate. (Only needed since we're not going across network.)
    await new Promise((resolve) => setTimeout(() => resolve(true), 10));

    await new Promise((resolve) => {
      // Should only receive 1 update, since we waited.
      let updated = false;
      if (jane.guid == null) {
        throw new Error('Entity is null.');
      }
      const subscription = pubsub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          guid: jane.guid,
        }
      )(async (update) => {
        pubsub.updateArray(entities, update);

        if (updated) {
          subscription.unsubscribe();
          resolve(true);
        } else if (Array.isArray(update)) {
          expect(update.length).toEqual(1);
          expect(entities[0].salary).toEqual(8000000);
          updated = true;
          // Time for a raise!
          jane.salary = (jane.salary ?? 0) + 1000000;
          await jane.$save();
        }
      });
    });

    expect(entities[0].salary).toEqual(9000000);
  });

  it('notified of entity delete', async () => {
    let jane = await createJane();
    let entities: (Employee & EmployeeData)[] = [];

    // Wait for change to propagate. (Only needed since we're not going across network.)
    await new Promise((resolve) => setTimeout(() => resolve(true), 10));

    let length: number = -1;
    await new Promise((resolve) => {
      let updated = false;
      if (jane.guid == null) {
        throw new Error('Entity is null.');
      }
      const subscription = pubsub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          equal: ['name', 'Jane Doe'],
        }
      )(async (update) => {
        pubsub.updateArray(entities, update);

        if (updated) {
          subscription.unsubscribe();
          resolve(true);
        } else if (Array.isArray(update)) {
          expect(update.length).toBeGreaterThan(0);
          updated = true;
          length = update.length;
          await jane.$delete();
        }
      });
    });

    expect(entities.length).toEqual(length - 1);
  });

  it('entire match is updated', async () => {
    let jane: (Employee & EmployeeData) | undefined;
    let entities: (Employee & EmployeeData)[] = [];
    await createJane();

    // Wait for change to propagate. (Only needed since we're not going across network.)
    await new Promise((resolve) => setTimeout(() => resolve(true), 10));

    await new Promise((resolve) => {
      let receivedRemove = false;
      let receivedAdd = false;
      const subscription = pubsub.subscribeEntities(
        { class: Employee, limit: 1, reverse: true },
        {
          type: '&',
          equal: ['name', 'Jane Doe'],
        }
      )(async (update) => {
        pubsub.updateArray(entities, update);

        if (jane) {
          if ('removed' in update) {
            receivedRemove = true;
          }
          if ('added' in update) {
            receivedAdd = true;
          }
          if (receivedAdd && receivedRemove) {
            subscription.unsubscribe();
            resolve(true);
          }
        } else if (Array.isArray(update)) {
          expect(update.length).toEqual(1);
          jane = await createJane();
        }
      });
    });

    expect(entities.length).toEqual(1);
    expect(entities[0].$is(jane)).toEqual(true);
  });

  it('entity subscription is updated', async () => {
    let jane = await createJane();

    await new Promise(async (resolve) => {
      let mdate = 0;
      const subscription = pubsub.subscribeWith(jane, async () => {
        if (mdate > 0 && (jane.mdate ?? -1) === mdate) {
          subscription.unsubscribe();
          resolve(true);
        }
      });

      if (jane.guid == null) {
        throw new Error('Entity is null.');
      }

      expect(jane.salary).toEqual(8000000);
      const janeDupe = await Employee.factory(jane.guid);
      expect(janeDupe.salary).toEqual(8000000);
      // Time for a raise!
      janeDupe.salary = (janeDupe.salary ?? 0) + 1000000;
      await janeDupe.$save();
      mdate = janeDupe.mdate ?? 0;
    });

    expect(jane.salary).toEqual(9000000);
  });

  it('new uid', async () => {
    await new Promise(async (resolve) => {
      const subscription = pubsub.subscribeUID('testNewUID')(
        async (value) => {
          expect(value).toEqual(directValue);
          subscription.unsubscribe();
          resolve(true);
        },
        (err) => {
          expect(err.status).toEqual(404);
        }
      );

      const directValue = await nymph.newUID('testNewUID');
    });
  });

  it('increasing uids', async () => {
    await new Promise(async (resolve) => {
      let lastUpdate: number;
      const subscription = pubsub.subscribeUID('testIncUID')(
        async (value) => {
          if (lastUpdate) {
            expect(value).toEqual(lastUpdate + 1);
          } else {
            expect(value).toEqual(1);
          }
          lastUpdate = value;
          if (value == 100) {
            subscription.unsubscribe();
            resolve(true);
          }
        },
        (err) => {
          expect(err.status).toEqual(404);
        }
      );

      let directValue: number = -1;
      while (directValue < 100) {
        directValue = await nymph.newUID('testIncUID');
      }
    });
  });

  it('set uid', async () => {
    await new Promise(async (resolve) => {
      const subscription = pubsub.subscribeUID('testSetUID')(
        async (value) => {
          expect(value).toEqual(123);
          subscription.unsubscribe();
          resolve(true);
        },
        (err) => {
          expect(err.status).toEqual(404);
        }
      );

      await nymph.setUID('testSetUID', 123);
    });
  });

  it('rename uid from old name', async () => {
    await new Promise(async (resolve) => {
      let updated = false;
      const subscription = pubsub.subscribeUID('testRenameUID')(
        async (value, event) => {
          if (updated) {
            expect(event).toEqual('renameUID');
            expect(value).toEqual(null);
            subscription.unsubscribe();
            resolve(true);
          } else {
            expect(value).toEqual(456);
            updated = true;
          }
        },
        (err) => {
          expect(err.status).toEqual(404);
        }
      );

      await nymph.setUID('testRenameUID', 456);
      await nymphServer.renameUID('testRenameUID', 'newRenameUID');
    });
  });

  it('rename uid from new name', async () => {
    await new Promise(async (resolve) => {
      const subscription = pubsub.subscribeUID('newRename2UID')(
        async (value, event) => {
          expect(event).toEqual('setUID');
          expect(value).toEqual(456);
          subscription.unsubscribe();
          resolve(true);
        },
        (err) => {
          expect(err.status).toEqual(404);
        }
      );

      await nymph.setUID('testRename2UID', 456);
      await nymphServer.renameUID('testRename2UID', 'newRename2UID');
    });
  });

  it('delete uid', async () => {
    await nymph.setUID('testDeleteUID', 789);

    await new Promise(async (resolve) => {
      let updated = false;
      const subscription = pubsub.subscribeUID('testDeleteUID')(
        async (value, event) => {
          if (updated && event === 'deleteUID') {
            expect(value).toEqual(null);
            subscription.unsubscribe();
            resolve(true);
          } else {
            expect(value).toEqual(789);
            updated = true;
          }
        },
        (err) => {
          expect(err.status).toEqual(404);
        }
      );

      await nymph.deleteUID('testDeleteUID');
    });
  });

  afterAll(async () => {
    // avoid jest open handle error
    const closed = new Promise((resolve) => {
      pubsub.on('disconnect', () => {
        resolve(true);
      });
    });
    pubsub.close(); // close PubSub client.
    await closed;
    pubsubServer.close(); // close PubSub server.
    server.close(); // close REST server.
  });
});
