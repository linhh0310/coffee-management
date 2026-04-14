const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

function calcTier(points) {
  const p = Number(points || 0);
  if (p >= 5000) return 'platinum';
  if (p >= 2000) return 'gold';
  if (p >= 800) return 'silver';
  return 'bronze';
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

let authColumnsEnsured = false;
const resetOtpStore = new Map();

async function ensureCustomerAuthColumns() {
  if (authColumnsEnsured) return;

  const [cols] = await db.query(
    `
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'customers'
        AND COLUMN_NAME = 'password'
      LIMIT 1
    `
  );

  if (!cols.length) {
    await db.query('ALTER TABLE customers ADD COLUMN password VARCHAR(255) NULL');
  }

  authColumnsEnsured = true;
}

function maskPhone(phone) {
  const p = String(phone || '');
  if (p.length < 4) return '****';
  return `${'*'.repeat(Math.max(0, p.length - 4))}${p.slice(-4)}`;
}

function buildOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

exports.registerCustomer = async (req, res) => {
  const { full_name, phone, email = null, password } = req.body || {};
  const normalizedPhone = normalizePhone(phone);

  if (!String(full_name || '').trim()) return res.status(400).json({ message: 'Vui lòng nhập họ và tên' });
  if (!normalizedPhone || normalizedPhone.length < 9) return res.status(400).json({ message: 'Số điện thoại không hợp lệ' });
  if (!String(password || '').trim() || String(password).length < 6) return res.status(400).json({ message: 'Mật khẩu tối thiểu 6 ký tự' });

  try {
    await ensureCustomerAuthColumns();

    const [existPhone] = await db.query(
      "SELECT customer_id FROM customers WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '.', ''), '-', '') = ? LIMIT 1",
      [normalizedPhone]
    );
    if (existPhone.length) return res.status(400).json({ message: 'Số điện thoại đã tồn tại' });

    if (email) {
      const [existEmail] = await db.query('SELECT customer_id FROM customers WHERE email = ? LIMIT 1', [String(email).trim()]);
      if (existEmail.length) return res.status(400).json({ message: 'Email đã tồn tại' });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);

    const [result] = await db.query(
      'INSERT INTO customers (full_name, phone, email, password, points, total_spent, tier, status) VALUES (?, ?, ?, ?, 0, 0, "bronze", 1)',
      [String(full_name).trim(), normalizedPhone, email ? String(email).trim() : null, hashedPassword]
    );

    const token = jwt.sign(
      { id: result.insertId, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Đăng ký tài khoản khách hàng thành công',
      token,
      customer: {
        customer_id: result.insertId,
        full_name: String(full_name).trim(),
        phone: normalizedPhone,
        email: email ? String(email).trim() : null,
        points: 0,
        tier: 'bronze'
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi đăng ký khách hàng', error: error.message });
  }
};

exports.loginCustomer = async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if ((!phone && !email) || !password) {
    return res.status(400).json({ message: 'Thiếu số điện thoại/email hoặc mật khẩu' });
  }

  try {
    await ensureCustomerAuthColumns();

    const [rows] = email
      ? await db.query(
          `
          SELECT customer_id, full_name, phone, email, password, points, tier, status
          FROM customers
          WHERE LOWER(COALESCE(email, '')) = ?
          LIMIT 1
          `,
          [email]
        )
      : await db.query(
          `
          SELECT customer_id, full_name, phone, email, password, points, tier, status
          FROM customers
          WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '.', ''), '-', '') = ?
          LIMIT 1
          `,
          [phone]
        );

    if (!rows.length) return res.status(401).json({ message: 'Tài khoản không tồn tại' });

    const customer = rows[0];
    if (Number(customer.status) !== 1) return res.status(403).json({ message: 'Tài khoản đang tạm khóa' });
    if (!customer.password) return res.status(400).json({ message: 'Tài khoản chưa thiết lập mật khẩu. Vui lòng đăng ký lại.' });

    const isMatch = await bcrypt.compare(password, customer.password);
    if (!isMatch) return res.status(401).json({ message: 'Mật khẩu không chính xác' });

    const token = jwt.sign(
      { id: customer.customer_id, role: 'customer' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Đăng nhập khách hàng thành công',
      token,
      customer: {
        customer_id: customer.customer_id,
        full_name: customer.full_name,
        phone: customer.phone,
        email: customer.email,
        points: Number(customer.points || 0),
        tier: customer.tier || calcTier(customer.points)
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi đăng nhập khách hàng', error: error.message });
  }
};

exports.getMyCustomerProfile = async (req, res) => {
  try {
    const [rows] = await db.query(
      `
      SELECT customer_id, full_name, phone, email, points, total_spent, tier, status, updated_at
      FROM customers
      WHERE customer_id = ?
      LIMIT 1
      `,
      [Number(req.user.id)]
    );

    if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy tài khoản khách hàng' });
    const customer = rows[0];

    if (Number(customer.status) !== 1) {
      return res.status(403).json({ message: 'Tài khoản thành viên đang tạm khóa' });
    }

    return res.json({
      customer: {
        customer_id: customer.customer_id,
        full_name: customer.full_name,
        phone: customer.phone,
        email: customer.email,
        points: Number(customer.points || 0),
        total_spent: Number(customer.total_spent || 0),
        tier: customer.tier || calcTier(customer.points),
        updated_at: customer.updated_at
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi lấy thông tin tài khoản', error: error.message });
  }
};

exports.updateMyCustomerProfile = async (req, res) => {
  const customerId = Number(req.user?.id);
  const fullName = String(req.body?.full_name || '').trim();
  const emailRaw = String(req.body?.email || '').trim();
  const birthDate = String(req.body?.birth_date || '').trim();

  if (!customerId) return res.status(401).json({ message: 'Token không hợp lệ' });
  if (!fullName) return res.status(400).json({ message: 'Họ tên là bắt buộc' });

  const email = emailRaw || null;
  const normalizedBirthDate = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? birthDate : null;

  try {
    await db.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS birth_date DATE NULL');
  } catch (_err) {
    // ignore if DB does not support IF NOT EXISTS or column already exists
  }

  try {
    if (email) {
      const [dupEmail] = await db.query(
        'SELECT customer_id FROM customers WHERE email = ? AND customer_id <> ? LIMIT 1',
        [email, customerId]
      );
      if (dupEmail.length) return res.status(400).json({ message: 'Email đã được sử dụng bởi tài khoản khác' });
    }

    await db.query(
      `UPDATE customers
       SET full_name = ?, email = ?, birth_date = COALESCE(?, birth_date)
       WHERE customer_id = ?`,
      [fullName, email, normalizedBirthDate, customerId]
    );

    const [rows] = await db.query(
      `SELECT customer_id, full_name, phone, email, birth_date, points, total_spent, tier, updated_at
       FROM customers
       WHERE customer_id = ?
       LIMIT 1`,
      [customerId]
    );

    return res.json({
      message: 'Cập nhật hồ sơ thành công',
      customer: rows[0] || null
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi cập nhật hồ sơ', error: error.message });
  }
};

exports.changeMyPassword = async (req, res) => {
  const customerId = Number(req.user?.id);
  const oldPassword = String(req.body?.old_password || '');
  const newPassword = String(req.body?.new_password || '');

  if (!customerId || !oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Thiếu dữ liệu đổi mật khẩu' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Mật khẩu mới tối thiểu 6 ký tự' });
  }

  try {
    await ensureCustomerAuthColumns();
    const [rows] = await db.query('SELECT password FROM customers WHERE customer_id = ? LIMIT 1', [customerId]);
    if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy tài khoản khách hàng' });
    if (!rows[0].password) return res.status(400).json({ message: 'Tài khoản chưa có mật khẩu, vui lòng đặt lại mật khẩu' });

    const isMatch = await bcrypt.compare(oldPassword, rows[0].password);
    if (!isMatch) return res.status(401).json({ message: 'Mật khẩu hiện tại không chính xác' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE customers SET password = ? WHERE customer_id = ?', [hashed, customerId]);
    return res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi đổi mật khẩu', error: error.message });
  }
};

exports.requestResetOtp = async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!phone || phone.length < 9) return res.status(400).json({ message: 'Số điện thoại không hợp lệ' });

  try {
    await ensureCustomerAuthColumns();
    const [rows] = await db.query(
      "SELECT customer_id, phone, status FROM customers WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '.', ''), '-', '') = ? LIMIT 1",
      [phone]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản với số điện thoại này' });
    }

    const customer = rows[0];
    if (Number(customer.status) !== 1) {
      return res.status(403).json({ message: 'Tài khoản đang tạm khóa' });
    }

    const otpCode = buildOtp();
    const expiresAt = Date.now() + 5 * 60 * 1000;
    resetOtpStore.set(phone, { otpCode, expiresAt, customerId: customer.customer_id, verified: false });

    return res.json({
      message: `Mã OTP đã được gửi tới SĐT ${maskPhone(customer.phone)} (dev mode)`,
      otp_debug: otpCode,
      expires_in_seconds: 300
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi gửi OTP', error: error.message });
  }
};

exports.verifyResetOtp = async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const otp = String(req.body?.otp || '').trim();

  if (!phone || !otp) return res.status(400).json({ message: 'Thiếu số điện thoại hoặc OTP' });

  const item = resetOtpStore.get(phone);
  if (!item) return res.status(400).json({ message: 'OTP không tồn tại hoặc đã hết hạn' });
  if (Date.now() > Number(item.expiresAt || 0)) {
    resetOtpStore.delete(phone);
    return res.status(400).json({ message: 'OTP đã hết hạn' });
  }
  if (otp !== item.otpCode) return res.status(400).json({ message: 'OTP không chính xác' });

  item.verified = true;
  resetOtpStore.set(phone, item);

  return res.json({ message: 'Xác thực OTP thành công' });
};

exports.resetPasswordByOtp = async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const newPassword = String(req.body?.new_password || '');

  if (!phone || !newPassword) return res.status(400).json({ message: 'Thiếu dữ liệu đặt lại mật khẩu' });
  if (newPassword.length < 6) return res.status(400).json({ message: 'Mật khẩu mới tối thiểu 6 ký tự' });

  const item = resetOtpStore.get(phone);
  if (!item || !item.verified) return res.status(400).json({ message: 'OTP chưa được xác thực' });
  if (Date.now() > Number(item.expiresAt || 0)) {
    resetOtpStore.delete(phone);
    return res.status(400).json({ message: 'OTP đã hết hạn' });
  }

  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE customers SET password = ? WHERE customer_id = ?', [hashed, item.customerId]);
    resetOtpStore.delete(phone);
    return res.json({ message: 'Đặt lại mật khẩu thành công' });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi đặt lại mật khẩu', error: error.message });
  }
};

exports.getCustomers = async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
  const offset = (page - 1) * limit;
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || '').trim();
  const tier = String(req.query.tier || '').trim();

  try {
    const where = [];
    const params = [];
    if (q) {
      where.push('(full_name LIKE ? OR phone LIKE ? OR COALESCE(email, "") LIKE ?)');
      const key = `%${q}%`;
      params.push(key, key, key);
    }
    if (status !== '' && ['0', '1'].includes(status)) {
      where.push('status = ?');
      params.push(Number(status));
    }
    if (tier && ['bronze', 'silver', 'gold', 'platinum'].includes(tier)) {
      where.push('tier = ?');
      params.push(tier);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.query(`SELECT COUNT(*) AS totalItems FROM customers ${whereSql}`, params);
    const [rows] = await db.query(
      `
        SELECT customer_id, full_name, phone, email, points, total_spent, tier, status, created_at, updated_at
        FROM customers
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [summaryRows] = await db.query(
      `
        SELECT
          COUNT(*) AS totalCustomers,
          SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS activeCustomers,
          SUM(CASE WHEN tier IN ('gold', 'platinum') THEN 1 ELSE 0 END) AS vipCustomers,
          COALESCE(SUM(points), 0) AS totalPoints
        FROM customers
      `
    );

    const totalItems = Number(countRows[0]?.totalItems || 0);
    res.json({
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      customers: rows.map((r) => ({
        customer_id: r.customer_id,
        full_name: r.full_name,
        phone: r.phone,
        email: r.email,
        points: Number(r.points || 0),
        total_spent: Number(r.total_spent || 0),
        tier: r.tier,
        status: Number(r.status || 0),
        created_at: r.created_at,
        updated_at: r.updated_at
      })),
      summary: {
        totalCustomers: Number(summaryRows[0]?.totalCustomers || 0),
        activeCustomers: Number(summaryRows[0]?.activeCustomers || 0),
        vipCustomers: Number(summaryRows[0]?.vipCustomers || 0),
        totalPoints: Number(summaryRows[0]?.totalPoints || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách khách hàng', error: error.message });
  }
};

exports.createCustomer = async (req, res) => {
  const { full_name, phone, email = null } = req.body || {};
  if (!full_name || !phone) return res.status(400).json({ message: 'Thiếu full_name/phone' });
  try {
    const [exist] = await db.query('SELECT customer_id FROM customers WHERE phone = ?', [phone]);
    if (exist.length) return res.status(400).json({ message: 'Số điện thoại đã tồn tại' });
    const [result] = await db.query(
      'INSERT INTO customers (full_name, phone, email, points, total_spent, tier, status) VALUES (?, ?, ?, 0, 0, "bronze", 1)',
      [full_name, phone, email]
    );
    res.status(201).json({ message: 'Tạo khách hàng thành công', customer_id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo khách hàng', error: error.message });
  }
};

exports.updateCustomerStatus = async (req, res) => {
  const id = Number(req.params.id);
  const nextStatus = Number(req.body?.status);
  if (!Number.isFinite(id) || ![0, 1].includes(nextStatus)) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
  }
  try {
    const [result] = await db.query('UPDATE customers SET status = ? WHERE customer_id = ?', [nextStatus, id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    res.json({ message: 'Cập nhật trạng thái thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật trạng thái', error: error.message });
  }
};

exports.adjustPoints = async (req, res) => {
  const id = Number(req.params.id);
  const delta = Number(req.body?.delta_points);
  if (!Number.isFinite(id) || !Number.isFinite(delta)) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
  }
  try {
    const [rows] = await db.query('SELECT points FROM customers WHERE customer_id = ?', [id]);
    if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy khách hàng' });
    const nextPoints = Math.max(0, Number(rows[0].points || 0) + delta);
    const nextTier = calcTier(nextPoints);
    await db.query('UPDATE customers SET points = ?, tier = ? WHERE customer_id = ?', [nextPoints, nextTier, id]);
    res.json({ message: 'Cập nhật điểm thành công', points: nextPoints, tier: nextTier });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật điểm', error: error.message });
  }
};

exports.lookupCustomerPoints = async (req, res) => {
  const phoneRaw = String(req.query.phone || '').trim();
  const phone = normalizePhone(phoneRaw);

  if (!phone || phone.length < 8) {
    return res.status(400).json({ message: 'Số điện thoại không hợp lệ' });
  }

  try {
    const [rows] = await db.query(
      `
        SELECT customer_id, full_name, phone, points, tier, status, total_spent, updated_at
        FROM customers
        WHERE REPLACE(REPLACE(REPLACE(phone, ' ', ''), '.', ''), '-', '') = ?
        LIMIT 1
      `,
      [phone]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản thành viên' });
    }

    const customer = rows[0];

    if (Number(customer.status) !== 1) {
      return res.status(403).json({ message: 'Tài khoản thành viên đang tạm khóa' });
    }

    return res.json({
      customer: {
        customer_id: customer.customer_id,
        full_name: customer.full_name,
        phone: customer.phone,
        points: Number(customer.points || 0),
        tier: customer.tier || calcTier(customer.points),
        total_spent: Number(customer.total_spent || 0),
        updated_at: customer.updated_at
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi tra cứu điểm khách hàng', error: error.message });
  }
};

exports.getMyTransactions = async (req, res) => {
  const customerId = Number(req.user?.id);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));

  if (!customerId) return res.status(401).json({ message: 'Token không hợp lệ' });

  try {
    const [rows] = await db.query(
      `
      SELECT
        o.order_id,
        o.created_at,
        o.final_amount,
        o.status,
        o.order_type,
        o.customer_id,
        COALESCE(t.table_number, 'Mang về') AS table_number
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.table_id
      WHERE o.customer_id = ?
      ORDER BY o.created_at DESC
      LIMIT ?
      `,
      [customerId, limit]
    );

    const orderIds = rows.map((r) => Number(r.order_id)).filter(Boolean);
    let itemRows = [];
    if (orderIds.length) {
      const [items] = await db.query(
        `
        SELECT oi.order_id, oi.quantity, p.product_name
        FROM order_items oi
        JOIN products p ON p.product_id = oi.product_id
        WHERE oi.order_id IN (?)
        ORDER BY oi.order_id DESC
        `,
        [orderIds]
      );
      itemRows = items || [];
    }

    const itemMap = new Map();
    itemRows.forEach((it) => {
      const key = Number(it.order_id);
      if (!itemMap.has(key)) itemMap.set(key, []);
      itemMap.get(key).push(`${Number(it.quantity || 0)}x ${it.product_name}`);
    });

    const transactions = rows.map((r) => ({
      id: `POS-${String(r.order_id).padStart(8, '0')}`,
      date: r.created_at,
      store: r.order_type === 'take_away' ? 'Mang về' : `Bàn ${r.table_number}`,
      total: Number(r.final_amount || 0),
      points: Math.floor(Number(r.final_amount || 0) / 10000),
      status: r.status,
      items: itemMap.get(Number(r.order_id)) || []
    }));

    return res.json({ transactions });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi lấy lịch sử giao dịch', error: error.message });
  }
};

exports.getMyVouchers = async (req, res) => {
  const customerId = Number(req.user?.id);
  if (!customerId) return res.status(401).json({ message: 'Token không hợp lệ' });

  try {
    const [customerRows] = await db.query(
      'SELECT points, tier FROM customers WHERE customer_id = ? LIMIT 1',
      [customerId]
    );

    if (!customerRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản khách hàng' });
    }

    const points = Number(customerRows[0].points || 0);
    const tier = String(customerRows[0].tier || calcTier(points));

    const [promoRows] = await db.query(
      `
      SELECT promo_code, promo_name, promo_type, discount_value, start_date, end_date, status
      FROM promotions
      WHERE status = 1
      ORDER BY end_date ASC
      LIMIT 20
      `
    );

    const now = new Date();
    const vouchers = (promoRows || []).map((p) => {
      const start = new Date(p.start_date);
      const end = new Date(p.end_date);
      const status = now < start ? 'upcoming' : now > end ? 'expired' : 'active';
      const baseCondition = 'Áp dụng tại quầy, không áp dụng đặt hàng online';
      const tierCondition = tier === 'gold' || tier === 'platinum' ? 'Ưu tiên cho hạng thành viên cao' : 'Áp dụng theo điều kiện chương trình';

      return {
        code: p.promo_code,
        title: p.promo_name,
        status,
        condition: `${baseCondition}. ${tierCondition}.`,
        expiry: end.toLocaleDateString('vi-VN'),
        discount_value: Number(p.discount_value || 0),
        promo_type: p.promo_type
      };
    });

    return res.json({
      points,
      tier,
      vouchers
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi lấy voucher', error: error.message });
  }
};
