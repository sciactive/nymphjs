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

  afterAll(() => {
    server.close(); // avoid jest open handle error
  });
});
