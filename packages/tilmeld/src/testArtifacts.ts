import { Entity } from '@nymphjs/nymph';

import type { AccessControlData } from './Tilmeld.types';

export type TestModelData = {
  name?: string;
} & AccessControlData;

/**
 * This class is a test class that extends the Entity class.
 */
export class TestModel extends Entity<TestModelData> {
  static ETYPE = 'test_model';
  static class = 'TestModel';
}
