import { jest } from '@jest/globals';

import { MockNymph } from '../testMocks.js';
import {
  TestBModel as TestBModelClass,
  TestModel as TestModelClass,
  TestModelData,
} from '../testArtifacts.js';

const nymph = new MockNymph();

jest.mock('./Nymph', () => ({
  __esModule: true,
  default: nymph,
}));

const TestModel = nymph.addEntityClass(TestModelClass);
const TestBModel = nymph.addEntityClass(TestBModelClass);

let testEntity = TestModel.factorySync();

describe('Helper - transactions', () => {
  it('test here', async () => {});
});
