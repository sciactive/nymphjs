import { Nymph, NymphOptions } from '@nymphjs/client';
import { User, Group } from '@nymphjs/tilmeld-client';

const nymph = new Nymph(
  (window as unknown as { nymphOptions: NymphOptions }).nymphOptions
);
nymph.setEntityClass(User.class, User);
nymph.setEntityClass(Group.class, Group);

export default nymph;

// Helps with admin and debugging.
(window as any).nymph = nymph;
