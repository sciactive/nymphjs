import { Config } from './d';

export default {
  originIsAllowed: () => {
    throw new Error(
      'You must provide a "originIsAllowed" function to PubSub config to determine if client origin is allowed.'
    );
  },
  entries: ['ws://127.0.0.1:8080/'],
  relays: [
    //'ws://127.0.0.1:8080/',
  ],
  broadcastCounts: true,
  logger: (type: 'log' | 'error', ...args: any[]) => console[type](...args),
} as Config;
