import {
  Nymph,
  EntityConstructor,
  EntityInterface,
  Options,
  Selector,
  SerializedEntityData,
  classNamesToEntityConstructors,
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
import type {
  QuerySubscriptionData,
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
  /**
   * The Nymph instance.
   */
  public nymph: Nymph;

  /**
   * The PubSub config.
   */
  public config: Config;

  /**
   * The WebSocket server.
   */
  public server: WebSocketServer;

  private sessions = new Map<
    connection,
    { authToken: string; switchToken?: string }
  >();
  protected querySubs: {
    [etype: string]: {
      [query: string]: Map<connection, QuerySubscriptionData>;
    };
  } = {};
  protected uidSubs: {
    [uidName: string]: Map<connection, { count: boolean }>;
  } = {};
  protected static transactionPublishes: {
    nymph: Nymph;
    payload: string;
    config: Config;
  }[] = [];

  public static initPublisher(config: Partial<Config>, nymph: Nymph) {
    const configWithDefaults: Config = { ...defaults, ...config };

    nymph.on('beforeSaveEntity', async (nymph, entity) => {
      const guid = entity.guid;
      const etype = (entity.constructor as EntityConstructor).ETYPE;

      const off = nymph.on('afterSaveEntity', async (curNymph, result) => {
        off();
        off2();
        if (!(await result)) {
          return;
        }
        const payload = JSON.stringify({
          action: 'publish',
          event: guid == null ? 'create' : 'update',
          guid: entity.guid,
          entity: entity.toJSON(),
          etype: etype,
        });
        this.transactionPublishes.push({
          nymph: curNymph,
          payload,
          config: configWithDefaults,
        });
        await this.publishTransactionPublishes(curNymph);
      });
      const off2 = nymph.on('failedSaveEntity', async () => {
        off();
        off2();
      });
    });

    nymph.on('beforeDeleteEntity', async (nymph, entity) => {
      const guid = entity.guid;
      const etype = (entity.constructor as EntityConstructor).ETYPE;

      const off = nymph.on('afterDeleteEntity', async (curNymph, result) => {
        off();
        off2();
        if (!(await result)) {
          return;
        }
        const payload = JSON.stringify({
          action: 'publish',
          event: 'delete',
          guid: guid,
          etype: etype,
        });
        this.transactionPublishes.push({
          nymph: curNymph,
          payload,
          config: configWithDefaults,
        });
        await this.publishTransactionPublishes(curNymph);
      });
      const off2 = nymph.on('failedDeleteEntity', async () => {
        off();
        off2();
      });
    });

    nymph.on('beforeDeleteEntityByID', async (nymph, guid, className) => {
      try {
        const etype = nymph.getEntityClass(className ?? 'Entity').ETYPE;

        const off = nymph.on(
          'afterDeleteEntityByID',
          async (curNymph, result) => {
            off();
            off2();
            if (!(await result)) {
              return;
            }
            const payload = JSON.stringify({
              action: 'publish',
              event: 'delete',
              guid: guid,
              etype: etype,
            });
            this.transactionPublishes.push({
              nymph: curNymph,
              payload,
              config: configWithDefaults,
            });
            await this.publishTransactionPublishes(curNymph);
          }
        );
        const off2 = nymph.on('failedDeleteEntityByID', async () => {
          off();
          off2();
        });
      } catch (e: any) {
        return;
      }
    });

    nymph.on('beforeNewUID', async (nymph, name) => {
      const off = nymph.on('afterNewUID', async (curNymph, result) => {
        off();
        off2();
        const value = await result;
        if (value == null) {
          return;
        }
        const payload = JSON.stringify({
          action: 'publish',
          event: 'newUID',
          name: name,
          value: value,
        });
        this.transactionPublishes.push({
          nymph: curNymph,
          payload,
          config: configWithDefaults,
        });
        await this.publishTransactionPublishes(curNymph);
      });
      const off2 = nymph.on('failedNewUID', async () => {
        off();
        off2();
      });
    });

    nymph.on('beforeSetUID', async (nymph, name, value) => {
      const off = nymph.on('afterSetUID', async (curNymph, result) => {
        off();
        off2();
        if (!(await result)) {
          return;
        }
        const payload = JSON.stringify({
          action: 'publish',
          event: 'setUID',
          name: name,
          value: value,
        });
        this.transactionPublishes.push({
          nymph: curNymph,
          payload,
          config: configWithDefaults,
        });
        await this.publishTransactionPublishes(curNymph);
      });
      const off2 = nymph.on('failedSetUID', async () => {
        off();
        off2();
      });
    });

    nymph.on('beforeRenameUID', async (nymph, oldName, newName) => {
      const off = nymph.on('afterRenameUID', async (curNymph, result) => {
        off();
        off2();
        if (!(await result)) {
          return;
        }
        const payload = JSON.stringify({
          action: 'publish',
          event: 'renameUID',
          oldName: oldName,
          newName: newName,
        });
        this.transactionPublishes.push({
          nymph: curNymph,
          payload,
          config: configWithDefaults,
        });
        await this.publishTransactionPublishes(curNymph);
      });
      const off2 = nymph.on('failedRenameUID', async () => {
        off();
        off2();
      });
    });

    nymph.on('beforeDeleteUID', async (nymph, name) => {
      const off = nymph.on('afterDeleteUID', async (curNymph, result) => {
        off();
        off2();
        if (!(await result)) {
          return;
        }
        const payload = JSON.stringify({
          action: 'publish',
          event: 'deleteUID',
          name: name,
        });
        this.transactionPublishes.push({
          nymph: curNymph,
          payload,
          config: configWithDefaults,
        });
        await this.publishTransactionPublishes(curNymph);
      });
      const off2 = nymph.on('failedDeleteUID', async () => {
        off();
        off2();
      });
    });

    nymph.on('afterCommitTransaction', async (nymph, _name, result) => {
      if (result) {
        await this.publishTransactionPublishes(nymph);
      }
    });

    nymph.on('afterRollbackTransaction', async (nymph) => {
      this.removeTransactionPublishes(nymph);
    });
  }

  private static publish(message: string, config: Config) {
    for (let host of config.entries ?? []) {
      const client = new WebSocketClient();

      client.on('connectFailed', (error) => {
        if (config.logger) {
          config.logger(
            'error',
            new Date().toISOString(),
            `Publish connection failed. (${error.toString()}, ${host})`
          );
        }
      });

      client.on('connect', (connection) => {
        connection.on('error', (error) => {
          if (config.logger) {
            config.logger(
              'error',
              new Date().toISOString(),
              `Publish connect error. (${error.toString()}, ${host})`
            );
          }
        });

        if (connection.connected) {
          connection.sendUTF(message);
        }

        connection.close();
      });

      client.connect(host, 'nymph');
    }
  }

  private static isOrIsDescendent(parent: Nymph, child: Nymph) {
    let check: Nymph | null = child;
    while (check) {
      if (check === parent) {
        return true;
      }
      check = check.parent;
    }
    return false;
  }

  private static async publishTransactionPublishes(nymph: Nymph) {
    if (await nymph.inTransaction()) {
      // This instance is still in a transaction, so nothing gets published yet.
      return;
    }

    this.transactionPublishes = (
      await Promise.all(
        this.transactionPublishes.map(async (publish) => {
          // Check that this instance is a parent and the instance is not in a
          // transaction.
          if (
            !this.isOrIsDescendent(nymph, publish.nymph) ||
            (await publish.nymph.inTransaction())
          ) {
            return publish;
          }
          this.publish(publish.payload, publish.config);
          return null;
        })
      )
    ).filter((value) => value != null) as {
      nymph: Nymph;
      payload: string;
      config: Config;
    }[];
  }

  private static removeTransactionPublishes(nymph: Nymph) {
    this.transactionPublishes = this.transactionPublishes.filter((publish) => {
      if (this.isOrIsDescendent(nymph, publish.nymph)) {
        return false;
      }
      return true;
    });
  }

  /**
   * Initialize Nymph PubSub.
   *
   * @param config The PubSub configuration.
   */
  public constructor(
    config: Partial<Config>,
    nymph: Nymph,
    server: WebSocketServer
  ) {
    this.nymph = nymph;
    this.config = { ...defaults, ...config };
    this.server = server;

    this.server.on('request', this.handleRequest.bind(this));
  }

  public close() {
    this.server.shutDown();
  }

  public handleRequest(request: request) {
    if (!this.config.originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      this.config.logger(
        'log',
        new Date().toISOString(),
        'Client from origin ' + request.origin + ' was kicked by the bouncer.'
      );
      return;
    }

    const connection = request.accept('nymph', request.origin);
    this.config.logger(
      'log',
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
    this.config.logger(
      'log',
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
                  key.sendUTF(
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
                key.sendUTF(
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
      this.config.logger(
        'log',
        new Date().toISOString(),
        `Cleaned up client's mess. (${mess}, ${conn.remoteAddress})`
      );
    }
  }

  public onError(conn: connection, e: Error) {
    this.config.logger(
      'error',
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
    const authToken = data.authToken;
    const switchToken = data.switchToken;
    if (authToken != null) {
      this.sessions.set(from, { authToken, switchToken });
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
    data: QuerySubscribeMessageData,
    qrefParent?: {
      etype: string;
      query: string;
    }
  ) {
    let args: [MessageOptions, ...Selector[]];
    let EntityClass: EntityConstructor;
    try {
      args = JSON.parse(data.query);
      EntityClass = this.nymph.getEntityClass(args[0].class);
    } catch (e: any) {
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
    // Find qref queries.
    const qrefQueries = this.findQRefQueries(clientOptions, ...selectors);

    if (data.action === 'subscribe') {
      // Client is subscribing to a query.

      // First subscribe to qrefQueries, giving this one as a reference.
      for (const qrefQuery of qrefQueries) {
        await this.handleSubscriptionQuery(
          from,
          {
            action: 'subscribe',
            query: JSON.stringify(qrefQuery),
          },
          {
            etype,
            query: serialArgs,
          }
        );
      }

      // Now subscribe to this query.
      if (!(etype in this.querySubs)) {
        this.querySubs[etype] = {};
      }
      if (!(serialArgs in this.querySubs[etype])) {
        this.querySubs[etype][serialArgs] = new Map();
      }
      let authToken = null;
      let switchToken = null;
      if (this.sessions.has(from)) {
        const session = this.sessions.get(from);
        authToken = session?.authToken;
        switchToken = session?.switchToken;
      }
      const nymph = this.nymph.clone();
      if (nymph.tilmeld != null && authToken != null) {
        const user = await nymph.tilmeld.extractToken(authToken);
        if (user && user.enabled) {
          if (switchToken != null) {
            const switchUser = await nymph.tilmeld.extractToken(switchToken);
            if (switchUser) {
              // Log in the switchUser for access controls.
              nymph.tilmeld.fillSession(switchUser);
            }
          } else {
            // Log in the user for access controls.
            nymph.tilmeld.fillSession(user);
          }
        }
      }
      const existingSub = this.querySubs[etype][serialArgs].get(from);
      if (existingSub) {
        if (qrefParent) {
          existingSub.qrefParents.push(qrefParent);
        }
        if (!qrefParent && !existingSub.direct) {
          existingSub.direct = true;
        }
        if (data.count && !existingSub.count) {
          existingSub.count = true;
        }
      } else {
        this.querySubs[etype][serialArgs].set(from, {
          current: await nymph.getEntities(options, ...selectors),
          query: data.query,
          qrefParents: qrefParent ? [qrefParent] : [],
          direct: !qrefParent,
          count: !!data.count,
        });
      }
      if (nymph.tilmeld != null && authToken != null) {
        // Clear the user that was temporarily logged in.
        nymph.tilmeld.clearSession();
      }
      this.config.logger(
        'log',
        new Date().toISOString(),
        `Client subscribed to a query! (${serialArgs}, ${from.remoteAddress})`
      );

      if (this.config.broadcastCounts) {
        // Notify clients of the subscription count.
        const count = this.querySubs[etype][serialArgs].size;
        for (let key of this.querySubs[etype][serialArgs].keys()) {
          const curData = this.querySubs[etype][serialArgs].get(key);
          if (curData && curData.count) {
            key.sendUTF(
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

      // First unsubscribe from qrefQueries.
      for (const qrefQuery of qrefQueries) {
        await this.handleSubscriptionQuery(
          from,
          {
            action: 'unsubscribe',
            query: JSON.stringify(qrefQuery),
          },
          {
            etype,
            query: serialArgs,
          }
        );
      }

      // Now unsubscribe from this query.
      if (!(etype in this.querySubs)) {
        return;
      }
      if (!(serialArgs in this.querySubs[etype])) {
        return;
      }
      if (!this.querySubs[etype][serialArgs].has(from)) {
        return;
      }
      const existingSub = this.querySubs[etype][serialArgs].get(from);
      if (existingSub) {
        if (qrefParent) {
          existingSub.qrefParents = existingSub.qrefParents.filter(
            (parent) =>
              !(
                qrefParent.etype === parent.etype &&
                qrefParent.query === parent.query
              )
          );
        }
        if (!qrefParent) {
          existingSub.direct = false;
        }
        if (!existingSub.direct && !existingSub.qrefParents.length) {
          this.querySubs[etype][serialArgs].delete(from);
        }
      }
      this.config.logger(
        'log',
        new Date().toISOString(),
        `Client unsubscribed from a query! (${serialArgs}, ${from.remoteAddress})`
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
            key.sendUTF(
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
      this.config.logger(
        'log',
        new Date().toISOString(),
        `Client subscribed to a UID! (${data.uid}, ${from.remoteAddress})`
      );

      if (this.config.broadcastCounts) {
        // Notify clients of the subscription count.
        const count = this.uidSubs[data.uid].size;
        for (let key of this.uidSubs[data.uid].keys()) {
          const curData = this.uidSubs[data.uid].get(key);
          if (curData && curData.count) {
            key.sendUTF(
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
      this.config.logger(
        'log',
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
            key.sendUTF(
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
      data.guid.match(/^[0-9a-f]{24}$/) &&
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
    this.config.logger(
      'log',
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
        try {
          for (const curClient of curClients.keys()) {
            const curData = curClients.get(curClient);
            if (!curData) {
              continue;
            }
            if (curData.current.indexOf(data.guid) !== -1) {
              await this.updateClient(curClient, curData, data);
              updatedClients.add(curClient);
            }
          }
        } catch (e: any) {
          this.config.logger(
            'error',
            new Date().toISOString(),
            `Error checking for client updates! (${e?.message})`
          );
        }
      }

      if ((data.event === 'create' || data.event === 'update') && data.entity) {
        // Check if it matches the query.
        try {
          const [clientOptions, ...selectors] = JSON.parse(curQuery);
          const qrefQueries = this.findQRefQueries(clientOptions, ...selectors);
          const EntityClass = this.nymph.getEntityClass(clientOptions.class);
          const entityData = data.entity.data;
          entityData.cdate = data.entity.cdate;
          entityData.mdate = data.entity.mdate;
          const entitySData: SerializedEntityData = {};
          if (typeof data.entity.class !== 'string') {
            throw new Error(
              `Received entity data class is not valid: ${data.entity.class}`
            );
          }
          const DataEntityClass = this.nymph.getEntityClass(data.entity.class);

          if (
            EntityClass.ETYPE === DataEntityClass.ETYPE &&
            (qrefQueries.length ||
              this.nymph.driver.checkData(
                entityData,
                entitySData,
                selectors,
                data.guid,
                data.entity?.tags ?? []
              ))
          ) {
            // It either matches the query, or there are qref queries.
            for (let curClient of curClients.keys()) {
              if (updatedClients.has(curClient)) {
                // The user was already notified. (Of an update.)
                continue;
              }

              const curData = curClients.get(curClient);
              if (!curData) {
                continue;
              }

              // If there are qref queries, we need to dive into the user's
              // current data and translate them before running checkData.
              if (qrefQueries.length) {
                const translatedSelectors = this.translateQRefSelectors(
                  curClient,
                  selectors
                );
                if (
                  !this.nymph.driver.checkData(
                    entityData,
                    entitySData,
                    translatedSelectors,
                    data.guid,
                    data.entity?.tags ?? []
                  )
                ) {
                  // The query doesn't match when the qref queries are filled.
                  continue;
                }
              }

              await this.updateClient(curClient, curData, data);
            }
          }
        } catch (e: any) {
          this.config.logger(
            'error',
            new Date().toISOString(),
            `Error checking for client updates! (${e?.message})`
          );
        }
      }
    }
  }

  private async updateClient(
    curClient: connection,
    curData: QuerySubscriptionData,
    data: PublishEntityMessageData
  ) {
    // Update currents list.
    let current: EntityInterface[];
    let authToken: string | undefined;
    let switchToken: string | undefined;
    const nymph = this.nymph.clone();
    try {
      const [clientOptions, ...clientSelectors] = JSON.parse(curData.query);
      const options: Options = {
        ...clientOptions,
        class: nymph.getEntityClass(clientOptions.class),
        return: 'entity',
        source: 'client',
        skipAc: false,
      };
      const selectors = classNamesToEntityConstructors(nymph, clientSelectors);
      if (this.sessions.has(curClient)) {
        const session = this.sessions.get(curClient);
        authToken = session?.authToken;
        switchToken = session?.switchToken;
      }
      if (nymph.tilmeld != null && authToken != null) {
        const user = await nymph.tilmeld.extractToken(authToken);
        if (user && user.enabled) {
          if (switchToken != null) {
            const switchUser = await nymph.tilmeld.extractToken(switchToken);
            if (switchUser) {
              // Log in the switchUser for access controls.
              nymph.tilmeld.fillSession(switchUser);
            }
          } else {
            // Log in the user for access controls.
            nymph.tilmeld.fillSession(user);
          }
        }
      }
      current = await nymph.getEntities(options, ...selectors);
    } catch (e: any) {
      this.config.logger(
        'error',
        new Date().toISOString(),
        `Error updating client! (${e?.message}, ${curClient.remoteAddress})`
      );
      return;
    }

    const entityMap = Object.fromEntries(
      current.map((entity) => [entity.guid, entity])
    );
    const currentGuids = current.map((entity) => entity.guid ?? '');
    const removed = difference(curData.current, currentGuids);
    const added = difference(currentGuids, curData.current);

    if (curData.direct) {
      for (let guid of removed) {
        // Notify subscriber.
        this.config.logger(
          'log',
          new Date().toISOString(),
          `Notifying client of removal! (${curClient.remoteAddress})`
        );
        curClient.sendUTF(
          JSON.stringify({
            query: curData.query,
            removed: guid,
          })
        );
      }

      for (let guid of added) {
        const entity = entityMap[guid];
        // Notify client.
        this.config.logger(
          'log',
          new Date().toISOString(),
          `Notifying client of new match! (${curClient.remoteAddress})`
        );
        if (typeof entity.updateDataProtection === 'function') {
          entity.updateDataProtection();
        }
        curClient.sendUTF(
          JSON.stringify({
            query: curData.query,
            added: guid,
            data: entity,
          })
        );
      }

      if (data.event === 'update' && data.guid in entityMap) {
        const entity = entityMap[data.guid];
        // Notify subscriber.
        this.config.logger(
          'log',
          new Date().toISOString(),
          `Notifying client of update! (${curClient.remoteAddress})`
        );
        if (typeof entity.updateDataProtection === 'function') {
          entity.updateDataProtection();
        }
        curClient.sendUTF(
          JSON.stringify({
            query: curData.query,
            updated: data.guid,
            data: entity,
          })
        );
      }
    }

    // Update curData.
    curData.current = currentGuids;

    if (nymph.tilmeld != null && authToken != null) {
      // Clear the user that was temporarily logged in.
      nymph.tilmeld.clearSession();
    }

    if ((removed.length || added.length) && curData.qrefParents.length) {
      // All qref parents need to be rerun.
      for (const qrefParent of curData.qrefParents) {
        const subData =
          this.querySubs[qrefParent.etype][qrefParent.query].get(curClient);
        if (subData) {
          this.updateClient(curClient, subData, data);
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
    this.config.logger(
      'log',
      new Date().toISOString(),
      `Received a UID publish! (${
        'name' in data ? data.name : `${data.oldName} => ${data.newName}`
      }, ${data.event}, ${from.remoteAddress})`
    );

    const names = [data.name, data.oldName].filter(
      (name) => name != null
    ) as string[];
    let value = data.value;
    if (data.event === 'renameUID' && data.newName) {
      value = (await this.nymph.getUID(data.newName)) ?? undefined;
    }

    for (let name of names) {
      if (!(name in this.uidSubs)) {
        continue;
      }
      for (let curClient of this.uidSubs[name].keys()) {
        this.config.logger(
          'log',
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
        curClient.sendUTF(JSON.stringify(payload));
      }
    }

    if (
      data.event === 'renameUID' &&
      data.newName &&
      data.newName in this.uidSubs
    ) {
      for (let curClient of this.uidSubs[data.newName].keys()) {
        this.config.logger(
          'log',
          new Date().toISOString(),
          `Notifying client of new value after rename! (${data.newName}, ${curClient.remoteAddress})`
        );
        curClient.sendUTF(
          JSON.stringify({
            uid: data.newName,
            event: 'setUID',
            value,
          })
        );
      }
    }
  }

  /**
   * Relay publish data to other servers.
   */
  private relay(message: Message) {
    if (message.type !== 'utf8') {
      this.config.logger(
        'error',
        new Date().toISOString(),
        `Can't relay non UTF8 message.`
      );
      return;
    }

    for (let host of this.config.relays) {
      const client = new WebSocketClient();

      client.on('connectFailed', (error) => {
        this.config.logger(
          'error',
          new Date().toISOString(),
          `Relay connection failed. (${error.toString()}, ${host})`
        );
      });

      client.on('connect', (connection) => {
        connection.on('error', (error) => {
          this.config.logger(
            'error',
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

  private findQRefQueries(options: Options, ...selectors: Selector[]) {
    const qrefQueries: [Options, ...Selector[]][] = [];

    for (const curSelector of selectors) {
      for (const k in curSelector) {
        const key = k as keyof Selector;
        const value = curSelector[key];

        if (key === 'type') {
          continue;
        }

        if (value === undefined) {
          continue;
        }

        if (key === 'qref' || key === '!qref') {
          const tmpArr = (
            Array.isArray(((value as Selector['qref']) ?? [])[0])
              ? value
              : [value]
          ) as [string, [Options, ...Selector[]]][];
          for (let i = 0; i < tmpArr.length; i++) {
            qrefQueries.push(tmpArr[i][1]);
          }
        } else if (key === 'selector' || key === '!selector') {
          const tmpArr = (Array.isArray(value) ? value : [value]) as Selector[];
          qrefQueries.push(...this.findQRefQueries(options, ...tmpArr));
        }
      }
    }

    return qrefQueries;
  }

  /**
   * This translates qref selectors into ref selectors using the "current" GUID
   * list in the existing subscriptions.
   */
  private translateQRefSelectors(client: connection, selectors: Selector[]) {
    const newSelectors: Selector[] = [];

    for (const curSelector of selectors) {
      const newSelector: Selector = { type: curSelector.type };

      for (const k in curSelector) {
        const key = k as keyof Selector;
        const value = curSelector[key];

        if (key === 'type') {
          continue;
        }

        if (value === undefined) {
          continue;
        }

        if (key === 'qref' || key === '!qref') {
          const newKey: 'ref' | '!ref' = key === 'qref' ? 'ref' : '!ref';
          const tmpArr = (
            Array.isArray(((value as Selector['qref']) ?? [])[0])
              ? value
              : [value]
          ) as [string, [Options, ...Selector[]]][];
          for (let i = 0; i < tmpArr.length; i++) {
            const name = tmpArr[i][0];
            const [qrefOptions, ...qrefSelectors] = tmpArr[i][1];
            const query = JSON.stringify(tmpArr[i][1]);
            const QrefEntityClass =
              typeof qrefOptions.class === 'string'
                ? this.nymph.getEntityClass(qrefOptions.class)
                : qrefOptions.class ?? this.nymph.getEntityClass('Entity');
            const data =
              this.querySubs[QrefEntityClass.ETYPE][query].get(client);
            if (data) {
              const guids = data.current;
              let newValue: [string, string | EntityInterface][];
              const oldValue = newSelector[newKey];
              if (!oldValue) {
                newValue = [];
              } else if (oldValue.length && !Array.isArray(oldValue[0])) {
                newValue = [oldValue] as [string, string | EntityInterface][];
              } else {
                newValue = oldValue as [string, string | EntityInterface][];
              }
              newValue.push(
                ...(guids.map((guid) => [name, guid]) as [string, string][])
              );
              // Insert the qref results as a ref clause.
              newSelector[newKey] = newValue;
            } else {
              // Can't translate, so put the original back in.
              if (!newSelector[key]) {
                newSelector[key] = [];
              }
              (newSelector[key] as [string, [Options, ...Selector[]]][]).push([
                name,
                [qrefOptions, ...qrefSelectors],
              ]);
            }
          }
        } else if (key === 'selector' || key === '!selector') {
          const tmpArr = (Array.isArray(value) ? value : [value]) as Selector[];
          newSelector[key] = this.translateQRefSelectors(client, tmpArr);
        } else if (key === 'ref' || key === '!ref') {
          const tmpArr = (
            Array.isArray(((value as Selector['ref']) ?? [])[0])
              ? value
              : [value]
          ) as [string, string | EntityInterface][];

          if (!newSelector[key]) {
            newSelector[key] = [];
          }
          (newSelector[key] as [string, string | EntityInterface][]).push(
            ...tmpArr
          );
        } else {
          // @ts-ignore: ts doesn't know what value is here.
          newSelector[key] = value;
        }
      }

      newSelectors.push(newSelector);
    }

    return newSelectors;
  }
}
