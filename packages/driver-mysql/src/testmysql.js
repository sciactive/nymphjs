const cp = require('child_process');

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
