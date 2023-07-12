import Group, { GroupData } from './Group';
import User, { UserData } from './User';

export type AccessControlData = {
  user?: User & UserData;
  group?: Group & GroupData;
  acUser?: number;
  acGroup?: number;
  acOther?: number;
  acFull?: ((User & UserData) | (Group & GroupData))[];
  acWrite?: ((User & UserData) | (Group & GroupData))[];
  acRead?: ((User & UserData) | (Group & GroupData))[];
};
