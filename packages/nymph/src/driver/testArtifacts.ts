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
    testEntity.array = ['full', 'of', 'values', 500];
    testEntity.match = `Hello, my name is Edward McCheese. It is a pleasure to meet you. As you can see, I have several hats of the most pleasant nature.

This one's email address is nice_hat-wednesday+newyork@im-a-hat.hat.
This one's phone number is (555) 555-1818.
This one's zip code is 92064.
This one's favorite emojis are 🔥❤️😊😂⭐🤔

These hats are absolutely fantastic.`;
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
    const resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', equal: ['string', 'test'] },
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

    // Retrieving entity by contain with full match...
    resultEntity = await nymph.getEntities(
      { class: TestModel },
      { type: '&', contain: ['string', 'test'] },
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
      { type: '&', match: ['match', 'Q'] },
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
      expect(model.array).toEqual(['full', 'of', 'values', 500]);
      expect(model.match)
        .toEqual(`Hello, my name is Edward McCheese. It is a pleasure to meet you. As you can see, I have several hats of the most pleasant nature.

This one's email address is nice_hat-wednesday+newyork@im-a-hat.hat.
This one's phone number is (555) 555-1818.
This one's zip code is 92064.
This one's favorite emojis are 🔥❤️😊😂⭐🤔

These hats are absolutely fantastic.`);
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
      testEntity.array = ['full', 'of', 'values', 500];
      testEntity.match = `Hello, my name is Edward McCheese. It is a pleasure to meet you. As you can see, I have several hats of the most pleasant nature.

This one's email address is nice_hat-wednesday+newyork@im-a-hat.hat.
This one's phone number is (555) 555-1818.
This one's zip code is 92064.
This one's favorite emojis are 🔥❤️😊😂⭐🤔

These hats are absolutely fantastic.`;
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
