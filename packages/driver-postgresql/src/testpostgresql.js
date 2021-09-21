const cp = require('child_process');

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
