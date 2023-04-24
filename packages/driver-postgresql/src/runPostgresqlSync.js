const { isMainThread, workerData, parentPort } = require('node:worker_threads');
const pg = require('pg');

if (isMainThread) {
  throw new Error("Don't load this file as main thread.");
}

try {
  const postgresqlConfig = workerData;
  const pool = new pg.Pool(postgresqlConfig);

  parentPort.on('message', async (message) => {
    if (message === 'halt') {
      pool.end(() => {
        parentPort.postMessage('halted');
      });
    } else {
      const { query, params, port } = message;

      try {
        const results = await new Promise((resolve, reject) =>
          pool.query(query, params).then(
            (results) => resolve(results),
            (error) => reject(error)
          )
        );

        port.postMessage({
          results: {
            rows: results.rows,
            rowCount: results.rowCount,
          },
        });
      } catch (e) {
        port.postMessage({ error: e.message });
      }
    }
  });
} catch (e) {
  parentPort.postMessage({ error: e.message });
}
