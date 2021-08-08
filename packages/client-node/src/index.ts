// Nymph expects fetch and WebSocket.
import { w3cwebsocket } from 'websocket';
import fetch from 'node-fetch';
import * as NymphClient from '@nymphjs/client';
import { NymphOptions } from '@nymphjs/client';

const { Nymph, PubSub } = NymphClient;

// Make a shortcut for PubSub init.
const _init = Nymph.init;
Nymph.init = (nymphOptions: NymphOptions) => {
  _init.call(Nymph, {
    fetch: fetch as any as WindowOrWorkerGlobalScope['fetch'],
    ...nymphOptions,
  });
  if (nymphOptions.pubsubURL) {
    PubSub.init({
      WebSocket: w3cwebsocket as any as typeof WebSocket,
      ...nymphOptions,
    });
  }
};

// Save the Tilmeld auth token and send it in the header.
let authToken: string | null = null;
Nymph.on('request', (_url: string, options: RequestInit) => {
  if (authToken) {
    (options.headers as Record<string, string>)['X-TILMELDAUTH'] = authToken;
  }
});
Nymph.on('response', (response: Response) => {
  if (response.headers.has('X-TILMELDAUTH')) {
    authToken = response.headers.get('X-TILMELDAUTH');
    if (authToken === '') {
      authToken = null;
    }
  }
});

export { Nymph };
