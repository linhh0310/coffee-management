const db = require('../config/db');

function deriveStatus(startDate, endDate, enabled) {
  if (!enabled) return 'inactive';
  const today = new Date();
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (today < s) return 'upcoming';
  if (today > e) return 'ended';
  return 'running';
}

exports.getPromotions = async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
  const offset = (page - 1) * limit;
  const q = String(req.query.q || '').trim();
  const type = String(req.query.type || '').trim();
  const life = String(req.query.life || '').trim(); // running|upcoming|ended

  try {
    const where = [];
    const params = [];
    if (q) {
      where.push('(promo_code LIKE ? OR promo_name LIKE ?)');
      const key = `%${q}%`;
      params.push(key, key);
    }
    if (type && ['percent', 'bogo', 'fixed'].includes(type)) {
      where.push('promo_type = ?');
      params.push(type);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.query(`SELECT COUNT(*) AS totalItems FROM promotions ${whereSql}`, params);
    const [rows] = await db.query(
      `
        SELECT promotion_id, promo_code, promo_name, promo_type, description, discount_value, budget, start_date, end_date, status, created_at
        FROM promotions
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    let mapped = rows.map((r) => {
      const lifecycle = deriveStatus(r.start_date, r.end_date, Number(r.status) === 1);
      return {
        promotion_id: r.promotion_id,
        promo_code: r.promo_code,
        promo_name: r.promo_name,
        promo_type: r.promo_type,
        description: r.description,
        discount_value: Number(r.discount_value || 0),
        budget: Number(r.budget || 0),
        start_date: r.start_date,
        end_date: r.end_date,
        status: Number(r.status || 0),
        lifecycle
      };
    });

    if (life && ['running', 'upcoming', 'ended'].includes(life)) {
      mapped = mapped.filter((x) => x.lifecycle === life);
    }

    const today = new Date();
    const [summaryRows] = await db.query(
      `
        SELECT
          SUM(CASE WHEN status = 1 AND start_date <= CURDATE() AND end_date >= CURDATE() THEN 1 ELSE 0 END) AS runningCount,
          SUM(CASE WHEN status = 1 AND start_date > CURDATE() THEN 1 ELSE 0 END) AS upcomingCount,
          SUM(CASE WHEN end_date < CURDATE() THEN 1 ELSE 0 END) AS endedCount,
          COALESCE(SUM(CASE WHEN MONTH(start_date) = MONTH(CURDATE()) AND YEAR(start_date) = YEAR(CURDATE()) THEN budget ELSE 0 END), 0) AS monthlyBudget
        FROM promotions
      `
    );

    const totalItems = Number(countRows[0]?.totalItems || 0);
    res.json({
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      promotions: mapped,
      summary: {
        runningCount: Number(summaryRows[0]?.runningCount || 0),
        upcomingCount: Number(summaryRows[0]?.upcomingCount || 0),
        endedCount: Number(summaryRows[0]?.endedCount || 0),
        monthlyBudget: Number(summaryRows[0]?.monthlyBudget || 0)
      },
      today: today.toISOString().slice(0, 10)
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách khuyến mãi', error: error.message });
  }
};

exports.createPromotion = async (req, res) => {
  const {
    promo_code,
    promo_name,
    promo_type = 'percent',
    description = null,
    discount_value = 0,
    budget = 0,
    start_date,
    end_date
  } = req.body || {};

  if (!promo_code || !promo_name || !start_date || !end_date) {
    return res.status(400).json({ message: 'Thiếu dữ liệu bắt buộc' });
  }
  if (!['percent', 'bogo', 'fixed'].includes(promo_type)) {
    return res.status(400).json({ message: 'promo_type không hợp lệ' });
  }

  try {
    const [exist] = await db.query('SELECT promotion_id FROM promotions WHERE promo_code = ?', [promo_code]);
    if (exist.length) return res.status(400).json({ message: 'Mã khuyến mãi đã tồn tại' });

    const [result] = await db.query(
      `
        INSERT INTO promotions (promo_code, promo_name, promo_type, description, discount_value, budget, start_date, end_date, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [promo_code, promo_name, promo_type, description, Number(discount_value || 0), Number(budget || 0), start_date, end_date]
    );
    res.status(201).json({ message: 'Tạo khuyến mãi thành công', promotion_id: result.insertId });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo khuyến mãi', error: error.message });
  }
};

exports.updatePromotionStatus = async (req, res) => {
  const id = Number(req.params.id);
  const status = Number(req.body?.status);
  if (!Number.isFinite(id) || ![0, 1].includes(status)) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
  }
  try {
    const [result] = await db.query('UPDATE promotions SET status = ? WHERE promotion_id = ?', [status, id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy khuyến mãi' });
    res.json({ message: 'Cập nhật trạng thái thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật trạng thái', error: error.message });
  }
};

exports.updatePromotion = async (req, res) => {
  const id = Number(req.params.id);
  const {
    promo_name,
    promo_type,
    description,
    discount_value,
    budget,
    start_date,
    end_date
  } = req.body || {};

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: 'ID khuyến mãi không hợp lệ' });
  }
  if (promo_type !== undefined && !['percent', 'bogo', 'fixed'].includes(promo_type)) {
    return res.status(400).json({ message: 'promo_type không hợp lệ' });
  }

  try {
    const [exist] = await db.query('SELECT promotion_id FROM promotions WHERE promotion_id = ?', [id]);
    if (!exist.length) return res.status(404).json({ message: 'Không tìm thấy khuyến mãi' });

    await db.query(
      `
        UPDATE promotions
        SET promo_name = COALESCE(?, promo_name),
            promo_type = COALESCE(?, promo_type),
            description = ?,
            discount_value = COALESCE(?, discount_value),
            budget = COALESCE(?, budget),
            start_date = COALESCE(?, start_date),
            end_date = COALESCE(?, end_date)
        WHERE promotion_id = ?
      `,
      [
        promo_name ?? null,
        promo_type ?? null,
        description ?? null,
        discount_value !== undefined ? Number(discount_value || 0) : null,
        budget !== undefined ? Number(budget || 0) : null,
        start_date ?? null,
        end_date ?? null,
        id
      ]
    );

    res.json({ message: 'Cập nhật khuyến mãi thành công', promotion_id: id });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật khuyến mãi', error: error.message });
  }
};

exports.deletePromotion = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: 'ID khuyến mãi không hợp lệ' });
  }
  try {
    const [result] = await db.query('DELETE FROM promotions WHERE promotion_id = ?', [id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy khuyến mãi' });
    res.json({ message: 'Xóa khuyến mãi thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa khuyến mãi', error: error.message });
  }
};

