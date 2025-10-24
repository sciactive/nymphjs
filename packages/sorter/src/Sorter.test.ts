import Sorter from './Sorter.js';
import { TestModel } from './testArtifacts.js';

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

  it('sorts entities by a number property with an identical resolver', () => {
    const entities: TestModel[] = [];
    for (const prop of [4, 300, 5, 1, 2]) {
      const entity = new TestModel();
      entity.number = 50;
      entity.fallback = prop;
      entities.push(entity);
    }

    const sorter = new Sorter(entities);

    sorter.sort('number', {
      identiticalResolver: (a, b) => (a.fallback || 0) - (b.fallback || 0),
    });
    expect(sorter.array.map((entity) => entity.fallback)).toEqual([
      1, 2, 4, 5, 300,
    ]);

    sorter.sort('number', {
      reverse: true,
      identiticalResolver: (a, b) => (a.fallback || 0) - (b.fallback || 0),
    });
    expect(sorter.array.map((entity) => entity.fallback)).toEqual([
      300, 5, 4, 2, 1,
    ]);
  });

  it('sorts entities by a string property with an identical resolver', () => {
    const entities: TestModel[] = [];
    for (const prop of [4, 300, 5, 1, 2]) {
      const entity = new TestModel();
      entity.name = 'John';
      entity.fallback = prop;
      entities.push(entity);
    }

    const sorter = new Sorter(entities);

    sorter.sort('name', {
      identiticalResolver: (a, b) => (a.fallback || 0) - (b.fallback || 0),
    });
    expect(sorter.array.map((entity) => entity.fallback)).toEqual([
      1, 2, 4, 5, 300,
    ]);

    sorter.sort('name', {
      reverse: true,
      identiticalResolver: (a, b) => (a.fallback || 0) - (b.fallback || 0),
    });
    expect(sorter.array.map((entity) => entity.fallback)).toEqual([
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

  it('sorts entities by parent with an identical resolver', () => {
    const firstParent = new TestModel();
    firstParent.name = 'Aaron';
    firstParent.fallback = 1;
    const secondParent = new TestModel();
    secondParent.name = 'Kevin';
    secondParent.fallback = 2;
    const entities: TestModel[] = [
      (() => {
        const entity = new TestModel();
        entity.name = 'Steve';
        entity.fallback = 3;
        entity.parent = firstParent;
        return entity;
      })(),
      (() => {
        const entity = new TestModel();
        entity.name = 'Steve';
        entity.fallback = 5;
        entity.parent = firstParent;
        return entity;
      })(),
      (() => {
        const entity = new TestModel();
        entity.name = 'Steve';
        entity.fallback = 4;
        entity.parent = firstParent;
        return entity;
      })(),
      (() => {
        const entity = new TestModel();
        entity.name = 'Steve';
        entity.fallback = 6;
        entity.parent = secondParent;
        return entity;
      })(),
      firstParent,
      secondParent,
    ];

    const sorter = new Sorter(entities);

    sorter.psort('name', 'parent', {
      identiticalResolver: (a, b) => (a.fallback || 0) - (b.fallback || 0),
    });
    expect(sorter.array.map((entity) => entity.fallback)).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it('sorts entities hierarchically', () => {
    const getEntries = () => {
      const firstParent = new TestModel();
      firstParent.name = 'Herbert';
      const secondParent = new TestModel();
      secondParent.name = 'Anthony';
      const subParent = new TestModel();
      subParent.name = 'Lamar';
      subParent.parent = secondParent;
      return [
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
    };
    const entities: TestModel[] = [];
    for (let i = 0; i < 100; i++) {
      entities.push(...getEntries());
    }

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
      ...[...Array(100)]
        .map(() => [
          'Anthony',
          '- Lamar',
          '- - Arthur',
          '- - Warren',
          '- Peter',
        ])
        .flat(),
      ...[...Array(100)].map(() => ['Herbert', '- Jacob', '- Joshua']).flat(),
    ]);
  });

  it('sorts entities hierarchically with an identical resolver', () => {
    const firstParent = new TestModel();
    firstParent.name = 'Herbert';
    firstParent.fallback = 1;
    const secondParent = new TestModel();
    secondParent.name = 'Anthony';
    secondParent.fallback = 2;
    const subParent = new TestModel();
    subParent.name = 'Lamar';
    subParent.fallback = 3;
    subParent.parent = secondParent;
    const entities = [
      (() => {
        const entity = new TestModel();
        entity.name = 'Peter';
        entity.fallback = 5;
        entity.parent = firstParent;
        return entity;
      })(),
      (() => {
        const entity = new TestModel();
        entity.name = 'Peter';
        entity.fallback = 4;
        entity.parent = firstParent;
        return entity;
      })(),
      subParent,
      (() => {
        const entity = new TestModel();
        entity.name = 'Peter';
        entity.fallback = 7;
        entity.parent = secondParent;
        return entity;
      })(),
      (() => {
        const entity = new TestModel();
        entity.name = 'Peter';
        entity.fallback = 8;
        entity.parent = subParent;
        return entity;
      })(),
      (() => {
        const entity = new TestModel();
        entity.name = 'Peter';
        entity.fallback = 6;
        entity.parent = subParent;
        return entity;
      })(),
      firstParent,
      secondParent,
    ];

    const sorter = new Sorter(entities);

    sorter.hsort('name', 'parent', {
      identiticalResolver: (a, b) => (a.fallback || 0) - (b.fallback || 0),
    });
    expect(
      sorter.array.map((entity) => {
        let output = '';
        let parent = entity.parent;
        while (parent) {
          output += '- ';
          parent = parent.parent;
        }
        return output + entity.fallback;
      }),
    ).toEqual(['2', '- 3', '- - 6', '- - 8', '- 7', '1', '- 4', '- 5']);
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
