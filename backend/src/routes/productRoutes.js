const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const inventoryController = require('../controllers/inventoryController');
const authMiddleware = require('../middlewares/authMiddleware'); // Import bảo vệ
const requireRole = require('../middlewares/requireRole');

// Public endpoint cho trang khách hàng
router.get('/public', productController.getPublicProducts);

// Chỉ những ai có Token mới gọi được link này
router.get('/', authMiddleware, productController.getAllProducts);
router.get('/categories', authMiddleware, productController.getCategories);
router.get('/ingredients/stock', authMiddleware, productController.getIngredients);

// Backward-compatible inventory endpoints (for clients still calling /api/products/*)
router.get('/ingredients/transactions', authMiddleware, inventoryController.getInventoryTransactions);
router.get('/ingredients/receipts', authMiddleware, inventoryController.getStockReceipts);
router.post('/ingredients/receipts', authMiddleware, requireRole('admin'), inventoryController.createStockReceipt);
router.get('/ingredients/stock-takes', authMiddleware, inventoryController.getStockTakes);
router.post('/ingredients/stock-takes', authMiddleware, requireRole('admin'), inventoryController.createStockTake);
router.get('/ingredients/recipes/:productId', authMiddleware, inventoryController.getRecipesByProduct);
router.post('/ingredients/recipes/:productId', authMiddleware, requireRole('admin'), inventoryController.upsertVariantRecipe);

// CRUD sản phẩm
router.post('/', authMiddleware, requireRole('admin'), productController.createProduct);
router.put('/:id', authMiddleware, requireRole('admin'), productController.updateProduct);
router.delete('/:id', authMiddleware, requireRole('admin'), productController.deleteProduct);

// Bật/tắt trạng thái bán của sản phẩm
router.patch('/:id/availability', authMiddleware, requireRole('admin'), productController.updateAvailability);

module.exports = router;