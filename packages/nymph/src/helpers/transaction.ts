import Nymph from '../Nymph.js';

export async function transaction<T>(
  nymph: Nymph,
  name: string,
  fn: (nymph: Nymph) => Promise<T>,
): Promise<T> {
  const tnymph = await nymph.startTransaction(name);
  try {
    const result = await fn(tnymph);

    if (!(await tnymph.commit(name))) {
      throw new Error('Transaction could not be committed.');
    }

    return result;
  } catch (e: any) {
    try {
      await tnymph.rollback(name);
    } catch (e: any) {
      // Ignore.
    }
    throw e;
  }
}
