import Entity from '../Entity.js';

/**
 * A decorator that accepts state from client before a client enabled method.
 *
 * What this means is that the entity will be filled with data from the client
 * before the method is run. This means that the data in the entity should _not_
 * be trusted inside this method, just like you wouldn't trust the data during
 * a $save call coming from the client.
 */
export function acceptStateFromClient<
  This extends Entity,
  Args extends any[],
  Return,
>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<
    This,
    (this: This, ...args: Args) => Return
  >,
  descriptor?: PropertyDescriptor,
) {
  if (descriptor == null || typeof context !== 'string') {
    if (context.kind !== 'method') {
      throw new Error('This is a method decorator only.');
    }

    // Using Stage 3 style decorators.
    const methodName = context.name;
    context.addInitializer(function () {
      (this as any)[methodName].acceptStateFromClient = true;
    });
  } else {
    // Using Stage 2 style decorators.
    const entity = target as unknown as Entity;
    const propName = context as unknown as keyof Entity;

    if (
      descriptor instanceof Entity &&
      propName in entity &&
      typeof entity[propName] === 'function'
    ) {
      (entity[propName] as any).acceptStateFromClient = true;
    } else {
      descriptor.value.acceptStateFromClient = true;
    }
  }

  return target;
}
