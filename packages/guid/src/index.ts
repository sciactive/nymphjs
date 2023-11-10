import { nanoid, customAlphabet } from 'nanoid';
import { DateTime } from 'luxon';
import sha1 from 'sha1';
import dictionary from 'nanoid-dictionary';

const { nolookalikesSafe } = dictionary;

const guidSuffix = customAlphabet('0123456789abcdef', 20);
export function guid() {
  return `${sha1(
    `${DateTime.now().weekYear}${DateTime.now().weekNumber}`,
  ).slice(0, 4)}${guidSuffix()}`;
}

export const makeTableSuffix = customAlphabet(
  '0123456789abcdefghijklmnopqrstuvwxyz',
  20,
);

export const humanSecret = customAlphabet(nolookalikesSafe, 10);

export { nanoid, customAlphabet };
