import fs from 'fs';
import strtotime from 'locutus/php/datetime/strtotime';

import newGUID from '../newGUID';
import Nymph from '../Nymph';
import { TestBModel, TestModel, TestModelData } from '../testArtifacts';

export function QueriesTest(it: (name: string, fn: () => void) => void) {
  let testEntity: TestModel & TestModelData;
  let testGuid: string;
  let refGuid: string;
  let createdMultiple = false;

  // The entities created by this function are required by many of the tests.
  function createTestEntities() {
    if (testGuid != null) {
      return;
    }

    // Creating entity...
    testEntity = TestModel.factory();

    // Saving entity...
    testEntity.name = 'Entity Test ' + new Date().toLocaleString();
    testEntity.null = null;
    testEntity.string = 'test';
    testEntity.array = ['full', 'of', 'values', 500];
    testEntity.match = `Hello, my name is Edward McCheese. It is a pleasure to meet you. As you can see, I have several hats of the most pleasant nature.

This one's email address is nice_hat-wednesday+newyork@im-a-hat.hat.
This one's phone number is (555) 555-1818.
This one's zip code is 92064.`;
    testEntity.number = 30;
    testEntity.numberString = '30';
    testEntity.timestamp = Date.now();
    expect(testEntity.$save()).toEqual(true);
    expect(testEntity.guid).not.toBeNull();
    testGuid = testEntity.guid as string;

    const entityReferenceTest: TestModel & TestModelData = new TestModel();
    entityReferenceTest.string = 'wrong';
    entityReferenceTest.timestamp = strtotime('-2 days') * 1000;
    expect(entityReferenceTest.$save()).toEqual(true);
    refGuid = entityReferenceTest.guid as string;
    testEntity.reference = entityReferenceTest;
    testEntity.refArray = [entityReferenceTest];
    expect(testEntity.$save()).toEqual(true);

    entityReferenceTest.test = 'good';
    expect(entityReferenceTest.$save()).toEqual(true);

    testEntity = Nymph.getEntity({ class: TestModel }, testGuid) as TestModel &
      TestModelData;
    expect(testEntity).toBeInstanceOf(TestModel);
    expect(testEntity.guid).toEqual(testGuid);
  }

  // The entities created by this function are required by many of the tests.
  async function createMultipleTestEntities() {
    if (!createdMultiple) {
      createdMultiple = true;
      // Creating 100 entities...
      for (let i = 0; i < 100; i++) {
        const testEntity = TestModel.factory();
        testEntity.name = `Multi Test ${i}`;
        testEntity.$removeTag('test');
        testEntity.$addTag('multiTest');
        expect(testEntity.$save()).toEqual(true);
        // Pause for a few milliseconds so the cdate and mdate can be sorted.
        await new Promise((res) => setTimeout(() => res(1), 5));
      }
    }
  }

  it('delete old test data', () => {
    let all = Nymph.getEntities({ class: TestModel });
    expect(Array.isArray(all)).toEqual(true);
    for (const cur of all) {
      expect(cur.$delete()).toEqual(true);
    }

    all = Nymph.getEntities({ class: TestModel });
    expect(all.length).toEqual(0);
  });

  it('create entity', () => {
    createTestEntities();
  });

  it('create multiple entities', async () => {
    return createMultipleTestEntities();
  });

  it('by guid', () => {
    createTestEntities();

    // Retrieving entity by GUID...
    let resultEntity = Nymph.getEntity({ class: TestModel }, testGuid);
    expect(testEntity.$is(resultEntity)).toEqual(true);

    // Using class constructor...
    resultEntity = TestModel.factory(testGuid);
    expect(testEntity.$is(resultEntity)).toEqual(true);

    // Testing wrong GUID...
    resultEntity = Nymph.getEntity({ class: TestModel }, newGUID());
    // if (resultEntity == null) {
    //   expect(resultEntity).toBeNull();
    // } else {
    expect(testEntity.$is(resultEntity)).toEqual(false);
    // }
  });

  it('options', () => {
    createTestEntities();

    // Testing entity order, offset, limit...
    const resultEntities = Nymph.getEntities(
      {
        class: TestModel,
        reverse: true,
        offset: 1,
        limit: 1,
        sort: 'cdate',
      },
      { type: '&', tag: 'test' }
    );
    expect(resultEntities.length).toEqual(1);
    expect(testEntity.$is(resultEntities[0])).toEqual(true);
  });

  it('guid and tags', () => {
    createTestEntities();

    // Retrieving entity by GUID and tags...
    const resultEntity = Nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: testGuid, tag: 'test' }
    );
    expect(testEntity.$is(resultEntity)).toEqual(true);
  });

  it('or selector', () => {
    createTestEntities();

    // Retrieving entity by GUID and tags...
    const resultEntity = Nymph.getEntity(
      { class: TestModel },
      { type: '|', guid: [testGuid, newGUID()] }
    );
    expect(testEntity.$is(resultEntity)).toEqual(true);
  });

  it('wrong or selector', () => {
    createTestEntities();

    // Retrieving entity by GUID and tags...
    const resultEntity = Nymph.getEntity(
      { class: TestModel },
      { type: '|', guid: [newGUID(), newGUID()] }
    );
    expect(testEntity.$is(resultEntity)).toEqual(false);
  });

  it('not guid', () => {
    createTestEntities();

    // Retrieving entity by !GUID...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', '!guid': newGUID(), tag: 'test' }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not tags', () => {
    createTestEntities();

    // Retrieving entity by !tags...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', guid: testGuid, '!tag': ['barbecue', 'pickles'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('guid and wrong tags', () => {
    createTestEntities();

    // Testing GUID and wrong tags...
    const resultEntity = Nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: testGuid, tag: ['pickles'] }
    );
    expect(resultEntity).toBeNull();
  });

  it('tags', () => {
    createTestEntities();

    // Retrieving entity by tags...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong tags', () => {
    createTestEntities();

    // Testing wrong tags...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'pickles' }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('inclusive tags', () => {
    createTestEntities();

    // Retrieving entity by tags inclusively...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '|', tag: ['pickles', 'test', 'barbecue'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong inclusive tags', () => {
    createTestEntities();

    // Testing wrong inclusive tags...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '|', tag: ['pickles', 'barbecue'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('mixed tags', () => {
    createTestEntities();

    // Retrieving entity by mixed tags...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
      { type: '|', tag: ['pickles', 'test', 'barbecue'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong inclusive mixed tags', () => {
    createTestEntities();

    // Testing wrong inclusive mixed tags...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
      { type: '|', tag: ['pickles', 'barbecue'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('wrong exclusive mixed tags', () => {
    createTestEntities();

    // Testing wrong exclusive mixed tags...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'pickles' },
      { type: '|', tag: ['test', 'barbecue'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('defined', () => {
    createTestEntities();

    // Retrieving entity by defined...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', defined: 'string' }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not defined', () => {
    createTestEntities();

    // Retrieving entity by !defined...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', '!defined': 'pickles' }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('defined in a not and clause', () => {
    createTestEntities();

    // Retrieving entity by defined in not and clause...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '!&', defined: 'pickles' },
      { type: '&', tag: 'test' }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('equal', () => {
    createTestEntities();

    // Retrieving entity by equal...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', equal: ['string', 'test'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not equal', () => {
    createTestEntities();

    const referenceEntity = TestModel.factory(refGuid);
    expect(referenceEntity.guid).toEqual(refGuid);

    // Retrieving entity by !equal...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', '!equal': ['string', 'wrong'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('like', () => {
    createTestEntities();

    // Retrieving entity by like...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', like: ['string', 't_s%'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not like', () => {
    createTestEntities();

    const referenceEntity = TestModel.factory(refGuid);
    expect(referenceEntity.guid).toEqual(refGuid);

    // Retrieving entity by !like...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', '!like': ['string', 'wr_n%'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('ilike', () => {
    createTestEntities();

    // Retrieving entity by ilike...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', ilike: ['string', 'T_s%'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not ilike', () => {
    createTestEntities();

    const referenceEntity = TestModel.factory(refGuid);
    expect(referenceEntity.guid).toEqual(refGuid);

    // Retrieving entity by !ilike...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', '!ilike': ['string', 'wr_n%'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('like with wrong case', () => {
    createTestEntities();

    // Retrieving entity by like...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', like: ['string', 'T_s%'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('tags and equal', () => {
    createTestEntities();

    // Retrieving entity by tags and equal...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', equal: ['string', 'test'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong tags right equal', () => {
    createTestEntities();

    // Testing wrong tags and right equal...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'pickles', equal: ['string', 'test'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('right tags wrong equal', () => {
    createTestEntities();

    // Testing right tags and wrong equal...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', equal: ['string', 'pickles'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('wrong tags wrong equal', () => {
    createTestEntities();

    // Testing wrong tags and wrong equal...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'pickles', equal: ['string', 'pickles'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('contain', () => {
    createTestEntities();

    // Retrieving entity by contain...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', contain: ['array', 'values'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not contain', () => {
    createTestEntities();

    // Retrieving entity by !contain...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
      { type: '!&', contain: ['array', 'pickles'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong contain', () => {
    createTestEntities();

    // Testing wrong contain...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', contain: ['array', 'pickles'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('match', () => {
    createTestEntities();

    // Retrieving entity by regex match...
    let resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', match: ['match', '.*'] } // anything
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', match: ['match', 'Edward McCheese'] } // a substring
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
      {
        type: '|',
        match: [
          ['string', '[0-9]'],
          ['match', 'Edward McCheese'],
        ],
      } // inclusive test
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        tag: 'test',
        match: ['match', '[-a-zA-Z0-9+_]+@[-a-zA-Z0-9_]+.[-a-zA-Z0-9_]{2,4}'],
      } // a simple email
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        tag: 'test',
        match: ['match', '\\([0-9]{3}\\) [0-9]{3}-[0-9]{4}'],
      } // a phone number
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('imatch', () => {
    createTestEntities();

    // Retrieving entity by regex match...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', imatch: ['match', 'edward mccheese'] } // a substring
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong match', () => {
    createTestEntities();

    // Testing wrong regex match...
    let resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', match: ['match', 'Q'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'pickle', match: ['match', '.*'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        match: [
          ['string', '[0-9]'],
          ['match', ',,'],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('match wrong case', () => {
    createTestEntities();

    // Retrieving entity by regex match...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', match: ['match', 'edward mccheese'] } // a substring
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('match and equal inclusive', () => {
    createTestEntities();

    // Retrieving entity by regex + equal inclusively...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
      { type: '|', equal: ['string', 'pickles'], match: ['string', 'test'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('greater than', () => {
    createTestEntities();

    // Retrieving entity by inequality...
    let resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gt: [
          ['number', 30],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gt: [
          ['number', 31],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gt: [
          ['number', 29],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gt: [
          ['numberString', 30],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gt: [
          ['numberString', 31],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gt: [
          ['numberString', 29],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('greater than or equal', () => {
    createTestEntities();

    // Retrieving entity by inequality...
    let resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gte: [
          ['number', 30],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gte: [
          ['number', 31],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gte: [
          ['number', 29],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gte: [
          ['numberString', 30],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gte: [
          ['numberString', 31],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gte: [
          ['numberString', 29],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('less than', () => {
    createTestEntities();

    // Retrieving entity by inequality...
    let resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lt: [
          ['number', 30],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lt: [
          ['number', 31],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lt: [
          ['number', 29],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lt: [
          ['numberString', 30],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lt: [
          ['numberString', 31],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lt: [
          ['numberString', 29],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('less than or equal', () => {
    createTestEntities();

    // Retrieving entity by inequality...
    let resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lte: [
          ['number', 30],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lte: [
          ['number', 31],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lte: [
          ['number', 29],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lte: [
          ['numberString', 30],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lte: [
          ['numberString', 31],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by inequality...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        lte: [
          ['numberString', 29],
          ['pickles', 100],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('not inequality', () => {
    createTestEntities();

    // Retrieving entity by !inequality...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
      { type: '!&', gte: ['number', 60] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong inequality', () => {
    createTestEntities();

    // Testing wrong inequality...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', lte: ['number', 29.99] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('greater than cdate', () => {
    createTestEntities();

    // Retrieving entity by time...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', gt: ['cdate', (testEntity.cdate ?? 0) - 120] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong cdate', () => {
    createTestEntities();

    // Testing wrong time...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', gte: ['cdate', (testEntity.cdate ?? 0) + 1] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('time selector', () => {
    createTestEntities();

    const referenceEntity = TestModel.factory(refGuid);

    // Retrieving entity by relative time...
    let resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', gt: ['timestamp', null, '-1 day'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by relative time inclusively...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        gt: [
          ['timestamp', null, '-1 day'],
          ['timestamp', null, '+5 days'],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by relative time...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', gt: ['timestamp', null, '-3 days'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(true);

    // Retrieving entity by relative time...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', gt: ['cdate', null, '-1 day'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong time selector', () => {
    createTestEntities();

    const referenceEntity = TestModel.factory(refGuid);

    // Retrieving entity by relative time...
    let resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', gt: ['timestamp', null, '+1 day'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by relative time...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', lt: ['timestamp', null, '-3 days'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);

    // Retrieving entity by relative time...
    resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test', gt: ['cdate', null, '+1 day'] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
    expect(referenceEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('references', () => {
    createTestEntities();

    // Testing referenced entities...
    expect(testEntity.reference?.test).toEqual('good');

    // Testing referenced entity arrays...
    expect(testEntity.refArray?.[0].test).toEqual('good');
  });

  it('ref', () => {
    createTestEntities();

    // Retrieving entity by reference...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', ref: ['reference', refGuid] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('not ref', () => {
    createTestEntities();

    // Retrieving entity by !reference...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', tag: 'test' },
      { type: '!&', ref: ['reference', newGUID()] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong ref', () => {
    createTestEntities();

    // Testing wrong reference...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', ref: ['reference', newGUID()] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('nonexistent ref', () => {
    createTestEntities();

    // Testing non-existent reference...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', ref: ['pickle', refGuid] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('inclusive ref', () => {
    createTestEntities();

    // Retrieving entity by inclusive reference...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        ref: [
          ['reference', refGuid],
          ['reference', newGUID()],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong inclusive ref', () => {
    createTestEntities();

    // Testing wrong inclusive reference...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        ref: [
          ['reference', newGUID()],
          ['reference', newGUID()],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('ref in an array', () => {
    createTestEntities();

    // Retrieving entity by array reference...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      { type: '&', ref: ['refArray', refGuid] }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('wrong ref in an array', () => {
    createTestEntities();

    // Testing wrong array reference...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        ref: [
          ['refArray', refGuid],
          ['refArray', newGUID()],
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('logic operations', () => {
    createTestEntities();

    // Testing logic operations...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        '!ref': [
          ['refArray', newGUID()],
          ['refArray', newGUID()],
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
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);
  });

  it('deep selector', () => {
    createTestEntities();

    // Testing deep selectors...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        '!ref': [
          ['refArray', newGUID()],
          ['refArray', newGUID()],
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
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(true);

    const resultEntity2 = Nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        '!ref': [
          ['refArray', newGUID()],
          ['refArray', newGUID()],
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
      }
    );
    expect(testEntity.$inArray(resultEntity2)).toEqual(true);

    const resultEntity3 = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        selector: [
          {
            type: '&',
            '!ref': ['refArray', newGUID()],
            '!lte': ['number', 29.99],
          },
          { type: '&', gte: ['number', 16000] },
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity3)).toEqual(true);

    const resultEntity4 = Nymph.getEntities(
      { class: TestModel },
      {
        type: '|',
        selector: [
          {
            type: '&',
            '!ref': ['refArray', newGUID()],
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
      }
    );
    expect(testEntity.$inArray(resultEntity4)).toEqual(true);
  });

  it('wrong deep selector', () => {
    // Testing wrong deep selectors...
    const resultEntity = Nymph.getEntities(
      { class: TestModel },
      {
        type: '&',
        selector: [
          {
            type: '&',
            '!ref': ['refArray', newGUID()],
            '!lte': ['number', 29.99],
          },
          { type: '&', gte: ['number', 16000] },
        ],
      }
    );
    expect(testEntity.$inArray(resultEntity)).toEqual(false);
  });

  it('sort option', async () => {
    await createMultipleTestEntities();

    for (const sort of ['cdate', 'mdate']) {
      // Retrieving entities sorted...
      let resultEntities = Nymph.getEntities({
        class: TestModel,
        sort: sort as 'cdate' | 'mdate',
      });
      expect(resultEntities.length).toBeGreaterThan(100);
      for (let i = 0; i < resultEntities.length - 1; i++) {
        expect(
          resultEntities[i + 1][sort as 'cdate' | 'mdate']
        ).toBeGreaterThan(resultEntities[i][sort as 'cdate' | 'mdate'] ?? 0);
      }

      // Retrieving entities reverse sorted...
      resultEntities = Nymph.getEntities({
        class: TestModel,
        sort: sort as 'cdate' | 'mdate',
        reverse: true,
      });
      expect(resultEntities.length).toBeGreaterThan(100);
      for (let i = 0; i < resultEntities.length - 1; i++) {
        expect(resultEntities[i + 1][sort as 'cdate' | 'mdate']).toBeLessThan(
          resultEntities[i][sort as 'cdate' | 'mdate'] ?? 0
        );
      }

      // And again with other selectors.
      // Retrieving entities sorted...
      resultEntities = Nymph.getEntities(
        { class: TestModel, sort: sort as 'cdate' | 'mdate' },
        { type: '&', match: ['name', '^Multi Test '] }
      );
      expect(resultEntities.length).toEqual(100);
      for (let i = 0; i < resultEntities.length - 1; i++) {
        expect(
          resultEntities[i + 1][sort as 'cdate' | 'mdate']
        ).toBeGreaterThan(resultEntities[i][sort as 'cdate' | 'mdate'] ?? 0);
      }

      // Retrieving entities reverse sorted...
      resultEntities = Nymph.getEntities(
        { class: TestModel, sort: sort as 'cdate' | 'mdate', reverse: true },
        { type: '&', match: ['name', '^Multi Test '] }
      );
      expect(resultEntities.length).toEqual(100);
      for (let i = 0; i < resultEntities.length - 1; i++) {
        expect(resultEntities[i + 1][sort as 'cdate' | 'mdate']).toBeLessThan(
          resultEntities[i][sort as 'cdate' | 'mdate'] ?? 0
        );
      }
    }
  });

  it('delete reference', () => {
    createTestEntities();

    // Deleting referenced entities...
    expect(testEntity.reference?.$delete()).toEqual(true);
    expect(testEntity.reference?.guid).toBeNull();
  });

  it('delete', () => {
    createTestEntities();

    // Deleting entity...
    expect(testEntity.$delete()).toEqual(true);
    expect(testEntity.guid).toBeNull();

    const entity = Nymph.getEntity(
      { class: TestModel },
      { type: '&', guid: testGuid }
    );

    expect(entity).toBeNull();
  });
}

export function UIDTest(it: (name: string, fn: () => void) => void) {
  it('delete old test data', () => {
    expect(Nymph.deleteUID('TestUID')).toEqual(true);
  });

  it('new UID', () => {
    expect(Nymph.newUID('TestUID')).toEqual(1);
  });

  it('increment UID', () => {
    expect(Nymph.newUID('TestUID')).toEqual(2);
  });

  it('retrieve UID', () => {
    expect(Nymph.getUID('TestUID')).toEqual(2);
  });

  it('rename UID', () => {
    expect(Nymph.renameUID('TestUID', 'NewUID')).toEqual(true);
    expect(Nymph.getUID('TestUID')).toBeNull();
    expect(Nymph.getUID('NewUID')).toEqual(2);
    expect(Nymph.renameUID('NewUID', 'TestUID')).toEqual(true);
    expect(Nymph.getUID('NewUID')).toBeNull();
    expect(Nymph.getUID('TestUID')).toEqual(2);
  });

  it('set UID', () => {
    expect(Nymph.setUID('TestUID', 5)).toEqual(true);
    expect(Nymph.getUID('TestUID')).toEqual(5);
  });

  it('delete UID', () => {
    expect(Nymph.deleteUID('TestUID')).toEqual(true);
    expect(Nymph.getUID('TestUID')).toBeNull();
  });
}

export function ExportImportTest(it: (name: string, fn: () => void) => void) {
  function deleteTestData() {
    let all = Nymph.getEntities({ class: TestModel });
    expect(Array.isArray(all)).toEqual(true);
    for (const cur of all) {
      expect(cur.$delete()).toEqual(true);
    }

    all = Nymph.getEntities({ class: TestModel });
    expect(all.length).toEqual(0);

    all = Nymph.getEntities({ class: TestBModel });
    expect(Array.isArray(all)).toEqual(true);
    for (const cur of all) {
      expect(cur.$delete()).toEqual(true);
    }

    all = Nymph.getEntities({ class: TestBModel });
    expect(all.length).toEqual(0);

    expect(Nymph.deleteUID('TestUID')).toEqual(true);
    expect(Nymph.deleteUID('TestUID2')).toEqual(true);
  }

  function checkEntityDataAndCount() {
    expect(Nymph.getUID('TestUID')).toEqual(2);
    expect(Nymph.getUID('TestUID2')).toEqual(1);

    const models = Nymph.getEntities({ class: TestModel });
    const bmodels = Nymph.getEntities({ class: TestBModel });

    expect(models.length).toEqual(30);
    expect(bmodels.length).toEqual(10);

    const all = [...models, ...bmodels];
    for (const model of all) {
      if (model.index?.match(/^\d+a$/)) {
        expect(model.null).toBeNull();
        expect(model.string).toEqual('test');
        expect(model.array).toEqual(['full', 'of', 'values', 500]);
        expect(model.number).toEqual(30);
        expect(model.timestamp).toBeGreaterThanOrEqual(strtotime('-2 minutes'));

        expect(model.reference?.guid).not.toBeNull();
        expect(model.reference?.string).toEqual('another');
        expect(model.reference?.index?.match(/^\d+b$/)).toBeTruthy();
        expect(model.refArray?.[0].guid).not.toBeNull();
        expect(model.refArray?.[0].guid).toEqual(model.reference?.guid);
      }
    }
  }

  it('delete old test data', () => {
    deleteTestData();
  });

  it('setup data', () => {
    expect(Nymph.newUID('TestUID')).toEqual(1);
    expect(Nymph.newUID('TestUID')).toEqual(2);
    expect(Nymph.newUID('TestUID2')).toEqual(1);

    for (let i = 0; i < 20; i++) {
      const EntityClass = i < 15 ? TestModel : TestBModel;

      // Creating entity...
      const testEntity = EntityClass.factory();

      // Saving entity...
      testEntity.name = 'Entity Test ' + new Date().toLocaleString();
      testEntity.null = null;
      testEntity.string = 'test';
      testEntity.array = ['full', 'of', 'values', 500];
      testEntity.number = 30;
      testEntity.timestamp = Date.now();
      testEntity.index = i + 'a';

      const entityReferenceTest = EntityClass.factory();
      entityReferenceTest.string = 'another';
      entityReferenceTest.index = i + 'b';

      expect(entityReferenceTest.$save()).toEqual(true);
      testEntity.reference = entityReferenceTest;
      testEntity.refArray = [entityReferenceTest];

      expect(testEntity.$save()).toEqual(true);
    }

    checkEntityDataAndCount();
  });

  it('export data', () => {
    expect(Nymph.export(__dirname + '/testentityexport.nex')).toEqual(true);
  });

  it('delete test data again', () => {
    deleteTestData();
  });

  it('import data', () => {
    expect(Nymph.getUID('TestUID')).toBeNull();
    expect(Nymph.getUID('TestUID2')).toBeNull();
    const models = Nymph.getEntities({ class: TestModel });
    const bmodels = Nymph.getEntities({ class: TestBModel });
    expect(models.length).toEqual(0);
    expect(bmodels.length).toEqual(0);

    expect(Nymph.import(__dirname + '/testentityexport.nex')).toEqual(true);

    checkEntityDataAndCount();

    fs.unlinkSync(__dirname + '/testentityexport.nex');
  });
}
