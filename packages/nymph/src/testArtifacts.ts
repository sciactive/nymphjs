import Entity from './Entity.js';
import { transactional } from './decorators/index.js';
import { transaction } from './helpers/index.js';

export type TestModelData = {
  name?: string;
  null?: null;
  string?: string;
  test?: string;
  array?: any[];
  match?: string;
  search?: string;
  number?: number;
  numberString?: string;
  timestamp?: Number;
  boolean?: boolean;
  reference?: TestModel & TestModelData;
  refArray?: (TestModel & TestModelData)[];
  refObject?: {
    [k: string]: TestModel & TestModelData;
  };
  parent?: TestModel & TestModelData;
  // For import/export tests.
  index?: string;
  // For uniqueness tests.
  uniques?: string[];
};

/**
 * This class is a test class that extends the Entity class.
 */
export class TestModel extends Entity<TestModelData> {
  static ETYPE = 'test_model';
  static class = 'TestModel';

  protected $privateData = ['boolean'];
  public static searchRestrictedData = ['fish'];
  protected $allowlistData? = ['string', 'array', 'mdate'];
  protected $protectedTags = ['test', 'notag'];
  protected $allowlistTags? = ['newtag'];

  constructor() {
    super();

    this.$addTag('test');
    this.$data.boolean = true;
    this.$data.uniques = [];
  }

  public async $getUniques() {
    return this.$data.uniques ?? [];
  }

  public $useProtectedData() {
    const $allowlistData = this.$allowlistData;
    const $allowlistTags = this.$allowlistTags;
    const $protectedData = this.$protectedData;
    const $protectedTags = this.$protectedTags;

    delete this.$allowlistData;
    delete this.$allowlistTags;
    this.$protectedData = ['number'];
    this.$protectedTags = [];

    return () => {
      this.$allowlistData = $allowlistData;
      this.$allowlistTags = $allowlistTags;
      this.$protectedData = $protectedData;
      this.$protectedTags = $protectedTags;
    };
  }

  @transactional
  public async $testTransactionalDecorator(throwError: boolean) {
    this.$data.string = 'this has been changed';

    if (this.$data.reference) {
      await this.$data.reference.$wake();
      this.$data.reference.string = 'this has been changed too';
      await this.$data.reference.$save();
    }

    await this.$save();

    if (throwError) {
      throw Error('An error.');
    }

    return 'Success.';
  }

  public async $testTransactionHelper(throwError: boolean) {
    return await transaction(
      this.$nymph,
      'test-transaction',
      async (nymph) => {
        this.$setNymph(nymph);
        this.$data.string = 'this has been changed';

        if (this.$data.reference) {
          await this.$data.reference.$wake();
          this.$data.reference.string = 'this has been changed too';
          await this.$data.reference.$save();
        }

        await this.$save();

        if (throwError) {
          throw Error('An error.');
        }

        return 'Success.';
      },
      async (nymph) => {
        this.$setNymph(nymph);
      },
    );
  }
}

/**
 * This class is a test class that extends the Entity class.
 */
export class TestBModel extends TestModel {
  static ETYPE = 'test_b_model';
  static class = 'TestBModel';
}

export type TestEmptyModelData = {};

/**
 * This class is a test class that extends the Entity class.
 */
export class TestEmptyModel extends Entity<TestEmptyModelData> {
  static ETYPE = 'test_empty_model';
  static class = 'TestEmptyModel';
}
