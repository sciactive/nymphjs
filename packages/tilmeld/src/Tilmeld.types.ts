import type { EntityPromise } from '@nymphjs/nymph';
import Group, { GroupData } from './Group';
import User, { UserData } from './User';

export type AccessControlData = {
  user?: EntityPromise<User & UserData>;
  group?: EntityPromise<Group & GroupData>;
  acUser?: number;
  acGroup?: number;
  acOther?: number;
  acFull?: EntityPromise<((User & UserData) | (Group & GroupData))[]>;
  acWrite?: EntityPromise<((User & UserData) | (Group & GroupData))[]>;
  acRead?: EntityPromise<((User & UserData) | (Group & GroupData))[]>;
};
