const db = require('../config/db');

exports.getAllTables = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
        SELECT table_id, table_number, seating_capacity, status, updated_at
        FROM tables
        ORDER BY table_id ASC
      `
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách bàn', error: error.message });
  }
};

