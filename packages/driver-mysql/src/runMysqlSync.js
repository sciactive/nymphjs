const mysql = require('@vlasky/mysql');

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
    const pool = mysql.createPool(mysqlConfig);
    const [results, fields] = await new Promise((resolve, reject) =>
      pool.query(query, params, (error, results, fields) => {
        if (error) {
          reject(error);
        }
        resolve([results, fields]);
      })
    );
    process.stdout.end(
      JSON.stringify({
        results,
        fields,
      }),
      'utf8',
      () => {
        pool.end(() => {
          process.exit(0);
        });
      }
    );
  } catch (e) {
    process.stderr.end(JSON.stringify(e), 'utf8', () => {
      process.exit(1);
    });
  }
}
