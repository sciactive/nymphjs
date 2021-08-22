import { EntityJson, Options } from '@nymphjs/nymph';

export type AuthenticateMessageData = {
  action: 'authenticate';
  token: string;
};

export type QuerySubscribeMessageData = {
  action: 'subscribe' | 'unsubscribe';
  query: never;
  count?: boolean;
};

export type UidSubscribeMessageData = {
  action: 'subscribe' | 'unsubscribe';
  uid: string;
  count?: boolean;
};

export type SubscribeMessageData =
  | QuerySubscribeMessageData
  | UidSubscribeMessageData;

export type PublishEntityMessageData = {
  action: 'publish';
  guid: string;
  event: 'create' | 'update' | 'delete';
  etype: string;
  entity?: EntityJson;
};

export type PublishUidMessageData = {
  action: 'publish';
  event: 'newUID' | 'setUID' | 'renameUID' | 'deleteUID';
  name?: string;
  oldName?: string;
  newName?: string;
  value?: number;
};

export type PublishMessageData =
  | PublishEntityMessageData
  | PublishUidMessageData;

export type MessageData =
  | AuthenticateMessageData
  | SubscribeMessageData
  | PublishMessageData;

export type MessageOptions = Options & {
  class: string;
};
