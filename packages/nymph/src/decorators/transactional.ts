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
export function transactional<This extends Entity, Args extends any[], Return>(
  target: (this: This, ...args: Args) => Promise<Return>,
  context: ClassMethodDecoratorContext<
    This,
    (this: This, ...args: Args) => Promise<Return>
  >,
  descriptor?: PropertyDescriptor,
) {
  let name: string;
  let method: (this: This, ...args: Args) => Promise<Return>;
  if (descriptor == null || typeof context !== 'string') {
    if (context.kind !== 'method') {
      throw new Error('This is a method decorator only.');
    }

    // Using Stage 3 style decorators.
    name = String(context.name);
    method = target;
  } else {
    // Using Stage 2 style decorators.
    const entity = target as unknown as Entity;
    const propName = context as unknown as keyof Entity;

    name = propName;
    method = entity[propName] as (this: This, ...args: Args) => Promise<Return>;
  }

  return async function (this: This, ...args: Args): Promise<Return> {
    const transactionName = `${name}-${nanoid()}`;
    const nymph = this.$nymph;
    nymph.config.debugInfo(
      'nymph:transactional',
      `Starting transaction ${transactionName}`,
    );
    const tnymph = await nymph.startTransaction(transactionName);
    this.$setNymph(tnymph);
    let committed = false;
    let result: any;
    try {
      result = await method.apply(this, args);
      nymph.config.debugInfo(
        'nymph:transactional',
        `Committing transaction ${transactionName}`,
      );
      committed = await tnymph.commit(transactionName);
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
          `Rollback of transaction ${transactionName} failed, reason: ${e.message}`,
        );
      }
      this.$setNymph(nymph);
      throw e;
    }

    this.$setNymph(nymph);

    if (!committed) {
      throw new Error('Transaction could not be committed.');
    }

    return result;
  };
}
