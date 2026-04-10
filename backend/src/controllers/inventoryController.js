const db = require('../config/db');

const toNum = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

async function insertInventoryTx(conn, payload) {
  try {
    await conn.query(
      `INSERT INTO inventory_transactions
        (ingredient_id, transaction_type, quantity_change, quantity_before, quantity_after, reference_type, reference_id, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.ingredient_id,
        payload.transaction_type,
        payload.quantity_change,
        payload.quantity_before,
        payload.quantity_after,
        payload.reference_type || null,
        payload.reference_id || null,
        payload.note || null,
        payload.created_by || null
      ]
    );
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE') throw err;
  }
}

exports.getIngredients = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ingredient_id, ingredient_name, unit, stock_quantity, min_stock_alert,
              conversion_unit, conversion_factor, created_at, updated_at
       FROM ingredients
       ORDER BY (stock_quantity < min_stock_alert) DESC, ingredient_name ASC`
    );
    res.json(rows || []);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy nguyên liệu', error: error.message });
  }
};

exports.getInventoryTransactions = async (req, res) => {
  try {
    const type = String(req.query.type || '').trim();
    const ingredientId = toNum(req.query.ingredient_id, 0);
    const params = [];
    const where = [];

    if (type) {
      where.push('t.transaction_type = ?');
      params.push(type);
    }
    if (ingredientId > 0) {
      where.push('t.ingredient_id = ?');
      params.push(ingredientId);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT t.transaction_id, t.transaction_type, t.quantity_change, t.quantity_before, t.quantity_after,
              t.reference_type, t.reference_id, t.note, t.created_at,
              i.ingredient_name, i.unit
       FROM inventory_transactions t
       JOIN ingredients i ON i.ingredient_id = t.ingredient_id
       ${whereSql}
       ORDER BY t.created_at DESC, t.transaction_id DESC
       LIMIT 200`,
      params
    );

    return res.json(rows || []);
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    return res.status(500).json({ message: 'Lỗi lấy lịch sử kho', error: error.message });
  }
};

exports.getStockReceipts = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT sr.receipt_id, sr.supplier_name, sr.receipt_date, sr.note, sr.created_at,
              COALESCE(SUM(sri.total_cost), 0) AS total_cost,
              COUNT(sri.receipt_item_id) AS item_count
       FROM stock_receipts sr
       LEFT JOIN stock_receipt_items sri ON sri.receipt_id = sr.receipt_id
       GROUP BY sr.receipt_id
       ORDER BY sr.created_at DESC
       LIMIT 100`
    );
    return res.json(rows || []);
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    return res.status(500).json({ message: 'Lỗi lấy phiếu nhập', error: error.message });
  }
};

exports.getStockTakes = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT st.stock_take_id, st.take_date, st.note, st.created_at,
              COUNT(sti.stock_take_item_id) AS item_count,
              COALESCE(SUM(sti.variance_quantity), 0) AS total_variance
       FROM stock_takes st
       LEFT JOIN stock_take_items sti ON sti.stock_take_id = st.stock_take_id
       GROUP BY st.stock_take_id
       ORDER BY st.created_at DESC
       LIMIT 100`
    );
    return res.json(rows || []);
  } catch (error) {
    if (error?.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    return res.status(500).json({ message: 'Lỗi lấy phiếu kiểm kê', error: error.message });
  }
};

exports.createIngredient = async (req, res) => {
  const {
    ingredient_name,
    unit,
    stock_quantity = 0,
    min_stock_alert = 0,
    conversion_unit = null,
    conversion_factor = 1
  } = req.body || {};

  if (!String(ingredient_name || '').trim()) {
    return res.status(400).json({ message: 'Tên nguyên liệu là bắt buộc' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO ingredients (ingredient_name, unit, stock_quantity, min_stock_alert, conversion_unit, conversion_factor)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(ingredient_name).trim(),
        String(unit || '').trim() || null,
        toNum(stock_quantity, 0),
        toNum(min_stock_alert, 0),
        String(conversion_unit || '').trim() || null,
        toNum(conversion_factor, 1)
      ]
    );

    const [rows] = await db.query(
      `SELECT ingredient_id, ingredient_name, unit, stock_quantity, min_stock_alert, conversion_unit, conversion_factor, created_at, updated_at
       FROM ingredients WHERE ingredient_id = ?`,
      [result.insertId]
    );

    return res.status(201).json({ message: 'Thêm nguyên liệu thành công', ingredient: rows?.[0] || null });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi thêm nguyên liệu', error: error.message });
  }
};

exports.updateIngredient = async (req, res) => {
  const id = toNum(req.params.id, 0);
  const {
    ingredient_name,
    unit,
    stock_quantity,
    min_stock_alert,
    conversion_unit,
    conversion_factor
  } = req.body || {};

  if (id <= 0) return res.status(400).json({ message: 'ingredient_id không hợp lệ' });
  if (!String(ingredient_name || '').trim()) return res.status(400).json({ message: 'Tên nguyên liệu là bắt buộc' });

  try {
    const [result] = await db.query(
      `UPDATE ingredients
       SET ingredient_name = ?, unit = ?, stock_quantity = ?, min_stock_alert = ?, conversion_unit = ?, conversion_factor = ?
       WHERE ingredient_id = ?`,
      [
        String(ingredient_name).trim(),
        String(unit || '').trim() || null,
        toNum(stock_quantity, 0),
        toNum(min_stock_alert, 0),
        String(conversion_unit || '').trim() || null,
        toNum(conversion_factor, 1),
        id
      ]
    );

    if (!result.affectedRows) return res.status(404).json({ message: 'Không tìm thấy nguyên liệu' });

    const [rows] = await db.query(
      `SELECT ingredient_id, ingredient_name, unit, stock_quantity, min_stock_alert, conversion_unit, conversion_factor, created_at, updated_at
       FROM ingredients WHERE ingredient_id = ?`,
      [id]
    );

    return res.json({ message: 'Cập nhật nguyên liệu thành công', ingredient: rows?.[0] || null });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi cập nhật nguyên liệu', error: error.message });
  }
};

exports.createStockReceipt = async (req, res) => {
  const userId = req.user?.id || null;
  const { supplier_name = null, receipt_date = null, note = null, items = [] } = req.body || {};

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'items nhập kho không hợp lệ' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [receiptRs] = await conn.query(
      `INSERT INTO stock_receipts (supplier_name, receipt_date, note, created_by)
       VALUES (?, COALESCE(?, CURDATE()), ?, ?)`,
      [String(supplier_name || '').trim() || null, receipt_date || null, String(note || '').trim() || null, userId]
    );

    const receiptId = receiptRs.insertId;

    for (const item of items) {
      const ingredientId = toNum(item?.ingredient_id, 0);
      const packQty = toNum(item?.pack_quantity, 0);
      const factor = Math.max(0, toNum(item?.conversion_factor, 1));
      const qtyAdded = packQty * factor;
      const unitCost = toNum(item?.unit_cost, 0);
      const totalCost = qtyAdded * unitCost;

      if (ingredientId <= 0 || qtyAdded <= 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'Dòng nhập kho không hợp lệ' });
      }

      const [[ing]] = await conn.query(
        `SELECT ingredient_id, ingredient_name, stock_quantity
         FROM ingredients WHERE ingredient_id = ? FOR UPDATE`,
        [ingredientId]
      );

      if (!ing) {
        await conn.rollback();
        return res.status(404).json({ message: `Không tìm thấy nguyên liệu id=${ingredientId}` });
      }

      const before = toNum(ing.stock_quantity, 0);
      const after = before + qtyAdded;

      await conn.query(
        `INSERT INTO stock_receipt_items
          (receipt_id, ingredient_id, pack_quantity, pack_unit, conversion_factor, quantity_added, unit_cost, total_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [receiptId, ingredientId, packQty, String(item?.pack_unit || '').trim() || null, factor, qtyAdded, unitCost, totalCost]
      );

      await conn.query(`UPDATE ingredients SET stock_quantity = ? WHERE ingredient_id = ?`, [after, ingredientId]);

      await insertInventoryTx(conn, {
        ingredient_id: ingredientId,
        transaction_type: 'import',
        quantity_change: qtyAdded,
        quantity_before: before,
        quantity_after: after,
        reference_type: 'stock_receipt',
        reference_id: receiptId,
        note: `Nhập kho từ phiếu #${receiptId}`,
        created_by: userId
      });
    }

    await conn.commit();
    return res.status(201).json({ message: 'Nhập kho thành công', receipt_id: receiptId });
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    return res.status(500).json({ message: 'Lỗi nhập kho', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

exports.createStockTake = async (req, res) => {
  const userId = req.user?.id || null;
  const { take_date = null, note = null, items = [] } = req.body || {};

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ message: 'items kiểm kê không hợp lệ' });
  }

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [takeRs] = await conn.query(
      `INSERT INTO stock_takes (take_date, note, created_by)
       VALUES (COALESCE(?, CURDATE()), ?, ?)`,
      [take_date || null, String(note || '').trim() || null, userId]
    );
    const takeId = takeRs.insertId;

    for (const item of items) {
      const ingredientId = toNum(item?.ingredient_id, 0);
      const actualQty = toNum(item?.actual_quantity, 0);

      if (ingredientId <= 0) {
        await conn.rollback();
        return res.status(400).json({ message: 'Dòng kiểm kê không hợp lệ' });
      }

      const [[ing]] = await conn.query(
        `SELECT ingredient_id, ingredient_name, stock_quantity
         FROM ingredients WHERE ingredient_id = ? FOR UPDATE`,
        [ingredientId]
      );
      if (!ing) {
        await conn.rollback();
        return res.status(404).json({ message: `Không tìm thấy nguyên liệu id=${ingredientId}` });
      }

      const systemQty = toNum(ing.stock_quantity, 0);
      const variance = actualQty - systemQty;

      await conn.query(
        `INSERT INTO stock_take_items
          (stock_take_id, ingredient_id, system_quantity, actual_quantity, variance_quantity, note)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [takeId, ingredientId, systemQty, actualQty, variance, String(item?.note || '').trim() || null]
      );

      await conn.query(`UPDATE ingredients SET stock_quantity = ? WHERE ingredient_id = ?`, [actualQty, ingredientId]);

      await insertInventoryTx(conn, {
        ingredient_id: ingredientId,
        transaction_type: 'adjustment',
        quantity_change: variance,
        quantity_before: systemQty,
        quantity_after: actualQty,
        reference_type: 'stock_take',
        reference_id: takeId,
        note: `Kiểm kê #${takeId}`,
        created_by: userId
      });
    }

    await conn.commit();
    return res.status(201).json({ message: 'Kiểm kê thành công', stock_take_id: takeId });
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    return res.status(500).json({ message: 'Lỗi kiểm kê', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

exports.getRecipesByProduct = async (req, res) => {
  const productId = toNum(req.params.productId, 0);
  if (productId <= 0) return res.status(400).json({ message: 'product_id không hợp lệ' });

  try {
    const [rows] = await db.query(
      `SELECT vr.variant_id, vr.size_label, vr.multiplier,
              i.ingredient_id, i.ingredient_name, i.unit,
              rr.amount_needed
       FROM product_variants vr
       LEFT JOIN variant_recipes rr ON rr.variant_id = vr.variant_id
       LEFT JOIN ingredients i ON i.ingredient_id = rr.ingredient_id
       WHERE vr.product_id = ?
       ORDER BY vr.multiplier ASC, i.ingredient_name ASC`,
      [productId]
    );

    if (!rows.length) {
      const [fallback] = await db.query(
        `SELECT NULL AS variant_id, 'DEFAULT' AS size_label, 1 AS multiplier,
                i.ingredient_id, i.ingredient_name, i.unit, r.amount_needed
         FROM recipes r
         JOIN ingredients i ON i.ingredient_id = r.ingredient_id
         WHERE r.product_id = ?
         ORDER BY i.ingredient_name ASC`,
        [productId]
      );
      return res.json({ product_id: productId, variants: [{ variant_id: null, size_label: 'DEFAULT', multiplier: 1, items: fallback || [] }] });
    }

    const byVariant = new Map();
    for (const r of rows) {
      const id = String(r.variant_id);
      if (!byVariant.has(id)) {
        byVariant.set(id, {
          variant_id: r.variant_id,
          size_label: r.size_label,
          multiplier: toNum(r.multiplier, 1),
          items: []
        });
      }
      if (r.ingredient_id) {
        byVariant.get(id).items.push({
          ingredient_id: r.ingredient_id,
          ingredient_name: r.ingredient_name,
          unit: r.unit,
          amount_needed: toNum(r.amount_needed, 0)
        });
      }
    }

    return res.json({ product_id: productId, variants: [...byVariant.values()] });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi lấy định mức', error: error.message });
  }
};

exports.upsertVariantRecipe = async (req, res) => {
  const productId = toNum(req.params.productId, 0);
  const { size_label = 'DEFAULT', multiplier = 1, items = [] } = req.body || {};

  if (productId <= 0) return res.status(400).json({ message: 'product_id không hợp lệ' });
  if (!Array.isArray(items)) return res.status(400).json({ message: 'items không hợp lệ' });

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [[existing]] = await conn.query(
      `SELECT variant_id FROM product_variants WHERE product_id = ? AND size_label = ? LIMIT 1`,
      [productId, String(size_label || 'DEFAULT').trim().toUpperCase()]
    );

    let variantId = existing?.variant_id;
    if (!variantId) {
      const [rs] = await conn.query(
        `INSERT INTO product_variants (product_id, size_label, multiplier) VALUES (?, ?, ?)`,
        [productId, String(size_label || 'DEFAULT').trim().toUpperCase(), toNum(multiplier, 1)]
      );
      variantId = rs.insertId;
    } else {
      await conn.query(`UPDATE product_variants SET multiplier = ? WHERE variant_id = ?`, [toNum(multiplier, 1), variantId]);
      await conn.query(`DELETE FROM variant_recipes WHERE variant_id = ?`, [variantId]);
    }

    for (const item of items) {
      const ingredientId = toNum(item?.ingredient_id, 0);
      const amountNeeded = toNum(item?.amount_needed, 0);
      if (ingredientId <= 0 || amountNeeded <= 0) continue;
      await conn.query(
        `INSERT INTO variant_recipes (variant_id, ingredient_id, amount_needed) VALUES (?, ?, ?)`,
        [variantId, ingredientId, amountNeeded]
      );
    }

    await conn.commit();
    return res.json({ message: 'Lưu định mức thành công', variant_id: variantId });
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    return res.status(500).json({ message: 'Lỗi lưu định mức', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};

exports.getInventorySummary = async (req, res) => {
  try {
    const date = String(req.query.date || '').trim();
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const [[stockRow]] = await db.query(
      `SELECT
        COUNT(*) AS totalIngredients,
        COALESCE(SUM(stock_quantity), 0) AS totalStock,
        SUM(CASE WHEN stock_quantity < min_stock_alert THEN 1 ELSE 0 END) AS lowStockCount
       FROM ingredients`
    );

    let importQty = 0;
    let exportQty = 0;
    let adjustQty = 0;

    try {
      const [txRows] = await db.query(
        `SELECT transaction_type, COALESCE(SUM(quantity_change), 0) AS qty
         FROM inventory_transactions
         WHERE DATE(created_at) = ?
         GROUP BY transaction_type`,
        [targetDate]
      );

      for (const r of txRows || []) {
        const t = String(r.transaction_type || '');
        const qty = Number(r.qty || 0);
        if (t === 'import') importQty += Math.max(0, qty);
        if (t === 'deduction') exportQty += Math.abs(qty);
        if (t === 'adjustment') adjustQty += qty;
      }
    } catch (err) {
      if (err?.code !== 'ER_NO_SUCH_TABLE') throw err;
    }

    const [lowItems] = await db.query(
      `SELECT ingredient_id, ingredient_name, unit, stock_quantity, min_stock_alert
       FROM ingredients
       WHERE stock_quantity < min_stock_alert
       ORDER BY (min_stock_alert - stock_quantity) DESC, ingredient_name ASC
       LIMIT 20`
    );

    return res.json({
      date: targetDate,
      totals: {
        totalIngredients: Number(stockRow?.totalIngredients || 0),
        totalStock: Number(stockRow?.totalStock || 0),
        lowStockCount: Number(stockRow?.lowStockCount || 0),
        importQty: Number(importQty || 0),
        exportQty: Number(exportQty || 0),
        adjustQty: Number(adjustQty || 0)
      },
      lowStockItems: lowItems || []
    });
  } catch (error) {
    return res.status(500).json({ message: 'Lỗi lấy báo cáo kho', error: error.message });
  }
};

exports.restoreStockByOrder = async (req, res) => {
  const orderId = toNum(req.params.orderId, 0);
  const userId = req.user?.id || null;

  if (orderId <= 0) return res.status(400).json({ message: 'order_id không hợp lệ' });

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [[order]] = await conn.query(
      `SELECT order_id, status FROM orders WHERE order_id = ? LIMIT 1 FOR UPDATE`,
      [orderId]
    );

    if (!order) {
      await conn.rollback();
      return res.status(404).json({ message: 'Không tìm thấy hóa đơn' });
    }

    const [alreadyRows] = await conn.query(
      `SELECT transaction_id
       FROM inventory_transactions
       WHERE reference_type = 'order_restore' AND reference_id = ?
       LIMIT 1`,
      [orderId]
    ).catch((err) => {
      if (err?.code === 'ER_NO_SUCH_TABLE') return [[]];
      throw err;
    });

    if (Array.isArray(alreadyRows) && alreadyRows.length) {
      await conn.rollback();
      return res.status(400).json({ message: 'Hóa đơn này đã hoàn kho trước đó' });
    }

    const [items] = await conn.query(
      `SELECT product_id, quantity FROM order_items WHERE order_id = ?`,
      [orderId]
    );

    if (!items.length) {
      await conn.rollback();
      return res.status(400).json({ message: 'Hóa đơn không có sản phẩm để hoàn kho' });
    }

    const demandMap = new Map();
    for (const it of items) {
      const pid = toNum(it.product_id, 0);
      const qty = toNum(it.quantity, 0);
      if (pid <= 0 || qty <= 0) continue;

      const [rows] = await conn.query(
        `SELECT ingredient_id, amount_needed FROM recipes WHERE product_id = ?`,
        [pid]
      );

      for (const rr of rows || []) {
        const iid = toNum(rr.ingredient_id, 0);
        const need = toNum(rr.amount_needed, 0) * qty;
        if (iid <= 0 || need <= 0) continue;
        demandMap.set(iid, (demandMap.get(iid) || 0) + need);
      }
    }

    if (!demandMap.size) {
      await conn.rollback();
      return res.status(400).json({ message: 'Không tìm thấy định mức recipes để hoàn kho' });
    }

    for (const [ingredientId, qtyBack] of demandMap.entries()) {
      const [[ing]] = await conn.query(
        `SELECT ingredient_id, stock_quantity FROM ingredients WHERE ingredient_id = ? FOR UPDATE`,
        [ingredientId]
      );
      if (!ing) {
        await conn.rollback();
        return res.status(404).json({ message: `Không tìm thấy nguyên liệu id=${ingredientId}` });
      }

      const before = toNum(ing.stock_quantity, 0);
      const after = before + qtyBack;
      await conn.query(`UPDATE ingredients SET stock_quantity = ? WHERE ingredient_id = ?`, [after, ingredientId]);

      await insertInventoryTx(conn, {
        ingredient_id: ingredientId,
        transaction_type: 'adjustment',
        quantity_change: qtyBack,
        quantity_before: before,
        quantity_after: after,
        reference_type: 'order_restore',
        reference_id: orderId,
        note: `Hoàn kho từ hóa đơn #${orderId}`,
        created_by: userId
      });
    }

    await conn.query(`UPDATE orders SET status = 'cancelled' WHERE order_id = ?`, [orderId]);

    await conn.commit();
    return res.json({ message: 'Hoàn kho theo hóa đơn thành công', order_id: orderId });
  } catch (error) {
    if (conn) {
      try { await conn.rollback(); } catch (_) {}
    }
    return res.status(500).json({ message: 'Lỗi hoàn kho theo hóa đơn', error: error.message });
  } finally {
    if (conn) conn.release();
  }
};
