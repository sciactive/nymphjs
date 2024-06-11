import createDebug, { type Debugger } from 'debug';
import { Config } from './d';

const debuggers: { [k: string]: { log: Debugger; error: Debugger } } = {};

function getDebuggers(source: string) {
  if (source in debuggers) {
    return debuggers[source];
  }

  debuggers[source] = {
    log: createDebug(`nymphjs:log:${source}`),
    error: createDebug(`nymphjs:error:${source}`),
  };

  debuggers[source].log.log = console.log.bind(console);

  return debuggers[source];
}

export default {
  cache: false,
  cacheThreshold: 4,
  cacheLimit: 50,
  emptyListError: false,
  debugLog: (source, message) => {
    getDebuggers(source).log(message);
  },
  debugError: (source, message) => {
    getDebuggers(source).error(message);
  },
} as Config;
