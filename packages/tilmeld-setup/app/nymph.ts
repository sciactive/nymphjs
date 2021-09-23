import { Entity, Nymph, NymphOptions } from '@nymphjs/client';
import { User, Group } from '@nymphjs/tilmeld-client';

const nymph = new Nymph(
  (window as unknown as { nymphOptions: NymphOptions }).nymphOptions
);
nymph.addEntityClass(User);
nymph.addEntityClass(Group);

export default nymph;

// Helps with admin and debugging.
(window as any).Entity = Entity;
(window as any).User = User;
(window as any).Group = Group;
(window as any).nymph = nymph;
