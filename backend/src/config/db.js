const mysql = require('mysql2');
require('dotenv').config();

// Tạo một pool kết nối (tối ưu hơn việc tạo kết nối đơn lẻ)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Chuyển pool sang dạng promise để dùng được async/await
const db = pool.promise();

module.exports = db;