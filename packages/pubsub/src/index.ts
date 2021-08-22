import { server as WebSocketServer } from 'websocket';
import http from 'http';

import PubSub from './PubSub';

export { PubSub };

export default function defaultServer(port = 8080) {
  const server = http.createServer(function (_request, response) {
    response.writeHead(404);
    response.end();
  });

  server.listen(port, () => {
    console.log(
      new Date().toISOString(),
      `Nymph-PubSub server started listening on port ${port}.`
    );
  });

  const wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false,
  });

  return new PubSub({}, wsServer);
}
