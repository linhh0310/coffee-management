const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const customerAuthMiddleware = require('../middlewares/customerAuthMiddleware');
const customerController = require('../controllers/customerController');

router.post('/auth/register', customerController.registerCustomer);
router.post('/auth/login', customerController.loginCustomer);
router.post('/auth/forgot-password/request-otp', customerController.requestResetOtp);
router.post('/auth/forgot-password/verify-otp', customerController.verifyResetOtp);
router.post('/auth/forgot-password/reset', customerController.resetPasswordByOtp);
router.patch('/auth/change-password', authMiddleware, customerAuthMiddleware, customerController.changeMyPassword);

router.get('/lookup', customerController.lookupCustomerPoints);
router.get('/me', authMiddleware, customerAuthMiddleware, customerController.getMyCustomerProfile);
router.patch('/me', authMiddleware, customerAuthMiddleware, customerController.updateMyCustomerProfile);
router.get('/me/transactions', authMiddleware, customerAuthMiddleware, customerController.getMyTransactions);
router.get('/me/vouchers', authMiddleware, customerAuthMiddleware, customerController.getMyVouchers);

router.get('/', authMiddleware, customerController.getCustomers);
router.post('/', authMiddleware, customerController.createCustomer);
router.patch('/:id/status', authMiddleware, customerController.updateCustomerStatus);
router.patch('/:id/points', authMiddleware, customerController.adjustPoints);

module.exports = router;

