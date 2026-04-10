const db = require('../config/db');

function normalizeImageUrl(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) return null;

    // Keep fully-qualified URLs and data URLs as-is.
    if (/^https?:\/\//i.test(value) || /^data:image\//i.test(value)) {
        return value;
    }

    // Keep root-relative paths (e.g. /uploads/products/a.jpg).
    if (value.startsWith('/')) {
        return value;
    }

    // Convert common relative paths to root-relative.
    if (/^(uploads|images|assets)\//i.test(value)) {
        return `/${value}`;
    }

    // Bare filenames (e.g. cafe-den.jpg) usually do not map to a served static path.
    return null;
}

/** Danh sách nguyên liệu + tồn kho (trang Quản lý sản phẩm & kho) */
exports.getIngredients = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        ingredient_id,
        ingredient_name,
        unit,
        stock_quantity,
        min_stock_alert,
        created_at,
        updated_at
      FROM ingredients
      ORDER BY
        (stock_quantity < min_stock_alert) DESC,
        ingredient_name ASC
    `);
    res.status(200).json(rows || []);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy tồn kho nguyên liệu', error: error.message });
  }
};

exports.getAllProducts = async (req, res) => {
    try {
        // Lấy tất cả sản phẩm + tên danh mục (nếu có)
        const [rows] = await db.query(`
            SELECT 
                p.*,
                c.category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            ORDER BY p.product_id DESC
        `);
        const normalizedRows = (rows || []).map((row) => ({
            ...row,
            image_url: normalizeImageUrl(row.image_url)
        }));
        res.status(200).json(normalizedRows);
    } catch (error) {
        res.status(500).json({ message: "Lỗi lấy danh sách sản phẩm", error: error.message });
    }
};

exports.getPublicProducts = async (_req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT
                p.product_id,
                p.product_name,
                p.base_price,
                p.sale_price,
                p.image_url,
                p.is_available,
                c.category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.category_id
            WHERE p.is_available = 1
            ORDER BY p.product_id DESC
        `);

        const normalizedRows = (rows || []).map((row) => ({
            ...row,
            image_url: normalizeImageUrl(row.image_url)
        }));

        res.status(200).json(normalizedRows);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi lấy sản phẩm trang chủ', error: error.message });
    }
};

exports.getCategories = async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT category_id, category_name FROM categories ORDER BY category_name ASC`);
        res.status(200).json(rows || []);
    } catch (error) {
        res.status(500).json({ message: 'Lỗi lấy danh mục', error: error.message });
    }
};

exports.createProduct = async (req, res) => {
    const { category_id, product_name, base_price, sale_price, image_url, is_available } = req.body || {};

    if (!String(product_name || '').trim()) {
        return res.status(400).json({ message: 'Tên sản phẩm là bắt buộc' });
    }

    const categoryId = category_id ? Number(category_id) : null;
    const basePrice = base_price == null || base_price === '' ? null : Number(base_price);
    const salePrice = sale_price == null || sale_price === '' ? null : Number(sale_price);
    const isAvailable = Number(is_available) === 0 ? 0 : 1;

    try {
        const [result] = await db.query(
            `INSERT INTO products (category_id, product_name, base_price, sale_price, image_url, is_available)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [categoryId, String(product_name).trim(), basePrice, salePrice, String(image_url || '').trim() || null, isAvailable]
        );

        const [rows] = await db.query(
            `SELECT p.*, c.category_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.category_id
             WHERE p.product_id = ?`,
            [result.insertId]
        );

        const product = rows?.[0] ? { ...rows[0], image_url: normalizeImageUrl(rows[0].image_url) } : null;
        return res.status(201).json({ message: 'Thêm sản phẩm thành công', product });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi thêm sản phẩm', error: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    const productId = Number(req.params.id);
    const { category_id, product_name, base_price, sale_price, image_url, is_available } = req.body || {};

    if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ message: 'product_id không hợp lệ' });
    }
    if (!String(product_name || '').trim()) {
        return res.status(400).json({ message: 'Tên sản phẩm là bắt buộc' });
    }

    const categoryId = category_id ? Number(category_id) : null;
    const basePrice = base_price == null || base_price === '' ? null : Number(base_price);
    const salePrice = sale_price == null || sale_price === '' ? null : Number(sale_price);
    const isAvailable = Number(is_available) === 0 ? 0 : 1;

    try {
        const [result] = await db.query(
            `UPDATE products
             SET category_id = ?, product_name = ?, base_price = ?, sale_price = ?, image_url = ?, is_available = ?
             WHERE product_id = ?`,
            [categoryId, String(product_name).trim(), basePrice, salePrice, String(image_url || '').trim() || null, isAvailable, productId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
        }

        const [rows] = await db.query(
            `SELECT p.*, c.category_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.category_id
             WHERE p.product_id = ?`,
            [productId]
        );

        const product = rows?.[0] ? { ...rows[0], image_url: normalizeImageUrl(rows[0].image_url) } : null;
        return res.json({ message: 'Cập nhật sản phẩm thành công', product });
    } catch (error) {
        return res.status(500).json({ message: 'Lỗi cập nhật sản phẩm', error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    const productId = Number(req.params.id);

    if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ message: 'product_id không hợp lệ' });
    }

    try {
        const [result] = await db.query('DELETE FROM products WHERE product_id = ?', [productId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
        }
        return res.json({ message: 'Xóa sản phẩm thành công' });
    } catch (error) {
        if (error?.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ message: 'Không thể xóa vì sản phẩm đã có trong đơn hàng' });
        }
        return res.status(500).json({ message: 'Lỗi xóa sản phẩm', error: error.message });
    }
};

exports.updateAvailability = async (req, res) => {
    const productId = Number(req.params.id);
    const { is_available } = req.body || {};

    if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ message: "product_id không hợp lệ" });
    }

    const nextVal = Number(is_available);
    if (![0, 1].includes(nextVal)) {
        return res.status(400).json({ message: "is_available phải là 0 hoặc 1" });
    }

    try {
        const [result] = await db.query(
            'UPDATE products SET is_available = ? WHERE product_id = ?',
            [nextVal, productId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Không tìm thấy sản phẩm" });
        }

        return res.json({ message: "Cập nhật trạng thái thành công", product_id: productId, is_available: nextVal });
    } catch (error) {
        return res.status(500).json({ message: "Lỗi cập nhật trạng thái", error: error.message });
    }
};