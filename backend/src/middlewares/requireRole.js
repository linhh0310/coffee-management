module.exports = function requireRole(...allowedRoles) {
  const normalized = (allowedRoles || []).map((r) => String(r || '').trim().toLowerCase()).filter(Boolean);

  return (req, res, next) => {
    const role = String(req.user?.role || '').trim().toLowerCase();

    if (!role) {
      return res.status(403).json({ message: 'Không xác định được vai trò tài khoản' });
    }

    if (!normalized.length || normalized.includes(role)) {
      return next();
    }

    return res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này' });
  };
};
