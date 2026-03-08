const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://cacheflow:changeme123@localhost:5433/cacheflow' });
pool.query("SELECT provider, count(*) FROM oauth_tokens GROUP BY provider", (err, res) => {
  if (err) console.error(err);
  else console.log(res.rows);
  pool.end();
});

