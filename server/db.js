require('dotenv').config()
const { Pool, types } = require('pg')

// Return date columns as YYYY-MM-DD strings to avoid UTC timezone shift
types.setTypeParser(1082, val => val)

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'garage56',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
})

pool.on('error', (err) => console.error('DB pool error:', err))

module.exports = { pool }
