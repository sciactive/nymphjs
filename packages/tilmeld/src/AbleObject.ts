import { Entity } from '@nymphjs/nymph';

export interface AbleObjectData {
  abilities?: string[];
}

export interface AbleObject<T extends {}> extends AbleObjectData {}

/**
 * AbleObject abstract class.
 *
 * Used in entities which support abilities, such as users and groups.
 */
export abstract class AbleObject<T extends {}> extends Entity<
  T & AbleObjectData
> {
  /**
   * Grant an ability.
   *
   * @param ability The ability.
   */
  public $grant(ability: string) {
    if (!Array.isArray(this.abilities)) {
      this.abilities = [];
    }
    if (!this.abilities.includes(ability)) {
      this.abilities.push(ability);
    }
  }

  /**
   * Revoke an ability.
   *
   * @param ability The ability.
   */
  public $revoke(ability: string) {
    if (!Array.isArray(this.abilities)) {
      this.abilities = [];
    }
    let idx: number;
    do {
      idx = this.abilities.indexOf(ability);
      if (idx !== -1) {
        this.abilities.splice(idx, 1);
      }
    } while (idx !== -1);
  }
}
