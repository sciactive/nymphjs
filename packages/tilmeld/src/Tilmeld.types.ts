import { Group } from './Group.js';
import { User } from './User.js';

export interface AccessControlData {
  user?: User;
  group?: Group;
  acUser?: number;
  acGroup?: number;
  acOther?: number;
  acFull?: string[];
  acWrite?: string[];
  acRead?: string[];
}
