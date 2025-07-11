const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`✅ MySQL ${process.env.DB_NAME} Database connected successfully!`);
    connection.release();
  } catch (error) {
    console.error('❌ MySQL Database connection failed:', error.message);
  }
})();

module.exports = pool;
