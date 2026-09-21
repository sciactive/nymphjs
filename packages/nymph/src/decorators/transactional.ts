import { nanoid } from '@nymphjs/guid';

import Entity from '../Entity.js';

export function transactional(
  target: (...args: any[]) => Promise<any>,
  context: ClassMethodDecoratorContext,
) {
  const name = String(context.name);
  return async function (this: Entity, ...args: unknown[]) {
    const transactionName = `${name}-${nanoid()}`;
    const nymph = this.$nymph;
    const tnymph = await nymph.startTransaction(transactionName);
    this.$setNymph(tnymph);
    try {
      const result = await target.apply(this, args);
      const committed = await tnymph.commit(transactionName);

      if (!committed) {
        throw new Error('Transaction could not be committed.');
      }

      this.$setNymph(nymph);
      return result;
    } catch (e: any) {
      try {
        await tnymph.rollback(transactionName);
      } catch (e: any) {
        // Ignore.
      }
      this.$setNymph(nymph);
      throw e;
    }
  };
}
