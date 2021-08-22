import Nymph, {
  EntityConstructor,
  EntityInterface,
  Options,
  Selector,
  SerializedEntityData,
} from '@nymphjs/nymph';
import {
  request,
  client as WebSocketClient,
  server as WebSocketServer,
  connection,
  Message,
} from 'websocket';
import { difference } from 'lodash';

import { Config, ConfigDefaults as defaults } from './conf';
import {
  AuthenticateMessageData,
  QuerySubscribeMessageData,
  UidSubscribeMessageData,
  SubscribeMessageData,
  PublishEntityMessageData,
  PublishUidMessageData,
  PublishMessageData,
  MessageData,
  MessageOptions,
} from './PubSub.types';

/**
 * A publish/subscribe server for Nymph.
 *
 * Written by Hunter Perrin for SciActive.
 *
 * @author Hunter Perrin <hperrin@gmail.com>
 * @copyright SciActive Inc
 * @see http://nymph.io/
 */
export default class PubSub {
  public config: Config;
  public server: WebSocketServer;
  public tilmeld: any;

  private sessions = new Map<connection, string>();
  protected querySubs: {
    [etype: string]: {
      [query: string]: Map<
        connection,
        {
          current: string[];
          query: string;
          count: boolean;
        }
      >;
    };
  } = {};
  protected uidSubs: {
    [uidName: string]: Map<connection, { count: boolean }>;
  } = {};

  /**
   * Initialize Nymph PubSub.
   *
   * @param config The PubSub configuration.
   */
  public constructor(
    config: Partial<Config>,
    server: WebSocketServer,
    tilmeld?: any
  ) {
    this.config = { ...defaults, ...config };
    this.server = server;
    this.tilmeld = tilmeld;

    this.server.on('request', this.handleRequest.bind(this));
  }

  public originIsAllowed(_origin: string) {
    // TODO: add this to options.
    return true;
  }

  public handleRequest(request: request) {
    if (!this.originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log(
        new Date().toISOString(),
        'Client from origin ' + request.origin + ' was kicked by the bouncer.'
      );
      return;
    }

    const connection = request.accept('nymph', request.origin);
    console.log(
      new Date().toISOString(),
      `Client joined the party! (${connection.remoteAddress}).`
    );

    connection.on('error', (err) => {
      this.onError(connection, err);
    });

    connection.on('message', (message) => {
      this.onMessage(connection, message);
    });

    connection.on('close', (_reasonCode, description) => {
      this.onClose(connection, description);
    });
  }

  /**
   * Handle a message from a client.
   */
  public async onMessage(from: connection, msg: Message) {
    if (msg.type !== 'utf8') {
      throw new Error("This server doesn't accept binary messages.");
    }
    const data: MessageData = JSON.parse(msg.utf8Data);
    if (
      !data.action ||
      ['authenticate', 'subscribe', 'unsubscribe', 'publish'].indexOf(
        data.action
      ) === -1
    ) {
      return;
    }
    switch (data.action) {
      case 'authenticate':
        this.handleAuthentication(from, data);
        break;
      case 'subscribe':
      case 'unsubscribe':
        await this.handleSubscription(from, data);
        break;
      case 'publish':
        await this.handlePublish(from, msg, data);
        break;
    }
  }

  /**
   * Clean up after users who leave.
   */
  public onClose(conn: connection, description: string) {
    console.log(
      new Date().toISOString(),
      `Client skedaddled. (${description}, ${conn.remoteAddress})`
    );

    let mess = 0;
    for (let curEtype in this.querySubs) {
      const curSubscriptions = this.querySubs[curEtype];
      for (let curQuery in curSubscriptions) {
        const curClients = curSubscriptions[curQuery];
        if (curClients.has(conn)) {
          curClients.delete(conn);

          const count = curClients.size;

          if (count === 0) {
            delete curSubscriptions[curQuery];
            if (Object.keys(this.querySubs[curEtype]).length === 0) {
              delete this.querySubs[curEtype];
            }
          } else {
            if (this.config.broadcastCounts) {
              // Notify clients of the subscription count.
              for (let key of curClients.keys()) {
                const curData = curClients.get(key);
                if (curData && curData.count) {
                  key.send(
                    JSON.stringify({
                      query: curData.query,
                      count,
                    })
                  );
                }
              }
            }
          }
          mess++;
        }
      }
    }

    for (let curUID in this.uidSubs) {
      const curClients = this.uidSubs[curUID];
      if (curClients.has(conn)) {
        curClients.delete(conn);

        const count = curClients.size;

        if (count === 0) {
          delete this.uidSubs[curUID];
        } else {
          if (this.config.broadcastCounts) {
            // Notify clients of the subscription count.
            for (const key of curClients.keys()) {
              const curData = curClients.get(key);
              if (curData && curData.count) {
                key.send(
                  JSON.stringify({
                    uid: curUID,
                    count,
                  })
                );
              }
            }
          }
        }
        mess++;
      }
    }

    if (this.sessions.has(conn)) {
      this.sessions.delete(conn);
      mess++;
    }

    if (mess) {
      console.log(
        new Date().toISOString(),
        `Cleaned up client's mess. (${mess}, ${conn.remoteAddress})`
      );
    }
  }

  public onError(conn: connection, e: Error) {
    console.error(
      new Date().toISOString(),
      `An error occured. (${e.message}, ${conn.remoteAddress})`
    );
  }

  /**
   * Handle an authentication from a client.
   */
  private handleAuthentication(
    from: connection,
    data: AuthenticateMessageData
  ) {
    // Save the user's auth token in session storage.
    const token = data.token;
    if (token != null) {
      this.sessions.set(from, token);
    } else if (this.sessions.has(from)) {
      this.sessions.delete(from);
    }
  }

  /**
   * Handle a subscribe or unsubscribe from a client.
   */
  private async handleSubscription(
    from: connection,
    data: SubscribeMessageData
  ) {
    if ('query' in data && data.query != null) {
      // Request is for a query.

      await this.handleSubscriptionQuery(from, data);
    } else if (
      'uid' in data &&
      data.uid != null &&
      typeof data.uid == 'string'
    ) {
      // Request is for a UID.

      await this.handleSubscriptionUid(from, data);
    }
  }

  /**
   * Handle a subscribe or unsubscribe for a query from a client.
   */
  private async handleSubscriptionQuery(
    from: connection,
    data: QuerySubscribeMessageData
  ) {
    let args: [MessageOptions, ...Selector[]];
    let EntityClass: EntityConstructor;
    try {
      args = JSON.parse(data.query);
      EntityClass = Nymph.getEntityClass(args[0].class);
    } catch (e) {
      return;
    }
    const etype = EntityClass.ETYPE;
    const serialArgs = JSON.stringify(args);
    const [clientOptions, ...selectors] = args;
    const options: Options & { return: 'guid' } = {
      ...clientOptions,
      class: EntityClass,
      return: 'guid',
      source: 'client',
    };

    if (data.action === 'subscribe') {
      // Client is subscribing to a query.
      if (!(etype in this.querySubs)) {
        this.querySubs[etype] = {};
      }
      if (!(serialArgs in this.querySubs[etype])) {
        this.querySubs[etype][serialArgs] = new Map();
      }
      let token = null;
      if (this.sessions.has(from)) {
        token = this.sessions.get(from);
      }
      if (this.tilmeld != null && token != null) {
        const user = this.tilmeld.extractToken(token);
        if (user) {
          // Log in the user for access controls.
          this.tilmeld.fillSession(user);
        }
      }
      this.querySubs[etype][serialArgs].set(from, {
        current: await Nymph.getEntities(options, ...selectors),
        query: data.query,
        count: !!data.count,
      });
      if (this.tilmeld != null && token != null) {
        // Clear the user that was temporarily logged in.
        this.tilmeld.clearSession();
      }
      console.log(
        new Date().toISOString(),
        `Client subscribed to a query! ($serialArgs, ${from.remoteAddress})`
      );

      if (this.config.broadcastCounts) {
        // Notify clients of the subscription count.
        const count = this.querySubs[etype][serialArgs].size;
        for (let key of this.querySubs[etype][serialArgs].keys()) {
          const curData = this.querySubs[etype][serialArgs].get(key);
          if (curData && curData.count) {
            key.send(
              JSON.stringify({
                query: curData.query,
                count,
              })
            );
          }
        }
      }
    }

    if (data.action === 'unsubscribe') {
      // Client is unsubscribing from a query.
      if (!(etype in this.querySubs)) {
        return;
      }
      if (!(serialArgs in this.querySubs[etype])) {
        return;
      }
      if (!this.querySubs[etype][serialArgs].has(from)) {
        return;
      }
      this.querySubs[etype][serialArgs].delete(from);
      console.log(
        new Date().toISOString(),
        `Client unsubscribed from a query! ($serialArgs, ${from.remoteAddress})`
      );

      const count = this.querySubs[etype][serialArgs].size;

      if (count === 0) {
        // No more subscribed clients.
        delete this.querySubs[etype][serialArgs];
        if (Object.keys(this.querySubs[etype]).length === 0) {
          delete this.querySubs[etype];
        }
        return;
      }

      if (this.config.broadcastCounts) {
        // Notify clients of the subscription count.
        for (let key of this.querySubs[etype][serialArgs].keys()) {
          const curData = this.querySubs[etype][serialArgs].get(key);
          if (curData && curData.count) {
            key.send(
              JSON.stringify({
                query: curData.query,
                count,
              })
            );
          }
        }
      }
    }
  }

  /**
   * Handle a subscribe or unsubscribe for a UID from a client.
   */
  private async handleSubscriptionUid(
    from: connection,
    data: UidSubscribeMessageData
  ) {
    if (data.action === 'subscribe') {
      // Client is subscribing to a UID.
      if (!(data.uid in this.uidSubs)) {
        this.uidSubs[data.uid] = new Map();
      }
      this.uidSubs[data['uid']].set(from, {
        count: !!data.count,
      });
      console.log(
        new Date().toISOString(),
        `Client subscribed to a UID! (${data.uid}, ${from.remoteAddress})`
      );

      if (this.config.broadcastCounts) {
        // Notify clients of the subscription count.
        const count = this.uidSubs[data.uid].size;
        for (let key of this.uidSubs[data.uid].keys()) {
          const curData = this.uidSubs[data.uid].get(key);
          if (curData && curData.count) {
            key.send(
              JSON.stringify({
                uid: data.uid,
                count,
              })
            );
          }
        }
      }
    }

    if (data.action === 'unsubscribe') {
      // Client is unsubscribing from a UID.
      if (!(data.uid in this.uidSubs)) {
        return;
      }
      if (!this.uidSubs[data.uid].has(from)) {
        return;
      }
      this.uidSubs[data.uid].delete(from);
      console.log(
        new Date().toISOString(),
        `Client unsubscribed from a UID! (${data.uid}, ${from.remoteAddress})`
      );

      const count = this.uidSubs[data.uid].size;

      if (count === 0) {
        // No more subscribed clients.
        delete this.uidSubs[data.uid];
        return;
      }

      if (this.config.broadcastCounts) {
        // Notify clients of the subscription count.
        for (let key of this.uidSubs[data.uid].keys()) {
          const curData = this.uidSubs[data.uid].get(key);
          if (curData && curData.count) {
            key.send(
              JSON.stringify({
                uid: data.uid,
                count,
              })
            );
          }
        }
      }
    }
  }

  /**
   * Handle a publish from a client.
   */
  private async handlePublish(
    from: connection,
    msg: Message,
    data: PublishMessageData
  ) {
    if (
      'guid' in data &&
      typeof data.guid === 'string' &&
      data.guid.match(/^[0-9a-f]24$/) &&
      (data.event === 'delete' ||
        ((data.event === 'create' || data.event === 'update') &&
          'entity' in data &&
          data.entity != null))
    ) {
      // Publish is an entity.

      await this.handlePublishEntity(from, data);

      // Relay the publish to other servers.
      this.relay(msg);
    }

    if (
      (('name' in data && typeof data.name === 'string') ||
        ('oldName' in data &&
          typeof data.oldName === 'string' &&
          'newName' in data &&
          typeof data.newName === 'string')) &&
      ['newUID', 'setUID', 'renameUID', 'deleteUID'].indexOf(data.event) !== -1
    ) {
      // Publish is a UID.

      await this.handlePublishUid(from, data);

      // Relay the publish to other servers.
      this.relay(msg);
    }
  }

  /**
   * Handle an entity publish from a client.
   */
  private async handlePublishEntity(
    from: connection,
    data: PublishEntityMessageData
  ) {
    console.log(
      new Date().toISOString(),
      `Received an entity publish! (${data.guid}, ${data.event}, ${from.remoteAddress})`
    );

    const etype = data.etype;

    if (!(etype in this.querySubs)) {
      return;
    }

    for (let curQuery in this.querySubs[etype]) {
      const curClients = this.querySubs[etype][curQuery];
      const updatedClients = new Set<connection>();

      if (data.event === 'delete' || data.event === 'update') {
        // Check if it is in any client's currents.
        for (const curClient of curClients.keys()) {
          const curData = curClients.get(curClient);
          if (!curData) {
            continue;
          }
          if (curData.current.indexOf(data.guid) !== -1) {
            // Update currents list.
            let current: EntityInterface | null;
            let token: string | undefined;
            try {
              const [clientOptions, ...selectors] = JSON.parse(curQuery);
              const options: Options = {
                ...clientOptions,
                class: Nymph.getEntityClass(clientOptions.class),
                return: 'entity',
                source: 'client',
              };
              selectors.push({ type: '&', guid: [data.guid] });
              if (this.sessions.has(curClient)) {
                token = this.sessions.get(curClient);
              }
              if (this.tilmeld != null && token != null) {
                const user = this.tilmeld.extractToken(token);
                if (user) {
                  // Log in the user for access controls.
                  this.tilmeld.fillSession(user);
                }
              }
              current = await Nymph.getEntity(options, ...selectors);
            } catch (e) {
              console.error(
                new Date().toISOString(),
                `Error updating client! (${e.message}, ${curClient.remoteAddress})`
              );
              continue;
            }

            if (current != null) {
              // Notify subscriber.
              console.log(
                new Date().toISOString(),
                `Notifying client of update! (${curClient.remoteAddress})`
              );
              if (typeof current.updateDataProtection === 'function') {
                current.updateDataProtection();
              }
              curClient.send(
                JSON.stringify({
                  query: curData.query,
                  updated: data.guid,
                  data: current,
                })
              );
            } else {
              curData.current = difference(curData.current, [data.guid]);
              curClients.set(curClient, curData);

              // Notify subscriber.
              console.log(
                new Date().toISOString(),
                `Notifying client of removal! (${curClient.remoteAddress})`
              );
              curClient.send(
                JSON.stringify({
                  query: curData.query,
                  removed: data.guid,
                })
              );
            }

            if (this.tilmeld != null && token != null) {
              // Clear the user that was temporarily logged in.
              this.tilmeld.clearSession();
            }

            updatedClients.add(curClient);
          }
        }
      }

      if ((data.event === 'create' || data.event === 'update') && data.entity) {
        // Check if it matches the query.
        try {
          let [clientOptions, ...selectors] = JSON.parse(curQuery);
          const EntityClass = Nymph.getEntityClass(clientOptions.class);
          const options: Options = {
            ...clientOptions,
            class: EntityClass,
            return: 'entity',
            source: 'client',
          };
          const entityData = data.entity.data;
          entityData.cdate = data.entity.cdate;
          entityData.mdate = data.entity.mdate;
          const entitySData: SerializedEntityData = {};
          if (typeof data.entity.class !== 'string') {
            throw new Error(
              `Received entity data class is not valid: ${data.entity.class}`
            );
          }
          const DataEntityClass = Nymph.getEntityClass(data.entity.class);

          if (
            EntityClass.ETYPE === DataEntityClass.ETYPE &&
            Nymph.driver.checkData(
              entityData,
              entitySData,
              selectors,
              data.guid,
              data.entity?.tags ?? []
            )
          ) {
            // It does match the query.
            for (let curClient of curClients.keys()) {
              if (updatedClients.has(curClient)) {
                // The user was already notified. (Of an update.)
                continue;
              }

              // Check that the user can access the entity.
              const [clientOptions, ...selectors] = JSON.parse(curQuery);
              const options: Options = {
                ...clientOptions,
                class: Nymph.getEntityClass(clientOptions.class),
                return: 'entity',
                source: 'client',
              };
              selectors.push({ type: '&', guid: [data.guid] });
              let token = null;
              if (this.sessions.has(curClient)) {
                token = this.sessions.get(curClient);
              }
              if (this.tilmeld != null && token != null) {
                const user = this.tilmeld.extractToken(token);
                if (user) {
                  // Log in the user for access controls.
                  this.tilmeld.fillSession(user);
                }
              }
              const current: EntityInterface | null = await Nymph.getEntity(
                options,
                ...selectors
              );

              if (current != null) {
                // Update the currents list.
                const curData = curClients.get(curClient);
                if (curData) {
                  curData.current.push(data.guid);
                  curClients.set(curClient, curData);

                  // Notify client.
                  console.log(
                    new Date().toISOString(),
                    `Notifying client of new match! (${curClient.remoteAddress})`
                  );
                  if (typeof current.updateDataProtection === 'function') {
                    current.updateDataProtection();
                  }
                  curClient.send(
                    JSON.stringify({
                      query: curData.query,
                      added: data.guid,
                      data: current,
                    })
                  );
                }
              }

              if (this.tilmeld != null && token != null) {
                // Clear the user that was temporarily logged in.
                this.tilmeld.clearSession();
              }
            }
          }
        } catch (e) {
          console.error(
            new Date().toISOString(),
            `Error checking for client updates! (${e.message})`
          );
        }
      }
    }
  }

  /**
   * Handle a UID publish from a client.
   */
  private async handlePublishUid(
    from: connection,
    data: PublishUidMessageData
  ) {
    console.log(
      new Date().toISOString(),
      `Received a UID publish! (${
        'name' in data ? data.name : `${data.oldName} => ${data.newName}`
      }, ${data.event}, ${from.remoteAddress})`
    );

    const names = [data.name, data.newName, data.oldName].filter(
      (name) => name != null
    ) as string[];

    for (let name of names) {
      if (!(name in this.uidSubs)) {
        continue;
      }
      for (let curClient of this.uidSubs[name].keys()) {
        console.log(
          new Date().toISOString(),
          `Notifying client of ${data.event}! (${name}, ${curClient.remoteAddress})`
        );
        const payload: {
          uid: string;
          event: string;
          value?: number;
        } = {
          uid: name,
          event: data.event,
        };
        if (data.value != null) {
          payload.value = data.value;
        }
        curClient.send(JSON.stringify(payload));
      }
    }
  }

  /**
   * Relay publish data to other servers.
   */
  private relay(message: Message) {
    if (message.type !== 'utf8') {
      console.error(new Date().toISOString(), `Can't relay non UTF8 message.`);
      return;
    }

    for (let host of this.config.relays) {
      const client = new WebSocketClient();

      client.on('connectFailed', function (error) {
        console.error(
          new Date().toISOString(),
          `Relay connection failed. (${error.toString()}, ${host})`
        );
      });

      client.on('connect', function (connection) {
        connection.on('error', function (error) {
          console.error(
            new Date().toISOString(),
            `Relay connect error. (${error.toString()}, ${host})`
          );
        });

        if (connection.connected) {
          connection.sendUTF(message.utf8Data);
        }

        connection.close();
      });

      client.connect(host, 'nymph');
    }
  }
}
