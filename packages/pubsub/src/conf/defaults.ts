import { Config } from './d';

export default {
  entries: ['ws://127.0.0.1:8080/'],
  relays: [
    //'ws://127.0.0.1:8080/',
  ],
  broadcastCounts: true,
  logger: (type: 'log' | 'error', ...args: any[]) => console[type](...args),
} as Config;
