import { EntityJson } from './Entity.types';
import { PubSubSubscription } from './PubSub';

export type PubSubResolveCallback<T> = (arg: T, event?: string) => void;
export type PubSubRejectCallback = (err: any) => void;
export type PubSubCountCallback = (count: number) => void;
export type PubSubCallbacks<T> = [
  PubSubResolveCallback<T> | undefined,
  PubSubRejectCallback | undefined,
  PubSubCountCallback | undefined
];
export type PubSubEventType = 'connect' | 'disconnect';
export type PubSubConnectCallback = () => void;
export type PubSubDisconnectCallback = () => void;
export type PubSubUpdate<T> =
  | T
  | {
      query: string;
      removed: string;
    }
  | {
      query: string;
      added: string;
      data: EntityJson;
    }
  | {
      query: string;
      updated: string;
      data: EntityJson;
    };
export type PubSubSubscribable<T> = (
  resolve?: PubSubResolveCallback<T> | undefined,
  reject?: PubSubRejectCallback | undefined,
  count?: PubSubCountCallback | undefined
) => PubSubSubscription<T>;
