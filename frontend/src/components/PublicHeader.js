import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { resolveMediaUrl } from '../utils/media';

const NAV_ITEMS = [
  { to: '/story', label: 'Câu chuyện' },
  { to: '/stores', label: 'Cửa hàng' },
  { to: '/news', label: 'Tin tức' },
  { to: '/account', label: 'Tài khoản' }
];

export default function PublicHeader({ sticky = false }) {
  const navigate = useNavigate();
  const [openAccountMenu, setOpenAccountMenu] = useState(false);
  const customerToken = localStorage.getItem('customerToken');

  let customerProfile = {};
  try {
    customerProfile = JSON.parse(localStorage.getItem('customerProfile') || '{}');
  } catch (_err) {
    customerProfile = {};
  }

  const handleCustomerLogout = () => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerProfile');
    setOpenAccountMenu(false);
    navigate('/');
  };

  return (
    <header className={`${sticky ? 'sticky top-0 z-40 ' : ''}border-b border-[#e8dccf] bg-[#fffaf4]/95 backdrop-blur fx-fade-up`}>
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:flex-nowrap md:px-6 md:py-4">
        <Link to="/" className="block w-[150px] shrink-0 sm:w-[190px] md:w-[220px]">
          <div className="relative h-10 overflow-visible md:h-12">
            <img
              src={resolveMediaUrl('/uploads/logo/logo.png')}
              alt="The Coffee"
              className="absolute left-0 top-1/2 h-16 w-auto -translate-y-1/2 object-contain md:h-20"
            />
          </div>
        </Link>

        <nav className="order-3 flex w-full items-center gap-2 overflow-x-auto pb-1 text-xs font-semibold text-[#6b4d37] md:order-none md:w-auto md:gap-5 md:overflow-visible md:pb-0 md:text-sm">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="shrink-0 rounded-full bg-white/70 px-3 py-2 hover:text-[#7a4a27] md:bg-transparent md:p-0"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="relative flex shrink-0 items-center gap-2 md:gap-3">
          {!customerToken ? (
            <>
              <Link className="rounded-full border border-[#d5b899] px-3 py-2 text-xs font-semibold hover:bg-[#f7eadb] sm:px-4 sm:text-sm" to="/customer/login">
                Đăng nhập
              </Link>
              <Link className="rounded-full bg-[#7a4a27] px-3 py-2 text-xs font-semibold text-white hover:bg-[#5e3519] sm:px-4 sm:text-sm" to="/customer/register">
                Đăng ký
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setOpenAccountMenu((v) => !v)}
                className="flex items-center gap-2 px-1 py-1"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#e7ebf0] text-[#5a6168] text-xs font-semibold">
                  {String(customerProfile?.full_name || customerProfile?.email || 'U').slice(0, 1).toUpperCase()}
                </span>
                <span className="text-[16px] font-medium text-[#303742] leading-none">
                  {String(customerProfile?.full_name || 'Tài khoản').split(' ').slice(-2).join(' ')}
                </span>
                <span className="material-symbols-outlined text-[18px] text-[#6b7280]">expand_more</span>
              </button>

              {openAccountMenu && (
                <div className="fixed right-6 top-16 z-[9999] w-52 rounded-xl border border-[#eadfd4] bg-white shadow-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenAccountMenu(false);
                      navigate('/account');
                    }}
                    className="w-full text-left px-4 py-3 text-sm font-medium text-[#2f2117] hover:bg-[#faf5ef]"
                  >
                    Tài khoản của tôi
                  </button>
                  <button
                    type="button"
                    onClick={handleCustomerLogout}
                    className="w-full text-left px-4 py-3 text-sm font-medium text-[#8b2b2b] hover:bg-[#fff1f1] border-t border-[#f2e5e5]"
                  >
                    Đăng xuất
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
