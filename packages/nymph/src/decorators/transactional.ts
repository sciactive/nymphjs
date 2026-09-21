import { nanoid } from '@nymphjs/guid';

import Entity from '../Entity.js';

/**
 * A decorator that runs the decorated method inside a transaction.
 *
 * If the method resolves, the transaction is committed. If the method throws,
 * the transaction is rolled back.
 *
 * Uses $setNymph to set the transactional instance of Nymph on the entity and
 * return to the original instance after the transaction is committed or rolled
 * back.
 */
export function transactional(
  target: (...args: any[]) => Promise<any>,
  context: ClassMethodDecoratorContext,
) {
  const name = String(context.name);
  return async function (this: Entity, ...args: unknown[]) {
    const transactionName = `${name}-${nanoid()}`;
    const nymph = this.$nymph;
    nymph.config.debugInfo(
      'nymph:transactional',
      `Starting transaction ${transactionName}`,
    );
    const tnymph = await nymph.startTransaction(transactionName);
    this.$setNymph(tnymph);
    try {
      const result = await target.apply(this, args);
      nymph.config.debugInfo(
        'nymph:transactional',
        `Committing transaction ${transactionName}`,
      );
      const committed = await tnymph.commit(transactionName);

      if (!committed) {
        throw new Error('Transaction could not be committed.');
      }

      this.$setNymph(nymph);
      return result;
    } catch (e: any) {
      try {
        nymph.config.debugInfo(
          'nymph:transactional',
          `Rolling back transaction ${transactionName}, reason: ${e.message}`,
        );
        await tnymph.rollback(transactionName);
      } catch (e: any) {
        nymph.config.debugError(
          'nymph:transactional',
          `Roll back of transaction ${transactionName} failed, reason: ${e.message}`,
        );
      }
      this.$setNymph(nymph);
      throw e;
    }
  };
}
