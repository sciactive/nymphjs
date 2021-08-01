const mysql = require('mysql2/promise');

let stdin = '';

process.stdin.on('data', (data) => {
  if (data != null) {
    stdin += data.toString();
  }
});

process.stdin.on('end', () => {
  run();
});

async function run() {
  try {
    const { mysqlConfig, query, params } = JSON.parse(stdin);
    const connection = await mysql.createConnection(mysqlConfig);
    const [rows, fields] = await connection.query(query, params);
    process.stdout.end(JSON.stringify({ rows, fields }), 'utf8', async () => {
      await connection.end();
      process.exit(0);
    });
  } catch (err) {
    process.stderr.end(JSON.stringify(err), 'utf8', () => {
      process.exit(1);
    });
  }
}
