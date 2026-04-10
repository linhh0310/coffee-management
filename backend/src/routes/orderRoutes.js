const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');

// API thống kê hàng ngày
router.get('/stats/daily', authMiddleware, requireRole('admin'), orderController.getDailyStats);

// API đơn hàng gần đây
router.get('/recent', authMiddleware, orderController.getRecentOrders);

// API analytics cho trang thống kê
router.get('/analytics', authMiddleware, requireRole('admin'), orderController.getAnalytics);

// API danh sách hóa đơn
router.get('/invoices', authMiddleware, requireRole('admin'), orderController.getInvoices);

// API chi tiết hóa đơn
router.get('/invoices/:id', authMiddleware, orderController.getInvoiceDetail);

// API checkout tạo đơn hàng + chi tiết
router.post('/checkout', authMiddleware, orderController.checkoutOrder);

// API xác nhận đơn hàng đã thanh toán (thủ công)
router.patch('/:id/mark-paid', authMiddleware, orderController.markOrderPaid);

module.exports = router;