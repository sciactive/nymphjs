let counter = 0;

export class TestModel {
  static class = 'TestModel';

  public guid: string;
  public name?: string;
  public number?: number;
  public fallback?: number;
  public parent?: TestModel;

  constructor() {
    this.guid = 'guid-' + counter++;
    return this;
  }

  $inArray(array: TestModel[]) {
    return this.$arraySearch(array) !== -1;
  }

  $arraySearch(array: TestModel[]) {
    for (let i = 0; i < array.length; i++) {
      if (array[i] && array[i].guid === this.guid) {
        return i;
      }
    }
    return -1;
  }
}
