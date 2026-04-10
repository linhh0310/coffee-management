const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const promotionController = require('../controllers/promotionController');

router.get('/', authMiddleware, requireRole('admin'), promotionController.getPromotions);
router.post('/', authMiddleware, requireRole('admin'), promotionController.createPromotion);
router.patch('/:id', authMiddleware, requireRole('admin'), promotionController.updatePromotion);
router.delete('/:id', authMiddleware, requireRole('admin'), promotionController.deletePromotion);
router.patch('/:id/status', authMiddleware, requireRole('admin'), promotionController.updatePromotionStatus);

module.exports = router;

