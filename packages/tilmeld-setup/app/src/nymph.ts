import type { NymphOptions } from '@nymphjs/client';
import { Entity, Nymph } from '@nymphjs/client';
import {
  User as UserClass,
  Group as GroupClass,
} from '@nymphjs/tilmeld-client';

const nymph = new Nymph(
  (window as unknown as { nymphOptions: NymphOptions }).nymphOptions,
);
const User = nymph.addEntityClass(UserClass);
const Group = nymph.addEntityClass(GroupClass);
User.init(nymph);

// Helps with admin and debugging.
(window as any).Entity = Entity;
(window as any).User = User;
(window as any).Group = Group;
(window as any).nymph = nymph;

export { nymph, User, Group };
