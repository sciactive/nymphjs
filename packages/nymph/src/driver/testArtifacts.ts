import fs from 'fs';
import strtotime from 'locutus/php/datetime/strtotime';
import { guid } from '@nymphjs/guid';

import type Nymph from '../Nymph';
import { EntityUniqueConstraintError } from '../errors';
import {
  TestBModel as TestBModelClass,
  TestModel as TestModelClass,
  TestModelData,
  TestEmptyModel as TestEmptyModelClass,
} from '../testArtifacts';

export function EntitiesTest(
  nymph: Nymph,
  it: (name: string, fn: () => void) => void,
) {
  const TestModel = nymph.addEntityClass(TestModelClass);
  const TestBModel = nymph.addEntityClass(TestBModelClass);
  const TestEmptyModel = nymph.addEntityClass(TestEmptyModelClass);

  let testEntity: TestModelClass & TestModelData;
  let testGuid: string;
  let refGuid: string;
  let createdMultiple = false;

  // The entities created by this function are required by many of the tests.
  async function createTestEntities() {
    if (testGuid != null) {
      return;
    }

    // Creating entity...
    testEntity = await TestModel.factory();

    // Saving entity...
    testEntity.name = 'Entity Test ' + new Date().toLocaleString();
    testEntity.null = null;
    testEntity.string = 'test';
    testEntity.array = [
      'full',
      'of',
      'values',
      500,
      { test: true },
      { nullbyte: '\\\x00\u0000  \x00' },
    ];
    testEntity.match = matchValue;
    testEntity.number = 30;
    testEntity.numberString = '30';
    testEntity.timestamp = Date.now();
    expect(await testEntity.$save()).toEqual(true);
    expect(testEntity.guid).not.toBeNull();
    testGuid = testEntity.guid as string;

    const entityReferenceTest: TestModelClass & TestModelData = new TestModel();
    entityReferenceTest.string = 'wrong';
    entityReferenceTest.timestamp = strtotime('-2 days') * 1000;
    expect(await entityReferenceTest.$save()).toEqual(true);
    refGuid = entityReferenceTest.guid as string;
    testEntity.reference = entityReferenceTest;
    testEntity.refArray = [entityReferenceTest];
    expect(await testEntity.$save()).toEqual(true);

    entityReferenceTest.test = 'good';
    expect(await entityReferenceTest.$save()).toEqual(true);

    // Test asynchronous getEntity.
    testEntity = (await nymph.getEntity(
      { class: TestModel },
      testGuid,
    )) as TestModelClass & TestModelData;
    expect(testEntity).toBeInstanceOf(TestModel);
    expect(testEntity.guid).toEqual(testGuid);
  }

  // The entities created by this function are required by many of the tests.
  async function createMultipleTestEntities() {
    if (!createdMultiple) {
      createdMultiple = true;
      // Creating 100 entities...
      for (let i = 0; i < 100; i++) {
        const testEntity = await TestModel.factory();
        testEntity.name = `Multi Test ${i}`;
        // Reverse the number for sort testing.
        testEntity.number = 100 - i;
        testEntity.$removeTag('test');
        testEntity.$addTag('multiTest');
        expect(await testEntity.$save()).toEqual(true);
        // Pause for a few milliseconds so the cdate and mdate can be sorted.
        await new Promise((res) => setTimeout(() => res(1), 5));
      }
    }
  }

  it('delete old test data', async () => {
    let amodels = await nymph.getEntities({ class: TestModel });
    expect(Array.isArray(amodels)).toEqual(true);
    for (const cur of amodels) {
      expect(await cur.$delete()).toEqual(true);
    }

    amodels = await nymph.getEntities({ class: TestModel });
    expect(amodels.length).toEqual(0);

    let bmodels = await nymph.getEntities({ class: TestBModel });
    expect(Array.isArray(bmodels)).toEqual(true);
    for (const cur of bmodels) {
      expect(await cur.$delete()).toEqual(true);
    }

    bmodels = await nymph.getEntities({ class: TestBModel });
    expect(bmodels.length).toEqual(0);
  });

  it('create entity', async () => {
    await createTestEntities();
  });

  it("doesn't create empty entity", async () => {
    const testEntity = await TestEmptyModel.factory();

    expect(await testEntity.$save()).toBeFalsy();
    expect(testEntity.guid).toBeNull();
  });

  it('update mdate on save', async () => {
    await createTestEntities();

    const oldMdate = testEntity.mdate ?? Infinity;

    await new Promise((resolve) => setTimeout(() => resolve(true), 100));
    await testEntity.$save();

    expect(testEntity.mdate).toBeGreaterThan(oldMdate);
  });

  it('create multiple entities', async () => {
    return createMultipleTestEntities();
  });

  it('by guid', async () => {
    await createTestEntities();

    // Retrieving entity by GUID...
    let resultEntity = await nymph.getEntity({ class: TestModel }, testGuid);
    expect(testEntity.$is(resultEntity)).toEqual(true);

    // Using class constructor...
    resultEntity = await TestModel.factory(testGuid);
    expect(testEntity.$is(resultEntity)).toEqual(true);

    // Testing wrong GUID...
    resultEntity = await nymph.getEntity({ class: TestModel }, guid());
    expect(testEntity.$is(resultEntity)).toEqual(false);
  });

  it('transactions', async () => {
    await createTestEntities();

    // Verify not in a transaction.
    expect(await nymph.inTransaction()).toEqual(false);

    let transaction = await nymph.startTransaction('test');
    testEntity.$nymph = transaction;

    if (!(await transaction.inTransaction())) {
      console.log(
        'This Nymph driver or database seems to not support transactions. Skipping transaction tests.',
      );
      await transaction.rollback('test');
      return;
    }

    // Change a value in the test entity.
    testEntity.string = 'bad value';
    expect(await testEntity.$save()).toEqual(true);

    // Rollback the transaction.
    await transaction.rollback('test');

    // Verify not in a transaction.
    expect(await transaction.inTransaction()).toEqual(false);

    // Verify the value is correct.
    await testEntity.$refresh();
    expect(testEntity.string).toEqual('test');

    // Start a new transaction.
    transaction = await nymph.startTransaction('test');
    testEntity.$nymph = transaction;

    // Verify in a transaction.
    expect(await transaction.inTransaction()).toEqual(true);

    // Delete the entity.
    expect(await testEntity.$delete()).toEqual(true);
    const resultEntity = await transaction.getEntity(
      { class: TestModel },
      testGuid,
    );
    expect(resultEntity).toBeNull();

    // Rollback the transaction.
    await transaction.rollback('test');

    // Verify not in a transaction.
    expect(await transaction.inTransaction()).toEqual(false);

    // Verify it's back.
    testEntity = (await transaction.getEntity(
      { class: TestModel },
      testGuid,
    )) as TestModelClass & TestModelData;

    expect(testEntity.guid).toEqual(testGuid);

    // Start a new transaction with a dot in the name.
    transaction = await nymph.startTransaction('test.1');
    testEntity.$nymph = transaction;

    // Verify in a transaction.
    expect(await transaction.inTransaction()).toEqual(true);

    // Make a change.
    testEntity.string = 'fish';
    expect(await testEntity.$save()).toEqual(true);

    // Commit the transaction.
    await transaction.commit('test.1');
    testEntity.$nymph = nymph;

    // Verify not in a transaction.
    expect(await transaction.inTransaction()).toEqual(false);

    // Verify the value is correct.
    await testEntity.$refresh();
    expect(testEntity.string).toEqual('fish');

    // Finally, change it back.
    testEntity.string = 'test';
    expect(await testEntity.$save()).toEqual(true);

    // TODO: nested transactions
  });

  it('options', async () => {
    await createTestEntities();

    // Testing entity order, offset, limit...
    const resultEntities = await nymph.getEntities(
      {
        class: TestModel,
        reverse: true,
        offset: 1,
        limit: 1,
        sort: 'cdate',
      },
      { type: '&', tag: 'test' },
    );
    expect(resultEntities.length).toEqual(1);
    expect(testEntity.$is(resultEntities[0])).toEqual(true);
  });

  it('guid and tags', async () => {
    await createTestEntities();

    // Retrieving entity by GUID and tags...
    const resultEntity = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: testGuid, tag: 'test' },
    );
    expect(testEntity.$is(resultEntity)).toEqual(true);
  });

  it('or selector', async () => {
    await createTestEntities();

    // Retrieving entity by GUID and tags...
    const resultEntity = await nymph.getEntity(
      { class: TestModel },
      { type: '|', guid: [testGuid, guid()] },
    );
    expect(testEntity.$is(resultEntity)).toEqual(true);
  });

  it('wrong or selector', async () => {
    await createTestEntities();

    // Retrieving entity by GUID and tags...
    const resultEntity = await nymph.getEntity(
      { class: TestModel },
      { type: '|', guid: [guid(), guid()] },
    );
    expect(testEntity.$is(resultEntity)).toEqual(false);
  });

  it('not guid', async () => {
    await createTestEntities();

    // Retrieving entity by !GUID...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', '!guid': guid(), tag: 'test' },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not tags', async () => {
    await createTestEntities();

    // Retrieving entity by !tags...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', guid: testGuid, '!tag': ['barbecue', 'pickles'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('guid and wrong tags', async () => {
    await createTestEntities();

    // Testing GUID and wrong tags...
    const resultEntity = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: testGuid, tag: ['pickles'] },
    );
    expect(resultEntity).toBeNull();
  });

  it('tags', async () => {
    await createTestEntities();

    // Retrieving entity by tags...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong tags', async () => {
    await createTestEntities();

    // Testing wrong tags...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'pickles' },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('inclusive tags', async () => {
    await createTestEntities();

    // Retrieving entity by tags inclusively...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '|', tag: ['pickles', 'test', 'barbecue'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong inclusive tags', async () => {
    await createTestEntities();

    // Testing wrong inclusive tags...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '|', tag: ['pickles', 'barbecue'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('mixed tags', async () => {
    await createTestEntities();

    // Retrieving entity by mixed tags...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
      { type: '|', tag: ['pickles', 'test', 'barbecue'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong inclusive mixed tags', async () => {
    await createTestEntities();

    // Testing wrong inclusive mixed tags...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
      { type: '|', tag: ['pickles', 'barbecue'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('wrong exclusive mixed tags', async () => {
    await createTestEntities();

    // Testing wrong exclusive mixed tags...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'pickles' },
      { type: '|', tag: ['test', 'barbecue'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('defined', async () => {
    await createTestEntities();

    // Retrieving entity by defined...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', defined: 'string' },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not defined', async () => {
    await createTestEntities();

    // Retrieving entity by !defined...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', '!defined': 'pickles' },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('defined in a not and clause', async () => {
    await createTestEntities();

    // Retrieving entity by defined in not and clause...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '!&', defined: 'pickles' },
      { type: '&', tag: 'test' },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('equal', async () => {
    await createTestEntities();

    // Retrieving entity by equal...
    let resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', equal: ['string', 'test'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by equal...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', equal: ['null', null] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not equal', async () => {
    await createTestEntities();

    const referenceEntity = await TestModel.factory(refGuid);
    expect(referenceEntity.guid).toEqual(refGuid);

    // Retrieving entity by !equal...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', '!equal': ['string', 'wrong'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('like', async () => {
    await createTestEntities();

    // Retrieving entity by like...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', like: ['string', 't_s%'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not like', async () => {
    await createTestEntities();

    const referenceEntity = await TestModel.factory(refGuid);
    expect(referenceEntity.guid).toEqual(refGuid);

    // Retrieving entity by !like...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', '!like': ['string', 'wr_n%'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('ilike', async () => {
    await createTestEntities();

    // Retrieving entity by ilike...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', ilike: ['string', 'T_s%'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not ilike', async () => {
    await createTestEntities();

    const referenceEntity = await TestModel.factory(refGuid);
    expect(referenceEntity.guid).toEqual(refGuid);

    // Retrieving entity by !ilike...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', '!ilike': ['string', 'wr_n%'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('like with wrong case', async () => {
    await createTestEntities();

    // Retrieving entity by like...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', like: ['string', 'T_s%'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('tags and equal', async () => {
    await createTestEntities();

    // Retrieving entity by tags and equal...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', equal: ['string', 'test'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong tags right equal', async () => {
    await createTestEntities();

    // Testing wrong tags and right equal...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'pickles', equal: ['string', 'test'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('right tags wrong equal', async () => {
    await createTestEntities();

    // Testing right tags and wrong equal...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', equal: ['string', 'pickles'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('wrong tags wrong equal', async () => {
    await createTestEntities();

    // Testing wrong tags and wrong equal...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'pickles', equal: ['string', 'pickles'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('contain', async () => {
    await createTestEntities();

    // Retrieving entity by contain...
    let resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', contain: ['array', 'values'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by contain...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', contain: ['array', 500] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by contain...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', contain: ['array', { test: true }] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not contain', async () => {
    await createTestEntities();

    // Retrieving entity by !contain...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
      { type: '!&', contain: ['array', 'pickles'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong contain', async () => {
    await createTestEntities();

    // Testing wrong contain...
    let resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', contain: ['array', 'pickles'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Testing wrong contain...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', contain: ['string', 'pickles'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('match', async () => {
    await createTestEntities();

    // Retrieving entity by regex match...
    let resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', match: ['match', '.*'] }, // anything
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', match: ['match', 'Edward McCheese'] }, // a substring
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
      {
        type: '|',
        match: [
          ['string', '[0-9]'],
          ['match', 'Edward McCheese'],
        ],
      }, // inclusive test
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        tag: 'test',
        match: ['match', '[-a-zA-Z0-9+_]+@[-a-zA-Z0-9_]+.[-a-zA-Z0-9_]{2,4}'],
      }, // a simple email
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        tag: 'test',
        match: ['match', '\\([0-9]{3}\\) [0-9]{3}-[0-9]{4}'],
      }, // a phone number
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('imatch', async () => {
    await createTestEntities();

    // Retrieving entity by regex match...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', imatch: ['match', 'edward mccheese'] }, // a substring
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong match', async () => {
    await createTestEntities();

    // Testing wrong regex match...
    let resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', match: ['match', '='] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'pickle', match: ['match', '.*'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        match: [
          ['string', '[0-9]'],
          ['match', ',,'],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('match wrong case', async () => {
    await createTestEntities();

    // Retrieving entity by regex match...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', match: ['match', 'edward mccheese'] }, // a substring
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('match and equal inclusive', async () => {
    await createTestEntities();

    // Retrieving entity by regex + equal inclusively...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
      { type: '|', equal: ['string', 'pickles'], match: ['string', 'test'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('greater than', async () => {
    await createTestEntities();

    // Retrieving entity by inequality...
    let resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gt: [
          ['number', 30],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gt: [
          ['number', 31],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gt: [
          ['number', 29],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gt: [
          ['numberString', 30],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gt: [
          ['numberString', 31],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gt: [
          ['numberString', 29],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('greater than or equal', async () => {
    await createTestEntities();

    // Retrieving entity by inequality...
    let resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gte: [
          ['number', 30],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gte: [
          ['number', 31],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gte: [
          ['number', 29],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gte: [
          ['numberString', 30],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gte: [
          ['numberString', 31],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gte: [
          ['numberString', 29],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('less than', async () => {
    await createTestEntities();

    // Retrieving entity by inequality...
    let resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lt: [
          ['number', 30],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lt: [
          ['number', 31],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lt: [
          ['number', 29],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lt: [
          ['numberString', 30],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lt: [
          ['numberString', 31],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lt: [
          ['numberString', 29],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('less than or equal', async () => {
    await createTestEntities();

    // Retrieving entity by inequality...
    let resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lte: [
          ['number', 30],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lte: [
          ['number', 31],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lte: [
          ['number', 29],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lte: [
          ['numberString', 30],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lte: [
          ['numberString', 31],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lte: [
          ['numberString', 29],
          ['pickles', 100],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('not inequality', async () => {
    await createTestEntities();

    // Retrieving entity by !inequality...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
      { type: '!&', gte: ['number', 60] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong inequality', async () => {
    await createTestEntities();

    // Testing wrong inequality...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', lte: ['number', 29.99] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('greater than cdate', async () => {
    await createTestEntities();

    // Retrieving entity by time...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', gt: ['cdate', (testEntity.cdate ?? 0) - 120] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong cdate', async () => {
    await createTestEntities();

    // Testing wrong time...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', gte: ['cdate', (testEntity.cdate ?? 0) + 1] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('time selector', async () => {
    await createTestEntities();

    const referenceEntity = await TestModel.factory(refGuid);

    // Retrieving entity by relative time...
    let resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', gt: ['timestamp', null, '-1 day'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by relative time inclusively...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gt: [
          ['timestamp', null, '-1 day'],
          ['timestamp', null, '+5 days'],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by relative time...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', gt: ['timestamp', null, '-3 days'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by relative time...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', gt: ['cdate', null, '-1 day'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong time selector', async () => {
    await createTestEntities();

    const referenceEntity = await TestModel.factory(refGuid);

    // Retrieving entity by relative time...
    let resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', gt: ['timestamp', null, '+1 day'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by relative time...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', lt: ['timestamp', null, '-3 days'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by relative time...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', gt: ['cdate', null, '+1 day'] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('references', async () => {
    await createTestEntities();

    // Testing referenced entities...
    await testEntity.reference?.$wake();
    expect(testEntity.reference?.test).toEqual('good');

    // Testing referenced entity arrays...
    await Promise.all(testEntity.refArray?.map((e) => e.$wake()) || []);
    expect(testEntity.refArray?.[0].test).toEqual('good');
  });

  it('ref', async () => {
    await createTestEntities();

    // Retrieving entity by reference...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', ref: ['reference', refGuid] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not ref', async () => {
    await createTestEntities();

    // Retrieving entity by !reference...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
      { type: '!&', ref: ['reference', guid()] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong ref', async () => {
    await createTestEntities();

    // Testing wrong reference...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', ref: ['reference', guid()] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('nonexistent ref', async () => {
    await createTestEntities();

    // Testing non-existent reference...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', ref: ['pickle', refGuid] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('inclusive ref', async () => {
    await createTestEntities();

    // Retrieving entity by inclusive reference...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        ref: [
          ['reference', refGuid],
          ['reference', guid()],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong inclusive ref', async () => {
    await createTestEntities();

    // Testing wrong inclusive reference...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        ref: [
          ['reference', guid()],
          ['reference', guid()],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('ref in an array', async () => {
    await createTestEntities();

    // Retrieving entity by array reference...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', ref: ['refArray', refGuid] },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong ref in an array', async () => {
    await createTestEntities();

    // Testing wrong array reference...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        ref: [
          ['refArray', refGuid],
          ['refArray', guid()],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('logic operations', async () => {
    await createTestEntities();

    // Testing logic operations...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        '!ref': [
          ['refArray', guid()],
          ['refArray', guid()],
        ],
        '!lte': ['number', 29.99],
      },
      {
        type: '|',
        '!lte': [
          ['number', 29.99],
          ['number', 30],
        ],
      },
      {
        type: '!&',
        '!equal': ['string', 'test'],
        '!contain': [
          ['array', 'full'],
          ['array', 'of'],
          ['array', 'values'],
          ['array', 500],
          ['array', { test: true }],
          ['array', { nullbyte: '\\\x00\u0000  \x00' }],
        ],
      },
      {
        type: '!|',
        '!equal': ['string', 'test'],
        contain: [
          ['array', 'full'],
          ['array', 'of'],
          ['array', 'values'],
          ['array', 500],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('count return', async () => {
    await createTestEntities();

    const result = await nymph.getEntities({ class: TestModel });

    // Testing count return...
    const resultCount = await nymph.getEntities({
      class: TestModel,
      return: 'count',
    });
    expect(resultCount).toBeGreaterThanOrEqual(1);
    expect(resultCount).toEqual(result.length);

    const resultSelectors = await nymph.getEntities(
      { class: TestModel },
      { type: '&', ref: ['reference', refGuid] },
    );

    // Testing count return with selectors...
    const resultSelectorsCount = await nymph.getEntities(
      { class: TestModel, return: 'count' },
      { type: '&', ref: ['reference', refGuid] },
    );
    expect(resultSelectorsCount).toBeGreaterThanOrEqual(1);
    expect(resultSelectorsCount).toEqual(resultSelectors.length);

    // Testing count return with limit...
    const resultSelectorsLimit = await nymph.getEntities({
      class: TestModel,
      limit: 1,
      return: 'count',
    });
    expect(resultSelectorsLimit).toEqual(1);

    // Testing count return with limit...
    const resultSelectorsSingle = await nymph.getEntity({
      class: TestModel,
      return: 'count',
    });
    expect(resultSelectorsSingle).toEqual(1);

    // Testing empty count...
    const resultSelectorsEmpty = await nymph.getEntities(
      { class: TestModel, return: 'count' },
      { type: '&', ref: ['reference', guid()] },
    );
    expect(resultSelectorsEmpty).toEqual(0);
  });

  it('guid return', async () => {
    await createTestEntities();

    // Testing guid return using logic operations...
    const resultGuid = await nymph.getEntities(
      { class: TestModel, return: 'guid' },
      {
        type: '&',
        '!ref': [
          ['refArray', guid()],
          ['refArray', guid()],
        ],
        '!lte': ['number', 29.99],
      },
      {
        type: '|',
        '!lte': [
          ['number', 29.99],
          ['number', 30],
        ],
      },
      {
        type: '!&',
        '!equal': ['string', 'test'],
        '!contain': [
          ['array', 'full'],
          ['array', 'of'],
          ['array', 'values'],
          ['array', 500],
          ['array', { test: true }],
          ['array', { nullbyte: '\\\x00\u0000  \x00' }],
        ],
      },
      {
        type: '!|',
        '!equal': ['string', 'test'],
        contain: [
          ['array', 'full'],
          ['array', 'of'],
          ['array', 'values'],
          ['array', 500],
        ],
      },
    );
    expect(resultGuid.indexOf(testEntity.guid ?? '')).toBeGreaterThan(-1);
  });

  it('deep selector', async () => {
    await createTestEntities();

    // Testing deep selectors...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        '!ref': [
          ['refArray', guid()],
          ['refArray', guid()],
        ],
        '!lte': ['number', 29.99],
      },
      {
        type: '&',
        selector: [
          {
            type: '|',
            '!lte': [
              ['number', 29.99],
              ['number', 30],
            ],
          },
          {
            type: '!&',
            '!equal': ['string', 'test'],
            '!contain': [
              ['array', 'full'],
              ['array', 'of'],
              ['array', 'values'],
              ['array', 500],
              ['array', { test: true }],
              ['array', { nullbyte: '\\\x00\u0000  \x00' }],
            ],
          },
          {
            type: '!|',
            '!equal': ['string', 'test'],
            contain: [
              ['array', 'full'],
              ['array', 'of'],
              ['array', 'values'],
              ['array', 500],
            ],
          },
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    const resultEntity2 = await nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        '!ref': [
          ['refArray', guid()],
          ['refArray', guid()],
        ],
        '!lte': ['number', 29.99],
      },
      {
        type: '|',
        selector: [
          {
            type: '&',
            '!lte': [
              ['number', 29.99],
              ['number', 30],
            ],
          },
          {
            type: '!&',
            '!equal': ['string', 'test'],
            '!contain': [
              ['array', 'full'],
              ['array', 'of'],
              ['array', 'values'],
              ['array', 500],
              ['array', { test: true }],
              ['array', { nullbyte: '\\\x00\u0000  \x00' }],
            ],
          },
          {
            type: '&',
            '!equal': ['string', 'test'],
            contain: [
              ['array', 'full'],
              ['array', 'of'],
              ['array', 'values'],
              ['array', 500],
            ],
          },
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity2)).toEqual(true);

    const resultEntity3 = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        selector: [
          {
            type: '&',
            '!ref': ['refArray', guid()],
            '!lte': ['number', 29.99],
          },
          { type: '&', gte: ['number', 16000] },
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity3)).toEqual(true);

    const resultEntity4 = await nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        selector: [
          {
            type: '&',
            '!ref': ['refArray', guid()],
            '!lte': ['number', 29.99],
          },
          {
            type: '&',
            selector: {
              type: '&',
              selector: { type: '&', gte: ['number', 16000] },
            },
          },
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity4)).toEqual(true);
  });

  it('wrong deep selector', async () => {
    // Testing wrong deep selectors...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        selector: [
          {
            type: '&',
            '!ref': ['refArray', guid()],
            '!lte': ['number', 29.99],
          },
          { type: '&', gte: ['number', 16000] },
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('qref', async () => {
    await createTestEntities();

    // Retrieving entity by qref...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        qref: [
          'reference',
          [{ class: TestModel }, { type: '&', equal: ['test', 'good'] }],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not qref', async () => {
    await createTestEntities();

    // Retrieving entity by !qref...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        '!qref': [
          'reference',
          [{ class: TestModel }, { type: '&', equal: ['test', 'pickles'] }],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong qref class', async () => {
    await createTestEntities();

    // Testing wrong qref...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        qref: [
          'reference',
          [{ class: TestBModel }, { type: '&', equal: ['test', 'good'] }],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('wrong qref data', async () => {
    await createTestEntities();

    // Testing wrong qref...
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        qref: [
          'reference',
          [{ class: TestModel }, { type: '&', equal: ['test', 'pickles'] }],
        ],
      },
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('cdate and mdate sort option', async () => {
    await createMultipleTestEntities();

    for (const sort of ['cdate', 'mdate'] as ('cdate' | 'mdate')[]) {
      // Retrieving entities sorted...
      let resultEntities = await nymph.getEntities({ class: TestModel, sort });
      expect(resultEntities.length).toBeGreaterThan(100);
      for (let i = 0; i < resultEntities.length - 1; i++) {
        expect(resultEntities[i + 1][sort]).toBeGreaterThan(
          resultEntities[i][sort] ?? 0,
        );
      }

      // And test the same with guid return...
      let resultGuids = await nymph.getEntities({
        class: TestModel,
        sort,
        return: 'guid',
      });
      expect(resultGuids.length).toBeGreaterThan(100);
      for (let i = 0; i < resultGuids.length - 1; i++) {
        expect(resultGuids[i]).toEqual(resultEntities[i].guid);
      }

      // Retrieving entities reverse sorted...
      resultEntities = await nymph.getEntities({
        class: TestModel,
        sort,
        reverse: true,
      });
      expect(resultEntities.length).toBeGreaterThan(100);
      for (let i = 0; i < resultEntities.length - 1; i++) {
        expect(resultEntities[i + 1][sort]).toBeLessThan(
          resultEntities[i][sort] ?? 0,
        );
      }

      // And again with other selectors.
      // Retrieving entities sorted...
      resultEntities = await nymph.getEntities(
        { class: TestModel, sort },
        { type: '&', match: ['name', '^Multi Test '] },
      );
      expect(resultEntities.length).toEqual(100);
      for (let i = 0; i < resultEntities.length - 1; i++) {
        expect(resultEntities[i + 1][sort]).toBeGreaterThan(
          resultEntities[i][sort] ?? 0,
        );
      }

      // Retrieving entities reverse sorted...
      resultEntities = await nymph.getEntities(
        { class: TestModel, sort, reverse: true },
        { type: '&', match: ['name', '^Multi Test '] },
      );
      expect(resultEntities.length).toEqual(100);
      for (let i = 0; i < resultEntities.length - 1; i++) {
        expect(resultEntities[i + 1][sort]).toBeLessThan(
          resultEntities[i][sort] ?? 0,
        );
      }
    }
  });

  it('property sort option', async () => {
    await createMultipleTestEntities();

    // Retrieving entities sorted...
    let resultEntities = await nymph.getEntities({
      class: TestModel,
      sort: 'number',
    });
    expect(resultEntities.length).toBeGreaterThan(100);
    for (let i = 0; i < resultEntities.length - 1; i++) {
      expect(resultEntities[i + 1].number ?? Infinity).toBeGreaterThanOrEqual(
        resultEntities[i].number ?? 0,
      );
    }

    // And test the same with guid return...
    let resultGuids = await nymph.getEntities({
      class: TestModel,
      sort: 'number',
      return: 'guid',
    });
    expect(resultGuids.length).toBeGreaterThan(100);
    for (let i = 0; i < resultGuids.length - 1; i++) {
      expect(resultGuids[i]).toEqual(resultEntities[i].guid);
    }

    // Retrieving entities reverse sorted...
    resultEntities = await nymph.getEntities({
      class: TestModel,
      sort: 'number',
      reverse: true,
    });
    expect(resultEntities.length).toBeGreaterThan(100);
    for (let i = 0; i < resultEntities.length - 1; i++) {
      expect(resultEntities[i + 1].number ?? 0).toBeLessThanOrEqual(
        resultEntities[i].number ?? Infinity,
      );
    }

    // And again with other selectors.
    // Retrieving entities sorted...
    resultEntities = await nymph.getEntities(
      { class: TestModel, sort: 'number' },
      { type: '&', match: ['name', '^Multi Test '] },
    );
    expect(resultEntities.length).toEqual(100);
    for (let i = 0; i < resultEntities.length - 1; i++) {
      expect(resultEntities[i + 1].number ?? Infinity).toBeGreaterThan(
        resultEntities[i].number ?? 0,
      );
      expect(resultEntities[i].name).toEqual(
        `Multi Test ${100 - (resultEntities[i].number ?? 0)}`,
      );
    }

    // Retrieving entities reverse sorted...
    resultEntities = await nymph.getEntities(
      { class: TestModel, sort: 'number', reverse: true },
      { type: '&', match: ['name', '^Multi Test '] },
    );
    expect(resultEntities.length).toEqual(100);
    for (let i = 0; i < resultEntities.length - 1; i++) {
      expect(resultEntities[i + 1].number ?? 0).toBeLessThan(
        resultEntities[i].number ?? Infinity,
      );
      expect(resultEntities[i].name).toEqual(
        `Multi Test ${100 - (resultEntities[i].number ?? 0)}`,
      );
    }
  });

  it('delete reference', async () => {
    await createTestEntities();

    // Deleting referenced entities...
    await testEntity.reference?.$wake();
    expect(await testEntity.reference?.$delete()).toEqual(true);
    await Promise.all(testEntity.refArray?.map((e) => e.$wake()) || []);
    expect(testEntity.reference?.guid).toBeNull();
  });

  it('delete', async () => {
    await createTestEntities();

    // Deleting entity...
    expect(await testEntity.$delete()).toEqual(true);
    expect(testEntity.guid).toBeNull();

    const entity = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: testGuid },
    );

    expect(entity).toBeNull();
  });

  it('allows non-duplicate unique strings', async () => {
    // Creating entity...
    const uniqueEntityA = await TestModel.factory();
    uniqueEntityA.name = 'Entity Test ' + new Date().toLocaleString();
    uniqueEntityA.uniques = ['test a'];

    // Saving entity...
    expect(await uniqueEntityA.$save()).toEqual(true);
    expect(uniqueEntityA.guid).not.toBeNull();

    // Creating entity...
    const uniqueEntityB = await TestModel.factory();
    uniqueEntityB.name = 'Entity Test ' + new Date().toLocaleString();
    uniqueEntityB.uniques = ['test b'];

    // Saving entity...
    expect(await uniqueEntityB.$save()).toEqual(true);
    expect(uniqueEntityB.guid).not.toBeNull();

    expect(uniqueEntityA.guid).not.toEqual(uniqueEntityB.guid);

    expect(await uniqueEntityA.$delete()).toEqual(true);
    expect(await uniqueEntityB.$delete()).toEqual(true);
  });

  it('throws on duplicate unique strings', async () => {
    // Creating entity...
    const uniqueEntityA = await TestModel.factory();
    uniqueEntityA.name = 'Entity Test ' + new Date().toLocaleString();
    uniqueEntityA.uniques = ['test a'];

    // Saving entity...
    expect(await uniqueEntityA.$save()).toEqual(true);
    expect(uniqueEntityA.guid).not.toBeNull();

    // Creating entity...
    const uniqueEntityB = await TestModel.factory();
    uniqueEntityB.name = 'Entity Test ' + new Date().toLocaleString();
    uniqueEntityB.uniques = ['test a'];

    // Saving entity...
    try {
      await uniqueEntityB.$save();

      throw Error("Shouldn't get past the uniqueness check.");
    } catch (e: any) {
      expect(e).toBeInstanceOf(EntityUniqueConstraintError);
    }
    expect(uniqueEntityB.guid).toBeNull();

    expect(await uniqueEntityA.$delete()).toEqual(true);
  });

  it('allows duplicate unique string if first transaction is rolled back', async () => {
    // Creating transaction entity...
    const tnymphA = await nymph.startTransaction('test-unique-a');
    const TestModelA = tnymphA.getEntityClass(TestModel);
    const uniqueEntityA = await TestModelA.factory();
    uniqueEntityA.name = 'Entity Test ' + new Date().toLocaleString();
    uniqueEntityA.uniques = ['test a'];

    // Saving entity...
    expect(await uniqueEntityA.$save()).toEqual(true);
    expect(uniqueEntityA.guid).not.toBeNull();

    // Rolling back transaction...
    expect(await tnymphA.rollback('test-unique-a')).toEqual(true);

    // Creating transaction entity...
    const tnymphB = await nymph.startTransaction('test-unique-b');
    const TestModelB = tnymphB.getEntityClass(TestModel);
    const uniqueEntityB = await TestModelB.factory();
    uniqueEntityB.name = 'Entity Test ' + new Date().toLocaleString();
    uniqueEntityB.uniques = ['test a'];

    // Saving entity...
    expect(await uniqueEntityB.$save()).toEqual(true);
    expect(uniqueEntityB.guid).not.toBeNull();

    expect(uniqueEntityA.guid).not.toEqual(uniqueEntityB.guid);

    expect(await tnymphB.commit('test-unique-b')).toEqual(true);

    const uniqueEntityACheck = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: uniqueEntityA.guid ?? '' },
    );
    expect(uniqueEntityACheck).toBeNull();

    const uniqueEntityBCheck = await nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: uniqueEntityB.guid ?? '' },
    );
    expect(uniqueEntityBCheck).not.toBeNull();

    if (uniqueEntityBCheck != null) {
      expect(await uniqueEntityBCheck.$delete()).toEqual(true);
    }
  });
}

export function UIDTest(
  nymph: Nymph,
  it: (name: string, fn: () => void) => void,
) {
  it('delete old test data', async () => {
    expect(await nymph.deleteUID('TestUID')).toEqual(true);
    expect(await nymph.deleteUID('NewUID')).toEqual(true);
  });

  it('new UID', async () => {
    expect(await nymph.newUID('TestUID')).toEqual(1);
  });

  it('increment UID', async () => {
    expect(await nymph.newUID('TestUID')).toEqual(2);
  });

  it('retrieve UID', async () => {
    expect(await nymph.getUID('TestUID')).toEqual(2);
  });

  it('rename UID', async () => {
    expect(await nymph.renameUID('TestUID', 'NewUID')).toEqual(true);
    expect(await nymph.getUID('TestUID')).toBeNull();
    expect(await nymph.getUID('NewUID')).toEqual(2);
    expect(await nymph.renameUID('NewUID', 'TestUID')).toEqual(true);
    expect(await nymph.getUID('NewUID')).toBeNull();
    expect(await nymph.getUID('TestUID')).toEqual(2);
  });

  it('set UID', async () => {
    expect(await nymph.setUID('TestUID', 5)).toEqual(true);
    expect(await nymph.getUID('TestUID')).toEqual(5);
  });

  it('delete UID', async () => {
    expect(await nymph.deleteUID('TestUID')).toEqual(true);
    expect(await nymph.getUID('TestUID')).toBeNull();
  });
}

export function ExportImportTest(
  nymph: Nymph,
  it: (name: string, fn: () => void) => void,
) {
  const TestModel = nymph.addEntityClass(TestModelClass);
  const TestBModel = nymph.addEntityClass(TestBModelClass);

  async function deleteTestData() {
    let all = await nymph.getEntities({ class: TestModel });
    expect(Array.isArray(all)).toEqual(true);
    for (const cur of all) {
      expect(await cur.$delete()).toEqual(true);
    }

    all = await nymph.getEntities({ class: TestModel });
    expect(all.length).toEqual(0);

    all = await nymph.getEntities({ class: TestBModel });
    expect(Array.isArray(all)).toEqual(true);
    for (const cur of all) {
      expect(await cur.$delete()).toEqual(true);
    }

    all = await nymph.getEntities({ class: TestBModel });
    expect(all.length).toEqual(0);

    expect(await nymph.deleteUID('TestUID')).toEqual(true);
    expect(await nymph.deleteUID('TestUID2')).toEqual(true);
  }

  async function checkEntityDataAndCount() {
    expect(await nymph.getUID('TestUID')).toEqual(2);
    expect(await nymph.getUID('TestUID2')).toEqual(1);

    const models = await nymph.getEntities({ class: TestModel });
    const bmodels = await nymph.getEntities({ class: TestBModel });

    expect(models.length).toEqual(30);
    expect(bmodels.length).toEqual(30);

    for (const model of models) {
      expect(model.name).toMatch(/^Entity Test /);
      expect(model.null).toBeDefined();
      expect(model.null).toBeNull();
      expect(model.string).toEqual('test');
      expect(model.array).toEqual([
        'full',
        'of',
        'values',
        500,
        { test: true },
        { nullbyte: '\\\x00\u0000  \x00' },
      ]);
      expect(model.match).toEqual(matchValue);
      expect(model.number).toEqual(30);
      expect(model.numberString).toEqual('30');
      expect(model.timestamp).toBeGreaterThanOrEqual(strtotime('-2 minutes'));
      expect(model.index).toMatch(/^\d+a$/);

      await model.reference?.$wake();
      expect(model.reference?.guid).not.toBeNull();
      expect(model.reference?.string).toEqual('another');
      expect(model.reference?.index).toMatch(/^\d+b$/);
      expect(model.index?.substring(0, -1)).toEqual(
        model.reference?.index?.substring(0, -1),
      );
      expect(model.reference?.$inArray(bmodels)).toEqual(true);
      await Promise.all(model.refArray?.map((e) => e.$wake()) || []);
      expect(model.refArray?.[0].guid).not.toBeNull();
      expect(model.refArray?.[0].guid).toEqual(model.reference?.guid);
    }
  }

  it('delete old test data', async () => {
    await deleteTestData();
  });

  it('setup data', async () => {
    expect(await nymph.newUID('TestUID')).toEqual(1);
    expect(await nymph.newUID('TestUID')).toEqual(2);
    expect(await nymph.newUID('TestUID2')).toEqual(1);

    for (let i = 0; i < 30; i++) {
      // Creating entity...
      const testEntity = await TestModel.factory();

      // Saving entity...
      testEntity.name = 'Entity Test ' + new Date().toLocaleString();
      testEntity.null = null;
      testEntity.string = 'test';
      testEntity.array = [
        'full',
        'of',
        'values',
        500,
        { test: true },
        { nullbyte: '\\\x00\u0000  \x00' },
      ];
      testEntity.match = matchValue;
      testEntity.number = 30;
      testEntity.numberString = '30';
      testEntity.timestamp = Date.now();
      testEntity.index = i + 'a';

      const entityReferenceTest = await TestBModel.factory();
      entityReferenceTest.string = 'another';
      entityReferenceTest.index = i + 'b';

      expect(await entityReferenceTest.$save()).toEqual(true);
      testEntity.reference = entityReferenceTest;
      testEntity.refArray = [entityReferenceTest];

      expect(await testEntity.$save()).toEqual(true);
    }

    await checkEntityDataAndCount();
  });

  it('needs migration', async () => {
    expect(await nymph.needsMigration()).toEqual(false);
  });

  it('export data', async () => {
    expect(await nymph.export(__dirname + '/testentityexport.nex')).toEqual(
      true,
    );
  });

  it('delete test data again', async () => {
    await deleteTestData();
  });

  it('import data', async () => {
    expect(await nymph.getUID('TestUID')).toBeNull();
    expect(await nymph.getUID('TestUID2')).toBeNull();
    const models = await nymph.getEntities({ class: TestModel });
    const bmodels = await nymph.getEntities({ class: TestBModel });
    expect(models.length).toEqual(0);
    expect(bmodels.length).toEqual(0);

    expect(await nymph.import(__dirname + '/testentityexport.nex')).toEqual(
      true,
    );

    await checkEntityDataAndCount();

    fs.unlinkSync(__dirname + '/testentityexport.nex');
  });
}

const matchValue = `Hello, my name is Edward McCheese. It is a pleasure to meet you. As you can see, I have several hats of the most pleasant nature.

This one's email address is nice_hat-wednesday+newyork@im-a-hat.hat.
This one's phone number is (555) 555-1818.
This one's zip code is 92064.
This one's favorite emojis are 🔥❤️😊😂⭐🤔

These hats are absolutely fantastic.

\x00\x00\x00

Lorem ipsum odor amet, consectetuer adipiscing elit. Metus ad mattis sit pretium per, dignissim imperdiet luctus. Congue rhoncus turpis etiam aenean ultricies dapibus justo nunc. Netus non primis quis habitasse lacus. Nascetur dapibus sociosqu ridiculus primis; elementum netus consectetur ridiculus litora. Tristique facilisis erat ex class nulla cursus amet. Metus vitae tempor euismod vel; ullamcorper ac quisque vestibulum. Mauris libero pulvinar facilisi eros natoque massa.

Nunc vel hac nec tristique vivamus. Leo volutpat convallis eget integer tellus cubilia tincidunt malesuada? Consequat elit nisi tristique vehicula cubilia maecenas metus facilisi malesuada. In mattis euismod ad magnis fusce. Nisi congue sociosqu rhoncus lobortis fringilla sollicitudin at platea. Iaculis ut et varius metus eleifend laoreet hac odio libero. Non ridiculus tempus ultricies nullam curabitur.

Amet pellentesque aliquam placerat; vestibulum blandit platea porttitor pulvinar. Tellus tristique ad morbi in ac placerat luctus. Ante efficitur inceptos commodo lacus sodales sit varius nunc consequat. Senectus non vel est convallis mauris. Venenatis feugiat massa nostra, purus class primis sodales odio. Risus nulla integer feugiat ridiculus porta nascetur. Rutrum tincidunt enim parturient libero nisl ante sagittis nisi. Cubilia massa non vehicula vehicula amet parturient pellentesque. Habitant dapibus fames lectus pretium rhoncus.

Ridiculus nascetur mauris iaculis hendrerit ridiculus gravida auctor in. Class suscipit augue finibus semper vulputate nec. Tristique mi eu praesent commodo fermentum inceptos penatibus lobortis. Libero enim orci ultricies egestas ut pellentesque. Laoreet massa ad curabitur tellus libero laoreet habitasse enim nascetur. Iaculis euismod a euismod conubia purus. Commodo condimentum ultrices lorem ligula aenean; netus mattis sem non.

Curabitur duis imperdiet mus integer vel bibendum; fusce malesuada. Dignissim duis himenaeos primis odio, congue pharetra? Egestas mus sit eget proin quis. Neque dapibus dapibus nam sociosqu; maecenas viverra himenaeos. Himenaeos faucibus himenaeos faucibus ex litora eros faucibus cras. Maximus scelerisque nullam nunc congue fringilla. Nisi eu magna erat morbi cras enim amet litora. Nostra primis vitae arcu, accumsan sollicitudin curabitur. Potenti sit vel vehicula metus leo id. Etiam blandit quisque nam orci; neque lacinia rutrum.

Aliquam mollis varius hendrerit sem eleifend fermentum. Sapien rutrum condimentum inceptos ex feugiat consectetur mollis magna diam. Natoque enim nisi, ex risus finibus lacinia conubia vivamus suscipit. Habitasse interdum lorem ante, bibendum posuere dis. Lacus porttitor sapien proin; consequat velit ipsum venenatis. Vivamus porta mattis morbi nunc torquent neque. Senectus vehicula tincidunt parturient fringilla id amet urna libero pharetra.

Faucibus netus tincidunt et viverra augue ligula est quis. Ipsum tempus vehicula tortor dis tortor ad. Ex tincidunt torquent eleifend aenean urna commodo. Quam nullam imperdiet volutpat vel condimentum cubilia sociosqu. Etiam tempor sapien mattis, venenatis aptent id risus. Efficitur luctus vel; nam ut commodo sociosqu hendrerit. Quisque placerat gravida rhoncus blandit vitae. Himenaeos id risus est mollis aliquet nam curabitur.

Habitasse sed est fames quis lobortis leo mattis. Nisl cursus tincidunt cursus felis porttitor. Ante integer turpis non class lobortis suscipit. Condimentum velit vulputate quis sapien, lacus magna adipiscing nec primis. Blandit consequat ipsum nostra dignissim; tincidunt torquent fames. Ac faucibus elit iaculis duis lobortis. Euismod facilisi massa turpis mus neque. Class vulputate quisque elementum suscipit nostra tempus adipiscing. Malesuada himenaeos finibus ad inceptos volutpat scelerisque inceptos.

Natoque platea at feugiat cras tellus facilisi suspendisse lacinia maximus. Duis vestibulum eget molestie turpis risus dapibus dignissim torquent? Nulla nibh aptent fringilla scelerisque euismod mauris ornare. Orci finibus taciti habitasse fringilla laoreet convallis. Class sed fringilla eget quisque sit auctor. Id cursus mauris praesent maecenas iaculis. Ullamcorper luctus habitant ultrices pharetra etiam mattis morbi fringilla lorem.

Pharetra porta orci ridiculus inceptos eleifend sem ante quis. Molestie velit penatibus libero per sem litora congue. Porta quis egestas vivamus vitae potenti ornare. Elit molestie nullam vitae quam viverra. Nisl fringilla massa ridiculus donec ridiculus sed magnis. Cursus ad enim consequat ultricies tortor rhoncus pellentesque augue. Netus facilisis tempor elementum interdum at sagittis habitasse. Pretium imperdiet duis diam ullamcorper donec at suscipit. Id per inceptos ac luctus massa imperdiet tempor. Parturient libero suscipit non tempor ligula ullamcorper placerat varius.

Libero duis suspendisse cubilia rhoncus scelerisque faucibus mattis. Leo fusce urna at per inceptos vel lobortis. Quisque ex duis euismod dictum hac nibh eros. Penatibus eleifend tellus donec elit primis phasellus habitant dictum. Imperdiet consequat facilisi massa, lacus gravida sodales id sapien. Ornare sapien sit convallis suscipit nunc enim. Tempus at vitae class sollicitudin proin. Dolor aenean felis netus consectetur mattis phasellus vestibulum. Orci fringilla sodales montes sed himenaeos ex massa natoque porttitor.

Mus condimentum dui mollis dolor accumsan ligula pretium? Est phasellus platea iaculis vehicula et eros vel rutrum placerat. Nulla laoreet faucibus; congue netus magna senectus lectus dictum. Sodales aliquam eget himenaeos adipiscing, tempor feugiat. Lorem pellentesque iaculis fames lectus cubilia ornare sagittis rhoncus? Bibendum viverra tellus libero congue dignissim metus tellus aenean ultrices. Sollicitudin cras sollicitudin mattis lacus facilisis fermentum scelerisque porttitor rutrum.

Sapien aptent fames curae, consectetur dapibus mauris sollicitudin tellus. Laoreet etiam dignissim, suscipit platea libero vitae taciti eu nec. Donec lobortis metus nisi; est enim himenaeos molestie tellus sapien. Sapien tellus rhoncus blandit fusce hendrerit feugiat. Maximus sit hendrerit tincidunt nec imperdiet hendrerit semper suscipit. Quam augue proin netus rutrum et sem. Neque penatibus cubilia nec metus porta. Ornare pulvinar quam auctor, elit curae ad donec dis. Egestas aptent non tortor potenti morbi mauris.

Montes dui in pharetra primis consequat ante integer. Vulputate libero gravida rutrum tortor suscipit massa! Netus rhoncus platea torquent dapibus consectetur suspendisse etiam sociosqu. Quis placerat mauris et quam nascetur. Dictumst mi rutrum justo vitae ultricies feugiat nulla faucibus morbi. Consectetur nec condimentum euismod sodales nisi purus; finibus elementum facilisi.

Senectus mus faucibus ut morbi eu maximus. Turpis tincidunt sodales sociosqu lorem amet pulvinar laoreet faucibus. Mus bibendum vulputate hendrerit sollicitudin eu ridiculus posuere augue leo? Cubilia nostra consequat; fusce egestas himenaeos class ornare nec. Est montes tortor vivamus congue inceptos erat mi eget pellentesque. Amet vulputate fringilla aliquet fames tristique. Rutrum malesuada dapibus vehicula risus nunc torquent habitant turpis habitant. Ipsum proin viverra adipiscing cras et augue hendrerit. Efficitur euismod aliquam habitant; sit nisl potenti.

Conubia dignissim metus phasellus tristique augue, nullam quam finibus. Dignissim vel enim mattis praesent penatibus. Sapien pharetra curae torquent turpis fermentum feugiat facilisis nisi. Lacinia justo ante mauris finibus vitae ante efficitur dis. Urna gravida conubia amet rhoncus felis ut lorem placerat. Quisque fermentum suscipit aenean nisi suscipit ac? Quis ornare faucibus amet conubia justo maximus hendrerit phasellus aenean. Ex vivamus vulputate in mollis mauris praesent vehicula erat neque.

Orci nullam commodo habitant volutpat per tincidunt mus sit. Nisi cubilia fringilla viverra at orci magnis massa nam orci. Duis iaculis sapien nulla nascetur elit porta fermentum. Amus libero vivamus vel finibus magnis placerat himenaeos. Integer posuere suscipit non vulputate enim. Conubia id lobortis habitasse luctus odio maecenas enim conubia non. Mus egestas massa platea nullam sociosqu, magnis cras. Quam placerat nisi dui gravida ultricies, facilisis eu pharetra vivamus.

Fusce maecenas dis finibus senectus nascetur tortor. Nec rhoncus pretium vivamus donec vel ligula curabitur. Velit dis laoreet aenean, fusce metus blandit erat. Ligula purus natoque, arcu finibus tincidunt efficitur dolor curabitur. Ac risus et ipsum; consequat integer phasellus diam. Praesent ipsum gravida placerat porta volutpat tincidunt maximus sapien. Phasellus gravida orci enim velit condimentum.

Dui id laoreet penatibus orci sit a. Iaculis dis porttitor luctus; lacus dignissim quam commodo lorem. Nullam dictum quisque accumsan porttitor tortor fusce aenean. Aliquet quisque ultricies malesuada auctor facilisi tristique. Dolor nulla conubia ultricies odio ad. Nunc consectetur venenatis consequat nisi habitant. Praesent accumsan scelerisque morbi aliquam sociosqu auctor, nostra aenean.

Mauris amet conubia egestas eu posuere nullam. Est neque dictum in, lacus aliquam ultrices vestibulum. Dapibus dis habitasse cras conubia felis nibh. Egestas nisl iaculis nostra neque enim, ridiculus praesent. Consectetur eleifend eu mus; elit sed pellentesque fringilla. Ullamcorper hendrerit nibh aptent per congue libero ultrices eget. Mollis velit ad tortor lobortis ipsum.

Tristique neque justo potenti himenaeos; pellentesque nam vehicula. Maximus etiam ut nullam semper; fames curabitur quam ad morbi. Interdum curabitur platea augue porttitor a gravida. Leo imperdiet id aenean sit; habitasse quam tempus pellentesque? Nostra leo aenean amet lectus ultricies ridiculus nascetur ullamcorper. Taciti in iaculis quam nascetur proin varius eget vehicula.

Mattis hendrerit tempus interdum diam elementum primis augue phasellus sociosqu. Imperdiet pulvinar imperdiet lacinia posuere class magnis. Montes viverra scelerisque laoreet sociosqu proin lacus. Nam id justo praesent curabitur nam accumsan imperdiet commodo. Sociosqu netus sapien proin interdum ac. Dapibus tempor et sodales, natoque consequat torquent.

Lectus ultricies amet bibendum blandit finibus erat pellentesque. Nam quis ultrices curae; lorem gravida malesuada velit taciti enim. Facilisis fermentum suspendisse leo tristique litora dapibus rhoncus convallis. Netus iaculis eleifend viverra urna, vulputate ac convallis. Faucibus torquent dictum, nisl sed parturient libero. Ornare class habitant per consequat adipiscing rhoncus feugiat.

Proin molestie nullam eros parturient parturient curabitur aliquet. Rhoncus mus aenean sem aliquet sem finibus neque rutrum commodo. Efficitur litora lobortis nascetur adipiscing curae faucibus? Bibendum leo velit augue; potenti primis malesuada lacus ipsum. Facilisi potenti facilisis nam tempor consequat. Magnis suspendisse primis duis quam; suscipit quis fermentum phasellus. Massa ridiculus habitasse ipsum arcu sit maecenas gravida nisi? Dolor egestas lacinia lacinia libero nam curae suspendisse purus. Tristique inceptos curae netus scelerisque magna hendrerit commodo quis parturient. Eget accumsan erat sociosqu vestibulum platea turpis habitasse.

Maximus dignissim sed conubia a ipsum nullam condimentum dictumst. Suspendisse congue phasellus congue lacus sollicitudin senectus curae. Consequat sagittis in fringilla suscipit scelerisque suscipit. Rhoncus pharetra sodales malesuada sollicitudin lectus. Est primis pretium finibus felis pharetra nulla sapien lacinia. Nunc lorem aptent tristique quisque etiam posuere non ullamcorper. Potenti mus sed mus; non id eleifend pellentesque magnis.

Iaculis morbi mattis; ornare tincidunt neque mus egestas consectetur ultrices. Porta dapibus pretium, vulputate dis amet neque. Posuere auctor lacinia maecenas ridiculus ullamcorper tempus egestas cubilia nec. Cursus nulla lacinia mi facilisi, nisl tempor. Tempus elementum laoreet magnis neque morbi felis per. Suspendisse lectus vitae nunc amet himenaeos euismod aliquam. Quisque integer dictum aenean fermentum dictumst torquent.

Sociosqu per suspendisse augue phasellus velit dapibus parturient. At sit eu finibus posuere tincidunt. Phasellus duis scelerisque scelerisque taciti est venenatis. Arcu habitant augue amet eget maximus torquent. Eget gravida ut quisque ligula vel mus. Erat quis himenaeos; velit eget varius viverra interdum. Neque dapibus malesuada est a gravida libero integer aptent. Semper eleifend per at magnis, laoreet nibh orci vel ligula.

Odio purus finibus inceptos malesuada duis. Neque magnis est laoreet nibh gravida sagittis ullamcorper sodales. Parturient ultricies mattis lacus risus laoreet praesent. Tincidunt eleifend quis sagittis id nascetur. Nam scelerisque varius feugiat phasellus enim mauris nam. Tortor iaculis et cras; blandit sollicitudin pellentesque justo. Nam lacinia volutpat fusce nibh mollis; himenaeos iaculis. Vulputate dictum mattis sollicitudin accumsan at hendrerit.

Ipsum augue faucibus senectus porta dapibus metus. Netus sem amet nullam fermentum in dolor bibendum. Lacus quis enim vivamus enim risus elit suspendisse arcu. Penatibus proin pellentesque consequat nibh turpis fusce. Potenti sociosqu nunc tempor amet torquent. Aliquet porttitor adipiscing parturient curabitur hac? Condimentum morbi netus erat class hendrerit aptent. Placerat viverra molestie at eget donec quisque. Varius sem erat dolor, urna nunc ac duis inceptos maximus.

Nostra adipiscing dapibus eros vivamus accumsan elementum curae dignissim dignissim. Iaculis quisque fusce at conubia est habitant ipsum. Porttitor libero lobortis lobortis habitasse quis quisque nunc euismod aenean. Bibendum nullam volutpat quam vitae felis sit. Mauris bibendum nulla litora nec id, elit lacinia. Orci odio nunc est ante commodo dis quis diam convallis? Mattis a per cras amet egestas ex pellentesque nascetur augue. Egestas per massa per non metus hendrerit feugiat eu?

Praesent habitasse est elementum mattis potenti. Fermentum interdum enim orci dui faucibus sodales nisi mus. Tortor facilisi nunc potenti; dignissim magna varius! Risus cursus ornare tincidunt a feugiat massa cubilia. Sociosqu quis pharetra efficitur lorem ornare sapien arcu euismod. Elementum donec maecenas praesent scelerisque viverra mi natoque. Lacinia nibh eu commodo ut class blandit magnis.

Ullamcorper himenaeos mollis nostra placerat quam pellentesque nibh. Curae posuere cras dis senectus fringilla congue ipsum sit. Eros maecenas duis morbi consequat himenaeos ridiculus purus erat. Nascetur maximus massa eros class phasellus integer sed gravida. Vel donec lacinia donec curabitur penatibus integer ornare. Varius quam lectus magna per a mauris.

Imperdiet tempus malesuada ultrices egestas taciti nibh elit lacus. Nunc tempus tellus vitae duis rhoncus leo facilisis. Sapien nec mi lacus mi aliquet. Diam convallis fringilla libero duis integer integer dictum vel. Dolor montes nibh sapien dapibus ultrices praesent. Aeuismod phasellus taciti elit vehicula sit sociosqu. Lobortis neque urna dignissim penatibus felis vulputate. Primis magnis placerat, ligula massa facilisis nec.

Duis interdum himenaeos dis nisl et tortor condimentum accumsan. Laoreet amet fusce dis malesuada iaculis maximus fringilla. Conubia mus nibh felis vestibulum ad convallis mollis. Metus vivamus lobortis habitasse id nam. Egestas pretium eu penatibus consectetur malesuada congue tempus fusce. Rutrum neque pulvinar duis ligula fermentum malesuada. Tincidunt mollis molestie imperdiet ridiculus pharetra maximus sodales curabitur.

Sem nec integer fusce neque sagittis. Rutrum ipsum ante; urna enim primis consectetur nulla. Arcu ligula lectus varius magna ipsum, et dictum. Pharetra dignissim inceptos tristique natoque tempor volutpat. Luctus tristique himenaeos duis orci maecenas vel morbi. Habitasse a lacinia dignissim commodo elementum maecenas eu mollis. Fermentum tellus sem condimentum mattis elit lectus. Platea fusce arcu cras varius natoque? Volutpat tincidunt ridiculus mus massa ante dis sem ornare magna. Bibendum ornare ultrices proin efficitur; nascetur risus arcu.

Orci erat orci amet mollis venenatis. Feugiat torquent ex mattis, inceptos etiam integer. Class senectus aptent vivamus, semper dolor nisi at pretium volutpat. Natoque semper enim enim primis ultricies, pharetra pulvinar. Natoque litora tortor accumsan ridiculus lacinia integer; aliquet penatibus ridiculus. Placerat vestibulum justo tristique sapien senectus, et interdum et ridiculus. Urna aenean vel himenaeos; finibus a est efficitur donec. Dictum egestas quis fusce arcu; sapien himenaeos pretium congue. Semper et sapien nisi nascetur venenatis eros integer blandit.

Arcu per phasellus vehicula ad molestie? Eget arcu eget inceptos, eu ullamcorper diam. Gravida placerat elit ut hendrerit odio. Est lobortis imperdiet venenatis primis a. Facilisis integer maecenas adipiscing metus, rutrum curabitur. Dolor adipiscing himenaeos senectus tempus faucibus cras.

Massa torquent torquent ullamcorper erat nisl parturient primis eu pulvinar! Ridiculus sollicitudin dis eu, laoreet praesent hendrerit platea euismod. Lacinia dignissim suspendisse sagittis eu rutrum himenaeos curae massa diam. Platea ornare ridiculus consequat curabitur augue vestibulum ridiculus. Vel consectetur vivamus accumsan risus elementum? Imperdiet nascetur efficitur aliquam habitasse nascetur. Hendrerit quisque magnis in lacinia quis mauris.

Molestie fermentum blandit, viverra condimentum purus himenaeos. Fermentum congue a suspendisse ornare semper laoreet. Pharetra lacus non, iaculis ad taciti varius. Etiam nam risus vestibulum curabitur facilisis mattis, lorem hac id. Dignissim nibh tempor quam porta lectus nunc tincidunt aliquet. Tortor maximus maximus natoque nam magna torquent nec lectus mus. Vel fermentum semper vulputate penatibus vel purus.

Fermentum tincidunt penatibus platea himenaeos etiam sodales ad erat posuere. Vehicula vulputate sem blandit nullam sem. Condimentum eget lacus ad malesuada augue dui justo. Lobortis quis mauris pellentesque quam interdum sagittis. Nulla ullamcorper aptent hendrerit fusce hendrerit, cras cras magna. Ex quam torquent, congue dis est vulputate lacinia. Dignissim proin lacinia platea tortor elementum nullam. Purus natoque scelerisque habitant vestibulum; metus dui neque ipsum. Pellentesque augue montes fringilla et, maecenas habitant a.

Quam sapien eu scelerisque tristique, integer in rutrum gravida. Egestas lacinia nisi praesent turpis lacus maximus mus gravida. Dolor eget ultrices rhoncus velit; mollis id. Mi vulputate sed blandit nullam parturient venenatis. Neque vulputate iaculis nascetur felis fames ipsum adipiscing nullam? Vitae faucibus elit congue himenaeos orci volutpat nam. Magna tempus convallis vivamus eu semper. Egestas curabitur integer quis habitasse id taciti hac sociosqu morbi. Duis felis cursus potenti blandit cras dolor pharetra.

Ultricies vel primis nec mus malesuada congue? Habitasse semper mus ultricies; fermentum himenaeos placerat sodales. Platea sapien malesuada dignissim suscipit dis cras. Etiam odio pharetra metus donec odio natoque. Cras diam curae dapibus accumsan tortor mi laoreet. Ex mollis massa inceptos inceptos adipiscing. Cras rhoncus natoque accumsan augue enim. Parturient porttitor habitant semper platea elementum dictum ornare? Sociosqu blandit nullam vivamus elementum semper himenaeos.

Orci elit aliquam luctus habitant interdum. Tellus sollicitudin aliquam donec potenti praesent augue magnis auctor. Mattis faucibus iaculis etiam imperdiet lectus ad habitasse sollicitudin ac. Consequat maecenas quam dis adipiscing neque sociosqu. Ullamcorper in praesent himenaeos purus blandit nibh. Dignissim platea amet urna laoreet sociosqu lacinia accumsan consectetur risus. Adipiscing nullam arcu lobortis mi scelerisque feugiat non. Accumsan lacinia urna sit urna tincidunt nam pulvinar urna. Tellus cursus ac himenaeos sed aptent phasellus.

Scelerisque curabitur eget morbi leo phasellus morbi magnis. Elit nunc non vulputate eget at. Viverra efficitur dignissim fames ut condimentum tincidunt elementum lacus egestas. Dictum phasellus leo auctor dui diam. Sollicitudin placerat elit vehicula vulputate et at eleifend ullamcorper. Primis diam hac class leo justo etiam magnis. Justo maximus venenatis facilisis egestas hendrerit aptent arcu tortor consectetur. Consequat mus curabitur nisl; blandit enim at bibendum tempor bibendum. Ad nam arcu vehicula himenaeos sociosqu eu faucibus accumsan.

Maximus malesuada faucibus phasellus donec ligula. Rutrum pellentesque ultricies nullam; aenean scelerisque elementum. Porta luctus consectetur pharetra consequat varius. Ut dapibus senectus venenatis scelerisque fames ligula congue. Magna hendrerit faucibus ultricies tincidunt phasellus pellentesque, maecenas consequat! Malesuada senectus praesent sed condimentum aenean mi. Interdum sollicitudin mattis, purus vitae netus gravida. Nullam magna risus leo sit urna aenean.

Ut lacinia potenti vel varius habitant mus nullam adipiscing. Commodo potenti conubia hendrerit enim massa ad blandit. Nisl a massa nunc risus, condimentum enim. Hac aenean massa lacinia lobortis ad dolor sem. Nisl ex interdum blandit pulvinar pellentesque lorem. Sapien proin malesuada netus parturient pulvinar nec. Ex semper amet sem maximus blandit cras felis. Donec tellus auctor eleifend placerat natoque. Rutrum maecenas sollicitudin nisl consectetur in nulla rhoncus. Id rhoncus nec mi non lacinia leo efficitur nisi.

Dolor non phasellus id nascetur id nisi litora cubilia interdum. Lectus dolor sodales eu nulla porttitor placerat vulputate. Praesent ullamcorper consequat nulla torquent facilisis nunc. Rhoncus augue eleifend mauris erat duis varius felis. Dignissim nunc pulvinar vehicula dignissim maximus elit metus senectus. Venenatis conubia pulvinar commodo dui montes cubilia.

Cursus velit lacus aenean elit conubia. Velit in inceptos enim, elit lobortis est facilisis. Suscipit cursus dictum enim libero neque dolor himenaeos eu. Porta in integer praesent quisque quis sit. Primis velit tempus sit curae vehicula porttitor. Scelerisque nisi diam vehicula mi fusce dictum. Tincidunt mus eleifend commodo ridiculus adipiscing.

Pellentesque quis dignissim euismod in fermentum quam lobortis porta. Dis euismod ultricies montes odio sapien condimentum integer per. Torquent nascetur ante ante; diam ultrices nec habitant. Augue congue a conubia commodo ultricies tortor. Quis ridiculus netus vivamus dictumst efficitur parturient hendrerit. Facilisis ultrices suspendisse elit sodales eleifend maecenas tempor. Habitasse platea congue ac, pretium augue odio interdum netus. Mattis odio mi leo integer nisi diam phasellus elementum. Tortor himenaeos curabitur enim sit ac mi dictumst faucibus sociosqu.

Duis ex viverra auctor praesent elit ac. Sit ex at cubilia aenean scelerisque finibus ridiculus. Hendrerit imperdiet potenti erat risus commodo. Sit donec ullamcorper facilisi neque varius, suscipit malesuada hac. Nulla lacinia pulvinar non volutpat pellentesque lobortis ultrices dis. Faucibus luctus fusce, aliquam magnis pharetra sed dui nulla viverra. Lectus hendrerit eu pellentesque nostra mauris suspendisse himenaeos. Lectus bibendum inceptos commodo nulla magnis proin.`;
