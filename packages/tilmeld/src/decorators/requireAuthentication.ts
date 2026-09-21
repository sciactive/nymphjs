import { Entity, HttpError } from '@nymphjs/nymph';

/**
 * A decorator that checks for authentication before running the method.
 *
 * If the user is not logged in, the decorator will cause the method to throw a
 * 403 Forbidden HttpError.
 */
export function requireAuthentication(
  target: (...args: any[]) => any,
  _context: ClassMethodDecoratorContext,
) {
  return function (this: Entity, ...args: unknown[]) {
    if (this.$nymph.tilmeld == null || !this.$nymph.tilmeld.gatekeeper()) {
      throw new HttpError('Forbidden', 403);
    }
    return target.apply(this, args);
  };
}
