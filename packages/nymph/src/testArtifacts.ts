import Entity from './Entity';
import Nymph from './Nymph';

export type TestModelData = {
  name?: string;
  null?: null;
  string?: string;
  test?: string;
  array?: any[];
  match?: string;
  number?: number;
  boolean?: boolean;
  reference?: TestModel;
  refArray?: TestModel[];
  refObject?: {
    [k: string]: TestModel;
  };
  parent?: TestModel;
};

/**
 * This class is a test class that extends the Entity class.
 */
export class TestModel extends Entity<TestModelData> {
  static ETYPE = 'test_model';
  static class = 'TestModel';

  protected $privateData = ['boolean'];
  public static $searchRestrictedData = ['fish'];
  protected $allowlistData? = ['string', 'array', 'mdate'];
  protected $protectedTags = ['test', 'notag'];
  protected $allowlistTags? = ['newtag'];

  static factory(guid?: string): TestModel & TestModelData {
    return new TestModel(guid);
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
Nymph.setEntityClass(TestModel.class, TestModel);

/**
 * This class is a test class that extends the Entity class.
 */
export class TestBModel extends TestModel {
  static ETYPE = 'test_b_model';
}
