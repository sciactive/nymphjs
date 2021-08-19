import express from 'express';
import SQLite3Driver from '@nymphjs/driver-sqlite3';
import NymphServer from '@nymphjs/nymph';
import { Nymph } from '@nymphjs/client-node';
import { Entity } from '@nymphjs/client';

import rest from './index';
import { Employee } from './testArtifacts';

const sqliteConfig = {
  filename: ':memory:',
};

NymphServer.init({ pubsub: false }, new SQLite3Driver(sqliteConfig));

const app = express();
app.use('/test', rest);
const server = app.listen(5080);

Nymph.init({
  restURL: 'http://localhost:5080/test/',
});

describe('Nymph REST Server', () => {
  async function createJane() {
    const jane = await Employee.factory();
    jane.name = 'Jane Doe';
    jane.current = true;
    jane.salary = 8000000;
    jane.startDate = Date.now();
    jane.subordinates = [];
    jane.title = 'Seniorer Person';
    await jane.$save();
  }

  it('try to save Entity class directly', async () => {
    const entity = new Entity() as Entity & { something: string };
    entity.something = 'Anything';
    let error = { message: '' };
    try {
      await entity.$save();
    } catch (errObj) {
      error = errObj;
    }
    expect(error.message).toEqual(
      "Can't use Entity class directly from the front end."
    );
  });

  it('handle forbidden method', async () => {
    let error = { status: 200 };
    try {
      await Employee.inaccessibleMethod();
    } catch (errObj) {
      error = errObj;
    }
    expect(error.status).toEqual(403);
  });

  it('handle server side static error', async () => {
    let error = { error: { name: '' } };
    try {
      await Employee.throwErrorStatic();
    } catch (errObj) {
      error = errObj;
    }
    expect(error.error.name).toEqual('BadFunctionCallError');
  });

  it('handle server side error', async () => {
    await createJane();

    let error = { error: { name: '' } };
    try {
      const jane = await Nymph.getEntity(
        {
          class: Employee,
        },
        {
          type: '&',
          equal: ['name', 'Jane Doe'],
        }
      );
      await jane?.$throwError();
    } catch (errObj) {
      error = errObj;
    }
    console.log(error);
  });

  // it('', async () => {});

  // it('', async () => {});

  // it('', async () => {});

  // it('', async () => {});

  // it('', async () => {});

  // it('', async () => {});

  // it('', async () => {});

  // it('', async () => {});

  // it('', async () => {});

  // it('', async () => {});

  // it('', async () => {});

  // it('', async () => {});

  // it('', async () => {});

  // it('', async () => {});

  afterAll(() => {
    server.close(); // avoid jest open handle error
  });
});
