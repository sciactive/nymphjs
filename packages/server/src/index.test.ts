import express from 'express';
import SQLite3Driver from '@nymphjs/driver-sqlite3';
import { Nymph as NymphServer } from '@nymphjs/nymph';
import { Nymph, Entity, HttpError } from '@nymphjs/client';

import createServer from './index.js';
import {
  EmployeeModel as EmployeeModelClass,
  Employee as EmployeeClass,
  RestrictedModel as RestrictedModelClass,
  Restricted as RestrictedClass,
  EmployeeData,
} from './testArtifacts.js';

const sqliteConfig = {
  filename: ':memory:',
};

const nymphServer = new NymphServer({}, new SQLite3Driver(sqliteConfig));
const EmployeeModel = nymphServer.addEntityClass(EmployeeModelClass);
const RestrictedModel = nymphServer.addEntityClass(RestrictedModelClass);

const app = express();
app.use('/test', createServer(nymphServer));
const server = app.listen(5080);

const REST_URL = 'http://localhost:5080/test/';
const nymph = new Nymph({
  restUrl: REST_URL,
});
const Employee = nymph.addEntityClass(EmployeeClass);
const Restricted = nymph.addEntityClass(RestrictedClass);

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
    await nymph.saveEntities(entities);

    if (entity.guid == null || entity2.guid == null) {
      throw new Error('Entity is null.');
    }

    entity.building = 'J2';
    entity2.building = 'B4';

    await nymph.saveEntities(entities);

    const jane = await nymph.getEntity({ class: Employee }, entity.guid);
    const john = await nymph.getEntity({ class: Employee }, entity2.guid);

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

    const checkSteve = await nymph.getEntity(
      { class: Employee },
      {
        type: '&',
        ref: ['subordinates', jane],
      },
    );

    expect(checkSteve?.guid).toEqual(steve.guid);

    const checkSteveQref = await nymph.getEntity(
      { class: Employee },
      {
        type: '&',
        qref: [
          'subordinates',
          [{ class: Employee }, { type: '&', guid: jane.guid }],
        ],
      },
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
      true,
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
    ]) as EmployeeClass & EmployeeData;
    await entity.$wake();

    expect(entity?.name).toEqual('Jane Doe');
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

    const jane = await nymph.getEntity(
      {
        class: Employee,
      },
      {
        type: '&',
        equal: ['name', 'Jane Doe'],
      },
    );

    expect(jane).not.toBeNull();
    expect(jane?.guid).not.toBeNull();
  });

  it('try to get a non-existent entity', async () => {
    let error = { status: 200 };
    try {
      await nymph.getEntity(
        {
          class: Employee,
        },
        {
          type: '&',
          equal: ['name', 'Non Existent'],
        },
      );
    } catch (e: any) {
      error = e;
    }
    expect(error.status).toEqual(404);
  });

  it('try to get a non-existent entity without error', async () => {
    const nymph = new Nymph({
      restUrl: REST_URL,
      returnNullOnNotFound: true,
    });
    const Employee = nymph.addEntityClass(EmployeeClass);

    const nonexistent = await nymph.getEntity(
      {
        class: Employee,
      },
      {
        type: '&',
        equal: ['name', 'Non Existent'],
      },
    );

    expect(nonexistent).toBeNull();
  });

  it('get entities', async () => {
    for (let i = 0; i < 4; i++) {
      await createJane();
    }

    const entities = await nymph.getEntities(
      {
        class: Employee,
        limit: 4,
      },
      {
        type: '&',
        tag: ['employee'],
      },
    );

    expect(entities.length).toEqual(4);
    entities.forEach((entity) => {
      expect(entity.guid).not.toBeNull();
    });
  });

  it('get entity counts', async () => {
    for (let i = 0; i < 20; i++) {
      await createJane();
    }

    const result = await nymph.getEntities({ class: Employee });

    // Testing count return...
    const resultCount = await nymph.getEntities({
      class: Employee,
      return: 'count',
    });
    expect(resultCount).toBeGreaterThanOrEqual(1);
    expect(resultCount).toEqual(result.length);

    const resultSelectors = await nymph.getEntities(
      { class: Employee },
      { type: '&', equal: ['name', 'Jane Doe'] },
    );

    // Testing count return with selectors...
    const resultSelectorsCount = await nymph.getEntities(
      { class: Employee, return: 'count' },
      { type: '&', equal: ['name', 'Jane Doe'] },
    );
    expect(resultSelectorsCount).toBeGreaterThanOrEqual(1);
    expect(resultSelectorsCount).toEqual(resultSelectors.length);

    // Testing count return with limit...
    const resultSelectorsLimit = await nymph.getEntities({
      class: Employee,
      limit: 1,
      return: 'count',
    });
    expect(resultSelectorsLimit).toEqual(1);

    // Testing count return with limit...
    const resultSelectorsSingle = await nymph.getEntity({
      class: Employee,
      return: 'count',
    });
    expect(resultSelectorsSingle).toEqual(1);

    // Testing empty count...
    const resultSelectorsEmpty = await nymph.getEntities(
      { class: Employee, return: 'count' },
      { type: '&', tag: 'pickle' },
    );
    expect(resultSelectorsEmpty).toEqual(0);
  });

  it('get entity GUIDs', async () => {
    for (let i = 0; i < 4; i++) {
      await createJane();
    }

    const entities = await nymph.getEntities(
      {
        class: Employee,
        limit: 4,
        return: 'guid',
      },
      {
        type: '&',
        tag: 'employee',
      },
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

    const entities = await nymph.getEntities(
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
      },
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

    const entities = await nymph.getEntities(
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
      },
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

    const entities = await nymph.getEntities(
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
      },
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

    const check = await nymph.getEntities(
      { class: Employee },
      {
        type: '&',
        guid,
      },
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

    const deleted = await nymph.deleteEntities(janes);
    expect(deleted).toEqual(guids);

    const check = await nymph.getEntities(
      { class: Employee },
      {
        type: '|',
        guid: guids,
      },
    );

    expect(check.length).toEqual(0);
  });

  it('try to save Entity class directly', async () => {
    const entity = new Entity() as Entity & { something: string };
    entity.$nymph = nymph;
    entity.something = 'Anything';
    let error = { message: '' };
    try {
      await entity.$save();
    } catch (e: any) {
      error = e;
    }
    expect(error.message).toEqual(
      "Can't use Entity class directly from the front end.",
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
    let error = { status: 0, error: { name: '' } };
    try {
      await Employee.throwErrorStatic();
    } catch (e: any) {
      error = e;
    }
    expect(error.status).toEqual(500);
    expect(error.error.name).toEqual('BadFunctionCallError');
  });

  it('handle server side static iterator error', async () => {
    let error: any = { status: 0, error: { name: '' } };
    const data = await Employee.throwErrorStaticIterable();

    let count = 0;
    for await (let value of data) {
      count++;
      if (value instanceof Error) {
        error = value;
      } else {
        expect(value).toEqual(count);
      }
    }

    expect(count).toEqual(2);
    expect(error.status).toEqual(500);
    expect(error.error.name).toEqual('BadFunctionCallError');
  });

  it('handle server side error', async () => {
    const jane = await createJane();

    let error = { status: 0, error: { name: '' } };
    try {
      await jane.$throwError();
    } catch (e: any) {
      error = e;
    }
    expect(error.status).toEqual(500);
    expect(error.error.name).toEqual('BadFunctionCallError');
  });

  it('handle server side HTTP error', async () => {
    const jane = await createJane();

    let error = { status: 0, statusText: '', message: '' };
    try {
      await jane.$throwHttpError();
    } catch (e: any) {
      error = e;
    }
    expect(error.status).toEqual(501);
    expect(error.statusText).toEqual('Not Implemented');
    expect(error.message).toEqual('A 501 HTTP error.');
  });

  it('handle server side custom HTTP error', async () => {
    const jane = await createJane();

    let error = { status: 0, statusText: '', message: '' };
    try {
      await jane.$throwHttpErrorWithDescription();
    } catch (e: any) {
      error = e;
    }
    expect(error.status).toEqual(512);
    expect(error.statusText).toEqual('Some Error');
    expect(error.message).toEqual('A 512 HTTP error.');
  });

  it('call a server side static method', async () => {
    const data = await Employee.testStatic(5);
    expect(data).toEqual(10);
  });

  it('call a server side static iterator method', async () => {
    const data = await Employee.testStaticIterable(5);

    let count = 0;
    for await (let value of data) {
      count++;
      expect(value).toEqual(5 + count);
    }

    expect(count).toEqual(3);
  });

  it('aborts a server side static iterator method', async () => {
    const data = await Employee.testStaticIterableAbort();
    data.abortController.abort();

    // Wait 1 second to ensure server receives abort signal.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    expect(true).toBeTruthy();
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

    const jane2 = await nymph.getEntity(
      {
        class: Employee,
      },
      jane1.guid,
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

    const second = await nymph.getEntity(
      {
        class: Employee,
      },
      first.guid,
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

    const second = await nymph.getEntity(
      {
        class: Employee,
      },
      first.guid,
    );

    if (second == null || second.guid == null) {
      throw new Error('Entity is null.');
    }

    expect(first.$is(second)).toEqual(true);

    second.other = 'this';
    second.thing = 'this';

    expect(first.$is(second)).toEqual(true);

    await createJane();

    const third = await nymph.getEntity(
      {
        class: Employee,
      },
      {
        type: '&',
        '!guid': first.guid,
      },
    );

    if (third == null || third.guid == null) {
      throw new Error('Entity is null.');
    }

    expect(first.$is(third)).toEqual(false);
  });

  it("doesn't allow creation of a restricted entity class", async () => {
    const attempt = await Restricted.factory();
    attempt.name = 'Jane Doe';

    let error = null;

    try {
      await attempt.$save();
    } catch (e: any) {
      error = e;
    }

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toEqual(403);
  });

  it("doesn't allow search of a restricted entity class", async () => {
    let error = null;

    try {
      await nymph.getEntity({
        class: Restricted,
      });
    } catch (e: any) {
      error = e;
    }

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toEqual(403);
  });

  it("doesn't allow methods of a restricted entity class", async () => {
    const attempt = await Restricted.factory();
    attempt.name = 'Jane Doe';

    let error = null;

    try {
      await attempt.$testMethod(1);
    } catch (e: any) {
      error = e;
    }

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toEqual(403);
  });

  it("doesn't allow static methods of a restricted entity class", async () => {
    let error = null;

    try {
      await Restricted.testStatic(1);
    } catch (e: any) {
      error = e;
    }

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toEqual(403);
  });

  it('get a new UID', async () => {
    const uidValue = await nymph.newUID('employee');
    expect(typeof uidValue).toEqual('number');
    expect(uidValue).toBeGreaterThan(0);

    const uidValue2 = await nymph.newUID('employee');
    expect(typeof uidValue2).toEqual('number');
    expect(uidValue2).toBeGreaterThan(uidValue);
  });

  it('get UID value', async () => {
    const uidValue = await nymph.getUID('employee');
    expect(typeof uidValue).toEqual('number');
    expect(uidValue).toBeGreaterThan(0);

    const uidValue2 = await nymph.getUID('employee');
    expect(typeof uidValue2).toEqual('number');
    expect(uidValue2).toEqual(uidValue);
  });

  it('set UID value', async () => {
    const uidValue = await nymph.newUID('employee');
    expect(typeof uidValue).toEqual('number');
    expect(uidValue).toBeGreaterThan(0);

    const success = await nymph.setUID('employee', uidValue - 1);
    expect(success).toEqual(true);

    const uidValue2 = await nymph.getUID('employee');
    expect(typeof uidValue2).toEqual('number');
    expect(uidValue2).toEqual(uidValue - 1);
  });

  it('delete UID', async () => {
    const uidValue = await nymph.newUID('temp');
    expect(typeof uidValue).toEqual('number');
    expect(uidValue).toEqual(1);

    await nymph.deleteUID('temp');

    let error = { status: 200 };
    try {
      await nymph.getUID('temp');
    } catch (e: any) {
      error = e;
    }
    expect(error.status).toEqual(404);
  });

  afterAll(() => {
    server.close(); // avoid jest open handle error
  });
});
