const { Pool } = require('pg')

// Expect DATABASE_URL in env (Neon or Postgres connection string)
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
}
