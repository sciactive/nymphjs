const pg = require('pg');

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
    const { postgresqlConfig, query, params } = JSON.parse(stdin);
    const pool = new pg.Pool(postgresqlConfig);
    const results = await new Promise((resolve, reject) =>
      pool.query(query, params).then(
        (results) => resolve(results),
        (error) => reject(error)
      )
    );
    process.stdout.end(JSON.stringify(results), 'utf8', () => {
      pool.end(() => {
        process.exit(0);
      });
    });
  } catch (e) {
    process.stderr.end(JSON.stringify(e), 'utf8', () => {
      process.exit(1);
    });
  }
}
