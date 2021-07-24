import { customAlphabet } from 'nanoid';
import { DateTime } from 'luxon';
import sha1 from 'sha1';

const nanoid = customAlphabet('0123456789abcdef', 20);

export default function newGUID() {
  return `${sha1(
    `${DateTime.now().weekYear}${DateTime.now().weekNumber}`
  ).slice(0, 4)}${nanoid()}`;
}
