import Nymph, { InvalidRequestError } from './Nymph';
import { NymphOptions, Options, Selector } from './Nymph.types';
import { EntityConstructor, EntityInterface } from './Entity.types';
import {
  PubSubCallbacks,
  PubSubConnectCallback,
  PubSubCountCallback,
  PubSubDisconnectCallback,
  PubSubEventType,
  PubSubRejectCallback,
  PubSubResolveCallback,
  PubSubSubscribable,
  PubSubUpdate,
} from './PubSub.types';

let authToken: string | null = null;

export default class PubSub {
  private static connection: WebSocket | undefined;
  private static waitForConnectionTimeout: NodeJS.Timeout | undefined;
  private static pubsubUrl: string | undefined;
  private static WebSocket: typeof WebSocket;
  private static subscriptions: {
    queries: {
      [k: string]: PubSubCallbacks<any>[];
    };
    uids: {
      [k: string]: PubSubCallbacks<number>[];
    };
  } = {
    queries: {},
    uids: {},
  };
  private static connectCallbacks: PubSubConnectCallback[] = [];
  private static disconnectCallbacks: PubSubDisconnectCallback[] = [];
  private static noConsole = false;

  public static init(NymphOptions: NymphOptions) {
    this.pubsubUrl = NymphOptions.pubsubUrl;
    this.WebSocket = NymphOptions.WebSocket ?? WebSocket;
    this.noConsole = !!NymphOptions.noConsole;

    if (!this.WebSocket) {
      throw new Error('Nymph-PubSub requires WebSocket!');
    }

    if (typeof addEventListener !== 'undefined') {
      addEventListener('online', () => this.connect());
    }
    if (typeof navigator === 'undefined' || navigator.onLine) {
      this.connect();
    }
  }

  public static isConfigured() {
    return this.pubsubUrl != null;
  }

  public static subscribeEntities<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): PubSubSubscribable<PubSubUpdate<string[]>>;
  public static subscribeEntities<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T>,
    ...selectors: Selector[]
  ): PubSubSubscribable<PubSubUpdate<ReturnType<T['factorySync']>[]>>;
  public static subscribeEntities<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T>,
    ...selectors: Selector[]
  ): PubSubSubscribable<
    PubSubUpdate<ReturnType<T['factorySync']>[]> | PubSubUpdate<string[]>
  > {
    const promise = Nymph.getEntities(options, ...selectors);
    const query = [{ ...options, class: options.class.class }, ...selectors];
    const jsonQuery = JSON.stringify(query);
    const subscribe = (
      resolve?:
        | PubSubResolveCallback<
            | PubSubUpdate<ReturnType<T['factorySync']>[]>
            | PubSubUpdate<string[]>
          >
        | undefined,
      reject?: PubSubRejectCallback | undefined,
      count?: PubSubCountCallback | undefined
    ) => {
      const callbacks: PubSubCallbacks<
        PubSubUpdate<ReturnType<T['factorySync']>[]> | PubSubUpdate<string[]>
      > = [resolve, reject, count];

      promise.then(resolve, reject);

      PubSub._subscribeQuery(jsonQuery, callbacks);
      return new PubSubSubscription(jsonQuery, callbacks, () => {
        PubSub._unsubscribeQuery(jsonQuery, callbacks);
      });
    };
    return subscribe;
  }

  public static subscribeEntity<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T> & { return: 'guid' },
    ...selectors: Selector[]
  ): PubSubSubscribable<PubSubUpdate<string | null>>;
  public static subscribeEntity<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T>,
    ...selectors: Selector[]
  ): PubSubSubscribable<PubSubUpdate<ReturnType<T['factorySync']> | null>>;
  public static subscribeEntity<
    T extends EntityConstructor = EntityConstructor
  >(
    options: Options<T>,
    ...selectors: Selector[]
  ): PubSubSubscribable<
    | PubSubUpdate<ReturnType<T['factorySync']> | null>
    | PubSubUpdate<string | null>
  > {
    const promise = Nymph.getEntity(options, ...selectors);
    const query = [
      { ...options, class: options.class.class, limit: 1 },
      ...selectors,
    ];
    const jsonQuery = JSON.stringify(query);
    const subscribe = (
      resolve?:
        | PubSubResolveCallback<
            | PubSubUpdate<ReturnType<T['factorySync']> | null>
            | PubSubUpdate<string | null>
          >
        | undefined,
      reject?: PubSubRejectCallback | undefined,
      count?: PubSubCountCallback | undefined
    ) => {
      const newResolve = (args: any) => {
        if (!args.length) {
          if (resolve) {
            resolve(null);
          }
        } else {
          if (resolve) {
            resolve(args[0]);
          }
        }
      };
      const callbacks: PubSubCallbacks<
        | PubSubUpdate<ReturnType<T['factorySync']> | null>
        | PubSubUpdate<string | null>
      > = [newResolve, reject, count];

      promise.then(resolve, reject);

      PubSub._subscribeQuery(jsonQuery, callbacks);
      return new PubSubSubscription(jsonQuery, callbacks, () => {
        PubSub._unsubscribeQuery(jsonQuery, callbacks);
      });
    };
    return subscribe;
  }

  public static subscribeUID(name: string) {
    const promise = Nymph.getUID(name);
    const subscribe = (
      resolve?: PubSubResolveCallback<number> | undefined,
      reject?: PubSubRejectCallback | undefined,
      count?: PubSubCountCallback | undefined
    ) => {
      const callbacks: PubSubCallbacks<number> = [resolve, reject, count];

      promise.then(resolve, reject);

      PubSub._subscribeUID(name, callbacks);
      return {
        unsubscribe: () => {
          PubSub._unsubscribeUID(name, callbacks);
        },
      };
    };
    return subscribe;
  }

  public static subscribeWith<T extends EntityInterface>(
    entity: T,
    resolve?: PubSubResolveCallback<T> | undefined,
    reject?: PubSubRejectCallback | undefined,
    count?: PubSubCountCallback | undefined
  ) {
    if (!entity.guid) {
      throw new InvalidRequestError(
        "You can't subscribe to an entity with no GUID."
      );
    }
    const query = [
      { class: (entity.constructor as EntityConstructor).class, limit: 1 },
      { type: '&', guid: entity.guid },
    ];
    const jsonQuery = JSON.stringify(query);

    const newResolve = (args: any) => {
      if (Array.isArray(args)) {
        if (args[0].length) {
          entity.$init(args[0]);
        } else {
          entity.guid = null;
        }
      } else if ('removed' in args) {
        entity.guid = null;
      } else {
        entity.$init(args.data);
      }

      if (resolve) {
        resolve(entity);
      }
    };
    const callbacks: PubSubCallbacks<T> = [newResolve, reject, count];

    PubSub._subscribeQuery(jsonQuery, callbacks);
    return new PubSubSubscription(jsonQuery, callbacks, () => {
      PubSub._unsubscribeQuery(jsonQuery, callbacks);
    });
  }

  public static connect() {
    // Are we already connected?
    if (
      this.connection &&
      (this.connection.readyState === this.WebSocket.OPEN ||
        this.connection.readyState === this.WebSocket.CONNECTING)
    ) {
      return;
    }

    this._waitForConnection();
    this._attemptConnect();
  }

  public static close() {
    if (this.waitForConnectionTimeout) {
      clearTimeout(this.waitForConnectionTimeout);
    }
    if (!this.connection) {
      return;
    }

    this.connection.close(4200, 'Closure requested by application.');
  }

  private static _waitForConnection(attempts = 0) {
    // Wait 5 seconds, then check and attempt connection again if
    // unsuccessful. Keep repeating until successful.
    this.waitForConnectionTimeout = setTimeout(() => {
      if (
        this.connection &&
        this.connection.readyState !== this.WebSocket.OPEN
      ) {
        if (
          this.connection.readyState !== this.WebSocket.CONNECTING ||
          attempts >= 5
        ) {
          this.connection.close();
          this._waitForConnection();
          this._attemptConnect();
        } else {
          this._waitForConnection(attempts + 1);
        }
      } else {
        this._attemptConnect();
      }
    }, 5000);
  }

  private static _attemptConnect() {
    // Attempt to connect.
    if (this.pubsubUrl != null) {
      this.connection = new this.WebSocket(this.pubsubUrl, 'nymph');
      this.connection.onopen = this._onopen.bind(this);
      this.connection.onmessage = this._onmessage.bind(this);
    }
  }

  private static _onopen() {
    if (typeof console !== 'undefined' && !this.noConsole) {
      console.log('Nymph-PubSub connection established!');
    }
    for (let i = 0; i < this.connectCallbacks.length; i++) {
      const callback = this.connectCallbacks[i];
      if (callback) {
        callback();
      }
    }

    if (authToken != null) {
      this._send({
        action: 'authenticate',
        token: authToken,
      });
    }

    for (let query in this.subscriptions.queries) {
      if (!this.subscriptions.queries.hasOwnProperty(query)) {
        continue;
      }
      let count = false;
      for (
        let callbacks = 0;
        callbacks < this.subscriptions.queries[query].length;
        callbacks++
      ) {
        if (this.subscriptions.queries[query][callbacks][2]) {
          count = true;
          break;
        }
      }
      this._sendQuery(query, count);
    }

    for (let name in this.subscriptions.uids) {
      if (!this.subscriptions.uids.hasOwnProperty(name)) {
        continue;
      }
      let count = false;
      for (
        let callbacks = 0;
        callbacks < this.subscriptions.uids[name].length;
        callbacks++
      ) {
        if (this.subscriptions.uids[name][callbacks][2]) {
          count = true;
          break;
        }
      }
      this._sendUID(name, count);
    }

    if (this.connection) {
      this.connection.onclose = this._onclose.bind(this);
    }
  }

  private static _onmessage(e: WebSocketEventMap['message']) {
    let data = JSON.parse(e.data);
    let subs: PubSubCallbacks<any>[] = [];
    let count = 'count' in data;
    if (
      data.hasOwnProperty('query') &&
      this.subscriptions.queries.hasOwnProperty(data.query)
    ) {
      subs = [...this.subscriptions.queries[data.query]];
      if (!count) {
        for (let i = 0; i < subs.length; i++) {
          const callback = subs[i][0];
          if (typeof callback === 'function') {
            callback(data);
          }
        }
      }
    } else if (
      data.hasOwnProperty('uid') &&
      this.subscriptions.uids.hasOwnProperty(data.uid)
    ) {
      subs = [...this.subscriptions.uids[data.uid]];
      if (!count) {
        for (let i = 0; i < subs.length; i++) {
          const callback = subs[i][0];
          if (typeof callback === 'function') {
            callback(data.value ?? null, data.event);
          }
        }
      }
    }
    if (count) {
      for (let i = 0; i < subs.length; i++) {
        const callback = subs[i][2];
        if (typeof callback === 'function') {
          callback(data.count);
        }
      }
    }
  }

  private static _onclose(e: WebSocketEventMap['close']) {
    if (typeof console !== 'undefined' && !this.noConsole) {
      console.log(`Nymph-PubSub connection closed: ${e.code} ${e.reason}`);
    }
    for (let i = 0; i < this.disconnectCallbacks.length; i++) {
      const callback = this.disconnectCallbacks[i];
      if (callback) {
        callback();
      }
    }
    if (
      e.code !== 4200 &&
      (typeof navigator === 'undefined' || navigator.onLine)
    ) {
      if (this.connection) {
        this.connection.close();
      }
      this._waitForConnection();
      this._attemptConnect();
    }
  }

  private static _send(data: any) {
    if (this.connection) {
      this.connection.send(JSON.stringify(data));
    }
  }

  public static isConnectionOpen() {
    return !!(
      this.connection && this.connection.readyState === this.WebSocket.OPEN
    );
  }

  private static _subscribeQuery(
    query: string,
    callbacks: PubSubCallbacks<any>
  ) {
    let isNewSubscription = false;
    if (!this.subscriptions.queries.hasOwnProperty(query)) {
      this.subscriptions.queries[query] = [];
      isNewSubscription = true;
    }
    let isCountSubscribed = isNewSubscription
      ? false
      : this._isCountSubscribedQuery(query);
    this.subscriptions.queries[query].push(callbacks);
    if (this.isConnectionOpen()) {
      if (isNewSubscription) {
        this._sendQuery(query, !!callbacks[2]);
      } else if (!isCountSubscribed && callbacks[2]) {
        this._sendUnQuery(query);
        this._sendQuery(query, true);
      }
    }
  }

  private static _subscribeUID(
    name: string,
    callbacks: PubSubCallbacks<number>
  ) {
    let isNewSubscription = false;
    if (!this.subscriptions.uids.hasOwnProperty(name)) {
      this.subscriptions.uids[name] = [];
      isNewSubscription = true;
    }
    let isCountSubscribed = isNewSubscription
      ? false
      : this._isCountSubscribedUID(name);
    this.subscriptions.uids[name].push(callbacks);
    if (this.isConnectionOpen()) {
      if (isNewSubscription) {
        this._sendUID(name, !!callbacks[2]);
      } else if (!isCountSubscribed && callbacks[2]) {
        this._sendUnUID(name);
        this._sendUID(name, true);
      }
    }
  }

  private static _sendQuery(query: string, count: boolean) {
    this._send({
      action: 'subscribe',
      query,
      count,
    });
  }

  private static _sendUID(name: string, count: boolean) {
    this._send({
      action: 'subscribe',
      uid: name,
      count,
    });
  }

  private static _isCountSubscribedQuery(query: string) {
    if (!this.subscriptions.queries.hasOwnProperty(query)) {
      return false;
    }
    for (
      let callbacks = 0;
      callbacks < this.subscriptions.queries[query].length;
      callbacks++
    ) {
      if (this.subscriptions.queries[query][callbacks][2]) {
        return true;
      }
    }
    return false;
  }

  private static _isCountSubscribedUID(name: string) {
    if (!this.subscriptions.uids.hasOwnProperty(name)) {
      return false;
    }
    for (
      let callbacks = 0;
      callbacks < this.subscriptions.uids[name].length;
      callbacks++
    ) {
      if (this.subscriptions.uids[name][callbacks][2]) {
        return true;
      }
    }
    return false;
  }

  private static _unsubscribeQuery(
    query: string,
    callbacks: PubSubCallbacks<any>
  ) {
    if (!this.subscriptions.queries.hasOwnProperty(query)) {
      return;
    }
    const idx = this.subscriptions.queries[query].indexOf(callbacks);
    if (idx === -1) {
      return;
    }
    this.subscriptions.queries[query].splice(idx, 1);
    if (!this.subscriptions.queries[query].length) {
      delete this.subscriptions.queries[query];
      if (this.isConnectionOpen()) {
        this._sendUnQuery(query);
      }
    }
  }

  private static _unsubscribeUID(
    name: string,
    callbacks: PubSubCallbacks<number>
  ) {
    if (!this.subscriptions.uids.hasOwnProperty(name)) {
      return;
    }
    const idx = this.subscriptions.uids[name].indexOf(callbacks);
    if (idx === -1) {
      return;
    }
    this.subscriptions.uids[name].splice(idx, 1);
    if (!this.subscriptions.uids[name].length) {
      delete this.subscriptions.uids[name];
      if (this.isConnectionOpen()) {
        this._sendUnUID(name);
      }
    }
  }

  private static _sendUnQuery(query: string) {
    this._send({
      action: 'unsubscribe',
      query: query,
    });
  }

  private static _sendUnUID(name: string) {
    this._send({
      action: 'unsubscribe',
      uid: name,
    });
  }

  public static updateArray(
    oldArr: EntityInterface[],
    update: PubSubUpdate<EntityInterface[]>
  ) {
    if (Array.isArray(update)) {
      const newArr = [...update];

      if (oldArr.length === 0) {
        // This will happen on the first update from a subscribe.
        oldArr.splice(0, 0, ...newArr);
        return;
      }

      const idMap: { [k: string]: number } = {};
      const Entity = Nymph.getEntityClass('Entity');
      for (let i = 0; i < newArr.length; i++) {
        const entity = newArr[i];
        if (entity instanceof Entity && entity.guid != null) {
          idMap[entity.guid] = i;
        }
      }
      const remove: number[] = [];
      for (let k in oldArr) {
        if (
          // This handles sparse arrays.
          typeof k === 'number' &&
          k <= 4294967294 &&
          /^0$|^[1-9]\d*$/.test(k) &&
          oldArr.hasOwnProperty(k)
        ) {
          const guid = oldArr[k].guid;
          if (guid != null) {
            if (!idMap.hasOwnProperty(guid)) {
              // It was deleted.
              remove.push(k);
            } else if (newArr[idMap[guid]].mdate !== oldArr[k].mdate) {
              // It was modified.
              oldArr[k].$init(newArr[idMap[guid]].toJSON());
              delete idMap[guid];
            } else {
              // Item wasn't modified.
              delete idMap[guid];
            }
          }
        }
      }
      // Now we must remove the deleted ones.
      remove.sort(function (a, b) {
        // Sort backwards so we can remove in reverse order. (Preserves
        // indices.)
        if (a > b) return -1;
        if (a < b) return 1;
        return 0;
      });
      for (let n = 0; n < remove.length; n++) {
        oldArr.splice(remove[n], 1);
      }
      // And add the new ones.
      for (let value of Object.values(idMap)) {
        oldArr.splice(oldArr.length, 0, newArr[value]);
      }
    } else if (update != null && update.hasOwnProperty('query')) {
      if ('removed' in update) {
        for (let i = 0; i < oldArr.length; i++) {
          if (oldArr[i] != null && oldArr[i].guid === update.removed) {
            oldArr.splice(i, 1);
            return;
          }
        }
      }

      // Get the entity.
      let entity: EntityInterface | null = null;
      if ('added' in update) {
        // Check for it in the array already.
        for (let i = 0; i < oldArr.length; i++) {
          if (oldArr[i] != null && oldArr[i].guid === update.added) {
            entity = oldArr.splice(i, 1)[0].$init(update.data);
          }
        }
        if (entity == null) {
          // A new entity.
          entity = Nymph.initEntity(update.data);
        }
      }
      if ('updated' in update) {
        // Extract it from the array.
        for (let i = 0; i < oldArr.length; i++) {
          if (oldArr[i] != null && oldArr[i].guid === update.updated) {
            entity = oldArr.splice(i, 1)[0].$init(update.data);
          }
        }
      }

      const query = JSON.parse(update.query);
      if (entity != null) {
        // Insert the entity in order.
        const sort =
          'sort' in query[0] ? (query[0].sort as 'cdate' | 'mdate') : 'cdate';
        const reverse = query[0].hasOwnProperty('reverse')
          ? query[0].reverse
          : false;
        let i;

        if (reverse) {
          for (
            i = 0;
            ((oldArr[i] ?? {})[sort] ?? 0) >= (entity[sort] ?? 0) &&
            i < oldArr.length;
            i++
          );
        } else {
          for (
            i = 0;
            ((oldArr[i] ?? {})[sort] ?? 0) < (entity[sort] ?? 0) &&
            i < oldArr.length;
            i++
          );
        }

        oldArr.splice(i, 0, entity);
      }
    }
  }

  public static on<T extends PubSubEventType>(
    event: T,
    callback: T extends 'connect'
      ? PubSubConnectCallback
      : T extends 'disconnect'
      ? PubSubDisconnectCallback
      : never
  ) {
    const prop = (event + 'Callbacks') as T extends 'connect'
      ? 'connectCallbacks'
      : T extends 'disconnect'
      ? 'disconnectCallbacks'
      : never;
    if (!this.hasOwnProperty(prop)) {
      throw new Error('Invalid event type.');
    }
    this[prop].push(callback);
    return () => this.off(event, callback);
  }

  public static off<T extends PubSubEventType>(
    event: T,
    callback: T extends 'connect'
      ? PubSubConnectCallback
      : T extends 'disconnect'
      ? PubSubDisconnectCallback
      : never
  ) {
    const prop = (event + 'Callbacks') as T extends 'connect'
      ? 'connectCallbacks'
      : T extends 'disconnect'
      ? 'disconnectCallbacks'
      : never;
    if (!this.hasOwnProperty(prop)) {
      return false;
    }
    const i = this[prop].indexOf(callback);
    if (i > -1) {
      this[prop].splice(i, 1);
    }
    return true;
  }

  public static setToken(token: string | null) {
    authToken = token;
    if (this.isConnectionOpen()) {
      this._send({
        action: 'authenticate',
        token: authToken,
      });
    }
  }
}

export class PubSubSubscription<T> {
  public query: string;
  public callbacks;
  public unsubscribe;

  constructor(
    query: string,
    callbacks: PubSubCallbacks<T>,
    unsubscribe: () => void
  ) {
    this.query = query;
    this.callbacks = callbacks;
    this.unsubscribe = unsubscribe;
  }
}

((global) => {
  if (
    typeof global !== 'undefined' &&
    typeof (global as any as { NymphOptions: NymphOptions }).NymphOptions !==
      'undefined' &&
    typeof (global as any as { NymphOptions: NymphOptions }).NymphOptions
      .pubsubUrl
  ) {
    PubSub.init((global as any as { NymphOptions: NymphOptions }).NymphOptions);
  }
})(
  typeof window === 'undefined'
    ? typeof self === 'undefined'
      ? undefined
      : self
    : window
);
