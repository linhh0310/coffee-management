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
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString('vi-VN');
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

  useEffect(() => {
    let mounted = true;

    const loadMyProfile = async () => {
      if (!customerToken) return;
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
            birth_date: c.birth_date || ''
          }));
          setMessage('Bạn đang đăng nhập tài khoản khách hàng.');
        }
      } catch (_err) {
        if (!mounted) return;
        localStorage.removeItem('customerToken');
        localStorage.removeItem('customerProfile');
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
          email: profileForm.email,
          birth_date: profileForm.birth_date || null
        },
        { headers: { Authorization: `Bearer ${customerToken}` } }
      );

      if (res.data?.customer) {
        setCustomer((prev) => ({ ...prev, ...res.data.customer }));
      }
      setMessage(res.data?.message || 'Cập nhật thông tin cá nhân thành công.');
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
      setMessage(res.data?.message || 'Đổi mật khẩu thành công.');
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
    setMessage('Đã gửi phản hồi. Đội ngũ CSKH sẽ liên hệ sớm nhất.');
    setFeedback('');
  };

  useEffect(() => {
    let mounted = true;

    const loadExtraData = async () => {
      if (!customerToken) {
        if (!mounted) return;
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
  const voucherRows = vouchers;
  const activeVouchers = useMemo(() => voucherRows.filter((v) => v.status === 'active'), [voucherRows]);
  const usedOrExpired = useMemo(() => voucherRows.filter((v) => v.status !== 'active'), [voucherRows]);

  const tabs = [
    { id: 'profile', label: 'Thông tin cá nhân', icon: 'badge' },
    { id: 'tier', label: 'Điểm & hạng', icon: 'workspace_premium' },
    { id: 'transactions', label: 'Giao dịch tại quầy', icon: 'receipt_long' },
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
          <div className="flex items-center gap-3">
            <Link className="rounded-full border border-[#d5b899] px-4 py-2 text-sm font-semibold hover:bg-[#f7eadb]" to="/customer/login">
              Đăng nhập
            </Link>
            <Link className="rounded-full bg-[#7a4a27] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5e3519]" to="/customer/register">
              Đăng ký
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
        {message && (
          <div className="mb-4 rounded-xl border border-[#f0d5bd] bg-[#fff7ef] px-4 py-3 text-sm text-[#7a4a27]">
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
              <section className="space-y-5">
                <h3 className="text-2xl font-bold text-[#2a2018]">Thông tin cá nhân</h3>
                <form onSubmit={handleSaveProfile} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#777]">Họ và tên</label>
                    <input className="w-full rounded-lg border border-[#ececec] bg-[#f7f7f7] px-3 py-2 text-sm" value={profileForm.full_name} onChange={(e) => setProfileForm((s) => ({ ...s, full_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#777]">Email</label>
                    <input className="w-full rounded-lg border border-[#ececec] bg-[#f7f7f7] px-3 py-2 text-sm" value={profileForm.email} onChange={(e) => setProfileForm((s) => ({ ...s, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#777]">Số điện thoại</label>
                    <input className="w-full rounded-lg border border-[#ececec] bg-[#f7f7f7] px-3 py-2 text-sm" value={profileForm.phone} onChange={(e) => setProfileForm((s) => ({ ...s, phone: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#777]">Ngày sinh</label>
                    <input type="date" className="w-full rounded-lg border border-[#ececec] bg-[#f7f7f7] px-3 py-2 text-sm" value={profileForm.birth_date || ''} onChange={(e) => setProfileForm((s) => ({ ...s, birth_date: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2 flex justify-end">
                    <button type="submit" className="rounded-lg bg-[#ff5b1a] px-5 py-2 text-sm font-semibold text-white">
                      {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {activeTab === 'tier' && (
              <section className="space-y-5">
                <h3 className="text-2xl font-bold text-[#2a2018]">Điểm tích lũy & hạng thành viên</h3>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-[#efefef] bg-[#fafafa] p-4">
                    <p className="text-xs text-[#777]">Điểm hiện tại</p>
                    <p className="mt-1 text-2xl font-black text-[#ff5b1a]">{points}</p>
                  </div>
                  <div className="rounded-lg border border-[#efefef] bg-[#fafafa] p-4">
                    <p className="text-xs text-[#777]">Hạng hiện tại</p>
                    <p className={`mt-1 text-2xl font-black ${tier.color}`}>{tier.tier}</p>
                  </div>
                  <div className="rounded-lg border border-[#efefef] bg-[#fafafa] p-4">
                    <p className="text-xs text-[#777]">Mốc tiếp theo</p>
                    <p className="mt-1 text-2xl font-black text-[#222]">{tier.nextMilestone}</p>
                  </div>
                </div>
                <div className="mt-4 h-2 w-full rounded-full bg-[#ececec]">
                  <div className="h-2 rounded-full bg-[#ff5b1a]" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs text-[#777]">Tiến độ lên mốc kế tiếp: {progress}%</p>

                <div className="mt-4 rounded-lg border border-[#efefef] bg-[#fafafa] p-4">
                  <p className="text-sm font-semibold">Quyền lợi hạng {tier.tier}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#555]">
                    {tier.perks.map((perk) => <li key={perk}>{perk}</li>)}
                  </ul>
                </div>
              </section>
            )}

            {activeTab === 'transactions' && (
              <section className="space-y-5">
                <h3 className="text-2xl font-bold text-[#2a2018]">Giao dịch tại quầy</h3>

                {!customerToken ? (
                  <div className="mt-4 rounded-lg border border-[#efefef] bg-[#fafafa] p-4 text-sm text-[#666]">
                    Vui lòng đăng nhập tài khoản thành viên để xem lịch sử giao dịch thật từ hệ thống.
                  </div>
                ) : extraLoading ? (
                  <div className="mt-4 space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-lg skeleton" />
                    ))}
                  </div>
                ) : transactionRows.length === 0 ? (
                  <div className="mt-4 rounded-lg border border-[#efefef] bg-[#fafafa] p-4 text-sm text-[#666]">
                    Chưa có giao dịch tại quầy nào được ghi nhận cho tài khoản này.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {transactionRows.map((tx) => (
                      <article key={tx.id} className="rounded-lg border border-[#efefef] bg-[#fafafa] p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-bold text-[#222]">{tx.id}</p>
                          <p className="text-xs text-[#777]">{formatDateTime(tx.date)}</p>
                        </div>
                        <p className="mt-1 text-sm text-[#555]">Cửa hàng: {tx.store}</p>
                        <div className="mt-2 flex flex-wrap gap-4 text-sm text-[#444]">
                          <p><span className="font-semibold">Tổng tiền:</span> {formatVnd(tx.total)}</p>
                          <p><span className="font-semibold">Điểm cộng:</span> +{tx.points}</p>
                        </div>
                        <ul className="mt-2 list-disc pl-5 text-sm text-[#555]">
                          {(tx.items || []).map((i) => <li key={`${tx.id}-${i}`}>{i}</li>)}
                        </ul>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'vouchers' && (
              <section className="space-y-5">
                <h3 className="text-2xl font-bold text-[#2a2018]">Voucher của tôi</h3>

                {!customerToken ? (
                  <div className="mt-4 rounded-lg border border-[#efefef] bg-[#fafafa] p-4 text-sm text-[#666]">
                    Vui lòng đăng nhập tài khoản thành viên để xem voucher thật từ hệ thống.
                  </div>
                ) : extraLoading ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-lg skeleton" />
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-sm font-semibold text-[#2f7d47]">Voucher còn hiệu lực</p>
                      <div className="space-y-2">
                        {activeVouchers.length === 0 ? (
                          <div className="rounded-lg border border-[#efefef] bg-[#fafafa] p-3 text-sm text-[#666]">Hiện chưa có voucher còn hiệu lực.</div>
                        ) : activeVouchers.map((v) => (
                          <article key={v.code} className="rounded-lg border border-[#d9efdf] bg-[#f6fff8] p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-bold">{v.code}</p>
                              <span className="text-xs font-semibold text-[#2f7d47]">Còn hạn</span>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-[#333]">{v.title}</p>
                            <p className="mt-1 text-xs text-[#666]">{v.condition}</p>
                            <p className="mt-1 text-xs text-[#777]">HSD: {v.expiry}</p>
                          </article>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-sm font-semibold text-[#666]">Voucher đã dùng / hết hạn</p>
                      <div className="space-y-2">
                        {usedOrExpired.length === 0 ? (
                          <div className="rounded-lg border border-[#efefef] bg-[#fafafa] p-3 text-sm text-[#666]">Chưa có voucher đã dùng hoặc hết hạn.</div>
                        ) : usedOrExpired.map((v) => (
                          <article key={v.code} className="rounded-lg border border-[#efefef] bg-[#fafafa] p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-bold text-[#555]">{v.code}</p>
                              <span className="text-xs font-semibold text-[#888]">{v.status === 'used' ? 'Đã dùng' : 'Hết hạn'}</span>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-[#444]">{v.title}</p>
                            <p className="mt-1 text-xs text-[#777]">{v.condition}</p>
                            <p className="mt-1 text-xs text-[#999]">{v.expiry}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {activeTab === 'security' && (
              <section className="space-y-5">
                <h3 className="text-2xl font-bold text-[#2a2018]">Bảo mật</h3>
                <form onSubmit={handleChangePassword} className="mt-4 max-w-xl space-y-3">
                  <input type="password" className="w-full rounded-lg border border-[#ececec] bg-[#f7f7f7] px-3 py-2 text-sm" placeholder="Mật khẩu hiện tại" value={passwordForm.current} onChange={(e) => setPasswordForm((s) => ({ ...s, current: e.target.value }))} />
                  <input type="password" className="w-full rounded-lg border border-[#ececec] bg-[#f7f7f7] px-3 py-2 text-sm" placeholder="Mật khẩu mới" value={passwordForm.next} onChange={(e) => setPasswordForm((s) => ({ ...s, next: e.target.value }))} />
                  <input type="password" className="w-full rounded-lg border border-[#ececec] bg-[#f7f7f7] px-3 py-2 text-sm" placeholder="Xác nhận mật khẩu mới" value={passwordForm.confirm} onChange={(e) => setPasswordForm((s) => ({ ...s, confirm: e.target.value }))} />
                  <div className="pt-1">
                    <button type="submit" className="rounded-lg bg-[#ff5b1a] px-5 py-2 text-sm font-semibold text-white">Cập nhật mật khẩu</button>
                  </div>
                </form>
              </section>
            )}

            {activeTab === 'support' && (
              <section className="space-y-5">
                <h3 className="text-2xl font-bold text-[#2a2018]">Hỗ trợ</h3>
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <article className="rounded-lg border border-[#efefef] bg-[#fafafa] p-4">
                    <p className="text-xs font-semibold text-[#777]">Hotline CSKH</p>
                    <p className="mt-1 text-xl font-black text-[#ff5b1a]">1900 1234</p>
                    <p className="mt-1 text-sm text-[#666]">Hỗ trợ 08:00 - 22:00 mỗi ngày.</p>
                  </article>
                  <article className="rounded-lg border border-[#efefef] bg-[#fafafa] p-4">
                    <p className="text-xs font-semibold text-[#777]">Email hỗ trợ</p>
                    <p className="mt-1 text-base font-black text-[#ff5b1a]">cskh@thecoffee.vn</p>
                    <p className="mt-1 text-sm text-[#666]">Phản hồi trong 24h làm việc.</p>
                  </article>
                </div>

                <form onSubmit={handleSendFeedback} className="mt-4 max-w-2xl">
                  <label className="mb-1 block text-xs font-semibold text-[#777]">Gửi phản hồi</label>
                  <textarea
                    rows={4}
                    className="w-full rounded-lg border border-[#ececec] bg-[#f7f7f7] px-3 py-2 text-sm"
                    placeholder="Nhập nội dung cần hỗ trợ..."
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                  />
                  <button type="submit" className="mt-3 rounded-lg bg-[#ff5b1a] px-5 py-2 text-sm font-semibold text-white">Gửi phản hồi</button>
                </form>
              </section>
            )}
          </main>
        </div>
      </section>
    </div>
  );
}
