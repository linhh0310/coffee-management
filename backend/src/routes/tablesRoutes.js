const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const tablesController = require('../controllers/tablesController');

router.get('/', authMiddleware, tablesController.getAllTables);

module.exports = router;

