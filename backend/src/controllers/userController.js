const db = require('../config/db');
const bcrypt = require('bcrypt');

const DEFAULT_SHIFT_START = '08:00:00';
const DEFAULT_SHIFT_END = '17:00:00';

let schemaEnsured = false;
async function ensureAttendanceSchema() {
  if (schemaEnsured) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS attendance_logs (
      attendance_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      work_date DATE NOT NULL,
      check_in DATETIME NULL,
      check_out DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_att_logs_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      UNIQUE KEY uq_attendance_user_date (user_id, work_date),
      INDEX idx_attendance_work_date (work_date)
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS staff_shifts (
      user_id INT NOT NULL PRIMARY KEY,
      shift_start TIME NOT NULL DEFAULT '08:00:00',
      shift_end TIME NOT NULL DEFAULT '17:00:00',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_staff_shifts_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS attendance_adjustments (
      adjustment_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      work_date DATE NOT NULL,
      old_check_in DATETIME NULL,
      old_check_out DATETIME NULL,
      new_check_in DATETIME NULL,
      new_check_out DATETIME NULL,
      reason VARCHAR(255) NOT NULL,
      adjusted_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_att_adj_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
      INDEX idx_att_adj_user_date (user_id, work_date)
    )
  `);

  try {
    await db.query("ALTER TABLE staff_profiles ADD COLUMN payment_status ENUM('pending','paid') DEFAULT 'pending'");
  } catch (err) {
    if (!String(err?.message || '').includes('Duplicate column name')) throw err;
  }

  schemaEnsured = true;
}

function toDateTime(workDate, hhmm) {
  return `${workDate} ${hhmm}:00`;
}

function toLocalSqlDateTime(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

exports.getUsers = async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
  const offset = (page - 1) * limit;
  const q = String(req.query.q || '').trim();
  const role = String(req.query.role || '').trim();
  const status = String(req.query.status || '').trim();

  try {
    const where = [];
    const params = [];

    if (q) {
      where.push('(u.username LIKE ? OR COALESCE(u.full_name, "") LIKE ?)');
      const key = `%${q}%`;
      params.push(key, key);
    }
    if (role && ['admin', 'staff'].includes(role)) {
      where.push('u.role = ?');
      params.push(role);
    }
    if (status !== '' && ['0', '1'].includes(status)) {
      where.push('u.status = ?');
      params.push(Number(status));
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS totalItems FROM users u ${whereSql}`,
      params
    );

    const [rows] = await db.query(
      `
        SELECT
          u.user_id,
          u.username,
          u.full_name,
          u.role,
          u.status,
          u.created_at,
          u.updated_at,
          COALESCE(COUNT(o.order_id), 0) AS orders_count,
          COALESCE(sp.employee_code, CONCAT('NV-', LPAD(u.user_id, 3, '0'))) AS employee_code,
          COALESCE(sp.phone, '') AS phone,
          COALESCE(sp.base_salary, 0) AS base_salary,
          COALESCE(sp.allowance, 0) AS allowance
        FROM users u
        LEFT JOIN staff_profiles sp ON sp.user_id = u.user_id
        LEFT JOIN orders o ON o.user_id = u.user_id
        ${whereSql}
        GROUP BY u.user_id
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [summaryRows] = await db.query(
      `
        SELECT
          COUNT(*) AS totalUsers,
          SUM(CASE WHEN role = 'staff' THEN 1 ELSE 0 END) AS totalStaff,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) AS totalAdmin,
          SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS activeUsers
        FROM users
      `
    );

    const totalItems = Number(countRows[0]?.totalItems || 0);
    res.json({
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      users: rows.map((u) => ({
        user_id: u.user_id,
        username: u.username,
        full_name: u.full_name,
        role: u.role,
        status: Number(u.status),
        created_at: u.created_at,
        updated_at: u.updated_at,
        orders_count: Number(u.orders_count || 0),
        employee_code: u.employee_code,
        phone: u.phone,
        base_salary: Number(u.base_salary || 0),
        allowance: Number(u.allowance || 0)
      })),
      summary: {
        totalUsers: Number(summaryRows[0]?.totalUsers || 0),
        totalStaff: Number(summaryRows[0]?.totalStaff || 0),
        totalAdmin: Number(summaryRows[0]?.totalAdmin || 0),
        activeUsers: Number(summaryRows[0]?.activeUsers || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách nhân viên', error: error.message });
  }
};

exports.createStaff = async (req, res) => {
  const { username, password, full_name, role = 'staff', phone = null, base_salary = 0, allowance = 0 } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: 'Thiếu username/password' });
  }
  if (!['admin', 'staff'].includes(role)) {
    return res.status(400).json({ message: 'role không hợp lệ' });
  }
  try {
    const [exist] = await db.query('SELECT user_id FROM users WHERE username = ?', [username]);
    if (exist.length) return res.status(400).json({ message: 'Username đã tồn tại' });

    const hashed = await bcrypt.hash(password.toString(), 10);
    const [result] = await db.query(
      'INSERT INTO users (username, password, full_name, role, status) VALUES (?, ?, ?, ?, 1)',
      [username, hashed, full_name || null, role]
    );

    const userId = result.insertId;
    await db.query(
      `INSERT INTO staff_profiles (user_id, employee_code, phone, base_salary, allowance)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, `NV-${String(userId).padStart(3, '0')}`, phone, Number(base_salary || 0), Number(allowance || 0)]
    );

    res.status(201).json({ message: 'Tạo nhân viên thành công', user_id: userId });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo nhân viên', error: error.message });
  }
};

exports.updateUserStatus = async (req, res) => {
  const userId = Number(req.params.id);
  const nextStatus = Number(req.body?.status);
  if (!Number.isFinite(userId) || ![0, 1].includes(nextStatus)) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
  }
  try {
    const [result] = await db.query('UPDATE users SET status = ? WHERE user_id = ?', [nextStatus, userId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy user' });
    res.json({ message: 'Cập nhật trạng thái thành công', user_id: userId, status: nextStatus });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật trạng thái', error: error.message });
  }
};

exports.getAttendance = async (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const q = String(req.query.q || '').trim().toLowerCase();
  const actorRole = String(req.user?.role || 'staff');
  const actorId = Number(req.user?.id || req.user?.user_id || 0);

  try {
    await ensureAttendanceSchema();

    const whereSelf = actorRole === 'admin' ? '' : ' AND u.user_id = ? ';
    const params = [DEFAULT_SHIFT_START, DEFAULT_SHIFT_END, date];
    if (actorRole !== 'admin') params.push(actorId);

    const [rows] = await db.query(
      `
        SELECT
          u.user_id,
          u.role,
          COALESCE(sp.employee_code, CONCAT('NV-', LPAD(u.user_id, 3, '0'))) AS employee_code,
          COALESCE(u.full_name, u.username) AS full_name,
          COALESCE(sp.phone, '') AS phone,
          al.work_date,
          al.check_in,
          al.check_out,
          GREATEST(TIMESTAMPDIFF(MINUTE, al.check_in, al.check_out), 0) AS worked_minutes,
          COALESCE(ss.shift_start, ?) AS shift_start,
          COALESCE(ss.shift_end, ?) AS shift_end
        FROM users u
        LEFT JOIN staff_profiles sp ON sp.user_id = u.user_id
        LEFT JOIN attendance_logs al ON al.user_id = u.user_id AND al.work_date = ?
        LEFT JOIN staff_shifts ss ON ss.user_id = u.user_id
        WHERE u.role IN ('admin', 'staff')
        ${whereSelf}
        ORDER BY u.user_id ASC
      `,
      params
    );

    let attendance = rows.map((r) => {
      const shiftStartDateTime = r.work_date ? new Date(`${r.work_date}T${String(r.shift_start || DEFAULT_SHIFT_START)}`) : null;
      const shiftEndDateTime = r.work_date ? new Date(`${r.work_date}T${String(r.shift_end || DEFAULT_SHIFT_END)}`) : null;
      const checkIn = r.check_in ? new Date(r.check_in) : null;
      const checkOut = r.check_out ? new Date(r.check_out) : null;

      const lateMinutes = checkIn && shiftStartDateTime
        ? Math.max(0, Math.round((checkIn.getTime() - shiftStartDateTime.getTime()) / 60000))
        : 0;
      const earlyLeaveMinutes = checkOut && shiftEndDateTime
        ? Math.max(0, Math.round((shiftEndDateTime.getTime() - checkOut.getTime()) / 60000))
        : 0;

      return {
        user_id: r.user_id,
        role: r.role,
        employee_code: r.employee_code,
        full_name: r.full_name,
        phone: r.phone,
        work_date: r.work_date,
        check_in: r.check_in,
        check_out: r.check_out,
        worked_minutes: Number(r.worked_minutes || 0),
        shift_start: String(r.shift_start || DEFAULT_SHIFT_START),
        shift_end: String(r.shift_end || DEFAULT_SHIFT_END),
        late_minutes: lateMinutes,
        early_leave_minutes: earlyLeaveMinutes,
        status: r.check_in
          ? (r.check_out ? 'checked_out' : 'checked_in')
          : 'not_started'
      };
    });

    if (q) {
      attendance = attendance.filter((r) => {
        const name = String(r.full_name || '').toLowerCase();
        const code = String(r.employee_code || '').toLowerCase();
        return name.includes(q) || code.includes(q);
      });
    }

    res.json({ date, attendance });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy chấm công', error: error.message });
  }
};

exports.upsertAttendance = async (req, res) => {
  const userId = Number(req.params.id);
  const { action, date, time } = req.body || {};
  const workDate = String(date || new Date().toISOString().slice(0, 10));
  const dateTime = time || toLocalSqlDateTime(new Date());
  const actorRole = String(req.user?.role || 'staff');
  const actorId = Number(req.user?.id || req.user?.user_id || 0);

  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'user_id không hợp lệ' });
  }
  if (!['check_in', 'check_out'].includes(action)) {
    return res.status(400).json({ message: 'action phải là check_in hoặc check_out' });
  }
  if (actorRole !== 'admin' && userId !== actorId) {
    return res.status(403).json({ message: 'Bạn chỉ được chấm công cho chính mình' });
  }

  try {
    await ensureAttendanceSchema();

    const [existingRows] = await db.query(
      'SELECT check_in, check_out FROM attendance_logs WHERE user_id = ? AND work_date = ? LIMIT 1',
      [userId, workDate]
    );
    const existing = existingRows[0];

    if (action === 'check_in') {
      if (existing?.check_in) {
        return res.status(400).json({ message: 'Nhân viên đã check-in trong ngày này' });
      }
      await db.query(
        `
          INSERT INTO attendance_logs (user_id, work_date, check_in)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE check_in = VALUES(check_in)
        `,
        [userId, workDate, dateTime]
      );
    } else {
      if (!existing?.check_in) {
        return res.status(400).json({ message: 'Không thể check-out khi chưa check-in' });
      }
      if (existing?.check_out) {
        return res.status(400).json({ message: 'Nhân viên đã check-out trong ngày này' });
      }
      await db.query(
        `
          INSERT INTO attendance_logs (user_id, work_date, check_out)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE check_out = VALUES(check_out)
        `,
        [userId, workDate, dateTime]
      );
    }

    res.json({ message: 'Cập nhật chấm công thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật chấm công', error: error.message });
  }
};

exports.adjustAttendance = async (req, res) => {
  const userId = Number(req.params.id);
  const { date, check_in, check_out, reason } = req.body || {};
  const workDate = String(date || '').trim();
  const actorRole = req.user?.role;
  const actorId = Number(req.user?.id || req.user?.user_id || 0) || null;

  if (actorRole !== 'admin') {
    return res.status(403).json({ message: 'Chỉ admin được phép điều chỉnh công' });
  }
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'user_id không hợp lệ' });
  }
  if (!workDate) {
    return res.status(400).json({ message: 'Thiếu ngày công cần điều chỉnh' });
  }
  if (!reason || String(reason).trim().length < 3) {
    return res.status(400).json({ message: 'Vui lòng nhập lý do điều chỉnh (>= 3 ký tự)' });
  }

  const nextCheckIn = check_in ? toDateTime(workDate, String(check_in).slice(0, 5)) : null;
  const nextCheckOut = check_out ? toDateTime(workDate, String(check_out).slice(0, 5)) : null;

  if (nextCheckIn && nextCheckOut && new Date(nextCheckOut) < new Date(nextCheckIn)) {
    return res.status(400).json({ message: 'Giờ check-out phải lớn hơn hoặc bằng check-in' });
  }

  try {
    await ensureAttendanceSchema();

    const [beforeRows] = await db.query(
      'SELECT check_in, check_out FROM attendance_logs WHERE user_id = ? AND work_date = ? LIMIT 1',
      [userId, workDate]
    );
    const before = beforeRows[0] || { check_in: null, check_out: null };

    await db.query(
      `
        INSERT INTO attendance_logs (user_id, work_date, check_in, check_out)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          check_in = VALUES(check_in),
          check_out = VALUES(check_out)
      `,
      [userId, workDate, nextCheckIn, nextCheckOut]
    );

    await db.query(
      `
        INSERT INTO attendance_adjustments
          (user_id, work_date, old_check_in, old_check_out, new_check_in, new_check_out, reason, adjusted_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [userId, workDate, before.check_in, before.check_out, nextCheckIn, nextCheckOut, String(reason).trim(), actorId]
    );

    res.json({ message: 'Điều chỉnh công thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi điều chỉnh công', error: error.message });
  }
};

exports.updateUserShift = async (req, res) => {
  const userId = Number(req.params.id);
  const { shift_start, shift_end } = req.body || {};

  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Chỉ admin được phép cập nhật ca làm' });
  }
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'user_id không hợp lệ' });
  }
  if (!shift_start || !shift_end) {
    return res.status(400).json({ message: 'Thiếu shift_start hoặc shift_end' });
  }

  try {
    await ensureAttendanceSchema();
    await db.query(
      `
        INSERT INTO staff_shifts (user_id, shift_start, shift_end)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE
          shift_start = VALUES(shift_start),
          shift_end = VALUES(shift_end)
      `,
      [userId, shift_start, shift_end]
    );
    res.json({ message: 'Cập nhật ca làm thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật ca làm', error: error.message });
  }
};

exports.exportAttendanceCsv = async (req, res) => {
  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const month = String(req.query.month || '').trim();
  const isMonth = /^\d{4}-\d{2}$/.test(month);

  try {
    await ensureAttendanceSchema();

    let rows = [];
    if (isMonth) {
      const from = `${month}-01`;
      const to = `${month}-31`;
      const [result] = await db.query(
        `
          SELECT
            al.work_date,
            COALESCE(sp.employee_code, CONCAT('NV-', LPAD(u.user_id, 3, '0'))) AS employee_code,
            COALESCE(u.full_name, u.username) AS full_name,
            al.check_in,
            al.check_out,
            GREATEST(TIMESTAMPDIFF(MINUTE, al.check_in, al.check_out), 0) AS worked_minutes
          FROM attendance_logs al
          INNER JOIN users u ON u.user_id = al.user_id
          LEFT JOIN staff_profiles sp ON sp.user_id = u.user_id
          WHERE al.work_date BETWEEN ? AND ?
          ORDER BY al.work_date ASC, u.user_id ASC
        `,
        [from, to]
      );
      rows = result;
    } else {
      const [result] = await db.query(
        `
          SELECT
            al.work_date,
            COALESCE(sp.employee_code, CONCAT('NV-', LPAD(u.user_id, 3, '0'))) AS employee_code,
            COALESCE(u.full_name, u.username) AS full_name,
            al.check_in,
            al.check_out,
            GREATEST(TIMESTAMPDIFF(MINUTE, al.check_in, al.check_out), 0) AS worked_minutes
          FROM attendance_logs al
          INNER JOIN users u ON u.user_id = al.user_id
          LEFT JOIN staff_profiles sp ON sp.user_id = u.user_id
          WHERE al.work_date = ?
          ORDER BY u.user_id ASC
        `,
        [date]
      );
      rows = result;
    }

    const csvHeader = 'Ngay,MNV,Ho ten,Check in,Check out,Gio cong\n';
    const csvBody = rows.map((r) => {
      const values = [
        r.work_date,
        r.employee_code,
        String(r.full_name || '').replaceAll(',', ' '),
        r.check_in || '',
        r.check_out || '',
        (Number(r.worked_minutes || 0) / 60).toFixed(2)
      ];
      return values.join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${isMonth ? month : date}.csv"`);
    res.send(`\uFEFF${csvHeader}${csvBody}`);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xuất báo cáo chấm công', error: error.message });
  }
};

exports.getPayroll = async (req, res) => {
  const month = String(req.query.month || new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [yearStr, monthStr] = month.split('-');
  const y = Number(yearStr);
  const m = Number(monthStr);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return res.status(400).json({ message: 'month không hợp lệ, dùng YYYY-MM' });
  }

  const monthStart = `${yearStr}-${monthStr.padStart(2, '0')}-01`;
  const monthEnd = `${yearStr}-${monthStr.padStart(2, '0')}-31`;
  const actorRole = String(req.user?.role || 'staff');
  const actorId = Number(req.user?.id || req.user?.user_id || 0);

  try {
    const whereSelf = actorRole === 'admin' ? '' : ' AND u.user_id = ? ';
    const params = [monthStart, monthEnd];
    if (actorRole !== 'admin') params.push(actorId);

    const [rows] = await db.query(
      `
        SELECT
          u.user_id,
          COALESCE(sp.employee_code, CONCAT('NV-', LPAD(u.user_id, 3, '0'))) AS employee_code,
          COALESCE(u.full_name, u.username) AS full_name,
          COALESCE(sp.base_salary, 0) AS base_salary,
          COALESCE(sp.allowance, 0) AS allowance,
          COALESCE(sp.payment_status, 'pending') AS payment_status,
          COALESCE(SUM(
            CASE
              WHEN al.check_in IS NOT NULL AND al.check_out IS NOT NULL
              THEN GREATEST(TIMESTAMPDIFF(MINUTE, al.check_in, al.check_out), 0)
              ELSE 0
            END
          ), 0) AS worked_minutes
        FROM users u
        LEFT JOIN staff_profiles sp ON sp.user_id = u.user_id
        LEFT JOIN attendance_logs al
          ON al.user_id = u.user_id
         AND al.work_date BETWEEN ? AND ?
        WHERE u.role IN ('admin', 'staff')
        ${whereSelf}
        GROUP BY u.user_id
        ORDER BY u.user_id ASC
      `,
      params
    );

    const payrollRows = rows.map((r) => {
      const baseSalary = Number(r.base_salary || 0);
      const allowance = Number(r.allowance || 0);
      const workedMinutes = Number(r.worked_minutes || 0);
      const workDays = Math.round((workedMinutes / 60 / 8) * 10) / 10;
      const bonus = Math.round(Math.max(0, workDays - 22) * 100000);
      const deduction = Math.round(Math.max(0, 22 - workDays) * 80000);
      const total = Math.max(0, Math.round(baseSalary + allowance + bonus - deduction));
      const paymentStatus = r.payment_status === 'paid' ? 'paid' : 'pending';
      return {
        user_id: r.user_id,
        employee_code: r.employee_code,
        full_name: r.full_name,
        base_salary: baseSalary,
        work_days: workDays,
        allowance,
        bonus,
        deduction,
        total_salary: total,
        payment_status: paymentStatus
      };
    });

    const totalFund = payrollRows.reduce((s, x) => s + x.total_salary, 0);
    const paidFund = payrollRows.filter((x) => x.payment_status === 'paid').reduce((s, x) => s + x.total_salary, 0);
    const pendingFund = totalFund - paidFund;

    res.json({
      month,
      payroll: payrollRows,
      summary: {
        totalFund,
        paidFund,
        pendingFund,
        totalStaff: payrollRows.length
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy bảng lương', error: error.message });
  }
};

exports.updateUserProfile = async (req, res) => {
  const userId = Number(req.params.id);
  const { full_name, role, phone, base_salary, allowance } = req.body || {};

  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'user_id không hợp lệ' });
  }
  if (role !== undefined && !['admin', 'staff'].includes(role)) {
    return res.status(400).json({ message: 'role không hợp lệ' });
  }

  try {
    const [exist] = await db.query('SELECT user_id FROM users WHERE user_id = ?', [userId]);
    if (!exist.length) return res.status(404).json({ message: 'Không tìm thấy user' });

    if (full_name !== undefined || role !== undefined) {
      await db.query(
        `UPDATE users
         SET full_name = COALESCE(?, full_name),
             role = COALESCE(?, role)
         WHERE user_id = ?`,
        [full_name ?? null, role ?? null, userId]
      );
    }

    await db.query(
      `INSERT INTO staff_profiles (user_id, employee_code, phone, base_salary, allowance)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         phone = COALESCE(VALUES(phone), phone),
         base_salary = COALESCE(VALUES(base_salary), base_salary),
         allowance = COALESCE(VALUES(allowance), allowance)`,
      [
        userId,
        `NV-${String(userId).padStart(3, '0')}`,
        phone ?? null,
        base_salary !== undefined ? Number(base_salary || 0) : null,
        allowance !== undefined ? Number(allowance || 0) : null
      ]
    );

    res.json({ message: 'Cập nhật hồ sơ nhân viên thành công', user_id: userId });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật hồ sơ nhân viên', error: error.message });
  }
};

exports.resetUserPassword = async (req, res) => {
  const userId = Number(req.params.id);
  const { new_password } = req.body || {};

  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'user_id không hợp lệ' });
  }
  if (!new_password || String(new_password).length < 6) {
    return res.status(400).json({ message: 'Mật khẩu mới tối thiểu 6 ký tự' });
  }

  try {
    const hashed = await bcrypt.hash(String(new_password), 10);
    const [result] = await db.query('UPDATE users SET password = ? WHERE user_id = ?', [hashed, userId]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy user' });
    res.json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi đặt lại mật khẩu', error: error.message });
  }
};

exports.updatePayrollPaymentStatus = async (req, res) => {
  const userId = Number(req.params.id);
  const paymentStatus = req.body?.payment_status;

  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'user_id không hợp lệ' });
  }
  if (!['paid', 'pending'].includes(paymentStatus)) {
    return res.status(400).json({ message: 'payment_status phải là paid hoặc pending' });
  }

  try {
    await db.query(
      `INSERT INTO staff_profiles (user_id, employee_code, payment_status)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE payment_status = VALUES(payment_status)`,
      [userId, `NV-${String(userId).padStart(3, '0')}`, paymentStatus]
    );
    res.json({ message: 'Cập nhật trạng thái lương thành công', user_id: userId, payment_status: paymentStatus });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật trạng thái lương', error: error.message });
  }
};

exports.getUserMonthlyDetail = async (req, res) => {
  const userId = Number(req.params.id);
  const month = String(req.query.month || new Date().toISOString().slice(0, 7));
  const actorRole = String(req.user?.role || 'staff');
  const actorId = Number(req.user?.id || req.user?.user_id || 0);

  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'user_id không hợp lệ' });
  }
  if (actorRole !== 'admin' && userId !== actorId) {
    return res.status(403).json({ message: 'Bạn chỉ được xem chi tiết lương của chính mình' });
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ message: 'month không hợp lệ, dùng YYYY-MM' });
  }

  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;

  try {
    await ensureAttendanceSchema();

    const [[staffInfo]] = await db.query(
      `
        SELECT
          u.user_id,
          u.username,
          u.full_name,
          u.role,
          COALESCE(sp.employee_code, CONCAT('NV-', LPAD(u.user_id, 3, '0'))) AS employee_code,
          COALESCE(sp.base_salary, 0) AS base_salary,
          COALESCE(sp.allowance, 0) AS allowance,
          COALESCE(sp.payment_status, 'pending') AS payment_status,
          COALESCE(ss.shift_start, ?) AS shift_start,
          COALESCE(ss.shift_end, ?) AS shift_end
        FROM users u
        LEFT JOIN staff_profiles sp ON sp.user_id = u.user_id
        LEFT JOIN staff_shifts ss ON ss.user_id = u.user_id
        WHERE u.user_id = ?
        LIMIT 1
      `,
      [DEFAULT_SHIFT_START, DEFAULT_SHIFT_END, userId]
    );

    if (!staffInfo) {
      return res.status(404).json({ message: 'Không tìm thấy nhân viên' });
    }

    const [attendanceRows] = await db.query(
      `
        SELECT
          al.work_date,
          al.check_in,
          al.check_out,
          GREATEST(TIMESTAMPDIFF(MINUTE, al.check_in, al.check_out), 0) AS worked_minutes
        FROM attendance_logs al
        WHERE al.user_id = ?
          AND al.work_date BETWEEN ? AND ?
        ORDER BY al.work_date ASC
      `,
      [userId, monthStart, monthEnd]
    );

    const attendance = attendanceRows.map((r) => {
      const shiftStartDateTime = new Date(`${r.work_date}T${String(staffInfo.shift_start || DEFAULT_SHIFT_START)}`);
      const shiftEndDateTime = new Date(`${r.work_date}T${String(staffInfo.shift_end || DEFAULT_SHIFT_END)}`);
      const checkIn = r.check_in ? new Date(r.check_in) : null;
      const checkOut = r.check_out ? new Date(r.check_out) : null;

      const lateMinutes = checkIn
        ? Math.max(0, Math.round((checkIn.getTime() - shiftStartDateTime.getTime()) / 60000))
        : 0;
      const earlyLeaveMinutes = checkOut
        ? Math.max(0, Math.round((shiftEndDateTime.getTime() - checkOut.getTime()) / 60000))
        : 0;

      return {
        work_date: r.work_date,
        check_in: r.check_in,
        check_out: r.check_out,
        worked_minutes: Number(r.worked_minutes || 0),
        late_minutes: lateMinutes,
        early_leave_minutes: earlyLeaveMinutes
      };
    });

    const workedMinutes = attendance.reduce((s, x) => s + Number(x.worked_minutes || 0), 0);
    const workDays = Math.round((workedMinutes / 60 / 8) * 10) / 10;
    const baseSalary = Number(staffInfo.base_salary || 0);
    const allowance = Number(staffInfo.allowance || 0);
    const bonus = Math.round(Math.max(0, workDays - 22) * 100000);
    const deduction = Math.round(Math.max(0, 22 - workDays) * 80000);
    const totalSalary = Math.max(0, Math.round(baseSalary + allowance + bonus - deduction));

    return res.json({
      month,
      staff: {
        user_id: staffInfo.user_id,
        employee_code: staffInfo.employee_code,
        full_name: staffInfo.full_name || staffInfo.username,
        role: staffInfo.role,
        shift_start: String(staffInfo.shift_start || DEFAULT_SHIFT_START),
        shift_end: String(staffInfo.shift_end || DEFAULT_SHIFT_END)
      },
      attendance,
      payroll: {
        base_salary: baseSalary,
        allowance,
        bonus,
        deduction,
        work_days: workDays,
        total_salary: totalSalary,
        payment_status: staffInfo.payment_status === 'paid' ? 'paid' : 'pending'
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi lấy chi tiết nhân viên theo tháng', error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'user_id không hợp lệ' });
  }

  try {
    const [exist] = await db.query('SELECT user_id, role FROM users WHERE user_id = ?', [userId]);
    if (!exist.length) return res.status(404).json({ message: 'Không tìm thấy nhân viên' });

    const [ordersCountRows] = await db.query('SELECT COUNT(*) AS total FROM orders WHERE user_id = ?', [userId]);
    const ordersCount = Number(ordersCountRows?.[0]?.total || 0);
    if (ordersCount > 0) {
      return res.status(400).json({ message: 'Nhân viên đã có đơn hàng, không thể xóa. Hãy khóa tài khoản thay thế.' });
    }

    await db.query('DELETE FROM attendance_logs WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM staff_profiles WHERE user_id = ?', [userId]);
    await db.query('DELETE FROM users WHERE user_id = ?', [userId]);

    res.json({ message: 'Xóa nhân viên thành công', user_id: userId });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa nhân viên', error: error.message });
  }
};

