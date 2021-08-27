import { Entity } from '@nymphjs/nymph';

/**
 * AbleObject abstract class.
 *
 * Used in entities which support abilities, such as users and groups.
 */
export default abstract class AbleObject<
  T extends { abilities?: string[] }
> extends Entity<T> {
  /**
   * Grant an ability.
   *
   * @param ability The ability.
   */
  public grant(ability: string) {
    if (!Array.isArray(this.$data.abilities)) {
      this.$data.abilities = [];
    }
    if (this.$data.abilities.indexOf(ability) === -1) {
      this.$data.abilities.push(ability);
    }
  }

  /**
   * Revoke an ability.
   *
   * @param ability The ability.
   */
  public revoke(ability: string) {
    if (!Array.isArray(this.$data.abilities)) {
      this.$data.abilities = [];
    }
    let idx: number;
    do {
      idx = this.$data.abilities.indexOf(ability);
      if (idx !== -1) {
        this.$data.abilities.splice(idx, 1);
      }
    } while (idx !== -1);
  }
}
