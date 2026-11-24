// One shared connection pool for the whole app.
// pg keeps a few open connections and reuses them, which is much
// faster than opening a new connection for every request.
const { Pool } = require('pg');
require('dotenv').config();

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon (and most hosted Postgres) require SSL, local Docker does not
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 10,
});

module.exports = pool;
