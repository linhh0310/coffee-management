const db = require('../config/db');

const TAX_RATE = 0.1;
const LOYALTY_POINT_DIVISOR = 10000; // 1 điểm / 10.000đ thanh toán

let orderCustomerColumnEnsured = false;
let orderHasCustomerColumn = false;

async function ensureOrderCustomerColumn(connLike = db) {
  if (orderCustomerColumnEnsured) return orderHasCustomerColumn;

  try {
    const [existsRows] = await connLike.query(
      `
      SELECT COUNT(*) AS cnt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'orders'
        AND COLUMN_NAME = 'customer_id'
      `
    );

    if (Number(existsRows?.[0]?.cnt || 0) > 0) {
      orderHasCustomerColumn = true;
      orderCustomerColumnEnsured = true;
      return true;
    }

    try {
      await connLike.query('ALTER TABLE orders ADD COLUMN customer_id INT NULL');
    } catch (_alterErr) {
      // ignore, will re-check below
    }

    const [recheckRows] = await connLike.query(
      `
      SELECT COUNT(*) AS cnt
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'orders'
        AND COLUMN_NAME = 'customer_id'
      `
    );

    orderHasCustomerColumn = Number(recheckRows?.[0]?.cnt || 0) > 0;
  } catch (_err) {
    orderHasCustomerColumn = false;
  }

  orderCustomerColumnEnsured = true;
  return orderHasCustomerColumn;
}

// API thống kê hàng ngày
const getDailyStats = async (req, res) => {
  try {
    // Tính doanh thu hôm nay
    const queryToday = `
      SELECT
        SUM(final_amount) as revenueToday,
        COUNT(*) as ordersToday
      FROM orders
      WHERE DATE(created_at) = CURDATE()
      AND status = 'paid'
    `;

    // Đếm sản phẩm sắp hết (stock_quantity < min_stock_alert)
    const queryStock = `SELECT COUNT(*) as lowStock FROM ingredients WHERE stock_quantity < min_stock_alert`;

    const [todayStats] = await db.query(queryToday);
    const [stockStats] = await db.query(queryStock);

    res.json({
      revenueToday: todayStats[0].revenueToday || 0,
      ordersToday: todayStats[0].ordersToday || 0,
      lowStock: stockStats[0].lowStock || 0
    });

  } catch (error) {
    console.error('Lỗi khi lấy thống kê hàng ngày:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

// API đơn hàng gần đây
const getRecentOrders = async (req, res) => {
  try {
    const query = `
      SELECT
        o.order_id as id,
        CONCAT('#ORD-', LPAD(o.order_id, 4, '0')) as orderId,
        COALESCE(t.table_number, 'Giao hàng') as table_number,
        o.final_amount as total,
        o.status as status,
        o.created_at as createdAt
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.table_id
      ORDER BY o.created_at DESC
      LIMIT 10
    `;

    const [orders] = await db.query(query);

    // Lấy chi tiết sản phẩm cho mỗi đơn hàng
    const formattedOrders = await Promise.all(orders.map(async (order) => {
      const productQuery = `
        SELECT oi.quantity, p.product_name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.product_id
        WHERE oi.order_id = ?
      `;
      const [products] = await db.query(productQuery, [order.id]);

      const productText = products.map(p => `${p.quantity}x ${p.product_name}`).join(', ');

      return {
        id: order.orderId,
        table: order.table_number,
        product: productText || 'Không có sản phẩm',
        total: `${parseInt(order.total).toLocaleString()}đ`,
        status: getStatusText(order.status),
        statusColor: getStatusColor(order.status),
        time: new Date(order.createdAt).toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit'
        })
      };
    }));

    res.json(formattedOrders);

  } catch (error) {
    console.error('Lỗi khi lấy đơn hàng gần đây:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
};

const getAnalytics = async (req, res) => {
  const period = String(req.query.period || 'day').toLowerCase();
  const configMap = {
    day: { label: 'day', mysqlInterval: '7 DAY', trendFormat: '%d/%m', points: 7 },
    week: { label: 'week', mysqlInterval: '7 WEEK', trendFormat: '%u/%Y', points: 7 },
    month: { label: 'month', mysqlInterval: '7 MONTH', trendFormat: '%m/%Y', points: 7 }
  };
  const cfg = configMap[period] || configMap.day;
  const createdAtLocalExpr = `CONVERT_TZ(created_at, '+00:00', '+07:00')`;
  const nowLocalExpr = `CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')`;

  try {
    const [overviewRows] = await db.query(
      `
        SELECT
          COALESCE(SUM(CASE WHEN status = 'paid' THEN final_amount ELSE 0 END), 0) AS totalRevenue,
          COALESCE(COUNT(CASE WHEN status = 'paid' THEN 1 END), 0) AS totalOrders,
          COALESCE(AVG(CASE WHEN status = 'paid' THEN final_amount END), 0) AS avgOrderValue,
          COALESCE(
            COUNT(DISTINCT CASE
              WHEN status = 'paid' AND table_id IS NOT NULL THEN CONCAT('table-', table_id)
              WHEN status = 'paid' THEN CONCAT('order-', order_id)
              ELSE NULL
            END),
            0
          ) AS customerCount
        FROM orders
        WHERE ${createdAtLocalExpr} >= ${nowLocalExpr} - INTERVAL ${cfg.mysqlInterval}
      `
    );

    let trendRows = [];
    if (cfg.label === 'day') {
      [trendRows] = await db.query(
        `
          SELECT
            DATE_FORMAT(DATE(${createdAtLocalExpr}), '%Y-%m-%d') AS periodKey,
            COALESCE(SUM(final_amount), 0) AS revenue,
            COUNT(*) AS orders
          FROM orders
          WHERE status = 'paid'
            AND ${createdAtLocalExpr} >= ${nowLocalExpr} - INTERVAL ${cfg.mysqlInterval}
          GROUP BY DATE_FORMAT(DATE(${createdAtLocalExpr}), '%Y-%m-%d')
          ORDER BY periodKey
        `
      );
    } else if (cfg.label === 'week') {
      [trendRows] = await db.query(
        `
          SELECT
            DATE_FORMAT(DATE_SUB(DATE(${createdAtLocalExpr}), INTERVAL WEEKDAY(${createdAtLocalExpr}) DAY), '%Y-%m-%d') AS periodKey,
            COALESCE(SUM(final_amount), 0) AS revenue,
            COUNT(*) AS orders
          FROM orders
          WHERE status = 'paid'
            AND ${createdAtLocalExpr} >= ${nowLocalExpr} - INTERVAL ${cfg.mysqlInterval}
          GROUP BY DATE_FORMAT(DATE_SUB(DATE(${createdAtLocalExpr}), INTERVAL WEEKDAY(${createdAtLocalExpr}) DAY), '%Y-%m-%d')
          ORDER BY periodKey
        `
      );
    } else {
      [trendRows] = await db.query(
        `
          SELECT
            DATE_FORMAT(${createdAtLocalExpr}, '%Y-%m-01') AS periodKey,
            COALESCE(SUM(final_amount), 0) AS revenue,
            COUNT(*) AS orders
          FROM orders
          WHERE status = 'paid'
            AND ${createdAtLocalExpr} >= ${nowLocalExpr} - INTERVAL ${cfg.mysqlInterval}
          GROUP BY DATE_FORMAT(${createdAtLocalExpr}, '%Y-%m-01')
          ORDER BY periodKey
        `
      );
    }

    const [[serverNowRow]] = await db.query(
      `SELECT DATE_FORMAT(DATE(${nowLocalExpr}), '%Y-%m-%d') AS todayKey`
    );
    const todayKey = String(serverNowRow?.todayKey || '').trim();
    const [y, m, d] = todayKey.split('-').map((x) => Number(x));
    const baseDate = (Number.isFinite(y) && Number.isFinite(m) && Number.isFinite(d))
      ? new Date(y, m - 1, d)
      : new Date();

    const expectedBuckets = [];

    const makeKey = (dt) => {
      const yyyy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    if (cfg.label === 'day') {
      for (let i = cfg.points - 1; i >= 0; i -= 1) {
        const cur = new Date(baseDate);
        cur.setDate(baseDate.getDate() - i);
        const key = makeKey(cur);
        const dd = String(cur.getDate()).padStart(2, '0');
        const mm = String(cur.getMonth() + 1).padStart(2, '0');
        expectedBuckets.push({ key, label: `${dd}/${mm}` });
      }
    } else if (cfg.label === 'week') {
      const anchor = new Date(baseDate);
      const anchorDay = anchor.getDay();
      const anchorDiff = anchorDay === 0 ? 6 : anchorDay - 1;
      anchor.setDate(anchor.getDate() - anchorDiff);

      for (let i = cfg.points - 1; i >= 0; i -= 1) {
        const monday = new Date(anchor);
        monday.setDate(anchor.getDate() - i * 7);
        const key = makeKey(monday);
        const weekText = i === 0 ? 'Tuần này' : `${i} tuần trước`;
        expectedBuckets.push({ key, label: weekText });
      }
    } else {
      const monthAnchor = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
      for (let i = cfg.points - 1; i >= 0; i -= 1) {
        const cur = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - i, 1);
        const key = makeKey(cur);
        const monthNum = cur.getMonth() + 1;
        expectedBuckets.push({ key, label: `T${monthNum}/${cur.getFullYear()}` });
      }
    }

    const trendMap = new Map(
      trendRows.map((r) => [
        String(r.periodKey),
        { revenue: Number(r.revenue || 0), orders: Number(r.orders || 0) }
      ])
    );

    const trend = expectedBuckets.map((bucket) => {
      const current = trendMap.get(bucket.key) || { revenue: 0, orders: 0 };
      return {
        label: bucket.label,
        revenue: Number(current.revenue || 0),
        orders: Number(current.orders || 0)
      };
    });

    const [topProductsRows] = await db.query(
      `
        SELECT
          p.product_name,
          COALESCE(SUM(oi.quantity), 0) AS qty,
          COALESCE(SUM(oi.quantity * COALESCE(oi.price_at_sale, p.sale_price, p.base_price, 0)), 0) AS revenue
        FROM order_items oi
        JOIN orders o ON o.order_id = oi.order_id
        JOIN products p ON p.product_id = oi.product_id
        WHERE o.status = 'paid'
          AND CONVERT_TZ(o.created_at, '+00:00', '+07:00') >= ${nowLocalExpr} - INTERVAL ${cfg.mysqlInterval}
        GROUP BY p.product_id, p.product_name
        ORDER BY qty DESC, revenue DESC
        LIMIT 5
      `
    );

    const [hourRows] = await db.query(
      `
        SELECT
          WEEKDAY(${createdAtLocalExpr}) AS weekdayNum,
          HOUR(${createdAtLocalExpr}) AS hourNum,
          COUNT(*) AS cnt
        FROM orders
        WHERE status = 'paid'
          AND ${createdAtLocalExpr} >= ${nowLocalExpr} - INTERVAL ${cfg.mysqlInterval}
        GROUP BY weekdayNum, hourNum
      `
    );

    const [busiestDayRows] = await db.query(
      `
        SELECT
          WEEKDAY(${createdAtLocalExpr}) AS weekdayNum,
          COUNT(*) AS orderCount
        FROM orders
        WHERE status = 'paid'
          AND ${createdAtLocalExpr} >= ${nowLocalExpr} - INTERVAL ${cfg.mysqlInterval}
        GROUP BY weekdayNum
        ORDER BY orderCount DESC
        LIMIT 1
      `
    );

    const [lowStockRows] = await db.query(
      `SELECT COUNT(*) AS lowStock FROM ingredients WHERE stock_quantity < min_stock_alert`
    );

    const [newCustomersRows] = await db.query(
      `
        SELECT
          SUM(CASE WHEN created_at >= NOW() - INTERVAL 30 DAY THEN 1 ELSE 0 END) AS current30,
          SUM(CASE WHEN created_at < NOW() - INTERVAL 30 DAY AND created_at >= NOW() - INTERVAL 60 DAY THEN 1 ELSE 0 END) AS prev30
        FROM users
      `
    );

    const weekdayLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
    const hourBuckets = [8, 10, 12, 14, 16, 18, 20];
    const heatMap = weekdayLabels.map((day, idx) => ({
      day,
      slots: hourBuckets.map((hour) => ({ hour, value: 0 })),
      weekdayNum: idx
    }));

    for (const row of hourRows) {
      const wd = Number(row.weekdayNum);
      const hr = Number(row.hourNum);
      const cnt = Number(row.cnt) || 0;
      if (!Number.isFinite(wd) || wd < 0 || wd > 6) continue;
      const bucket = hourBuckets.reduce((acc, h) => (Math.abs(h - hr) < Math.abs(acc - hr) ? h : acc), hourBuckets[0]);
      const slot = heatMap[wd].slots.find((s) => s.hour === bucket);
      if (slot) slot.value += cnt;
    }

    const maxHeat = Math.max(1, ...heatMap.flatMap((r) => r.slots.map((s) => s.value)));
    const heatMapNormalized = heatMap.map((row) => ({
      day: row.day,
      slots: row.slots.map((s) => ({
        hour: s.hour,
        value: s.value,
        intensity: Number((s.value / maxHeat).toFixed(2))
      }))
    }));

    const busiestDayNum = busiestDayRows[0]?.weekdayNum;
    const busiestDayText = Number.isFinite(Number(busiestDayNum))
      ? weekdayLabels[Number(busiestDayNum)]
      : 'Chưa có dữ liệu';

    const current30 = Number(newCustomersRows[0]?.current30 || 0);
    const prev30 = Number(newCustomersRows[0]?.prev30 || 0);
    const growthPct = prev30 > 0 ? ((current30 - prev30) / prev30) * 100 : (current30 > 0 ? 100 : 0);

    res.json({
      period: cfg.label,
      overview: {
        totalRevenue: Number(overviewRows[0]?.totalRevenue || 0),
        totalOrders: Number(overviewRows[0]?.totalOrders || 0),
        avgOrderValue: Number(overviewRows[0]?.avgOrderValue || 0),
        customerCount: Number(overviewRows[0]?.customerCount || 0)
      },
      trend,
      topProducts: topProductsRows.map((r) => ({
        product_name: r.product_name,
        qty: Number(r.qty || 0),
        revenue: Number(r.revenue || 0)
      })),
      peakHours: {
        buckets: hourBuckets,
        heatMap: heatMapNormalized
      },
      quickStats: {
        busiestDay: busiestDayText,
        newCustomers30d: current30,
        newCustomersGrowthPct: Number(growthPct.toFixed(1)),
        lowStock: Number(lowStockRows[0]?.lowStock || 0)
      }
    });
  } catch (error) {
    console.error('Lỗi analytics:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

const getInvoices = async (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
  const offset = (page - 1) * limit;
  const q = String(req.query.q || '').trim();
  const date = String(req.query.date || '').trim(); // YYYY-MM-DD
  const userId = String(req.query.user_id || '').trim();

  try {
    const where = [];
    const params = [];

    if (q) {
      where.push(`(CAST(o.order_id AS CHAR) LIKE ? OR COALESCE(t.table_number, 'Mang về') LIKE ? OR COALESCE(u.full_name, '') LIKE ?)`);
      const keyword = `%${q}%`;
      params.push(keyword, keyword, keyword);
    }
    if (date) {
      where.push(`DATE(o.created_at) = ?`);
      params.push(date);
    }
    if (userId) {
      where.push(`o.user_id = ?`);
      params.push(Number(userId));
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS totalItems
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN users u ON o.user_id = u.user_id
        ${whereSql}
      `,
      params
    );

    const [invoiceRows] = await db.query(
      `
        SELECT
          o.order_id,
          o.created_at,
          o.final_amount,
          o.status,
          o.payment_method,
          o.order_type,
          o.user_id,
          COALESCE(t.table_number, 'Mang về') AS table_number,
          COALESCE(u.full_name, u.username, 'N/A') AS cashier_name
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN users u ON o.user_id = u.user_id
        ${whereSql}
        ORDER BY o.created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const [summaryRows] = await db.query(
      `
        SELECT
          COALESCE(SUM(CASE WHEN DATE(created_at) = CURDATE() AND status = 'paid' THEN final_amount ELSE 0 END), 0) AS revenueToday,
          COUNT(*) AS totalInvoices,
          COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelledInvoices
        FROM orders
      `
    );

    const [staffRows] = await db.query(
      `
        SELECT user_id, COALESCE(full_name, username) AS display_name
        FROM users
        WHERE status = 1
        ORDER BY user_id ASC
      `
    );

    // Mapping để hiển thị nhãn giống UI POS
    const paymentMap = { cash: 'Tiền mặt', card: 'Thẻ ngân hàng', momo: 'Chuyển khoản' };
    const statusMap = {
      paid: { text: 'Đã thanh toán', color: 'success' },
      pending: { text: 'Chờ thanh toán', color: 'warning' },
      cancelled: { text: 'Đã hủy', color: 'error' }
    };

    const invoices = invoiceRows.map((row) => {
      const statusInfo = statusMap[row.status] || statusMap.paid;
      return {
        id: row.order_id,
        code: `#HD${String(row.order_id).padStart(5, '0')}`,
        created_at: row.created_at,
        total: Number(row.final_amount || 0),
        status: row.status,
        status_text: statusInfo.text,
        status_color: statusInfo.color,
        payment_method: row.payment_method,
        payment_text: paymentMap[row.payment_method] || row.payment_method,
        table: row.order_type === 'take_away' ? 'Mang về' : row.table_number,
        cashier_name: row.cashier_name,
        user_id: row.user_id
      };
    });

    const totalItems = Number(countRows[0]?.totalItems || 0);
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    res.json({
      page,
      limit,
      totalItems,
      totalPages,
      invoices,
      summary: {
        revenueToday: Number(summaryRows[0]?.revenueToday || 0),
        totalInvoices: Number(summaryRows[0]?.totalInvoices || 0),
        cancelledInvoices: Number(summaryRows[0]?.cancelledInvoices || 0)
      },
      staff: staffRows.map((s) => ({ user_id: s.user_id, name: s.display_name }))
    });
  } catch (error) {
    console.error('Lỗi lấy hóa đơn:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

// API chi tiết 1 hóa đơn (dùng cho modal POS)
const getInvoiceDetail = async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return res.status(400).json({ message: 'order id không hợp lệ' });
  }

  try {
    const paymentMap = { cash: 'Tiền mặt', card: 'Thẻ ngân hàng', momo: 'Momo' };

    const [orderRows] = await db.query(
      `
        SELECT
          o.order_id,
          o.created_at,
          o.total_amount,
          o.final_amount,
          o.status,
          o.payment_method,
          o.order_type,
          o.table_id,
          COALESCE(t.table_number, 'Mang về') AS table_number,
          COALESCE(u.full_name, u.username, 'N/A') AS cashier_name
        FROM orders o
        LEFT JOIN tables t ON o.table_id = t.table_id
        LEFT JOIN users u ON o.user_id = u.user_id
        WHERE o.order_id = ?
        LIMIT 1
      `,
      [orderId]
    );

    if (!orderRows.length) {
      return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
    }

    const o = orderRows[0];
    const subtotal = Number(o.total_amount || 0);
    const total = Number(o.final_amount || 0);
    const tax = Number(total - subtotal);

    const createdAt = o.created_at;
    const dt = createdAt ? new Date(createdAt) : new Date();
    const monthLabel = `${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;

    const tableLabel = o.order_type === 'take_away' ? 'Mang về' : (o.table_number || `Bàn ${o.table_id || ''}`);

    const [lineRows] = await db.query(
      `
        SELECT
          oi.product_id,
          p.product_name,
          p.image_url,
          oi.quantity,
          oi.price_at_sale
        FROM order_items oi
        JOIN products p ON p.product_id = oi.product_id
        WHERE oi.order_id = ?
      `,
      [orderId]
    );

    const items = (lineRows || []).map((r) => ({
      name: r.product_name,
      image_url: r.image_url || null,
      qty: Number(r.quantity || 0),
      unitPrice: Number(r.price_at_sale || 0),
      lineTotal: Number(r.quantity || 0) * Number(r.price_at_sale || 0)
    }));

    res.json({
      orderId: o.order_id,
      code: `#HD${String(o.order_id).padStart(5, '0')}`,
      createdAt: o.created_at,
      monthLabel,
      cashierName: o.cashier_name,
      tableLabel,
      status: o.status,
      paymentMethod: paymentMap[o.payment_method] || o.payment_method,
      subtotal,
      tax,
      total,
      items
    });
  } catch (error) {
    console.error('Lỗi lấy chi tiết hóa đơn:', error);
    res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

const checkoutOrder = async (req, res) => {
  const userId = req.user?.id;
  const {
    table_id = null,
    order_type = 'dine_in',
    payment_method = 'cash',
    status = 'paid',
    items = [],
    loyalty = {}
  } = req.body || {};

  if (!userId) {
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'items phải là mảng và không được rỗng' });
  }

  for (const it of items) {
    const qty = Number(it?.quantity);
    const unitPrice = Number(it?.price_at_sale);
    if (!it?.product_id || !Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: 'items không hợp lệ (product_id/quantity)' });
    }
    if (it?.price_at_sale != null && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
      return res.status(400).json({ message: 'items không hợp lệ (price_at_sale)' });
    }
  }

  const normalizedStatus = String(status);
  if (!['pending', 'paid', 'cancelled'].includes(normalizedStatus)) {
    return res.status(400).json({ message: 'status không hợp lệ' });
  }

  const normalizedOrderType = String(order_type);
  if (!['dine_in', 'take_away'].includes(normalizedOrderType)) {
    return res.status(400).json({ message: 'order_type không hợp lệ' });
  }

  const normalizedPayment = String(payment_method);
  if (!['cash', 'card', 'momo'].includes(normalizedPayment)) {
    return res.status(400).json({ message: 'payment_method không hợp lệ' });
  }

  const useLoyalty = Boolean(loyalty?.use_points);
  const loyaltyPhone = String(loyalty?.phone || '').trim();
  const loyaltyName = String(loyalty?.full_name || '').trim() || 'Khách POS';
  if (useLoyalty && !loyaltyPhone) {
    return res.status(400).json({ message: 'Thiếu số điện thoại tích điểm' });
  }

  const productIds = [...new Set(items.map((i) => Number(i.product_id)))].filter(Boolean);

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [productRows] = await conn.query(
      `
        SELECT product_id, product_name, COALESCE(sale_price, base_price) AS price, is_available
        FROM products
        WHERE product_id IN (?)
      `,
      [productIds]
    );

    const productMap = new Map(productRows.map((p) => [Number(p.product_id), p]));
    for (const pid of productIds) {
      const p = productMap.get(pid);
      if (!p) {
        await conn.rollback();
        return res.status(400).json({ message: `Không tìm thấy sản phẩm id=${pid}` });
      }
      if (Number(p.is_available) !== 1) {
        await conn.rollback();
        return res.status(400).json({ message: `Sản phẩm đang ngừng bán: ${p.product_name}` });
      }
    }

    const totalAmount = items.reduce((sum, it) => {
      const p = productMap.get(Number(it.product_id));
      const qty = Number(it.quantity);
      const linePrice = (it?.price_at_sale != null) ? Number(it.price_at_sale) : Number(p.price);
      return sum + linePrice * qty;
    }, 0);

    const taxAmount = Math.round(totalAmount * TAX_RATE);
    const finalAmount = totalAmount + taxAmount;
    const earnedPoints = Math.floor(finalAmount / LOYALTY_POINT_DIVISOR);

    const hasCustomerColumn = await ensureOrderCustomerColumn(conn);

    const [orderResult] = hasCustomerColumn
      ? await conn.query(
        `
          INSERT INTO orders (user_id, table_id, customer_id, total_amount, final_amount, payment_method, order_type, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [userId, table_id || null, null, totalAmount, finalAmount, normalizedPayment, normalizedOrderType, normalizedStatus]
      )
      : await conn.query(
        `
          INSERT INTO orders (user_id, table_id, total_amount, final_amount, payment_method, order_type, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [userId, table_id || null, totalAmount, finalAmount, normalizedPayment, normalizedOrderType, normalizedStatus]
      );

    const orderId = orderResult.insertId;

    const values = items.map((it) => {
      const pid = Number(it.product_id);
      const qty = Number(it.quantity);
      const p = productMap.get(pid);
      const linePrice = (it?.price_at_sale != null) ? Number(it.price_at_sale) : Number(p.price);
      return [orderId, pid, qty, linePrice];
    });

    await conn.query(
      `
        INSERT INTO order_items (order_id, product_id, quantity, price_at_sale)
        VALUES ?
      `,
      [values]
    );

    // Trừ kho tự động theo định mức variant_recipes (ưu tiên) hoặc recipes (fallback)
    const demandMap = new Map(); // ingredient_id -> total amount needed

    for (const it of items) {
      const pid = Number(it.product_id);
      const qty = Number(it.quantity);
      const sizeLabel = String(it.size_label || 'DEFAULT').trim().toUpperCase();

      let recipeRows = [];
      const [variantRows] = await conn.query(
        `SELECT vr.variant_id FROM product_variants vr WHERE vr.product_id = ? AND vr.size_label = ? LIMIT 1`,
        [pid, sizeLabel]
      );

      if (variantRows.length) {
        const variantId = Number(variantRows[0].variant_id);
        const [rows] = await conn.query(
          `SELECT ingredient_id, amount_needed FROM variant_recipes WHERE variant_id = ?`,
          [variantId]
        );
        recipeRows = rows || [];
      } else {
        const [rows] = await conn.query(
          `SELECT ingredient_id, amount_needed FROM recipes WHERE product_id = ?`,
          [pid]
        );
        recipeRows = rows || [];
      }

      for (const rr of recipeRows) {
        const iid = Number(rr.ingredient_id);
        const need = Number(rr.amount_needed || 0) * qty;
        if (!iid || need <= 0) continue;
        demandMap.set(iid, (demandMap.get(iid) || 0) + need);
      }
    }

    // Validate tồn kho trước khi trừ
    for (const [ingredientId, needed] of demandMap.entries()) {
      const [[ing]] = await conn.query(
        `SELECT ingredient_id, ingredient_name, stock_quantity
         FROM ingredients
         WHERE ingredient_id = ?
         FOR UPDATE`,
        [ingredientId]
      );

      if (!ing) {
        await conn.rollback();
        return res.status(400).json({ message: `Không tìm thấy nguyên liệu id=${ingredientId}` });
      }

      const stock = Number(ing.stock_quantity || 0);
      if (stock < needed) {
        await conn.rollback();
        return res.status(400).json({
          message: `Không đủ tồn kho nguyên liệu: ${ing.ingredient_name} (cần ${needed.toFixed(2)}, còn ${stock.toFixed(2)})`
        });
      }
    }

    // Thực hiện trừ kho + ghi log giao dịch
    for (const [ingredientId, needed] of demandMap.entries()) {
      const [[ing]] = await conn.query(
        `SELECT ingredient_id, stock_quantity FROM ingredients WHERE ingredient_id = ? FOR UPDATE`,
        [ingredientId]
      );
      const before = Number(ing.stock_quantity || 0);
      const after = before - needed;

      await conn.query(`UPDATE ingredients SET stock_quantity = ? WHERE ingredient_id = ?`, [after, ingredientId]);

      try {
        await conn.query(
          `INSERT INTO inventory_transactions
            (ingredient_id, transaction_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, note, created_by)
           VALUES (?, 'deduction', ?, ?, ?, 'order', ?, ?, ?)`,
          [ingredientId, -needed, before, after, orderId, 'Trừ kho tự động khi thanh toán', userId]
        );
      } catch (txErr) {
        if (txErr?.code !== 'ER_NO_SUCH_TABLE') throw txErr;
      }
    }

    let loyaltyResult = null;
    if (useLoyalty) {
      const [customerRows] = await conn.query(
        `SELECT customer_id, points, total_spent FROM customers WHERE phone = ? LIMIT 1`,
        [loyaltyPhone]
      );

      const toTier = (points) => {
        if (points >= 5000) return 'platinum';
        if (points >= 2000) return 'gold';
        if (points >= 800) return 'silver';
        return 'bronze';
      };

      if (customerRows.length) {
        const current = customerRows[0];
        const nextPoints = Number(current.points || 0) + earnedPoints;
        const nextSpent = Number(current.total_spent || 0) + finalAmount;
        const nextTier = toTier(nextPoints);
        await conn.query(
          `UPDATE customers SET points = ?, total_spent = ?, tier = ? WHERE customer_id = ?`,
          [nextPoints, nextSpent, nextTier, current.customer_id]
        );

        if (hasCustomerColumn) {
          await conn.query('UPDATE orders SET customer_id = ? WHERE order_id = ?', [current.customer_id, orderId]);
        }

        loyaltyResult = {
          customer_id: current.customer_id,
          phone: loyaltyPhone,
          points_added: earnedPoints,
          points_total: nextPoints,
          tier: nextTier
        };
      } else {
        const startPoints = earnedPoints;
        const startTier = toTier(startPoints);
        const [insertCustomer] = await conn.query(
          `INSERT INTO customers (full_name, phone, points, total_spent, tier, status) VALUES (?, ?, ?, ?, ?, 1)`,
          [loyaltyName, loyaltyPhone, startPoints, finalAmount, startTier]
        );

        if (hasCustomerColumn) {
          await conn.query('UPDATE orders SET customer_id = ? WHERE order_id = ?', [insertCustomer.insertId, orderId]);
        }

        loyaltyResult = {
          customer_id: insertCustomer.insertId,
          phone: loyaltyPhone,
          points_added: earnedPoints,
          points_total: startPoints,
          tier: startTier
        };
      }
    }

    await conn.commit();

    return res.status(201).json({
      order_id: orderId,
      total_amount: totalAmount,
      tax_amount: taxAmount,
      final_amount: finalAmount,
      status: normalizedStatus,
      loyalty: loyaltyResult
    });
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.error('Lỗi checkout:', error);
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

const markOrderPaid = async (req, res) => {
  const orderId = Number(req.params.id);

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return res.status(400).json({ message: 'order id không hợp lệ' });
  }

  try {
    const [rows] = await db.query(
      `
        SELECT order_id, status, payment_method, final_amount
        FROM orders
        WHERE order_id = ?
        LIMIT 1
      `,
      [orderId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    const order = rows[0];
    if (String(order.status) !== 'pending') {
      return res.status(400).json({ message: 'Chỉ xác nhận được đơn hàng đang chờ thanh toán' });
    }

    await db.query(
      `
        UPDATE orders
        SET status = 'paid'
        WHERE order_id = ?
      `,
      [orderId]
    );

    return res.json({
      order_id: orderId,
      status: 'paid',
      payment_method: order.payment_method,
      final_amount: Number(order.final_amount || 0)
    });
  } catch (error) {
    console.error('Lỗi xác nhận thanh toán đơn hàng:', error);
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

const updateInvoiceStatus = async (req, res) => {
  const orderId = Number(req.params.id);
  const nextStatus = String(req.body?.status || '').trim();

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return res.status(400).json({ message: 'order id không hợp lệ' });
  }
  if (!['pending', 'paid', 'cancelled'].includes(nextStatus)) {
    return res.status(400).json({ message: 'Trạng thái không hợp lệ' });
  }

  try {
    const [rows] = await db.query('SELECT order_id, status FROM orders WHERE order_id = ? LIMIT 1', [orderId]);
    if (!rows.length) return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });

    const currentStatus = String(rows[0].status || 'pending');

    if (currentStatus === nextStatus) {
      return res.json({ message: 'Trạng thái không thay đổi', order_id: orderId, status: nextStatus });
    }

    const isBlockedDirectSwitch =
      (currentStatus === 'cancelled' && nextStatus === 'paid') ||
      (currentStatus === 'paid' && nextStatus === 'cancelled');

    if (isBlockedDirectSwitch) {
      return res.status(400).json({
        message: 'Không được đổi trực tiếp giữa Đã hủy và Đã thanh toán. Vui lòng chuyển qua trạng thái Chờ thanh toán trước.'
      });
    }

    await db.query('UPDATE orders SET status = ? WHERE order_id = ?', [nextStatus, orderId]);
    return res.json({ message: 'Cập nhật trạng thái đơn hàng thành công', order_id: orderId, status: nextStatus });
  } catch (error) {
    console.error('Lỗi cập nhật trạng thái hóa đơn:', error);
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  }
};

const deleteInvoice = async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isFinite(orderId) || orderId <= 0) {
    return res.status(400).json({ message: 'order id không hợp lệ' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query('SELECT order_id FROM orders WHERE order_id = ? LIMIT 1', [orderId]);
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
    }

    await conn.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
    await conn.query('DELETE FROM orders WHERE order_id = ?', [orderId]);

    await conn.commit();
    return res.json({ message: 'Xóa hóa đơn thành công', order_id: orderId });
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    console.error('Lỗi xóa hóa đơn:', error);
    return res.status(500).json({ message: 'Lỗi server', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

// Helper functions
const getStatusText = (status) => {
  const statusMap = {
    'pending': 'ĐANG PHỤC VỤ',
    'paid': 'HOÀN TẤT',
    'cancelled': 'ĐÃ HỦY'
  };
  return statusMap[status] || 'ĐANG PHỤC VỤ';
};

const getStatusColor = (status) => {
  const colorMap = {
    'pending': 'warning',
    'paid': 'success',
    'cancelled': 'error'
  };
  return colorMap[status] || 'warning';
};

module.exports = {
  getDailyStats,
  getRecentOrders,
  getAnalytics,
  getInvoices,
  getInvoiceDetail,
  checkoutOrder,
  markOrderPaid,
  updateInvoiceStatus,
  deleteInvoice
};