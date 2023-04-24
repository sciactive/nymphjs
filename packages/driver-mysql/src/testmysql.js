const cp = require('node:child_process');
const {
  Worker,
  isMainThread,
  workerData,
  parentPort,
  MessageChannel,
  receiveMessageOnPort,
} = require('node:worker_threads');
const mysql = require('@vlasky/mysql');

const mysqlConfig = {
  host: 'localhost',
  user: 'nymph',
  password: 'nymph',
  database: 'nymph',
  insecureAuth: true,
};

const query = 'SELECT ? AS message;';
const params = ['Hello, world.'];

// const query =
//   'CREATE TABLE test (`id` INT UNSIGNED NOT NULL, PRIMARY KEY (`id`));';
// const params = [];

// const query = 'SELECT LOWER(HEX(UNHEX(?))) AS message;';
// const params = ['FF'];

const methodOne = () => {
  // Doesn't work anymore since runMysqlSync is updated.
  const output = cp.spawnSync(process.argv0, [__dirname + '/runMysqlSync.js'], {
    input: JSON.stringify({ mysqlConfig, query, params }),
    timeout: 30000,
    maxBuffer: 100 * 1024 * 1024,
    encoding: 'utf8',
    windowsHide: true,
  });
  const result = JSON.parse(output.stdout);
  const err = output.status === 0 ? null : JSON.parse(output.stderr);

  if (err) throw new Error(err.message);
  console.log('Server reply: ', result);
};

const methodTwo = () => {
  if (isMainThread) {
    const worker = new Worker(__filename, { workerData: mysqlConfig });
    const channel = new MessageChannel();

    worker.postMessage({ query, params, port: channel.port2 }, [channel.port2]);

    let result = undefined;
    while (!result) {
      result = receiveMessageOnPort(channel.port1);
    }

    if (result.message.error) {
      throw new Error(result.message.error);
    }

    console.log(JSON.stringify(result, null, 2));
  } else {
    const mysqlConfig = workerData;
    const pool = mysql.createPool(mysqlConfig);

    parentPort.on('message', async ({ query, params, port }) => {
      try {
        const [results, fields] = await new Promise((resolve, reject) =>
          pool.query(query, params, (error, results, fields) => {
            if (error) {
              reject(error);
            }
            resolve([results, fields]);
          })
        );

        port.postMessage({ results, fields });

        pool.end(() => {
          process.exit(0);
        });
      } catch (e) {
        port.postMessage({ error: e.message });
      }
    });
  }
};

methodTwo();
