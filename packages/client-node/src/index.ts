// Nymph expects fetch and WebSocket.
import ws from 'websocket';
import fetch from 'node-fetch';
import { Nymph, PubSub, type NymphOptions } from '@nymphjs/client';

// Make a shortcut for PubSub init.
class NodeNymph extends Nymph {
  constructor(nymphOptions: NymphOptions) {
    super({
      fetch: fetch as unknown as WindowOrWorkerGlobalScope['fetch'],
      ...nymphOptions,
    });

    // Save the Tilmeld auth token and send it in the header.
    let authToken: string | null = null;
    this.on('request', (_url: string, options: RequestInit) => {
      if (authToken) {
        (options.headers as Record<string, string>)['X-TILMELDAUTH'] =
          authToken;
      }
    });
    this.on('response', (response: Response) => {
      if (response.headers.has('X-TILMELDAUTH')) {
        authToken = response.headers.get('X-TILMELDAUTH');
        if (authToken === '') {
          authToken = null;
        }
      }
    });
  }
}

class NodePubSub extends PubSub {
  constructor(nymphOptions: NymphOptions, nymph: Nymph) {
    super(
      {
        WebSocket: ws.w3cwebsocket as unknown as typeof WebSocket,
        ...nymphOptions,
      },
      nymph,
    );
  }
}

export { NodeNymph as Nymph, NodePubSub as PubSub };
