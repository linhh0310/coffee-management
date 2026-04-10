const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const requireRole = require('../middlewares/requireRole');
const aiController = require('../controllers/aiController');

router.get('/best-selling', authMiddleware, requireRole('admin'), aiController.getBestSellingAnalysis);
router.get('/combo-suggestions', authMiddleware, requireRole('admin', 'staff'), aiController.getComboSuggestions);
router.get('/hourly-forecast', authMiddleware, requireRole('admin'), aiController.getHourlyForecast);
router.get('/insights/history', authMiddleware, requireRole('admin'), aiController.listInsightHistory);

module.exports = router;
