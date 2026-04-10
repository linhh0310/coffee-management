import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Trang chủ', icon: 'home', roles: ['admin'] },
  { path: '/sales', label: 'Bán hàng', icon: 'shopping_cart', roles: ['admin', 'staff'] },
  { path: '/stats', label: 'Thống kê', icon: 'bar_chart', roles: ['admin'] },
  { path: '/products', label: 'Sản phẩm', icon: 'inventory_2', roles: ['admin'] },
  { path: '/invoices', label: 'Hóa đơn', icon: 'receipt_long', roles: ['admin'] },
  { path: '/staff', label: 'Nhân viên', icon: 'badge', roles: ['admin', 'staff'] },
  { path: '/customers', label: 'Khách hàng', icon: 'person', roles: ['admin'] },
  { path: '/promotions', label: 'Khuyến mãi', icon: 'local_offer', roles: ['admin'] }
];

export default function Sidebar({ title = 'Coffee Admin', subtitle = 'Quản lý hệ thống' }) {
  const navigate = useNavigate();
  const location = useLocation();

  const staffProfile = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('staffProfile') || '{}');
    } catch (_) {
      return {};
    }
  }, []);

  const role = String(staffProfile?.role || 'staff').toLowerCase();
  const visibleItems = NAV_ITEMS.filter((it) => Array.isArray(it.roles) ? it.roles.includes(role) : true);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('staffProfile');
    navigate('/login');
  };

  return (
    <aside className="w-64 flex flex-col border-r border-orange-100 bg-white">
      <div className="p-6 flex items-center gap-3">
        <div className="size-10 rounded-full bg-[#b87414] flex items-center justify-center text-white shadow-sm">
          <span className="material-symbols-outlined">coffee</span>
        </div>
        <div className="text-left">
          <h1 className="text-[#b87414] font-bold text-lg leading-tight">{title}</h1>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-1 text-left">
        {visibleItems.map((it) => {
          const active = location.pathname === it.path;
          return (
            <button
              key={it.path}
              type="button"
              onClick={() => navigate(it.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                active
                  ? 'bg-[#b87414] text-white shadow-sm'
                  : 'text-slate-600 hover:bg-orange-50 hover:text-[#b87414]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">{it.icon}</span>
              <span className="text-sm font-medium">{it.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-orange-100 text-left">
        <button
          onClick={handleLogout}
          type="button"
          className="flex items-center gap-3 px-3 py-2 w-full text-slate-500 hover:text-red-500 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          <span className="text-sm font-medium">Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}

