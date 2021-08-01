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

const output = cp.spawnSync(process.argv0, [__dirname + '/runMysqlSync.js'], {
  input: JSON.stringify({ mysqlConfig, query, params }),
  timeout: 30000,
  maxBuffer: 100 * 1024 * 1024,
  encoding: 'utf8',
  windowsHide: true,
});
const { rows, fields } = JSON.parse(output.stdout);
const err = output.status === 0 ? null : JSON.parse(output.stderr);

if (err) throw new Error(err.message);
console.log('Server says: ', rows[0].message);
