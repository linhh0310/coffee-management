const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const inventoryController = require('../controllers/inventoryController');

// Ingredients
router.get('/', authMiddleware, inventoryController.getIngredients);
router.post('/', authMiddleware, requireRole('admin'), inventoryController.createIngredient);
router.put('/:id', authMiddleware, requireRole('admin'), inventoryController.updateIngredient);

// Import stock (phiếu nhập)
router.get('/receipts', authMiddleware, inventoryController.getStockReceipts);
router.post('/receipts', authMiddleware, requireRole('admin'), inventoryController.createStockReceipt);

// Stock take (kiểm kê)
router.get('/stock-takes', authMiddleware, inventoryController.getStockTakes);
router.post('/stock-takes', authMiddleware, requireRole('admin'), inventoryController.createStockTake);

// Inventory transaction history
router.get('/transactions', authMiddleware, inventoryController.getInventoryTransactions);
router.get('/summary', authMiddleware, inventoryController.getInventorySummary);

// Recipe by product (size-based)
router.get('/recipes/:productId', authMiddleware, inventoryController.getRecipesByProduct);
router.post('/recipes/:productId', authMiddleware, requireRole('admin'), inventoryController.upsertVariantRecipe);

// Restore stock by order (hoàn kho khi hủy/hoàn)
router.post('/restore/order/:orderId', authMiddleware, requireRole('admin'), inventoryController.restoreStockByOrder);

module.exports = router;
