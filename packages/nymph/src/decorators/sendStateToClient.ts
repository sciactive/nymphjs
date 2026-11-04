import Entity from '../Entity.js';

/**
 * A decorator that sends state to the client after a client enabled method.
 *
 * What this means is that the data from the entity on the server side will be
 * sent to the client after this method runs.
 */
export function sendStateToClient<
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
      (this as any)[methodName].sendStateToClient = true;
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
      (entity[propName] as any).sendStateToClient = true;
    } else {
      descriptor.value.sendStateToClient = true;
    }
  }

  return target;
}
