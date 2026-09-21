import { Entity, HttpError } from '@nymphjs/nymph';

/**
 * A decorator that checks for an ability before running the method.
 *
 * If the logged in user does not have the given ability, the decorator will
 * cause the method to throw a 403 Forbidden HttpError.
 *
 * @param ability The ability to check for.
 */
export function requireAbility(ability: string) {
  return function (
    target: (...args: any[]) => any,
    _context: ClassMethodDecoratorContext,
  ) {
    return function (this: Entity, ...args: unknown[]) {
      if (
        this.$nymph.tilmeld == null ||
        !this.$nymph.tilmeld.gatekeeper(ability)
      ) {
        throw new HttpError('Forbidden', 403);
      }
      return target.apply(this, args);
    };
  };
}
