import express from 'express';
import SQLite3Driver from '@nymphjs/driver-sqlite3';
import NymphServer from '@nymphjs/nymph';
import { Nymph } from '@nymphjs/client-node';
import { PubSub } from '@nymphjs/client';
import rest from '@nymphjs/server';
import { Employee, EmployeeData } from '@nymphjs/server/dist/testArtifacts.js';

import createServer from './index';
import PubSubServer from './PubSub';

const sqliteConfig = {
  filename: ':memory:',
};

const pubSubConfig = {
  entries: ['ws://localhost:5081/'],
  logger: () => {},
};

NymphServer.init({}, new SQLite3Driver(sqliteConfig));
PubSubServer.initPublisher(pubSubConfig);

const app = express();
app.use(rest);
const server = app.listen(5080);

const pubsub = createServer(5081, pubSubConfig);

Nymph.init({
  restURL: 'http://localhost:5080/',
  pubsubURL: 'ws://localhost:5081/',
  noConsole: true,
});

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
    } catch (e) {
      console.error('Error creating entity: ', e);
      throw e;
    }
    return jane;
  }

  it('notified of new match', async () => {
    let jane: Promise<Employee>;

    await new Promise((resolve) => {
      let updated = false;
      const subscription = PubSub.subscribeEntities(
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
      const subscription = PubSub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          guid: jane.guid,
        }
      )(async (update) => {
        PubSub.updateArray(entities, update);

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
      const subscription = PubSub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          guid: jane.guid,
        }
      )(async (update) => {
        PubSub.updateArray(entities, update);

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
      const subscription = PubSub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          equal: ['name', 'Jane Doe'],
        }
      )(async (update) => {
        PubSub.updateArray(entities, update);

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
      const subscription = PubSub.subscribeEntities(
        { class: Employee, limit: 1, reverse: true },
        {
          type: '&',
          equal: ['name', 'Jane Doe'],
        }
      )(async (update) => {
        PubSub.updateArray(entities, update);

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

  afterAll(async () => {
    // avoid jest open handle error
    const closed = new Promise((resolve) => {
      PubSub.on('disconnect', () => {
        resolve(true);
      });
    });
    PubSub.close(); // close PubSub client.
    await closed;
    pubsub.close(); // close PubSub server.
    server.close(); // close REST server.
  });
});
