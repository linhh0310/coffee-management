const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbPort = Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306);

async function initDb() {
  const schemaPath = path.join(__dirname, '..', 'database', 'coffee_db.sql');
  const migrationsDir = path.join(__dirname, 'migrations');

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || process.env.MYSQLHOST,
    port: dbPort,
    user: process.env.DB_USER || process.env.MYSQLUSER,
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
    multipleStatements: true
  });

  try {
    console.log('Đã kết nối đến MySQL');
    await conn.query(schemaSql);
    console.log('Đã import schema chính từ database/coffee_db.sql');

    const dbConn = await mysql.createConnection({
      host: process.env.DB_HOST || process.env.MYSQLHOST,
      port: dbPort,
      user: process.env.DB_USER || process.env.MYSQLUSER,
      password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
      database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE,
      multipleStatements: true
    });

    if (fs.existsSync(migrationsDir)) {
      const files = fs
        .readdirSync(migrationsDir)
        .filter((name) => name.toLowerCase().endsWith('.sql'))
        .sort((a, b) => a.localeCompare(b));

      if (files.length > 0) {
        await dbConn.query(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            filename VARCHAR(255) NOT NULL UNIQUE,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);

        for (const file of files) {
          const [rows] = await dbConn.query('SELECT 1 FROM schema_migrations WHERE filename = ? LIMIT 1', [file]);
          if (rows.length > 0) {
            console.log(`- Skip: ${file}`);
            continue;
          }

          const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
          console.log(`- Run: ${file}`);
          await dbConn.beginTransaction();
          await dbConn.query(sql);
          await dbConn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
          await dbConn.commit();
        }
      } else {
        console.log('- Không có file .sql trong migrations (bỏ qua).');
      }
    } else {
      console.log('- Không có thư mục migrations (bỏ qua — có thể đã chạy SQL thủ công).');
    }

    await dbConn.end();
    console.log('✅ Database khởi tạo thành công!');
  } catch (error) {
    console.error('Lỗi khi khởi tạo database:', error);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

initDb();