import { Entity, EntityConstructor, Nymph } from '@nymphjs/nymph';

import Tilmeld from './Tilmeld';

export function enforceTilmeld(object: Nymph | Entity | EntityConstructor) {
  let tilmeld: Tilmeld | undefined;
  if (object instanceof Entity) {
    tilmeld = object.$nymph.tilmeld as Tilmeld | undefined;
  } else if (object instanceof Nymph) {
    tilmeld = object.tilmeld as Tilmeld | undefined;
  } else {
    tilmeld = object.nymph.tilmeld as Tilmeld | undefined;
  }

  if (tilmeld == null) {
    throw new Error('Tilmeld was not configured on this Nymph instance!');
  }

  return tilmeld;
}
