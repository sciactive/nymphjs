import { jest } from '@jest/globals';

import { cloneDeep } from 'lodash-es';

import { MockNymph } from './testMocks.js';
import {
  TestBModel as TestBModelClass,
  TestModel as TestModelClass,
  TestModelData,
} from './testArtifacts.js';

const nymph = new MockNymph();

jest.mock('./Nymph', () => ({
  __esModule: true,
  default: nymph,
}));

const TestModel = nymph.addEntityClass(TestModelClass);
const TestBModel = nymph.addEntityClass(TestBModelClass);

let testEntity = TestModel.factorySync();
let entityReferenceTest: TestModelClass & TestModelData;
let entityReferenceGuid: string;

describe('Entity', () => {
  it('instantiates correctly', () => {
    expect(testEntity).toBeInstanceOf(TestModel);
    expect(testEntity.$hasTag('test')).toEqual(true);
    expect(testEntity.boolean).toEqual(true);
  });

  it('assignments work', async () => {
    // Assign some variables.
    testEntity.name = 'Entity Test';
    testEntity.null = null;
    testEntity.string = 'test';
    testEntity.array = ['full', 'of', 'values', 500];
    testEntity.number = 30;

    expect(testEntity.name).toEqual('Entity Test');
    expect(testEntity.null).toBeNull();
    expect(testEntity.string).toEqual('test');
    expect(testEntity.array).toEqual(['full', 'of', 'values', 500]);
    expect(testEntity.number).toEqual(30);

    expect(await testEntity.$save()).toEqual(true);
    expect(typeof testEntity.guid).toEqual('string');

    entityReferenceTest = await TestModel.factory();
    entityReferenceTest.string = 'wrong';
    expect(await entityReferenceTest.$save()).toEqual(true);
    entityReferenceGuid = entityReferenceTest.guid as string;
    testEntity.reference = entityReferenceTest;
    testEntity.refArray = [entityReferenceTest];
    testEntity.refObject = {
      entity: entityReferenceTest,
    };
    expect(await testEntity.$save()).toEqual(true);

    entityReferenceTest.test = 'good';
    expect(await entityReferenceTest.$save()).toEqual(true);
  });

  it('comparisons work', async () => {
    const compare = await TestModel.factory(testEntity.guid as string);

    expect(testEntity.$is(compare)).toEqual(true);
    await testEntity.$refresh();
    await compare.$refresh();
    expect(testEntity.$equals(compare)).toEqual(true);

    compare.string = 'different';

    expect(testEntity.$is(compare)).toEqual(true);
    expect(testEntity.$equals(compare)).toEqual(false);
  });

  it('array searching work', async () => {
    const testInArray = await TestModel.factory(testEntity.guid as string);
    const array: (string | (TestModelClass & TestModelData))[] = [
      'thing',
      testInArray,
    ];

    expect(testEntity.$inArray(array)).toEqual(true);
    await testEntity.$refresh();
    await testInArray.$refresh();
    expect(testEntity.$inArray(array, true)).toEqual(true);
    expect(testEntity.$inArray([0, 1, 2, 3, 4, 5])).toEqual(false);
    expect(testEntity.$inArray([0, 1, 2, 3, 4, 5], true)).toEqual(false);

    testInArray.string = 'different';

    expect(testEntity.$inArray(array)).toEqual(true);
    expect(testEntity.$inArray(array, true)).toEqual(false);

    expect(testEntity.$arraySearch(array)).toEqual(1);
    await testEntity.$refresh();
    await testInArray.$refresh();
    expect(testEntity.$arraySearch(array, true)).toEqual(1);
    expect(testEntity.$arraySearch([0, 1, 2, 3, 4, 5])).toEqual(-1);
    expect(testEntity.$arraySearch([0, 1, 2, 3, 4, 5], true)).toEqual(-1);

    testInArray.string = 'different';

    expect(testEntity.$arraySearch(array)).toEqual(1);
    expect(testEntity.$arraySearch(array, true)).toEqual(-1);
  });

  it('refresh work', async () => {
    testEntity.boolean = false;
    expect(testEntity.boolean).toEqual(false);
    expect(await testEntity.$refresh()).toEqual(true);
    expect(testEntity.boolean).toEqual(true);
  });

  it('refresh updates', async () => {
    expect(testEntity.string).toEqual('test');
    testEntity.string = 'updated';
    expect(await testEntity.$save()).toEqual(true);
    await testEntity.$refresh();
    expect(await testEntity.$save()).toEqual(true);

    const retrieve = await TestModel.factory(testEntity.guid as string);
    expect(retrieve.string).toEqual('updated');
    retrieve.string = 'test';
    expect(await retrieve.$save()).toBe(true);

    await testEntity.$refresh();
    expect(testEntity.string).toEqual('test');
  });

  it('conflict fails to save', async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));

    const testEntityCopy = await TestModel.factory(testEntity.guid as string);
    expect(await testEntityCopy.$save()).toEqual(true);
    expect(testEntityCopy.mdate ?? 0).toBeGreaterThan(testEntity.mdate ?? 0);

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(await testEntity.$save()).toEqual(false);

    await testEntity.$refresh();

    expect(testEntityCopy.mdate ?? Infinity).toBeLessThanOrEqual(
      testEntity.mdate ?? 0,
    );
  });

  it('toReference works', () => {
    const reference = testEntity.$toReference();

    expect(reference).toEqual([
      'nymph_entity_reference',
      testEntity.guid,
      'TestModel',
    ]);
  });

  it('toReference works even on an unsaved entity', () => {
    const unsavedEntity = TestModel.factorySync();
    const reference = unsavedEntity.$toReference();

    expect(unsavedEntity.guid).toBeNull();
    expect(reference).toEqual([
      'nymph_entity_reference',
      unsavedEntity.$getGuaranteedGUID(),
      'TestModel',
    ]);
  });

  it('tags work', async () => {
    expect(testEntity.$hasTag('test')).toEqual(true);
    testEntity.$addTag('test', 'test2');
    expect(testEntity.$hasTag('test', 'test2')).toEqual(true);
    testEntity.$addTag('test', 'test3', 'test4', 'test5', 'test6');
    expect(
      testEntity.$hasTag('test', 'test3', 'test4', 'test5', 'test6'),
    ).toEqual(true);
    testEntity.$removeTag('test2');
    expect(testEntity.$hasTag('test2')).toEqual(false);
    testEntity.$removeTag('test3', 'test4');
    expect(testEntity.$hasTag('test3', 'test4')).toEqual(false);
    testEntity.$removeTag('test5', 'test6');
    expect(testEntity.$hasTag('test5', 'test6')).toEqual(false);
    expect(testEntity.$getTags()).toEqual(['test']);

    // Remove all tags.
    testEntity.$removeTag('test');
    expect(await testEntity.$save()).toEqual(true);
    expect(await testEntity.$refresh()).toEqual(true);
    expect(testEntity.$hasTag('test')).toEqual(false);
    expect(testEntity.$getTags()).toEqual([]);
    testEntity.$addTag('test');
    expect(await testEntity.$save()).toEqual(true);
    expect(testEntity.$hasTag('test')).toEqual(true);
  });

  it('references work', async () => {
    await testEntity.$refresh();

    await testEntity.reference?.$wake();
    expect(testEntity.reference?.guid).toEqual(entityReferenceGuid);
    await Promise.all(testEntity.refArray?.map((e) => e.$wake()) || []);
    expect(testEntity.refArray?.[0].guid).toEqual(entityReferenceGuid);
    await testEntity.refObject?.entity.$wake();
    expect(testEntity.refObject?.entity.guid).toEqual(entityReferenceGuid);

    const entity = await TestModel.factory(testEntity.guid as string);

    await entity.reference?.$wake();
    expect(entity.reference?.guid).toEqual(entityReferenceGuid);
    await Promise.all(entity.refArray?.map((e) => e.$wake()) || []);
    expect(entity.refArray?.[0].guid).toEqual(entityReferenceGuid);
    await entity.refObject?.entity.$wake();
    expect(entity.refObject?.entity.guid).toEqual(entityReferenceGuid);
  });

  it('sleeping references wake up', async () => {
    const entity = TestModel.factoryReference([
      'nymph_entity_reference',
      testEntity.guid as string,
      'TestModel',
    ]) as TestModelClass & TestModelData;

    await entity.$wake();
    expect(entity.guid).toEqual(testEntity.guid);
    expect(entity.cdate).toEqual(testEntity.cdate);
    expect(entity.mdate).toEqual(testEntity.mdate);
    expect(entity.tags).toEqual(testEntity.tags);
    expect(entity.name).toEqual('Entity Test');
    expect(entity.null).toBeNull();
    expect(entity.string).toEqual('test');
    expect(entity.array).toEqual(['full', 'of', 'values', 500]);
    expect(entity.number).toEqual(30);
    await entity.reference?.$wake();
    expect(entity.reference?.guid).toEqual(entityReferenceGuid);
    await Promise.all(entity.refArray?.map((e) => e.$wake()) || []);
    expect(entity.refArray?.[0].guid).toEqual(entityReferenceGuid);
    await entity.refObject?.entity.$wake();
    expect(entity.refObject?.entity.guid).toEqual(entityReferenceGuid);
  });

  it('JSON encoding works', () => {
    const json = JSON.parse(JSON.stringify(testEntity));

    expect(json).toEqual({
      guid: testEntity.guid,
      cdate: testEntity.cdate,
      mdate: testEntity.mdate,
      tags: ['test'],
      data: {
        reference: ['nymph_entity_reference', entityReferenceGuid, 'TestModel'],
        refArray: [
          ['nymph_entity_reference', entityReferenceGuid, 'TestModel'],
        ],
        refObject: {
          entity: ['nymph_entity_reference', entityReferenceGuid, 'TestModel'],
        },
        name: 'Entity Test',
        number: 30,
        array: ['full', 'of', 'values', 500],
        string: 'test',
        null: null,
        uniques: [],
      },
      class: 'TestModel',
    });
  });

  it('incoming JSON works', async () => {
    // Test that a property can be deleted.
    let json = JSON.stringify(testEntity);

    const entityDataDelete = JSON.parse(json);

    entityDataDelete.mdate++;
    delete entityDataDelete.data.string;
    testEntity.$jsonAcceptData(cloneDeep(entityDataDelete));

    expect(testEntity.string).toBeUndefined();

    expect(await testEntity.$refresh()).toEqual(true);

    // Test whitelisted data.
    json = JSON.stringify(testEntity);

    const entityData = JSON.parse(json);

    testEntity.cdate = 13;
    testEntity.mdate = 14;
    entityData.cdate = 13;
    entityData.mdate = 15;
    entityData.tags = ['notag', 'newtag'];
    entityData.data.name = 'bad';
    entityData.data.string = 'good';
    delete entityData.data.null;
    entityData.data.array = ['imanarray'];
    entityData.data.number = 4;
    delete entityData.data.reference;
    entityData.data.refArray = [];
    entityData.data.refObject = {};
    testEntity.$jsonAcceptData(cloneDeep(entityData));

    expect(testEntity.$hasTag('notag')).toEqual(false);
    expect(testEntity.$hasTag('test')).toEqual(true);
    expect(testEntity.$hasTag('newtag')).toEqual(true);
    expect(testEntity.cdate).toEqual(13.0);
    expect(testEntity.mdate).toEqual(15);
    expect(testEntity.name).toEqual('Entity Test');
    expect(testEntity.null).toBeNull();
    expect(testEntity.string).toEqual('good');
    expect(testEntity.array).toEqual(['imanarray']);
    expect(testEntity.number).toEqual(30);
    await testEntity.reference?.$wake();
    expect(testEntity.reference?.guid).toEqual(entityReferenceGuid);
    await Promise.all(testEntity.refArray?.map((e) => e.$wake()) || []);
    expect(testEntity.refArray?.[0].guid).toEqual(entityReferenceGuid);
    await testEntity.refObject?.entity.$wake();
    expect(testEntity.refObject?.entity.guid).toEqual(entityReferenceGuid);

    expect(await testEntity.$refresh()).toEqual(true);

    testEntity.cdate = 13;
    testEntity.mdate = 14;
    testEntity.$jsonAcceptPatch({
      class: TestModel.class,
      guid: testEntity.guid as string,
      mdate: 15,
      set: {
        refArray: [],
      },
      unset: ['reference'],
      addTags: ['notag', 'newtag'],
      removeTags: ['test'],
    });

    expect(testEntity.$hasTag('notag')).toEqual(false);
    expect(testEntity.$hasTag('test')).toEqual(true);
    expect(testEntity.$hasTag('newtag')).toEqual(true);
    await testEntity.reference?.$wake();
    expect(testEntity.reference?.guid).toEqual(entityReferenceGuid);
    await Promise.all(testEntity.refArray?.map((e) => e.$wake()) || []);
    expect(testEntity.refArray?.[0].guid).toEqual(entityReferenceGuid);

    expect(await testEntity.$refresh()).toEqual(true);

    // Test no whitelist, but protected data instead.
    const undo = testEntity.$useProtectedData();

    testEntity.cdate = 13;
    testEntity.mdate = 14;
    testEntity.$jsonAcceptData(cloneDeep(entityData));

    expect(testEntity.$hasTag('notag')).toEqual(true);
    expect(testEntity.$hasTag('newtag')).toEqual(true);
    expect(testEntity.cdate).toEqual(13.0);
    expect(testEntity.mdate).toEqual(15);
    expect(testEntity.name).toEqual('bad');
    expect(testEntity.null).toBeUndefined();
    expect(testEntity.string).toEqual('good');
    expect(testEntity.array).toEqual(['imanarray']);
    expect(testEntity.number).toEqual(30);
    expect(testEntity.reference).toBeUndefined();
    expect(testEntity.refArray).toEqual([]);
    expect(testEntity.refObject).toEqual({});

    expect(await testEntity.$refresh()).toEqual(true);

    testEntity.cdate = 13;
    testEntity.mdate = 14;
    testEntity.$jsonAcceptPatch({
      class: TestModel.class,
      guid: testEntity.guid as string,
      mdate: 15,
      set: {
        string: 'good',
      },
      unset: ['null'],
      addTags: ['newtag'],
      removeTags: ['test'],
    });

    expect(testEntity.$hasTag('test')).toEqual(false);
    expect(testEntity.$hasTag('newtag')).toEqual(true);
    expect(testEntity.string).toEqual('good');
    expect(testEntity.null).toBeUndefined();

    undo();
    expect(await testEntity.$refresh()).toEqual(true);
  });

  it("conflicting JSON doesn't work", async () => {
    // Test that an old JSON payload causes a conflict.
    const json = JSON.stringify(testEntity);

    expect(await testEntity.$save()).toEqual(true);

    let thrown = false;
    let thrownName: string = '';
    const data = JSON.parse(json);

    try {
      testEntity.$jsonAcceptData(data);
    } catch (e: any) {
      thrown = true;
      thrownName = e?.name;
    }

    expect(thrown).toEqual(true);
    expect(thrownName).toEqual('EntityConflictError');

    thrown = false;
    thrownName = '';

    try {
      testEntity.$jsonAcceptPatch({
        class: TestModel.class,
        guid: data.guid,
        mdate: data.mdate,
        set: {
          string: 'good',
        },
        unset: [],
        addTags: [],
        removeTags: [],
      });
    } catch (e: any) {
      thrown = true;
      thrownName = e?.name;
    }

    expect(thrown).toEqual(true);
  });

  it('JSON with new entities works', async () => {
    testEntity.reference = await TestModel.factory();

    // Test that an old JSON payload causes a conflict.
    const json = JSON.stringify(testEntity);
    const data = JSON.parse(json);

    console.log(data.data.reference);

    testEntity.$jsonAcceptData(data);

    expect(testEntity.reference.guid).toBeNull();
  });
});
