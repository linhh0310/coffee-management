const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const userController = require('../controllers/userController');

router.get('/', authMiddleware, requireRole('admin'), userController.getUsers);
router.post('/', authMiddleware, requireRole('admin'), userController.createStaff);
router.patch('/:id', authMiddleware, requireRole('admin'), userController.updateUserProfile);
router.put('/:id', authMiddleware, requireRole('admin'), userController.updateUserProfile);
router.delete('/:id', authMiddleware, requireRole('admin'), userController.deleteUser);
router.patch('/:id/reset-password', authMiddleware, requireRole('admin'), userController.resetUserPassword);
router.patch('/:id/status', authMiddleware, requireRole('admin'), userController.updateUserStatus);
router.get('/attendance', authMiddleware, requireRole('admin', 'staff'), userController.getAttendance);
router.get('/attendance/export', authMiddleware, requireRole('admin'), userController.exportAttendanceCsv);
router.post('/:id/attendance', authMiddleware, requireRole('admin', 'staff'), userController.upsertAttendance);
router.patch('/:id/attendance/adjust', authMiddleware, requireRole('admin'), userController.adjustAttendance);
router.patch('/:id/shift', authMiddleware, requireRole('admin'), userController.updateUserShift);
router.get('/payroll', authMiddleware, requireRole('admin', 'staff'), userController.getPayroll);
router.patch('/payroll/:id/payment-status', authMiddleware, requireRole('admin'), userController.updatePayrollPaymentStatus);
router.get('/:id/monthly-detail', authMiddleware, requireRole('admin'), userController.getUserMonthlyDetail);

module.exports = router;

