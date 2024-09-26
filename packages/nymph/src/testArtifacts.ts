import Entity from './Entity';

export type TestModelData = {
  name?: string;
  null?: null;
  string?: string;
  test?: string;
  array?: any[];
  match?: string;
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

  private static partition: string | undefined = undefined;

  static getPartition() {
    return this.partition;
  }

  static setPartition(partition: string | undefined) {
    this.partition = partition;
  }

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
