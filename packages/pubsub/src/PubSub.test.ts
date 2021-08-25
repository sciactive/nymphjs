import express from 'express';
import SQLite3Driver from '@nymphjs/driver-sqlite3';
import NymphServer from '@nymphjs/nymph';
import { Nymph } from '@nymphjs/client-node';
import { PubSub } from '@nymphjs/client';
import rest from '@nymphjs/server';
import { Employee } from '@nymphjs/server/dist/testArtifacts.js';

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
