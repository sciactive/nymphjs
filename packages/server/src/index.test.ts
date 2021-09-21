import express from 'express';
import SQLite3Driver from '@nymphjs/driver-sqlite3';
import nymphServer from '@nymphjs/nymph';
import { Nymph } from '@nymphjs/client-node';
import { Entity } from '@nymphjs/client';

import createServer from './index';
import { Employee } from './testArtifacts';

const sqliteConfig = {
  filename: ':memory:',
};

nymphServer.init({}, new SQLite3Driver(sqliteConfig));

const app = express();
app.use('/test', createServer(nymphServer));
const server = app.listen(5080);

Nymph.init({
  restUrl: 'http://localhost:5080/test/',
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
    } catch (e: any) {
      console.error('Error creating entity: ', e);
      throw e;
    }
    return jane;
  }

  it('create an entity', async () => {
    const jane = await createJane();

    expect(jane.guid).not.toBeNull();
    expect(typeof jane.guid).toEqual('string');
  });

  it('mdate is updated on save', async () => {
    const jane = await createJane();

    expect(jane.guid).not.toBeNull();

    const oldMdate = jane.mdate ?? Infinity;

    await new Promise((resolve) => setTimeout(() => resolve(true), 100));
    await jane.$save();

    expect(jane.mdate).toBeGreaterThan(oldMdate);
  });

  it('create two unrelated entities', async () => {
    const entity = await Employee.factory();
    entity.name = 'Jane Doe';
    entity.current = true;
    entity.salary = 8000000;
    entity.startDate = Date.now();
    entity.subordinates = [];
    entity.title = 'Seniorer Person';

    const entity2 = await Employee.factory();
    entity2.name = 'John Doe';
    entity2.current = true;
    entity2.salary = 8000000;
    entity2.startDate = Date.now();
    entity2.subordinates = [];
    entity2.title = 'Seniorer Person';

    const entities = [entity, entity2];
    await Nymph.saveEntities(entities);

    if (entity.guid == null || entity2.guid == null) {
      throw new Error('Entity is null.');
    }

    entity.building = 'J2';
    entity2.building = 'B4';

    await Nymph.saveEntities(entities);

    const jane = await Nymph.getEntity({ class: Employee }, entity.guid);
    const john = await Nymph.getEntity({ class: Employee }, entity2.guid);

    expect(jane?.building).toEqual('J2');
    expect(john?.building).toEqual('B4');
  });

  it('create two related entities', async () => {
    const jane = await Employee.factory();
    jane.name = 'Jane Doe';
    jane.current = true;
    jane.salary = 8000000;
    jane.startDate = Date.now();
    jane.subordinates = [];
    jane.title = 'Seniorer Person';
    await jane.$save();

    const steve = await Employee.factory();
    steve.$addTag('boss', 'bigcheese');
    steve.name = 'Steve Guy';
    steve.current = true;
    steve.salary = 8000000;
    steve.startDate = Date.now();
    steve.subordinates = [jane];
    steve.title = 'Executive Person';
    await steve.$save();

    if (jane.guid == null || steve.guid == null) {
      throw new Error('Entity is null.');
    }

    const checkSteve = await Nymph.getEntity(
      { class: Employee },
      {
        type: '&',
        ref: ['subordinates', jane],
      }
    );

    expect(checkSteve?.guid).toEqual(steve.guid);

    const checkSteveQref = await Nymph.getEntity(
      { class: Employee },
      {
        type: '&',
        qref: [
          'subordinates',
          [{ class: Employee }, { type: '&', guid: jane.guid }],
        ],
      }
    );

    expect(checkSteveQref?.guid).toEqual(steve.guid);
  });

  it('add, check, and remove tags', async () => {
    const entity = await Entity.factory();
    entity.$addTag('test');
    expect(entity.$hasTag('test')).toEqual(true);
    entity.$addTag('test', 'test2');
    expect(entity.$hasTag('test', 'test2')).toEqual(true);
    entity.$addTag('test', 'test3', 'test4', 'test5', 'test6');
    expect(entity.$hasTag('test', 'test3', 'test4', 'test5', 'test6')).toEqual(
      true
    );
    entity.$removeTag('test2');
    expect(!entity.$hasTag('test2')).toEqual(true);
    entity.$removeTag('test3', 'test4');
    expect(!entity.$hasTag('test3', 'test4')).toEqual(true);
    entity.$removeTag('test5', 'test6');
    expect(!entity.$hasTag('test5', 'test6')).toEqual(true);
    expect(!(entity.tags < ['test'] || entity.tags > ['test'])).toEqual(true);
  });

  it('wake a sleeping reference', async () => {
    const jane = await createJane();

    if (jane.guid == null) {
      throw new Error('Entity is null.');
    }

    const entity = Employee.factoryReference([
      'nymph_entity_reference',
      jane.guid,
      'Employee',
    ]);
    await entity.$ready();

    expect(jane?.name).toEqual('Jane Doe');
  });

  it('change an entity', async () => {
    const employee = await createJane();

    if (employee.guid == null) {
      throw new Error('Entity is null.');
    }

    delete employee.salary;
    employee.current = false;
    employee.endDate = Date.now() + 1;

    await employee.$save();
    const check = await Employee.factory(employee.guid);

    expect(check.salary).toBeUndefined();
    expect(check.current).toEqual(false);
    expect(check.endDate).toBeGreaterThan(check.startDate ?? 0);
  });

  it('patch an entity', async () => {
    const employee = await createJane();

    if (employee.guid == null) {
      throw new Error('Entity is null.');
    }

    delete employee.salary;
    employee.current = false;
    employee.endDate = Date.now() + 1;

    await employee.$patch();
    const check = await Employee.factory(employee.guid);

    expect(check.salary).toBeUndefined();
    expect(check.current).toEqual(false);
    expect(check.endDate).toBeGreaterThan(check.startDate ?? 0);
  });

  it('get an entity', async () => {
    await createJane();

    const jane = await Nymph.getEntity(
      {
        class: Employee,
      },
      {
        type: '&',
        equal: ['name', 'Jane Doe'],
      }
    );

    expect(jane).not.toBeNull();
    expect(jane?.guid).not.toBeNull();
  });

  it('get entities', async () => {
    for (let i = 0; i < 4; i++) {
      await createJane();
    }

    const entities = await Nymph.getEntities(
      {
        class: Employee,
        limit: 4,
      },
      {
        type: '&',
        tag: ['employee'],
      }
    );

    expect(entities.length).toEqual(4);
    entities.forEach((entity) => {
      expect(entity.guid).not.toBeNull();
    });
  });

  it('get entity GUIDs', async () => {
    for (let i = 0; i < 4; i++) {
      await createJane();
    }

    const entities = await Nymph.getEntities(
      {
        class: Employee,
        limit: 4,
        return: 'guid',
      },
      {
        type: '&',
        tag: ['employee'],
      }
    );

    expect(entities.length).toEqual(4);
    entities.forEach((guid) => {
      expect(typeof guid).toEqual('string');
    });
  });

  it('use two selectors', async () => {
    for (let i = 0; i < 4; i++) {
      await createJane();
    }

    const entities = await Nymph.getEntities(
      {
        class: Employee,
        limit: 4,
      },
      {
        type: '&',
        tag: ['employee'],
      },
      {
        type: '&',
        like: ['name', '%Jane%'],
      }
    );

    expect(entities.length).toEqual(4);
    entities.forEach((entity) => {
      expect(entity.guid).not.toBeNull();
    });
  });

  it('use deep selector', async () => {
    for (let i = 0; i < 4; i++) {
      await createJane();
    }

    const entities = await Nymph.getEntities(
      {
        class: Employee,
        limit: 4,
      },
      {
        type: '&',
        tag: ['employee'],
        selector: {
          type: '|',
          like: ['name', '%Jane%'],
        },
      }
    );

    expect(entities.length).toEqual(4);
    entities.forEach((entity) => {
      expect(entity.guid).not.toBeNull();
    });
  });

  it('use really deep selector', async () => {
    for (let i = 0; i < 4; i++) {
      await createJane();
    }

    const entities = await Nymph.getEntities(
      {
        class: Employee,
        limit: 4,
      },
      {
        type: '&',
        tag: ['employee'],
        selector: {
          type: '|',
          selector: [
            {
              type: '&',
              like: ['name', '%Jane%'],
            },
            {
              type: '&',
              equal: ['name', 'Penelope'],
            },
          ],
        },
      }
    );

    expect(entities.length).toEqual(4);
    entities.forEach((entity) => {
      expect(entity.guid).not.toBeNull();
    });
  });

  it('delete an entity', async () => {
    const jane = await createJane();
    const guid = jane.guid;

    if (guid == null) {
      throw new Error('Entity is null.');
    }

    const deleted = await jane.$delete();
    expect(deleted).toEqual(true);

    const check = await Nymph.getEntities(
      { class: Employee },
      {
        type: '&',
        guid,
      }
    );

    expect(check.length).toEqual(0);
  });

  it('delete entities', async () => {
    const janes = [await createJane(), await createJane()];
    const guids = janes.map((jane) => {
      if (jane.guid == null) {
        throw new Error('Entity is null.');
      }
      return jane.guid;
    });

    const deleted = await Nymph.deleteEntities(janes);
    expect(deleted).toEqual(guids);

    const check = await Nymph.getEntities(
      { class: Employee },
      {
        type: '|',
        guid: guids,
      }
    );

    expect(check.length).toEqual(0);
  });

  it('try to save Entity class directly', async () => {
    const entity = new Entity() as Entity & { something: string };
    entity.something = 'Anything';
    let error = { message: '' };
    try {
      await entity.$save();
    } catch (e: any) {
      error = e;
    }
    expect(error.message).toEqual(
      "Can't use Entity class directly from the front end."
    );
  });

  it('handle forbidden method', async () => {
    let error = { status: 200 };
    try {
      await Employee.inaccessibleMethod();
    } catch (e: any) {
      error = e;
    }
    expect(error.status).toEqual(403);
  });

  it('handle server side static error', async () => {
    let error = { error: { name: '' } };
    try {
      await Employee.throwErrorStatic();
    } catch (e: any) {
      error = e;
    }
    expect(error.error.name).toEqual('BadFunctionCallError');
  });

  it('handle server side error', async () => {
    const jane = await createJane();

    let error = { error: { name: '' } };
    try {
      await jane.$throwError();
    } catch (e: any) {
      error = e;
    }
    expect(error.error.name).toEqual('BadFunctionCallError');
  });

  it('call a server side static method', async () => {
    const data = await Employee.testStatic(5);
    expect(data).toEqual(10);
  });

  it('call a stateless server side method', async () => {
    const jane = await createJane();

    const data = await jane?.$testMethodStateless(5);
    expect(data).toEqual(6);
    expect(jane?.name).toEqual('Jane Doe');
  });

  it('call a server side method', async () => {
    const jane = await createJane();

    expect(jane?.current).toEqual(true);
    const data = await jane?.$testMethod(5);
    expect(data).toEqual(7);
    expect(jane?.current).toEqual(false);
  });

  it('refresh an entity', async () => {
    const jane1 = await createJane();

    if (jane1.guid == null) {
      throw new Error('Entity is null.');
    }

    const jane2 = await Nymph.getEntity(
      {
        class: Employee,
      },
      jane1.guid
    );
    if (jane1 == null || jane2 == null) {
      throw new Error('Entity is null.');
    }

    jane1.name = 'Janet Doe';
    await jane1.$save();

    expect(jane2.name).toEqual('Jane Doe');

    await jane2.$refresh();
    expect(jane2.name).toEqual('Janet Doe');
  });

  it('check two entities are equal', async () => {
    const first = await createJane();

    if (first.guid == null) {
      throw new Error('Entity is null.');
    }

    const second = await Nymph.getEntity(
      {
        class: Employee,
      },
      first.guid
    );

    if (second == null || second.guid == null) {
      throw new Error('Entity is null.');
    }

    first.thing = 'this';
    first.other = 'this';

    second.other = 'this';
    second.thing = 'this';

    expect(first.$equals(second)).toEqual(true);

    second.other = 'that';
    second.thing = 'that';

    expect(first.$equals(second)).toEqual(false);
  });

  it('check two objects are the same entity', async () => {
    const first = await createJane();

    if (first.guid == null) {
      throw new Error('Entity is null.');
    }

    const second = await Nymph.getEntity(
      {
        class: Employee,
      },
      first.guid
    );

    if (second == null || second.guid == null) {
      throw new Error('Entity is null.');
    }

    expect(first.$is(second)).toEqual(true);

    second.other = 'this';
    second.thing = 'this';

    expect(first.$is(second)).toEqual(true);

    await createJane();

    const third = await Nymph.getEntity(
      {
        class: Employee,
      },
      {
        type: '&',
        '!guid': first.guid,
      }
    );

    if (third == null || third.guid == null) {
      throw new Error('Entity is null.');
    }

    expect(first.$is(third)).toEqual(false);
  });

  it('get a new UID', async () => {
    const uidValue = await Nymph.newUID('employee');
    expect(typeof uidValue).toEqual('number');
    expect(uidValue).toBeGreaterThan(0);

    const uidValue2 = await Nymph.newUID('employee');
    expect(typeof uidValue2).toEqual('number');
    expect(uidValue2).toBeGreaterThan(uidValue);
  });

  it('get UID value', async () => {
    const uidValue = await Nymph.getUID('employee');
    expect(typeof uidValue).toEqual('number');
    expect(uidValue).toBeGreaterThan(0);

    const uidValue2 = await Nymph.getUID('employee');
    expect(typeof uidValue2).toEqual('number');
    expect(uidValue2).toEqual(uidValue);
  });

  it('set UID value', async () => {
    const uidValue = await Nymph.newUID('employee');
    expect(typeof uidValue).toEqual('number');
    expect(uidValue).toBeGreaterThan(0);

    const success = await Nymph.setUID('employee', uidValue - 1);
    expect(success).toEqual(true);

    const uidValue2 = await Nymph.getUID('employee');
    expect(typeof uidValue2).toEqual('number');
    expect(uidValue2).toEqual(uidValue - 1);
  });

  it('delete UID', async () => {
    const uidValue = await Nymph.newUID('temp');
    expect(typeof uidValue).toEqual('number');
    expect(uidValue).toEqual(1);

    await Nymph.deleteUID('temp');

    let error = { status: 200 };
    try {
      await Nymph.getUID('temp');
    } catch (e: any) {
      error = e;
    }
    expect(error.status).toEqual(404);
  });

  afterAll(() => {
    server.close(); // avoid jest open handle error
  });
});
