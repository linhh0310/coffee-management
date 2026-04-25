import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

function tierInfo(points = 0) {
  const p = Number(points || 0);
  if (p >= 5000) return { tier: 'Platinum', nextMilestone: 8000, color: 'text-violet-700', perks: ['Giảm 15% đồ uống theo tháng', 'Ưu tiên sự kiện workshop', 'Quà sinh nhật đặc biệt'] };
  if (p >= 2000) return { tier: 'Gold', nextMilestone: 5000, color: 'text-amber-700', perks: ['Giảm 10% vào Thứ 6', 'Tích điểm x1.2', 'Voucher đồ uống theo mùa'] };
  if (p >= 800) return { tier: 'Silver', nextMilestone: 2000, color: 'text-slate-700', perks: ['Giảm 5% cho hóa đơn từ 2 món', 'Ưu đãi combo tại quầy', 'Nhận tin ưu đãi sớm'] };
  return { tier: 'Bronze', nextMilestone: 800, color: 'text-orange-700', perks: ['Tích điểm mỗi hóa đơn', 'Nhận ưu đãi khai vị thành viên', 'Ưu đãi sinh nhật cơ bản'] };
}

function formatVnd(v) {
  return `${Math.round(Number(v || 0)).toLocaleString('vi-VN')}đ`;
}

function formatDateTime(v) {
  if (!v) return '-';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return { full: String(v), date: String(v), time: '' };
  return {
    full: d.toLocaleString('vi-VN'),
    date: d.toLocaleDateString('vi-VN'),
    time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  };
}

function normalizeDateInputValue(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function getInvoiceStatusMeta(status) {
  if (status === 'paid') return { label: 'Hoàn thành', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (status === 'pending') return { label: 'Chờ thanh toán', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Đã hủy', className: 'bg-red-50 text-red-700 border-red-200' };
}

function isJwtExpired(token) {
  try {
    if (!token) return true;
    const payload = JSON.parse(atob(String(token).split('.')[1] || ''));
    const exp = Number(payload?.exp || 0);
    if (!exp) return false;
    return Date.now() >= exp * 1000;
  } catch (_err) {
    return true;
  }
}

export default function Account() {
  const navigate = useNavigate();
  const customerToken = localStorage.getItem('customerToken');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [customer, setCustomer] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    birth_date: ''
  });

  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [feedback, setFeedback] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [extraLoading, setExtraLoading] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [openAccountMenu, setOpenAccountMenu] = useState(false);

  const notify = React.useCallback((text) => {
    if (!text) return;
    setMessage(text);
    window.setTimeout(() => {
      setMessage('');
    }, 2200);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadMyProfile = async () => {
      if (!customerToken) return;
      if (isJwtExpired(customerToken)) {
        localStorage.removeItem('customerToken');
        localStorage.removeItem('customerProfile');
        setMessage('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        return;
      }
      try {
        setLoading(true);
        const res = await axios.get('/api/customers/me', {
          headers: { Authorization: `Bearer ${customerToken}` }
        });

        if (!mounted) return;
        if (res.data?.customer) {
          const c = res.data.customer;
          setCustomer(c);
          setProfileForm((prev) => ({
            ...prev,
            full_name: c.full_name || '',
            phone: c.phone || '',
            email: c.email || '',
            birth_date: normalizeDateInputValue(c.birth_date)
          }));
        }
      } catch (err) {
        if (!mounted) return;
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          localStorage.removeItem('customerToken');
          localStorage.removeItem('customerProfile');
          setMessage('Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.');
          return;
        }
        setMessage(err?.response?.data?.message || 'Không thể tải thông tin tài khoản.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadMyProfile();
    return () => {
      mounted = false;
    };
  }, [customerToken]);

  const handleLogout = () => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerProfile');
    setCustomer(null);
    setMessage('Bạn đã đăng xuất tài khoản khách hàng.');
    navigate('/');
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    if (!customerToken) {
      setMessage('Vui lòng đăng nhập để cập nhật hồ sơ.');
      return;
    }

    if (!String(profileForm.full_name || '').trim()) {
      setMessage('Vui lòng nhập họ và tên.');
      return;
    }

    try {
      setLoading(true);
      const res = await axios.patch(
        '/api/customers/me',
        {
          full_name: profileForm.full_name,
          phone: profileForm.phone,
          email: profileForm.email,
          birth_date: profileForm.birth_date || ''
        },
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );

      if (res.data?.customer) {
        setCustomer((prev) => ({ ...prev, ...res.data.customer }));
        setProfileForm((prev) => ({
          ...prev,
          full_name: res.data.customer.full_name || '',
          phone: res.data.customer.phone || '',
          email: res.data.customer.email || '',
          birth_date: normalizeDateInputValue(res.data.customer.birth_date)
        }));
      }
      notify(res.data?.message || 'Cập nhật thông tin cá nhân thành công.');
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Không thể cập nhật hồ sơ lúc này.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      setMessage('Vui lòng nhập đầy đủ thông tin đổi mật khẩu.');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setMessage('Mật khẩu mới và xác nhận chưa khớp.');
      return;
    }

    if (!customerToken) {
      setMessage('Vui lòng đăng nhập để đổi mật khẩu.');
      return;
    }

    try {
      setLoading(true);
      const res = await axios.patch(
        '/api/customers/auth/change-password',
        {
          old_password: passwordForm.current,
          new_password: passwordForm.next
        },
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );
      notify(res.data?.message || 'Đổi mật khẩu thành công.');
      setPasswordForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Không thể đổi mật khẩu lúc này.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendFeedback = (e) => {
    e.preventDefault();
    if (!feedback.trim()) {
      setMessage('Vui lòng nhập nội dung phản hồi.');
      return;
    }
    notify('Đã gửi phản hồi. Đội ngũ CSKH sẽ liên hệ sớm nhất.');
    setFeedback('');
  };

  useEffect(() => {
    let mounted = true;

    const loadExtraData = async () => {
      if (!customerToken || isJwtExpired(customerToken)) {
        if (!mounted) return;
        localStorage.removeItem('customerToken');
        localStorage.removeItem('customerProfile');
        setTransactions([]);
        setVouchers([]);
        return;
      }

      try {
        setExtraLoading(true);
        const [txRes, voucherRes] = await Promise.all([
          axios.get('/api/customers/me/transactions', { headers: { Authorization: `Bearer ${customerToken}` } }),
          axios.get('/api/customers/me/vouchers', { headers: { Authorization: `Bearer ${customerToken}` } })
        ]);

        if (!mounted) return;
        setTransactions(Array.isArray(txRes.data?.transactions) ? txRes.data.transactions : []);
        setVouchers(Array.isArray(voucherRes.data?.vouchers) ? voucherRes.data.vouchers : []);
      } catch (_err) {
        if (!mounted) return;
        setTransactions([]);
        setVouchers([]);
        setMessage('Không thể tải dữ liệu giao dịch/voucher từ hệ thống lúc này.');
      } finally {
        if (mounted) setExtraLoading(false);
      }
    };

    loadExtraData();
    return () => {
      mounted = false;
    };
  }, [customerToken]);

  const tier = tierInfo(customer?.points || 0);
  const points = Number(customer?.points || 0);
  const progress = Math.min(100, Math.round((points / tier.nextMilestone) * 100));
  const transactionRows = transactions;
  const filteredInvoices = useMemo(() => {
    const keyword = String(invoiceSearch || '').trim().toLowerCase();
    return (transactionRows || []).filter((tx) => {
      const matchKeyword = !keyword
        || String(tx.id || '').toLowerCase().includes(keyword)
        || String(tx.store || '').toLowerCase().includes(keyword)
        || (tx.items || []).some((it) => String(it || '').toLowerCase().includes(keyword));
      const matchStatus = !invoiceStatus || String(tx.status || '') === invoiceStatus;
      return matchKeyword && matchStatus;
    });
  }, [transactionRows, invoiceSearch, invoiceStatus]);
  const voucherRows = vouchers;
  const activeVouchers = useMemo(() => voucherRows.filter((v) => v.status === 'active'), [voucherRows]);
  const usedOrExpired = useMemo(() => voucherRows.filter((v) => v.status !== 'active'), [voucherRows]);

  const tabs = [
    { id: 'profile', label: 'Thông tin cá nhân', icon: 'badge' },
    { id: 'tier', label: 'Điểm & hạng', icon: 'workspace_premium' },
    { id: 'transactions', label: 'Hóa đơn mua hàng', icon: 'receipt_long' },
    { id: 'vouchers', label: 'Voucher của tôi', icon: 'local_activity' },
    { id: 'security', label: 'Bảo mật', icon: 'shield_lock' },
    { id: 'support', label: 'Hỗ trợ', icon: 'support_agent' }
  ];

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#2f2117]">
      <header className="border-b border-[#e8dccf] bg-[#fffaf4]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <Link to="/" className="block w-[220px]">
            <div className="relative h-12 overflow-visible">
              <img
                src="/uploads/logo/logo.png"
                alt="The Coffee"
                className="absolute left-0 top-1/2 h-20 w-auto -translate-y-1/2 object-contain"
              />
            </div>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-semibold text-[#6b4d37] md:flex">
            <Link to="/story" className="hover:text-[#7a4a27]">Câu chuyện</Link>
            <Link to="/stores" className="hover:text-[#7a4a27]">Cửa hàng</Link>
            <Link to="/news" className="hover:text-[#7a4a27]">Tin tức</Link>
            <Link to="/account" className="hover:text-[#7a4a27]">Tài khoản</Link>
          </nav>
          <div className="flex items-center gap-3 relative">
            {!customerToken ? (
              <>
                <Link className="rounded-full border border-[#d5b899] px-4 py-2 text-sm font-semibold hover:bg-[#f7eadb]" to="/customer/login">
                  Đăng nhập
                </Link>
                <Link className="rounded-full bg-[#7a4a27] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5e3519]" to="/customer/register">
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
                    {(customer?.full_name || profileForm.full_name || 'U').slice(0, 1).toUpperCase()}
                  </span>
                  <span className="text-[16px] font-medium text-[#303742] leading-none">
                    {String(customer?.full_name || profileForm.full_name || 'Tài khoản').split(' ').slice(-2).join(' ')}
                  </span>
                  <span className="material-symbols-outlined text-[18px] text-[#6b7280]">expand_more</span>
                </button>

                {openAccountMenu && (
                  <div className="absolute right-0 top-[56px] z-30 w-52 rounded-xl border border-[#eadfd4] bg-white shadow-lg overflow-hidden">
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
                      onClick={() => {
                        setOpenAccountMenu(false);
                        handleLogout();
                      }}
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

      <section className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
        {message && (
          <div className="fixed right-6 top-20 z-[60] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-lg animate-[fadeIn_0.2s_ease]">
            {message}
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <aside className="lg:col-span-3">
            <div className="rounded-2xl border border-[#ead9c7] bg-white shadow-sm">
              <div className="border-b border-[#f0e3d6] p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f1f1f1] text-sm font-bold text-[#666]">
                    {(customer?.full_name || profileForm.full_name || 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#202020]">{customer?.full_name || profileForm.full_name || 'Khách thành viên'}</p>
                    <p className="truncate text-xs text-[#7a7a7a]">{customer?.email || profileForm.email || 'Chưa có email'}</p>
                  </div>
                </div>
              </div>

              <div className="p-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`mb-1 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${activeTab === tab.id ? 'border-[#efcfb2] bg-[#fff3e7] text-[#d56b27] font-semibold' : 'border-transparent text-[#3e3e3e] hover:border-[#f2e1d0] hover:bg-[#fcf8f3]'}`}
                  >
                    <span className="material-symbols-outlined text-[18px] leading-none">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm text-[#3e3e3e] hover:bg-[#f8f8f8]"
                >
                  Đăng xuất
                </button>
              </div>
            </div>
          </aside>

          <main className="lg:col-span-9 rounded-2xl border border-[#ead9c7] bg-white p-6 md:p-8 lg:p-10 shadow-sm">
            {!customerToken && (
              <div className="mb-6 rounded-xl border border-[#ececec] bg-[#fafafa] p-4">
                <p className="text-sm font-semibold text-[#333]">Bạn chưa đăng nhập tài khoản thành viên.</p>
                <p className="mt-1 text-xs text-[#777]">Đăng nhập để xem điểm, giao dịch tại quầy và voucher thật từ hệ thống.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to="/customer/login" className="rounded-lg border border-[#ddd] px-3 py-2 text-xs font-semibold text-[#555]">Đăng nhập</Link>
                  <Link to="/customer/register" className="rounded-lg bg-[#ff5b1a] px-3 py-2 text-xs font-semibold text-white">Đăng ký</Link>
                </div>
              </div>
            )}

            {activeTab === 'profile' && (
              <section className="space-y-4">
                <div className="max-w-4xl rounded-[24px] border border-[#efdfd2] bg-white p-5 shadow-[0_12px_24px_rgba(122,74,39,0.07)]">
                  <div className="flex items-start justify-between gap-4 border-b border-[#ece2d8] pb-4">
                    <div className="max-w-2xl">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b07a4f]">Hồ sơ thành viên</p>
                      <h3 className="mt-2 text-[24px] font-extrabold leading-tight text-[#2f2117]">Thông tin cá nhân</h3>
                      <p className="mt-2 text-[14px] leading-[1.6] text-[#8a684c]">
                        Cập nhật thông tin cơ bản để đồng bộ tài khoản thành viên và nhận ưu đãi phù hợp.
                      </p>
                    </div>
                    <div className="hidden rounded-[16px] bg-[#fbf1e7] px-5 py-3 text-center md:block">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b07a4f]">Tài khoản</p>
                      <p className="mt-1 text-[14px] font-extrabold leading-[1.4] text-[#8c5c2f]">Cập nhật ngay</p>
                    </div>
                  </div>

                  <form onSubmit={handleSaveProfile} className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#a16f43]">Họ và tên</label>
                      <input className="w-full rounded-[16px] border border-[#ead9c8] bg-white px-4 py-3 text-[14px] text-[#2a2018] outline-none transition placeholder:text-[#b7b0c0] focus:border-[#d7b28f] focus:ring-4 focus:ring-[#f6e6d5]" value={profileForm.full_name} onChange={(e) => setProfileForm((s) => ({ ...s, full_name: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#a16f43]">Email</label>
                      <input className="w-full rounded-[16px] border border-[#ead9c8] bg-white px-4 py-3 text-[14px] text-[#2a2018] outline-none transition placeholder:text-[#b7b0c0] focus:border-[#d7b28f] focus:ring-4 focus:ring-[#f6e6d5]" value={profileForm.email} onChange={(e) => setProfileForm((s) => ({ ...s, email: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#a16f43]">Số điện thoại</label>
                      <input className="w-full rounded-[16px] border border-[#ead9c8] bg-white px-4 py-3 text-[14px] text-[#2a2018] outline-none transition placeholder:text-[#b7b0c0] focus:border-[#d7b28f] focus:ring-4 focus:ring-[#f6e6d5]" value={profileForm.phone} onChange={(e) => setProfileForm((s) => ({ ...s, phone: e.target.value }))} />
                    </div>
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#a16f43]">Ngày sinh</label>
                      <input type="date" className="w-full rounded-[16px] border border-[#ead9c8] bg-white px-4 py-3 text-[14px] text-[#2a2018] outline-none transition focus:border-[#d7b28f] focus:ring-4 focus:ring-[#f6e6d5]" value={profileForm.birth_date || ''} onChange={(e) => setProfileForm((s) => ({ ...s, birth_date: e.target.value }))} />
                    </div>
                    <div className="md:col-span-2 pt-1">
                      <p className="text-[13px] leading-[1.6] text-[#9a7b62]">
                        Hãy giữ thông tin chính xác để hệ thống ghi nhận điểm thưởng và ưu đãi đúng tài khoản của bạn.
                      </p>
                      <button type="submit" className="mt-4 rounded-[14px] bg-[#ff5b1a] px-6 py-3 text-[14px] font-extrabold text-white shadow-[0_10px_20px_rgba(255,91,26,0.22)] transition hover:bg-[#ea4f0f]">
                        {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            )}

            {activeTab === 'tier' && (
              <section className="space-y-4">
                <div className="max-w-4xl rounded-[24px] border border-[#efdfd2] bg-white p-5 shadow-[0_12px_24px_rgba(122,74,39,0.07)]">
                  <div className="flex items-start justify-between gap-4 border-b border-[#ece2d8] pb-4">
                    <div className="max-w-2xl">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b07a4f]">Thành viên thân thiết</p>
                      <h3 className="mt-2 text-[24px] font-extrabold leading-tight text-[#2f2117]">Điểm tích lũy & hạng thành viên</h3>
                      <p className="mt-2 text-[14px] leading-[1.6] text-[#8a684c]">
                        Theo dõi điểm hiện tại, hạng thành viên và quyền lợi bạn đang sở hữu.
                      </p>
                    </div>
                    <div className="hidden rounded-[16px] bg-[#fbf1e7] px-5 py-3 text-center md:block">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b07a4f]">Loyalty</p>
                      <p className="mt-1 text-[14px] font-extrabold leading-[1.4] text-[#8c5c2f]">{progress}%</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="rounded-[18px] border border-[#f0e2d3] bg-[#fffaf6] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a07b61]">Điểm hiện tại</p>
                      <p className="mt-2 text-[22px] font-black text-[#ff5b1a]">{points}</p>
                    </div>
                    <div className="rounded-[18px] border border-[#f0e2d3] bg-[#fffaf6] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a07b61]">Hạng hiện tại</p>
                      <p className={`mt-2 text-[22px] font-black ${tier.color}`}>{tier.tier}</p>
                    </div>
                    <div className="rounded-[18px] border border-[#f0e2d3] bg-[#fffaf6] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a07b61]">Mốc tiếp theo</p>
                      <p className="mt-2 text-[22px] font-black text-[#2f2117]">{tier.nextMilestone}</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[18px] border border-[#f2e2d3] bg-[#fff8f2] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-semibold text-[#7a5b44]">Tiến độ lên mốc kế tiếp</p>
                      <p className="text-[13px] font-bold text-[#a16f43]">{progress}%</p>
                    </div>
                    <div className="mt-3 h-2.5 w-full rounded-full bg-[#ecd8c7]">
                      <div className="h-2.5 rounded-full bg-[#ff5b1a]" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <div className="mt-5 rounded-[18px] border border-[#f2e2d3] bg-[#fff8f2] p-4">
                    <p className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#a16f43]">Quyền lợi hạng {tier.tier}</p>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-[14px] leading-[1.6] text-[#6f5a49]">
                      {tier.perks.map((perk) => <li key={perk}>{perk}</li>)}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'transactions' && (
              <section className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-[32px] font-extrabold tracking-tight text-[#2a2018]">Hóa đơn mua hàng</h3>
                  <div className="text-xs text-[#7a7a7a]">Tổng: <b>{filteredInvoices.length}</b> hóa đơn</div>
                </div>

                {!customerToken ? (
                  <div className="mt-4 rounded-lg border border-[#efefef] bg-[#fafafa] p-4 text-sm text-[#666]">
                    Vui lòng đăng nhập tài khoản thành viên để xem hóa đơn thật từ hệ thống.
                  </div>
                ) : extraLoading ? (
                  <div className="mt-4 space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-lg skeleton" />
                    ))}
                  </div>
                ) : transactionRows.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-[#efefef] bg-[#fafafa] p-4 text-sm text-[#666]">
                    Chưa có hóa đơn mua hàng nào được ghi nhận cho tài khoản này.
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-[#efe4d9] bg-[#fffaf6] p-3 grid grid-cols-1 lg:grid-cols-[1.8fr_1fr_0.9fr] gap-3 items-center">
                      <input
                        className="min-w-0 w-full rounded-xl border border-[#ece0d5] bg-white px-4 py-3 text-sm"
                        placeholder="Tìm mã hóa đơn / sản phẩm / cửa hàng"
                        value={invoiceSearch}
                        onChange={(e) => setInvoiceSearch(e.target.value)}
                      />
                      <select
                        className="w-full rounded-xl border border-[#ece0d5] bg-white px-4 py-3 text-sm"
                        value={invoiceStatus}
                        onChange={(e) => setInvoiceStatus(e.target.value)}
                      >
                        <option value="">Tất cả trạng thái</option>
                        <option value="paid">Đã thanh toán</option>
                        <option value="pending">Chờ thanh toán</option>
                        <option value="cancelled">Đã hủy</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => {
                          setInvoiceSearch('');
                          setInvoiceStatus('');
                        }}
                        className="rounded-xl border border-[#e2d3c4] bg-white px-4 py-3 text-sm font-semibold text-[#7a4a27]"
                      >
                        Xóa bộ lọc
                      </button>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-2xl border border-[#ebe1d7] bg-white shadow-sm">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] table-fixed text-sm">
                          <thead className="bg-[#faf7f3] text-[#7b6a59]">
                            <tr>
                              <th className="px-4 py-4 text-left font-semibold whitespace-nowrap w-[150px]">Mã đơn hàng</th>
                              <th className="px-4 py-4 text-left font-semibold whitespace-nowrap w-[170px]">Ngày đặt hàng</th>
                              <th className="px-4 py-4 text-left font-semibold whitespace-nowrap w-[120px]">Mua tại</th>
                              <th className="px-4 py-4 text-left font-semibold whitespace-nowrap w-[130px]">Tổng tiền</th>
                              <th className="px-4 py-4 text-left font-semibold whitespace-nowrap w-[110px]">Điểm cộng</th>
                              <th className="px-4 py-4 text-left font-semibold whitespace-nowrap w-[130px]">Trạng thái</th>
                              <th className="px-4 py-4 text-right font-semibold whitespace-nowrap w-[140px]">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredInvoices.map((tx) => {
                              const dt = formatDateTime(tx.date);
                              const statusMeta = getInvoiceStatusMeta(tx.status);
                              return (
                                <tr key={tx.id} className="border-t border-[#f0e7dd] text-[#3a2d22] hover:bg-[#fffdfb]">
                                  <td className="px-4 py-4 align-top">
                                    <div className="font-semibold leading-5 text-[#2f2117] whitespace-nowrap">{tx.id}</div>
                                  </td>
                                  <td className="px-4 py-4 align-top text-[#6f6257]">
                                    <div className="whitespace-nowrap font-medium">{dt.date}</div>
                                    <div className="whitespace-nowrap text-xs text-[#9a8b7c] mt-1">{dt.time}</div>
                                  </td>
                                  <td className="px-4 py-4 align-top text-[#4b3b2d] whitespace-nowrap">{tx.store}</td>
                                  <td className="px-4 py-4 align-top font-semibold text-[#2a2018] whitespace-nowrap">{formatVnd(tx.total)}</td>
                                  <td className="px-4 py-4 align-top whitespace-nowrap text-[#7a4a27] font-semibold">+{tx.points}</td>
                                  <td className="px-4 py-4 align-top whitespace-nowrap">
                                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold ${statusMeta.className}`}>
                                      {statusMeta.label}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 align-top text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedInvoice(tx)}
                                      className="rounded-xl border border-[#e2d3c4] px-4 py-2 text-xs font-semibold text-[#6b4125] hover:bg-[#f8f1ea]"
                                    >
                                      Xem chi tiết
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {!filteredInvoices.length && (
                        <div className="border-t border-[#f0e7dd] p-4 text-sm text-[#666]">
                          Không tìm thấy hóa đơn phù hợp với điều kiện lọc.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}

            {activeTab === 'vouchers' && (
              <section className="space-y-4">
                {!customerToken ? (
                  <div className="rounded-xl border border-[#efdfd2] bg-white p-4 text-sm text-[#6f6257] shadow-[0_8px_20px_rgba(122,74,39,0.07)]">
                    Vui lòng đăng nhập tài khoản thành viên để xem voucher thật từ hệ thống.
                  </div>
                ) : extraLoading ? (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="h-[320px] rounded-[24px] skeleton" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <div className="rounded-[24px] border border-[#d9eadf] bg-white p-4 shadow-[0_12px_24px_rgba(122,74,39,0.07)]">
                      <div className="flex items-start justify-between gap-3 border-b border-[#e8efe7] pb-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#3e9a61]">Voucher còn hiệu lực</p>
                          <h3 className="mt-1.5 text-[22px] font-extrabold leading-tight text-[#17352c]">Sẵn sàng để sử dụng</h3>
                        </div>
                        <div className="rounded-full bg-[#eef8f0] px-3 py-1.5 text-xs font-bold text-[#2f7d47]">
                          {activeVouchers.length} voucher
                        </div>
                      </div>

                      <div className="mt-4">
                        {activeVouchers.length === 0 ? (
                          <div className="rounded-[18px] border border-dashed border-[#d9eadf] bg-[#fbfefb] p-4 text-sm text-[#5f7467]">
                            Hiện chưa có voucher còn hiệu lực.
                          </div>
                        ) : activeVouchers.map((v) => (
                          <article key={v.code} className="rounded-[20px] border border-[#d6eadb] bg-[#f8fcf8] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <span className="inline-flex rounded-full bg-[#2f7d47] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white">
                                  {v.code}
                                </span>
                                <div className="mt-2">
                                  <span className="inline-flex rounded-full border border-[#cfe5d5] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#2f7d47]">
                                    Còn hạn
                                  </span>
                                </div>
                              </div>
                              <div className="min-w-[100px] rounded-[16px] bg-white px-4 py-3 text-center shadow-[0_6px_16px_rgba(0,0,0,0.04)]">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#93a39c]">HSD</p>
                                <p className="mt-2 text-[14px] font-extrabold text-[#1f8b45]">{v.expiry}</p>
                              </div>
                            </div>

                            <div className="mt-4 max-w-[220px]">
                              <p className="text-[18px] font-extrabold leading-[1.4] text-[#17352c]">{v.title}</p>
                              <p className="mt-2.5 text-[14px] leading-[1.6] text-[#587060]">{v.condition}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[#efdfd2] bg-white p-4 shadow-[0_12px_24px_rgba(122,74,39,0.07)]">
                      <div className="flex items-start justify-between gap-3 border-b border-[#ece2d8] pb-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#b07a4f]">Lịch sử ưu đãi</p>
                          <h3 className="mt-1.5 text-[22px] font-extrabold leading-tight text-[#2f2117]">Voucher đã dùng / hết hạn</h3>
                        </div>
                        <div className="rounded-full bg-[#f8efe6] px-3 py-1.5 text-xs font-bold text-[#7a5c47]">
                          {usedOrExpired.length} voucher
                        </div>
                      </div>

                      <div className="mt-4">
                        {usedOrExpired.length === 0 ? (
                          <div className="rounded-[18px] border border-dashed border-[#eadfd4] bg-white p-4 text-sm leading-[1.6] text-[#8a684c]">
                            Chưa có voucher đã dùng hoặc hết hạn.
                          </div>
                        ) : usedOrExpired.map((v) => (
                          <article key={v.code} className="rounded-[20px] border border-[#efe6dd] bg-[#fcfaf8] p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <span className="inline-flex rounded-full bg-[#f3ebe3] px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-[#7a5c47]">
                                  {v.code}
                                </span>
                                <div className="mt-2">
                                  <span className="inline-flex rounded-full border border-[#eadfd4] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#8b7768]">
                                    {v.status === 'used' ? 'Đã dùng' : 'Hết hạn'}
                                  </span>
                                </div>
                              </div>
                              <div className="min-w-[100px] rounded-[16px] bg-white px-4 py-3 text-center shadow-[0_6px_16px_rgba(0,0,0,0.04)]">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#a08b7a]">Thời hạn</p>
                                <p className="mt-2 text-[14px] font-extrabold text-[#7a5c47]">{v.expiry}</p>
                              </div>
                            </div>

                            <div className="mt-4 max-w-[220px]">
                              <p className="text-[18px] font-extrabold leading-[1.4] text-[#3d3025]">{v.title}</p>
                              <p className="mt-2.5 text-[14px] leading-[1.6] text-[#7d6f62]">{v.condition}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'security' && (
              <section className="space-y-4">
                <div className="max-w-3xl rounded-[24px] border border-[#efdfd2] bg-white p-5 shadow-[0_12px_24px_rgba(122,74,39,0.07)]">
                  <div className="flex items-start justify-between gap-4 border-b border-[#ece2d8] pb-4">
                    <div className="max-w-2xl">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b07a4f]">Cập nhật thông tin bảo mật</p>
                      <h3 className="mt-2 text-[24px] font-extrabold leading-tight text-[#2f2117]">Đổi mật khẩu</h3>
                      <p className="mt-2 text-[14px] leading-[1.6] text-[#8a684c]">
                        Điền đầy đủ thông tin bên dưới để thay đổi mật khẩu cho tài khoản của bạn.
                      </p>
                    </div>
                    <div className="hidden rounded-[16px] bg-[#fbf1e7] px-5 py-3 text-center md:block">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b07a4f]">Bảo mật</p>
                      <p className="mt-1 text-[14px] font-extrabold leading-[1.4] text-[#8c5c2f]">Cập nhật ngay</p>
                    </div>
                  </div>

                  <form onSubmit={handleChangePassword} className="mt-5 space-y-5">
                    <div>
                      <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#a16f43]">Mật khẩu hiện tại</label>
                      <input
                        type="password"
                        className="w-full rounded-[16px] border border-[#ead9c8] bg-white px-4 py-3 text-[14px] text-[#2a2018] outline-none transition placeholder:text-[#b7b0c0] focus:border-[#d7b28f] focus:ring-4 focus:ring-[#f6e6d5]"
                        placeholder="Nhập mật khẩu hiện tại"
                        value={passwordForm.current}
                        onChange={(e) => setPasswordForm((s) => ({ ...s, current: e.target.value }))}
                      />
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#a16f43]">Mật khẩu mới</label>
                        <input
                          type="password"
                          className="w-full rounded-[16px] border border-[#ead9c8] bg-white px-4 py-3 text-[14px] text-[#2a2018] outline-none transition placeholder:text-[#b7b0c0] focus:border-[#d7b28f] focus:ring-4 focus:ring-[#f6e6d5]"
                          placeholder="Tạo mật khẩu mới"
                          value={passwordForm.next}
                          onChange={(e) => setPasswordForm((s) => ({ ...s, next: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#a16f43]">Xác nhận mật khẩu mới</label>
                        <input
                          type="password"
                          className="w-full rounded-[16px] border border-[#ead9c8] bg-white px-4 py-3 text-[14px] text-[#2a2018] outline-none transition placeholder:text-[#b7b0c0] focus:border-[#d7b28f] focus:ring-4 focus:ring-[#f6e6d5]"
                          placeholder="Nhập lại mật khẩu mới"
                          value={passwordForm.confirm}
                          onChange={(e) => setPasswordForm((s) => ({ ...s, confirm: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="rounded-[16px] border border-[#f2e2d3] bg-[#fff8f2] px-4 py-3 text-[13px] leading-[1.6] text-[#8a684c]">
                      Mật khẩu mạnh nên có ít nhất 8 ký tự, bao gồm chữ cái viết hoa, chữ thường, số và ký tự đặc biệt.
                    </div>

                    <div className="pt-1">
                      <p className="text-[13px] leading-[1.6] text-[#9a7b62]">
                        Sau khi cập nhật, hãy dùng mật khẩu mới cho lần đăng nhập tiếp theo.
                      </p>
                      <button type="submit" className="mt-4 rounded-[14px] bg-[#ff5b1a] px-6 py-3 text-[14px] font-extrabold text-white shadow-[0_10px_20px_rgba(255,91,26,0.22)] transition hover:bg-[#ea4f0f]">
                        Cập nhật mật khẩu
                      </button>
                    </div>
                  </form>
                </div>
              </section>
            )}

            {activeTab === 'support' && (
              <section className="space-y-4">
                <div className="max-w-4xl rounded-[24px] border border-[#efdfd2] bg-white p-5 shadow-[0_12px_24px_rgba(122,74,39,0.07)]">
                  <div className="flex items-start justify-between gap-4 border-b border-[#ece2d8] pb-4">
                    <div className="max-w-2xl">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b07a4f]">Chăm sóc khách hàng</p>
                      <h3 className="mt-2 text-[24px] font-extrabold leading-tight text-[#2f2117]">Hỗ trợ</h3>
                      <p className="mt-2 text-[14px] leading-[1.6] text-[#8a684c]">
                        Liên hệ đội ngũ hỗ trợ hoặc gửi phản hồi để chúng tôi phục vụ bạn tốt hơn.
                      </p>
                    </div>
                    <div className="hidden rounded-[16px] bg-[#fbf1e7] px-5 py-3 text-center md:block">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b07a4f]">Support</p>
                      <p className="mt-1 text-[14px] font-extrabold leading-[1.4] text-[#8c5c2f]">Sẵn sàng</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <article className="rounded-[18px] border border-[#f0e2d3] bg-[#fffaf6] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a07b61]">Hotline CSKH</p>
                      <p className="mt-2 text-[22px] font-black text-[#ff5b1a]">1900 1234</p>
                      <p className="mt-2 text-[14px] leading-[1.6] text-[#6f5a49]">Hỗ trợ 08:00 - 22:00 mỗi ngày.</p>
                    </article>
                    <article className="rounded-[18px] border border-[#f0e2d3] bg-[#fffaf6] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a07b61]">Email hỗ trợ</p>
                      <p className="mt-2 text-[18px] font-black text-[#ff5b1a]">cskh@thecoffee.vn</p>
                      <p className="mt-2 text-[14px] leading-[1.6] text-[#6f5a49]">Phản hồi trong 24h làm việc.</p>
                    </article>
                  </div>

                  <form onSubmit={handleSendFeedback} className="mt-5 max-w-3xl">
                    <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#a16f43]">Gửi phản hồi</label>
                    <textarea
                      rows={4}
                      className="w-full rounded-[16px] border border-[#ead9c8] bg-white px-4 py-3 text-[14px] text-[#2a2018] outline-none transition placeholder:text-[#b7b0c0] focus:border-[#d7b28f] focus:ring-4 focus:ring-[#f6e6d5]"
                      placeholder="Nhập nội dung cần hỗ trợ..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                    />
                    <div className="pt-1">
                      <p className="text-[13px] leading-[1.6] text-[#9a7b62]">Chúng tôi sẽ phản hồi sớm nhất qua hotline hoặc email bạn đã đăng ký.</p>
                      <button type="submit" className="mt-4 rounded-[14px] bg-[#ff5b1a] px-6 py-3 text-[14px] font-extrabold text-white shadow-[0_10px_20px_rgba(255,91,26,0.22)] transition hover:bg-[#ea4f0f]">Gửi phản hồi</button>
                    </div>
                  </form>
                </div>
              </section>
            )}
          </main>
        </div>
      </section>

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-[360px] rounded-xl bg-[#f8f8f8] border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chi tiết hóa đơn</p>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="px-2 py-1 rounded-md border border-slate-200 text-slate-600 text-xs hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>

            <div className="p-3 bg-[#f3f3f3]">
              <div className="mx-auto w-full max-w-[320px] bg-white border border-slate-200 rounded-md p-4 text-slate-800">
                <div className="text-center border-b border-dashed border-slate-300 pb-3">
                  <h3 className="text-[28px] font-black leading-none text-[#b87414] tracking-tight">THE COFFEE</h3>
                  <p className="text-[11px] mt-1">Hóa đơn mua hàng thành viên</p>
                  <p className="text-[10px] text-slate-500">Cảm ơn bạn đã đồng hành cùng cửa hàng</p>
                </div>

                <div className="mt-3 text-[11px] grid grid-cols-2 gap-y-1">
                  <p><span className="font-semibold">Mã đơn</span> {selectedInvoice.id}</p>
                  <p className="text-right"><span className="font-semibold">Điểm</span> +{selectedInvoice.points}</p>
                  <p>Ngày: {formatDateTime(selectedInvoice.date).date} {formatDateTime(selectedInvoice.date).time}</p>
                  <p className="text-right">Khách: {customer?.full_name || profileForm.full_name || 'Thành viên'}</p>
                  <p className="col-span-2">Mua tại: {selectedInvoice.store}</p>
                </div>

                <div className="mt-3 border-t border-b border-slate-200 py-2">
                  <div className="grid grid-cols-12 text-[10px] font-bold text-slate-500 uppercase">
                    <div className="col-span-9">Tên món</div>
                    <div className="col-span-3 text-right">Ghi chú</div>
                  </div>

                  <div className="mt-1 space-y-1.5">
                    {(selectedInvoice.items || []).map((it, idx) => (
                      <div key={`${selectedInvoice.id}-${it}-${idx}`} className="grid grid-cols-12 text-[11px]">
                        <div className="col-span-9">
                          <p className="font-semibold leading-tight">{it}</p>
                          <p className="text-[10px] text-slate-500">Sản phẩm trong giao dịch của bạn</p>
                        </div>
                        <div className="col-span-3 text-right text-[10px] text-slate-500">Đã mua</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3 text-[11px] space-y-1">
                  <p className="flex items-center justify-between"><span>Tạm tính</span><span>{formatVnd(selectedInvoice.total)}</span></p>
                  <p className="flex items-center justify-between text-[#b87414] font-bold"><span>Điểm tích lũy</span><span>+{selectedInvoice.points}</span></p>
                  <p className="flex items-center justify-between text-lg font-black border-t border-dashed border-slate-300 pt-2 mt-1">
                    <span>TỔNG CỘNG</span><span>{formatVnd(selectedInvoice.total)}</span>
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-dashed border-slate-300 text-[10px] grid grid-cols-2 gap-2">
                  <div>
                    <p className="font-bold uppercase text-slate-500">Trạng thái</p>
                    <p className="font-black mt-0.5 text-emerald-600">{getInvoiceStatusMeta(selectedInvoice.status).label}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold uppercase text-slate-500">Cửa hàng</p>
                    <p className="font-semibold mt-0.5">{selectedInvoice.store}</p>
                  </div>
                </div>

                <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-center">
                  <p className="text-[10px] text-slate-500">CẢM ƠN BẠN ĐÃ LỰA CHỌN THE COFFEE</p>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="mt-2 px-4 py-1.5 rounded-full bg-[#b87414] text-white text-xs font-bold"
                  >
                    In hóa đơn
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
