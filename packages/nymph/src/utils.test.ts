import { TestModel } from './testArtifacts.js';
import { clearSearchRestrictedData } from './utils.js';
import { Options, Selector } from './Nymph.types.js';

describe('utils', () => {
  it('filters search restricted data in equal', async () => {
    let options: Options = { class: TestModel };
    let selectors: Selector[] = [{ type: '&', equal: ['fish', 'salmon'] }];

    ({ options, selectors } = clearSearchRestrictedData({
      options,
      selectors,
    }));

    expect(selectors.length).toEqual(0);
  });

  it('filters search restricted data in truthy', async () => {
    let options: Options = { class: TestModel };
    let selectors: Selector[] = [{ type: '&', truthy: 'fish' }];

    ({ options, selectors } = clearSearchRestrictedData({
      options,
      selectors,
    }));

    expect(selectors.length).toEqual(0);
  });

  it('filters search restricted data in !defined', async () => {
    let options: Options = { class: TestModel };
    let selectors: Selector[] = [{ type: '&', '!defined': 'fish' }];

    ({ options, selectors } = clearSearchRestrictedData({
      options,
      selectors,
    }));

    expect(selectors.length).toEqual(0);
  });

  it('filters search restricted data in deep selector', async () => {
    let options: Options = { class: TestModel };
    let selectors: Selector[] = [
      {
        type: '&',
        selector: { type: '&', '!selector': { type: '|', '!defined': 'fish' } },
      },
    ];

    ({ options, selectors } = clearSearchRestrictedData({
      options,
      selectors,
    }));

    expect(selectors.length).toEqual(0);
  });

  it('filters search restricted data in qref', async () => {
    let options: Options = { class: TestModel };
    let selectors: Selector[] = [
      {
        type: '&',
        qref: ['fish', [{ class: TestModel }, { type: '&', tag: 'happy' }]],
      },
    ];

    ({ options, selectors } = clearSearchRestrictedData({
      options,
      selectors,
    }));

    expect(selectors.length).toEqual(0);
  });

  it('filters search restricted data in nested qref', async () => {
    let options: Options = { class: TestModel };
    let selectors: Selector[] = [
      {
        type: '&',
        qref: [
          'something',
          [{ class: TestModel }, { type: '&', defined: 'fish' }],
        ],
      },
    ];

    ({ options, selectors } = clearSearchRestrictedData({
      options,
      selectors,
    }));

    expect(selectors.length).toEqual(0);
  });

  it('filters partial search restricted data in nested qref', async () => {
    let options: Options = { class: TestModel };
    let selectors: Selector[] = [
      {
        type: '&',
        qref: [
          'something',
          [{ class: TestModel }, { type: '&', defined: 'fish', tag: 'happy' }],
        ],
      },
    ];

    ({ options, selectors } = clearSearchRestrictedData({
      options,
      selectors,
    }));

    expect(selectors).toEqual([
      {
        type: '&',
        qref: [
          ['something', [{ class: TestModel }, { type: '&', tag: 'happy' }]],
        ],
      },
    ]);
  });
});
