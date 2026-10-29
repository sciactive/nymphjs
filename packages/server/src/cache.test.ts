import express from 'express';
import SQLite3Driver from '@nymphjs/driver-sqlite3';
import { Nymph as NymphServer } from '@nymphjs/nymph';
import { Nymph } from '@nymphjs/client';

import createServer from './index.js';
import {
  EmployeeModel as EmployeeModelClass,
  Employee as EmployeeClass,
} from './testArtifacts.js';

const sqliteConfig = {
  filename: ':memory:',
};

const nymphServer = new NymphServer({}, new SQLite3Driver(sqliteConfig));
const EmployeeModel = nymphServer.addEntityClass(EmployeeModelClass);

const app = express();
app.use('/test', createServer(nymphServer));
const server = app.listen(5081);

const nymph = new Nymph({
  restUrl: 'http://localhost:5081/test/',
  weakCache: true,
  weakCacheKeepDirtyData: true,
});
const Employee = nymph.addEntityClass(EmployeeClass);

describe('Nymph REST Server and Client with Client Weak Ref Cache', () => {
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

  it('change an entity and check weakCache', async () => {
    // @ts-ignore TS doesn't know about WeakRef.
    if (typeof WeakRef === 'undefined') {
      throw new Error(
        'You must run this test in an environment that includes WeakRef.',
      );
    }

    const employee = await createJane();

    if (employee.guid == null) {
      throw new Error('Entity is null.');
    }

    const checkA = await Employee.factory(employee.guid);
    const checkB = await nymph.getEntity(
      { class: Employee },
      { type: '&', guid: employee.guid },
    );

    if (!checkB) {
      throw new Error("Couldn't fetch entity.");
    }

    employee.current = false;

    expect(checkA.current).toEqual(false);
    expect(checkB.current).toEqual(false);
  });

  it('make two identical queries and check whether the same result is returned', async () => {
    // @ts-ignore TS doesn't know about WeakRef.
    if (typeof WeakRef === 'undefined') {
      throw new Error(
        'You must run this test in an environment that includes WeakRef.',
      );
    }

    const employee = await createJane();

    if (employee.guid == null) {
      throw new Error('Entity is null.');
    }

    const checkAPromise = nymph.getEntity(
      { class: Employee },
      { type: '&', guid: employee.guid },
    );
    const checkBPromise = nymph.getEntity(
      { class: Employee },
      { type: '&', guid: employee.guid },
    );

    const checkA = await checkAPromise;

    if (!checkA) {
      throw new Error("Couldn't fetch entity.");
    }

    checkA.name = 'Success!';

    const checkB = await checkBPromise;

    if (!checkB) {
      throw new Error("Couldn't fetch entity.");
    }

    expect(checkA.name).toEqual('Success!');
    expect(checkB.name).toEqual('Success!');
  });

  afterAll(() => {
    server.close(); // avoid jest open handle error
  });
});
