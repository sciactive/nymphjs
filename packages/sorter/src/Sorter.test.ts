import Sorter from './Sorter';
import { TestModel } from './testArtifacts';

describe('Sorter', () => {
  it('sorts entities by a string property', () => {
    const entities: TestModel[] = [];
    for (const prop of ['d', 'a', 'C', 'e', 'b']) {
      const entity = new TestModel();
      entity.name = prop;
      entities.push(entity);
    }

    const sorter = new Sorter(entities);

    sorter.sort('name');
    expect(sorter.array.map((entity) => entity.name)).toEqual([
      'a',
      'b',
      'C',
      'd',
      'e',
    ]);

    sorter.sort('name', { reverse: true });
    expect(sorter.array.map((entity) => entity.name)).toEqual([
      'e',
      'd',
      'C',
      'b',
      'a',
    ]);
  });

  it('sorts entities by a number property', () => {
    const entities: TestModel[] = [];
    for (const prop of [4, 300, 5, 1, 2]) {
      const entity = new TestModel();
      entity.number = prop;
      entities.push(entity);
    }

    const sorter = new Sorter(entities);

    sorter.sort('number');
    expect(sorter.array.map((entity) => entity.number)).toEqual([
      1, 2, 4, 5, 300,
    ]);

    sorter.sort('number', { reverse: true });
    expect(sorter.array.map((entity) => entity.number)).toEqual([
      300, 5, 4, 2, 1,
    ]);
  });

  it('sorts entities case sensitively', () => {
    const entities: TestModel[] = [];
    for (const prop of ['America', 'america', 'baseball', 'Bernard', 'zebra']) {
      const entity = new TestModel();
      entity.name = prop;
      entities.push(entity);
    }

    const sorter = new Sorter(entities);

    sorter.sort('name');
    expect(sorter.array.map((entity) => entity.name)).toEqual([
      'America',
      'america',
      'baseball',
      'Bernard',
      'zebra',
    ]);

    sorter.sort('name', { caseSensitive: true });
    expect(sorter.array.map((entity) => entity.name)).toEqual([
      'america',
      'America',
      'baseball',
      'Bernard',
      'zebra',
    ]);

    sorter.sort('name', {
      collatorOptions: {
        sensitivity: 'case',
        caseFirst: 'upper',
      },
    });
    expect(sorter.array.map((entity) => entity.name)).toEqual([
      'America',
      'america',
      'baseball',
      'Bernard',
      'zebra',
    ]);

    sorter.sort('name', {
      comparator: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
    });
    expect(sorter.array.map((entity) => entity.name)).toEqual([
      'America',
      'Bernard',
      'america',
      'baseball',
      'zebra',
    ]);
  });

  it('sorts entities numerically', () => {
    const entities: TestModel[] = [];
    for (const prop of [
      '1: first',
      '10: tenth',
      '40: fourtieth',
      '3: third',
      '2: second',
    ]) {
      const entity = new TestModel();
      entity.name = prop;
      entities.push(entity);
    }

    const sorter = new Sorter(entities);

    sorter.sort('name');
    expect(sorter.array.map((entity) => entity.name)).toEqual([
      '1: first',
      '10: tenth',
      '2: second',
      '3: third',
      '40: fourtieth',
    ]);

    sorter.sort('name', {
      collatorOptions: {
        numeric: true,
      },
    });
    expect(sorter.array.map((entity) => entity.name)).toEqual([
      '1: first',
      '2: second',
      '3: third',
      '10: tenth',
      '40: fourtieth',
    ]);
  });

  it('sorts entities by parent', () => {
    const firstParent = new TestModel();
    firstParent.name = 'Aaron';
    const secondParent = new TestModel();
    secondParent.name = 'Kevin';
    const entities: TestModel[] = [
      (() => {
        const entity = new TestModel();
        entity.name = 'Sarah';
        entity.parent = firstParent;
        return entity;
      })(),
      (() => {
        const entity = new TestModel();
        entity.name = 'Jimmy';
        entity.parent = firstParent;
        return entity;
      })(),
      (() => {
        const entity = new TestModel();
        entity.name = 'Mary';
        entity.parent = firstParent;
        return entity;
      })(),
      (() => {
        const entity = new TestModel();
        entity.name = 'Jessica';
        entity.parent = secondParent;
        return entity;
      })(),
      firstParent,
      secondParent,
    ];

    const sorter = new Sorter(entities);

    sorter.psort('name', 'parent');
    expect(sorter.array.map((entity) => entity.name)).toEqual([
      'Aaron',
      'Jimmy',
      'Kevin',
      'Mary',
      'Sarah',
      'Jessica',
    ]);
  });

  it('sorts entities hierarchically', () => {
    const firstParent = new TestModel();
    firstParent.name = 'Herbert';
    const secondParent = new TestModel();
    secondParent.name = 'Anthony';
    const subParent = new TestModel();
    subParent.name = 'Lamar';
    subParent.parent = secondParent;
    const entities: TestModel[] = [
      (() => {
        const entity = new TestModel();
        entity.name = 'Jacob';
        entity.parent = firstParent;
        return entity;
      })(),
      (() => {
        const entity = new TestModel();
        entity.name = 'Joshua';
        entity.parent = firstParent;
        return entity;
      })(),
      subParent,
      (() => {
        const entity = new TestModel();
        entity.name = 'Peter';
        entity.parent = secondParent;
        return entity;
      })(),
      (() => {
        const entity = new TestModel();
        entity.name = 'Warren';
        entity.parent = subParent;
        return entity;
      })(),
      (() => {
        const entity = new TestModel();
        entity.name = 'Arthur';
        entity.parent = subParent;
        return entity;
      })(),
      firstParent,
      secondParent,
    ];

    const sorter = new Sorter(entities);

    sorter.hsort('name', 'parent');
    expect(
      sorter.array.map((entity) => {
        let output = '';
        let parent = entity.parent;
        while (parent) {
          output += '- ';
          parent = parent.parent;
        }
        return output + entity.name;
      }),
    ).toEqual([
      'Anthony',
      '- Lamar',
      '- - Arthur',
      '- - Warren',
      '- Peter',
      'Herbert',
      '- Jacob',
      '- Joshua',
    ]);
  });

  it('sorts array in place', () => {
    const entities: TestModel[] = [];
    for (const prop of ['d', 'a', 'c', 'e', 'b']) {
      const entity = new TestModel();
      entity.name = prop;
      entities.push(entity);
    }

    const sorter = new Sorter(entities);

    const sorted = sorter.sort('name');
    expect(entities.map((entity) => entity.name)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
    expect(sorter.array.map((entity) => entity.name)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
    expect(sorted.map((entity) => entity.name)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });
});
