import {
  nanoid as realNanoid,
  customAlphabet as realCustomAlphabet,
} from 'nanoid';

import {
  guid,
  makeTableSuffix,
  humanSecret,
  nanoid,
  customAlphabet,
} from './index';

describe('GUID', () => {
  it('exports nanoid and customAlphabet', () => {
    expect(nanoid).toBe(realNanoid);
    expect(customAlphabet).toBe(realCustomAlphabet);
  });

  it('generates GUIDs', () => {
    let guid1 = guid();
    let guid2 = guid();

    expect(guid1.length).toBe(24);
    expect(guid2.length).toBe(24);
    expect(guid1).not.toEqual(guid2);
    expect(guid1.substring(0, 4)).toEqual(guid2.substring(0, 4));
  });

  it('generates table suffixes', () => {
    let tableSuffix1 = makeTableSuffix();
    let tableSuffix2 = makeTableSuffix();

    expect(tableSuffix1.length).toBe(20);
    expect(tableSuffix2.length).toBe(20);
    expect(tableSuffix1).not.toEqual(tableSuffix2);
  });

  it('generates human readable secrets', () => {
    let secret1 = humanSecret();
    let secret2 = humanSecret();

    expect(secret1.length).toBe(10);
    expect(secret2.length).toBe(10);
    expect(secret1).not.toEqual(secret2);
  });
});
