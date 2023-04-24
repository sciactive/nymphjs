const cp = require('child_process');
const {
  Worker,
  isMainThread,
  workerData,
  parentPort,
  MessageChannel,
  receiveMessageOnPort,
} = require('node:worker_threads');
const pg = require('pg');

const postgresqlConfig = {
  host: 'localhost',
  user: 'nymph',
  password: 'nymph',
  database: 'nymph',
  insecureAuth: true,
};

const guid = '790274347f9b3a018c2cedee';
const guidBuf = Buffer.from(guid, 'hex');

// const query = 'SELECT $1 AS message;';
// const params = ['Hello, world.'];

const query = 'SELECT $1 AS message;';
const params = [['Hello, world.']];

// const query = "SELECT encode(decode($1, 'hex'), 'hex') AS message;";
// const params = [guid];

// const query = 'CREATE TABLE test ("id" INT NOT NULL, PRIMARY KEY ("id"));';
// const params = [];

// const query = 'CREATE TABLE test ("id" BYTEA NOT NULL, PRIMARY KEY ("id"));';
// const params = [];

// const query = 'INSERT INTO test ( "id" ) VALUES ( decode($1, \'hex\') );';
// const params = [guid];

// const query = 'SELECT encode("id", \'hex\') as "id" FROM test;';
// const params = [];

// const query = 'SELECT * FROM nonexist;';
// const params = [];

// const query = 'SELECT relname FROM pg_stat_user_tables ORDER BY relname;';
// const params = [];

const methodOne = () => {
  // Doesn't work anymore since runPostgresqlSync is updated.
  const output = cp.spawnSync(
    process.argv0,
    [__dirname + '/runPostgresqlSync.js'],
    {
      input: JSON.stringify({ postgresqlConfig, query, params }),
      timeout: 30000,
      maxBuffer: 100 * 1024 * 1024,
      encoding: 'utf8',
      windowsHide: true,
    }
  );
  try {
    const result = JSON.parse(output.stdout);
    console.log('Server reply: ', result);
  } catch (e) {
    // Do nothing.
  }
  const err = output.status === 0 ? null : JSON.parse(output.stderr);
  if (err) console.error(err);
};

const methodTwo = () => {
  if (isMainThread) {
    const worker = new Worker(__filename, { workerData: postgresqlConfig });
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
    const postgresqlConfig = workerData;
    const pool = new pg.Pool(postgresqlConfig);
    parentPort.on('message', async ({ query, params, port }) => {
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
