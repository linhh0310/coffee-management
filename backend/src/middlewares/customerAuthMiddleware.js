module.exports = (req, res, next) => {
  if (req.user?.role !== 'customer') {
    return res.status(403).json({ message: 'Chỉ tài khoản khách hàng mới truy cập được' });
  }
  return next();
};
