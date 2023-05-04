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
  // For Import/Export Tests.
  index?: string;
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

  static async factory(guid?: string): Promise<TestModel & TestModelData> {
    return (await super.factory(guid)) as TestModel & TestModelData;
  }

  static factorySync(guid?: string): TestModel & TestModelData {
    return super.factorySync(guid) as TestModel & TestModelData;
  }

  constructor(guid?: string) {
    super(guid);

    if (this.guid == null) {
      this.$addTag('test');
      this.$data.boolean = true;
    }
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

  static async factory(guid?: string): Promise<TestBModel & TestModelData> {
    return (await super.factory(guid)) as TestBModel & TestModelData;
  }

  static factorySync(guid?: string): TestBModel & TestModelData {
    return super.factorySync(guid) as TestBModel & TestModelData;
  }
}

export type TestEmptyModelData = {};

/**
 * This class is a test class that extends the Entity class.
 */
export class TestEmptyModel extends Entity<TestEmptyModelData> {
  static ETYPE = 'test_empty_model';
  static class = 'TestEmptyModel';

  static async factory(
    guid?: string
  ): Promise<TestEmptyModel & TestEmptyModelData> {
    return (await super.factory(guid)) as TestEmptyModel & TestEmptyModelData;
  }

  static factorySync(guid?: string): TestEmptyModel & TestEmptyModelData {
    return super.factorySync(guid) as TestEmptyModel & TestEmptyModelData;
  }
}
