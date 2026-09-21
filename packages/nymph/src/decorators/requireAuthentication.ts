import Entity from '../Entity.js';
import { HttpError } from '../errors/HttpError.js';

export function requireAuthentication(
  target: (...args: any[]) => any,
  _context: ClassMethodDecoratorContext,
) {
  return function (this: Entity, ...args: unknown[]) {
    if (this.$nymph.tilmeld == null || !this.$nymph.tilmeld.gatekeeper()) {
      throw new HttpError('Authentication requried.', 401);
    }
    return target.apply(this, args);
  };
}
