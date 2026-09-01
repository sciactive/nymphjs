import { EntityJson } from './Entity.types.js';
import { PubSubSubscription } from './PubSub.js';

export type PubSubResolveCallback<T> = (arg: T, event?: string) => void;
export type PubSubRejectCallback = (err: any) => void;
export type PubSubCountCallback = (count: number) => void;
export type PubSubCallbacks<T> = [
  PubSubResolveCallback<T> | undefined,
  PubSubRejectCallback | undefined,
  PubSubCountCallback | undefined,
];
export type PubSubEventType = 'connect' | 'disconnect' | 'error';
export type PubSubConnectCallback = () => void;
export type PubSubDisconnectCallback = () => void;
/**
 * The error event is for unknown errors. Query errors fire their own reject
 * callbacks.
 */
export type PubSubErrorCallback = (err: any) => void;
export type PubSubUpdateRemoved = {
  query: string;
  removed: string;
};
export type PubSubUpdateAdded = {
  query: string;
  added: string;
  data: EntityJson;
};
export type PubSubUpdateUpdated = {
  query: string;
  updated: string;
  data: EntityJson;
};
export type PubSubUpdateMultiple = {
  query: string;
  multiple: true;
  messages: (PubSubUpdateRemoved | PubSubUpdateAdded | PubSubUpdateUpdated)[];
};
export type PubSubUpdate<T> =
  | T
  | PubSubUpdateRemoved
  | PubSubUpdateAdded
  | PubSubUpdateUpdated
  | PubSubUpdateMultiple;
export type PubSubSubscribable<T> = (
  resolve?: PubSubResolveCallback<T> | undefined,
  reject?: PubSubRejectCallback | undefined,
  count?: PubSubCountCallback | undefined,
) => PubSubSubscription<T>;
