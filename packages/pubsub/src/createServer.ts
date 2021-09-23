import type { Nymph, TilmeldInterface } from '@nymphjs/nymph';
import http from 'http';
import { server as WebSocketServer } from 'websocket';

import { Config, ConfigDefaults as defaults } from './conf';
import PubSub from './PubSub';

export default function createServer(
  port = 8080,
  config: Partial<Config> = {},
  nymph: Nymph
) {
  const server = http.createServer((_request, response) => {
    response.writeHead(404);
    response.end();
  });

  const listener = server.listen(port, () => {
    (config.logger ?? defaults.logger)(
      'log',
      new Date().toISOString(),
      `Nymph-PubSub server started listening on port ${port}.`
    );
  });

  const wsServer = new WebSocketServer({
    httpServer: listener,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false,
  });

  const pubsub = new PubSub(config, nymph, wsServer);

  const _close = pubsub.close;
  pubsub.close = () => {
    _close.call(pubsub);
    listener.close();
  };

  return pubsub;
}
