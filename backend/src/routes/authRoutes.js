const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const authController = require('../controllers/authController');

function guardAdminOnly(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(403).json({ message: 'Chỉ admin mới được tạo tài khoản nhân viên' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload?.role !== 'admin') {
      return res.status(403).json({ message: 'Chỉ admin mới được tạo tài khoản nhân viên' });
    }
    req.user = payload;
    return next();
  } catch (_err) {
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }
}

// Đăng nhập nhân viên
router.post('/login', authController.login);

// Tạo tài khoản nhân viên - luôn chỉ admin
router.post('/register', guardAdminOnly, authController.register);

module.exports = router;
