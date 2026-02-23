import Group, { GroupData } from './Group.js';
import User, { UserData } from './User.js';

export type AccessControlData = {
  user?: User & UserData;
  group?: Group & GroupData;
  acUser?: number;
  acGroup?: number;
  acOther?: number;
  acFull?: string[];
  acWrite?: string[];
  acRead?: string[];
};
