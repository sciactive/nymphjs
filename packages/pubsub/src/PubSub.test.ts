import express from 'express';
import SQLite3Driver from '@nymphjs/driver-sqlite3';
import { Nymph as NymphServer } from '@nymphjs/nymph';
import type { PubSubSubscription, PubSubUpdate } from '@nymphjs/client';
import { Nymph, PubSub } from '@nymphjs/client';
import createRestServer from '@nymphjs/server';
import {
  EmployeeModel as EmployeeModelClass,
  Employee as EmployeeClass,
  EmployeeData,
  RestrictedModel as RestrictedModelClass,
  Restricted as RestrictedClass,
  PubSubDisabledModel as PubSubDisabledModelClass,
  PubSubDisabled as PubSubDisabledClass,
  PubSubDisabledData,
} from '@nymphjs/server/dist/testArtifacts.js';

import createServer from './index.js';
import PubSubServer from './PubSub.js';

const sqliteConfig = {
  filename: ':memory:',
};

const pubSubConfig = {
  originIsAllowed: () => true,
  entries: ['ws://localhost:5083/'],
  logger: () => {},
};

const nymphServer = new NymphServer({}, new SQLite3Driver(sqliteConfig));
const EmployeeModel = nymphServer.addEntityClass(EmployeeModelClass);
const RestrictedModel = nymphServer.addEntityClass(RestrictedModelClass);
const PubSubDisabledModel = nymphServer.addEntityClass(
  PubSubDisabledModelClass,
);
const removePublisher = PubSubServer.initPublisher(pubSubConfig, nymphServer);

const app = express();
app.use(createRestServer(nymphServer));
const server = app.listen(5082);

const pubsubServer = createServer(5083, pubSubConfig, nymphServer);

const nymphOptions = {
  restUrl: 'http://localhost:5082/',
  pubsubUrl: 'ws://localhost:5083/',
  noConsole: true,
};
const nymph = new Nymph(nymphOptions);
const pubsub = new PubSub(nymphOptions, nymph);
const Employee = nymph.addEntityClass(EmployeeClass);
const Restricted = nymph.addEntityClass(RestrictedClass);
const PubSubDisabled = nymph.addEntityClass(PubSubDisabledClass);

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
    let jane: Promise<EmployeeClass>;

    await new Promise<void>((resolve) => {
      let updated = false;
      const subscription = pubsub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          equal: ['name', 'Jane Doe'],
        },
      )(async (update) => {
        if (updated) {
          expect('added' in update && update.added).toEqual((await jane).guid);
          expect('data' in update && update.data.guid).toEqual(
            (await jane).guid,
          );
          subscription.unsubscribe();
          resolve();
        } else {
          expect(update).toEqual([]);
          updated = true;
          jane = createJane();
        }
      });
    });
  });

  it('notified of new match only after transaction committed', async () => {
    let guid: string;
    let committed = false;

    await new Promise<void>((resolve) => {
      let updated = false;
      const subscription = pubsub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          equal: ['name', 'Steve Transaction'],
        },
      )(async (update) => {
        if (updated) {
          if (committed) {
            expect('added' in update && update.added).toEqual(guid);
            expect('data' in update && update.data.guid).toEqual(guid);
          } else {
            throw new Error('Update arrived before transaction committed.');
          }
          subscription.unsubscribe();
          resolve();
        } else {
          expect(update).toEqual([]);
          updated = true;
          const tnymph = await nymphServer.startTransaction('steve');
          const Employee = tnymph.getEntityClass(EmployeeModel);
          const steve = await Employee.factory();
          steve.name = 'Steve Transaction';
          steve.current = true;
          steve.salary = 8000000;
          steve.startDate = Date.now();
          steve.subordinates = [];
          steve.title = 'Seniorer Person';
          try {
            await steve.$save();
            guid = steve.guid as string;
            await new Promise<void>((res) => setTimeout(res, 1000));
            committed = true;
            await tnymph.commit('steve');
          } catch (e: any) {
            console.error('Error creating entity: ', e);
            throw e;
          }
        }
      });
    });
  });

  it('not notified of new match when transaction rolled back', async () => {
    let guid: string;

    await new Promise<void>((resolve) => {
      let updated = false;
      const subscription = pubsub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          equal: ['name', 'Steve Rollback'],
        },
      )(async (update) => {
        if (updated) {
          if ('added' in update && update.added === guid) {
            throw new Error('Update arrived after transaction rolled back.');
          }
          throw new Error('Update arrived unrelated to transaction.');
        } else {
          expect(update).toEqual([]);
          updated = true;
          const tnymph = await nymphServer.startTransaction('steve');
          const Employee = tnymph.getEntityClass(EmployeeModel);
          const steve = await Employee.factory();
          steve.name = 'Steve Rollback';
          steve.current = true;
          steve.salary = 8000000;
          steve.startDate = Date.now();
          steve.subordinates = [];
          steve.title = 'Seniorer Person';
          try {
            await steve.$save();
            guid = steve.guid as string;
            await new Promise<void>((res) => setTimeout(res, 600));
            await tnymph.rollback('steve');
            await new Promise<void>((res) => setTimeout(res, 600));
            subscription.unsubscribe();
            resolve();
          } catch (e: any) {
            console.error('Error creating entity: ', e);
            throw e;
          }
        }
      });
    });
  });

  it('notified of new match after complex transactions committed', async () => {
    let guid: string;
    let committed = false;

    await new Promise<void>((resolve) => {
      let updated = false;
      const subscription = pubsub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          equal: ['name', 'Steve Complex'],
        },
      )(async (update) => {
        if (updated) {
          if (committed) {
            expect('added' in update && update.added).toEqual(guid);
            expect('data' in update && update.data.guid).toEqual(guid);
          } else {
            throw new Error('Update arrived before transaction committed.');
          }
          subscription.unsubscribe();
          resolve();
        } else {
          expect(update).toEqual([]);
          updated = true;
          const tnymphTop = await nymphServer.startTransaction('steve-top');

          // Start a transaction that ultimately gets rolled back.
          const tnymphB = await tnymphTop.startTransaction('steve-b');
          const EmployeeB = tnymphB.getEntityClass(EmployeeModel);
          const badSteve = await EmployeeB.factory();
          badSteve.name = 'Steve Complex';
          badSteve.current = true;
          badSteve.salary = 8000000;
          badSteve.startDate = Date.now();
          badSteve.subordinates = [];
          badSteve.title = 'Seniorer Person';
          try {
            await badSteve.$save();
            await new Promise<void>((res) => setTimeout(res, 200));
            await tnymphB.rollback('steve-b');
            await new Promise<void>((res) => setTimeout(res, 200));
          } catch (e: any) {
            console.error('Error creating entity: ', e);
            throw e;
          }

          // Start a transaction that ultimately gets committed.
          const tnymphA = await tnymphTop.startTransaction('steve-a');
          const EmployeeA = tnymphA.getEntityClass(EmployeeModel);
          const goodSteve = await EmployeeA.factory();
          goodSteve.name = 'Steve Complex';
          goodSteve.current = true;
          goodSteve.salary = 8000000;
          goodSteve.startDate = Date.now();
          goodSteve.subordinates = [];
          goodSteve.title = 'Seniorer Person';
          try {
            await goodSteve.$save();
            guid = goodSteve.guid as string;
            await new Promise<void>((res) => setTimeout(res, 200));
            await tnymphA.commit('steve-a');
            await new Promise<void>((res) => setTimeout(res, 400));
            committed = true;
            await tnymphTop.commit('steve-top');
          } catch (e: any) {
            console.error('Error creating entity: ', e);
            throw e;
          }
        }
      });
    });
  });

  it('notified of entity update', async () => {
    let jane = await createJane();
    let entities: (EmployeeClass & EmployeeData)[] = [];

    await new Promise<void>((resolve) => {
      let mdate = 0;
      if (jane.guid == null) {
        throw new Error('Entity is null.');
      }
      const subscription = pubsub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          guid: jane.guid,
        },
      )(async (update) => {
        pubsub.updateArray(entities, update);

        if (mdate > 0 && (entities[0]?.mdate ?? -1) === mdate) {
          subscription.unsubscribe();
          resolve();
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
    let entities: (EmployeeClass & EmployeeData)[] = [];

    await new Promise<void>((resolve) => {
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
        },
      )(async (update) => {
        pubsub.updateArray(entities, update);

        if (mdate > 0 && (entities[0]?.mdate ?? -1) === mdate) {
          subscription.unsubscribe();
          resolve();
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
    let entities: (EmployeeClass & EmployeeData)[] = [];

    // Create employees that matches qref to test when multiple things match.
    let oldEmployee = await createJane();
    oldEmployee.current = false;
    await oldEmployee.$save();
    let oldEmployee2 = await createJane();
    oldEmployee2.current = false;
    await oldEmployee2.$save();

    expect(
      await new Promise<boolean>((resolve) => {
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
          },
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
      }),
    ).toEqual(true);

    expect(entities.length).toEqual(1);
  });

  it('notified of new match for qref query in transaction', async () => {
    let entities: (EmployeeClass & EmployeeData)[] = [];

    const john = await EmployeeModel.factory();
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

    const jane = await EmployeeModel.factory();
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

    async function createNewBoss() {
      // Create employee that matches qref.
      const tnymph = await nymphServer.startTransaction('qref-test');
      const tnymphDeep = await tnymph.startTransaction('qref-deep-test');

      const TEmployeeModel = tnymph.getEntityClass(EmployeeModel);
      const newBoss = await TEmployeeModel.factory();
      newBoss.name = 'Jill Doe';
      newBoss.current = false;
      newBoss.salary = 8000000;
      newBoss.startDate = Date.now();
      newBoss.subordinates = [john];
      newBoss.title = 'Seniorer Person';
      try {
        await newBoss.$save();
      } catch (e: any) {
        console.error('Error creating entity: ', e);
        throw e;
      }

      newBoss.current = true;
      try {
        await newBoss.$save();
      } catch (e: any) {
        console.error('Error creating entity: ', e);
        throw e;
      }

      await tnymphDeep.commit('qref-deep-test');
      await tnymph.commit('qref-test');
    }

    expect(
      await new Promise<boolean>((resolve) => {
        if (jane.guid == null || john.guid == null) {
          throw new Error('Entity is null.');
        }
        const subscription = pubsub.subscribeEntities(
          { class: Employee },
          {
            type: '&',
            truthy: 'current',
            qref: [
              'subordinates',
              [{ class: Employee }, { type: '&', guid: john.guid }],
            ],
          },
        )(async (update) => {
          pubsub.updateArray(entities, update);

          if (Array.isArray(update)) {
            expect(entities.length).toEqual(1);
            await createNewBoss();
          } else {
            expect(entities.length).toEqual(2);
            subscription.unsubscribe();
            resolve(true);
          }
        });
      }),
    ).toEqual(true);

    expect(entities.length).toEqual(2);
  });

  it('notified of removed match for qref query', async () => {
    let [jane, john] = await createBossJane();
    let entities: (EmployeeClass & EmployeeData)[] = [];

    await new Promise<void>((resolve) => {
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
        },
      )(async (update) => {
        pubsub.updateArray(entities, update);

        if (!entities.length) {
          subscription.unsubscribe();
          resolve();
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
    let entities: (EmployeeClass & EmployeeData)[] = [];

    // Wait for change to propagate. (Only needed since we're not going across network.)
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 10));

    await new Promise<void>((resolve) => {
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
        },
      )(async (update) => {
        pubsub.updateArray(entities, update);

        if (updated) {
          subscription.unsubscribe();
          resolve();
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
    let jane: EmployeeClass & EmployeeData;
    let entities: (EmployeeClass & EmployeeData)[] = [];

    let removed = false;
    await new Promise<void>((resolve) => {
      const subscription = pubsub.subscribeEntities(
        { class: Employee },
        {
          type: '&',
          equal: ['name', 'Jane Doe'],
        },
      )(async (update) => {
        pubsub.updateArray(entities, update);

        if (Array.isArray(update)) {
          jane = await createJane();
          if (jane.guid == null) {
            throw new Error('Entity is null.');
          }
        } else if ('added' in update) {
          await entities.find((e) => e.guid === update.added)?.$delete();
        } else if ('removed' in update && update.removed === jane.guid) {
          subscription.unsubscribe();
          removed = true;
          resolve();
        }
      });
    });

    expect(removed).toBeTruthy();
  });

  it('entire match is updated', async () => {
    let jane: (EmployeeClass & EmployeeData) | undefined;
    let entities: (EmployeeClass & EmployeeData)[] = [];
    await createJane();

    // Wait for change to propagate. (Only needed since we're not going across network.)
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 10));

    await new Promise<void>((resolve) => {
      let receivedRemove = false;
      let receivedAdd = false;
      const subscription = pubsub.subscribeEntities(
        { class: Employee, limit: 1, reverse: true },
        {
          type: '&',
          equal: ['name', 'Jane Doe'],
        },
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
            resolve();
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

    await new Promise<void>(async (resolve) => {
      let mdate = 0;
      const subscription = pubsub.subscribeWith(jane, async () => {
        expect(jane.guid).not.toBeNull();
        if (mdate > 0 && (jane.mdate ?? -1) === mdate) {
          subscription.unsubscribe();
          resolve();
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

  it("doesn't allow subscription of a restricted entity class", async () => {
    let receivedBadUpdate = false;
    let error = null;

    await new Promise<void>((resolve) => {
      pubsub.subscribeEntities(
        { class: Restricted },
        {
          type: '&',
          equal: ['name', 'Jane Doe'],
        },
      )(
        async () => {
          receivedBadUpdate = true;
          resolve();
        },
        (e: any) => {
          error = e;
          resolve();
        },
      );
    });

    expect(receivedBadUpdate).toEqual(false);
    expect(error).toEqual('Not accessible.');
  });

  it("doesn't notify of new pubsub disabled entity class", async () => {
    let receivedBadUpdate = false;

    await new Promise<void>(async (resolve) => {
      const subscription = await new Promise<
        PubSubSubscription<
          PubSubUpdate<(PubSubDisabledClass & PubSubDisabledData)[]>
        >
      >(async (resolve) => {
        let updated = false;
        const subscription = pubsub.subscribeEntities({
          class: PubSubDisabled,
        })(async (update) => {
          if (updated) {
            receivedBadUpdate = true;
          } else {
            expect(update).toEqual([]);
            updated = true;
            try {
              const entity = await PubSubDisabled.factory();
              entity.name = 'Someone';
              if (!(await entity.$save())) {
                throw new Error("Couldn't save.");
              }
              resolve(subscription);
            } catch (e: any) {
              console.error('Error creating entity: ', e);
              throw e;
            }
          }
        });
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      subscription.unsubscribe();
      resolve();
    });

    expect(receivedBadUpdate).toEqual(false);
  });

  it('new uid', async () => {
    await new Promise<void>(async (resolve) => {
      const subscription = pubsub.subscribeUID('testNewUID')(
        async (value) => {
          expect(value).toEqual(directValue);
          subscription.unsubscribe();
          resolve();
        },
        (err) => {
          expect(err.status).toEqual(404);
        },
      );

      const directValue = await nymph.newUID('testNewUID');
    });
  });

  it('increasing uids', async () => {
    await new Promise<void>(async (resolve) => {
      let receivedFirst = false;
      let lastUpdate: number = 0;
      const subscription = pubsub.subscribeUID('testIncUID')(
        async (value) => {
          if (!receivedFirst) {
            receivedFirst = true;
            expect(value).toBeNull();
            return;
          }

          expect(value).toEqual(lastUpdate + 1);
          lastUpdate = value;
          if (value == 100) {
            subscription.unsubscribe();
            resolve();
          }
        },
        (err) => {
          expect(err.status).toEqual(404);
        },
      );

      await nymph.deleteUID('testIncUID');

      let directValue: number = -1;
      while (directValue < 100) {
        directValue = await nymph.newUID('testIncUID');
      }
    });
  });

  it('set uid', async () => {
    await new Promise<void>(async (resolve) => {
      const subscription = pubsub.subscribeUID('testSetUID')(
        async (value) => {
          expect(value).toEqual(123);
          subscription.unsubscribe();
          resolve();
        },
        (err) => {
          expect(err.status).toEqual(404);
        },
      );

      await nymph.setUID('testSetUID', 123);
    });
  });

  it('rename uid from old name', async () => {
    await new Promise<void>(async (resolve) => {
      let updated = false;
      const subscription = pubsub.subscribeUID('testRenameUID')(
        async (value, event) => {
          if (updated) {
            expect(event).toEqual('renameUID');
            expect(value).toEqual(null);
            subscription.unsubscribe();
            resolve();
          } else if (event === 'setUID') {
            expect(value).toEqual(456);
            updated = true;
          }
        },
        (err) => {
          expect(err.status).toEqual(404);
        },
      );

      await nymph.setUID('testRenameUID', 456);
      await nymphServer.renameUID('testRenameUID', 'newRenameUID');
    });
  });

  it('rename uid from new name', async () => {
    await new Promise<void>(async (resolve) => {
      const subscription = pubsub.subscribeUID('newRename2UID')(
        async (value, event) => {
          expect(event).toEqual('setUID');
          expect(value).toEqual(456);
          subscription.unsubscribe();
          resolve();
        },
        (err) => {
          expect(err.status).toEqual(404);
        },
      );

      await nymph.setUID('testRename2UID', 456);
      await nymphServer.renameUID('testRename2UID', 'newRename2UID');
    });
  });

  it('delete uid', async () => {
    await nymph.setUID('testDeleteUID', 789);

    await new Promise<void>(async (resolve) => {
      let updated = false;
      const subscription = pubsub.subscribeUID('testDeleteUID')(
        async (value, event) => {
          if (updated && event === 'deleteUID') {
            expect(value).toEqual(null);
            subscription.unsubscribe();
            resolve();
          } else {
            expect(value).toEqual(789);
            updated = true;
            await nymph.deleteUID('testDeleteUID');
          }
        },
        (err) => {
          expect(err.status).toEqual(404);
        },
      );
    });
  });

  beforeEach(async () => {
    pubsub.connect();
    while (!pubsub.isConnectionOpen()) {
      await new Promise<void>((resolve) => setTimeout(resolve, 20));
    }
  });

  afterAll(async () => {
    // Don't publish anything after the tests.
    removePublisher();

    // Avoid jest open handle errors.
    const closed = new Promise<void>((resolve) => {
      pubsub.on('disconnect', () => {
        resolve();
      });
    });
    pubsub.close(); // close PubSub client.
    await closed;
    pubsubServer.close(); // close PubSub server.
    server.close(); // close REST server.
  });
});
