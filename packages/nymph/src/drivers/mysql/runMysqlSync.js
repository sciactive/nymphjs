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
    const connection = mysql.createConnection(mysqlConfig);
    connection.connect();
    const [results, fields] = await new Promise((resolve, reject) =>
      connection.query(query, params, (error, results, fields) => {
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
        connection.end(() => {
          process.exit(0);
        });
      }
    );
  } catch (err) {
    process.stderr.end(JSON.stringify(err), 'utf8', () => {
      process.exit(1);
    });
  }
}
