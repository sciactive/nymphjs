const { isMainThread, workerData, parentPort } = require('node:worker_threads');
const mysql = require('mysql2');

if (isMainThread) {
  throw new Error("Don't load this file as main thread.");
}

try {
  const mysqlConfig = workerData;
  const pool = mysql.createPool(mysqlConfig);

  parentPort.on('message', async (message) => {
    if (message === 'halt') {
      pool.end(() => {
        parentPort.postMessage('halted');
      });
    } else {
      const { query, params, port } = message;

      try {
        const [results, fields] = await new Promise((resolve, reject) =>
          pool.query(query, params, (error, results, fields) => {
            if (error) {
              reject(error);
            }
            resolve([results, fields]);
          })
        );

        port.postMessage({
          results,
          fields,
        });
      } catch (e) {
        port.postMessage({ error: e.message });
      }
    }
  });
} catch (e) {
  parentPort.postMessage({ error: e.message });
}
