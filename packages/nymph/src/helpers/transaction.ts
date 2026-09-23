import Nymph from '../Nymph.js';

/**
 * Run a function inside of a transaction.
 *
 * @param nymph The instance of Nymph to start the transaction on.
 * @param name The name of the transaction.
 * @param fn The function that runs inside the transaction. It is passed the
 *           transactional instance of Nymph. If it resolves, the transaction is
 *           committed, and if it throws, the transaction is rolled back.
 * @param finallyFn An optional function to run after the transaction is
 *                  committed or rolled back. It is passed the original instance
 *                  of Nymph. It SHOULD NOT throw.
 * @returns The return value of the function.
 */
export async function transaction<T>(
  nymph: Nymph,
  name: string,
  fn: (nymph: Nymph) => Promise<T>,
  finallyFn?: (nymph: Nymph, committed?: boolean) => Promise<void>,
): Promise<T> {
  nymph.config.debugInfo('nymph:transaction', `Starting transaction ${name}`);
  const tnymph = await nymph.startTransaction(name);
  try {
    const result = await fn(tnymph);

    nymph.config.debugInfo(
      'nymph:transaction',
      `Committing transaction ${name}`,
    );
    if (!(await tnymph.commit(name))) {
      throw new Error('Transaction could not be committed.');
    }

    if (finallyFn) {
      await finallyFn(nymph, true);
    }

    return result;
  } catch (e: any) {
    try {
      nymph.config.debugInfo(
        'nymph:transaction',
        `Rolling back transaction ${name}, reason: ${e.message}`,
      );
      await tnymph.rollback(name);
    } catch (e: any) {
      nymph.config.debugError(
        'nymph:transaction',
        `Rollback of transaction ${name} failed, reason: ${e.message}`,
      );
    }
    if (finallyFn) {
      try {
        await finallyFn(nymph, false);
      } catch (e: any) {
        nymph.config.debugError(
          'nymph:transaction',
          `Finally function of transaction ${name} threw error: ${e.message}, this is a mistake and should be fixed, finally functions should never throw`,
        );
      }
    }
    throw e;
  }
}
