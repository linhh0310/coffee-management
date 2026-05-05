const mysql = require('mysql2');
require('dotenv').config();

const dbPort = Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306);

// Tạo một pool kết nối (tối ưu hơn việc tạo kết nối đơn lẻ)
const pool = mysql.createPool({
    host: process.env.DB_HOST || process.env.MYSQLHOST,
    port: dbPort,
    user: process.env.DB_USER || process.env.MYSQLUSER,
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Chuyển pool sang dạng promise để dùng được async/await
const db = pool.promise();

module.exports = db;