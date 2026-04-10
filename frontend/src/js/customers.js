import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';

function formatVnd(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('vi-VN')}đ`;
}

const TIERS = ['bronze', 'silver', 'gold', 'platinum'];

export default function Customers() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ totalCustomers: 0, activeCustomers: 0, vipCustomers: 0, totalPoints: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 1 });
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [tier, setTier] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ full_name: '', phone: '', email: '' });

  const handleLogout = React.useCallback(() => {
    localStorage.removeItem('token');
    navigate('/login');
  }, [navigate]);

  const fetchCustomers = React.useCallback(async (page = 1) => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      setLoading(true);
      setErrorMessage('');
      const res = await axios.get('/api/customers', {
        params: { page, limit: pagination.limit, q: q || undefined, status: status || undefined, tier: tier || undefined },
        headers: { Authorization: `Bearer ${token}` }
      });
      setRows(res.data?.customers || []);
      setSummary(res.data?.summary || {});
      setPagination({
        page: res.data?.page || 1,
        limit: res.data?.limit || 10,
        totalItems: res.data?.totalItems || 0,
        totalPages: res.data?.totalPages || 1
      });
    } catch (err) {
      if ([401, 403].includes(err?.response?.status)) return handleLogout();
      setErrorMessage(err?.response?.data?.message || 'Không thể tải danh sách khách hàng');
    } finally {
      setLoading(false);
    }
  }, [handleLogout, pagination.limit, q, status, tier]);

  useEffect(() => { fetchCustomers(1); }, [fetchCustomers]);

  const pages = useMemo(() => {
    const total = pagination.totalPages || 1;
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
    const p = pagination.page;
    const start = Math.max(1, p - 2);
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [pagination]);

  const toggleStatus = async (customerId, nextStatus) => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      await axios.patch(`/api/customers/${customerId}/status`, { status: nextStatus }, { headers: { Authorization: `Bearer ${token}` } });
      setRows((prev) => prev.map((r) => Number(r.customer_id) === Number(customerId) ? { ...r, status: nextStatus } : r));
    } catch (err) {
      if ([401, 403].includes(err?.response?.status)) return handleLogout();
      toast.error(err?.response?.data?.message || 'Cập nhật trạng thái thất bại');
    }
  };

  const adjustPoints = async (customerId, delta) => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      const res = await axios.patch(
        `/api/customers/${customerId}/points`,
        { delta_points: delta },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRows((prev) =>
        prev.map((r) =>
          Number(r.customer_id) === Number(customerId)
            ? { ...r, points: Number(res.data?.points || r.points), tier: res.data?.tier || r.tier }
            : r
        )
      );
    } catch (err) {
      if ([401, 403].includes(err?.response?.status)) return handleLogout();
      toast.error(err?.response?.data?.message || 'Cập nhật điểm thất bại');
    }
  };

  const createCustomer = async () => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      await axios.post('/api/customers', newCustomer, { headers: { Authorization: `Bearer ${token}` } });
      setShowCreate(false);
      setNewCustomer({ full_name: '', phone: '', email: '' });
      toast.success('Tạo khách hàng thành công');
      fetchCustomers(1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Tạo khách hàng thất bại');
    }
  };

  return (
    <div className="admin-shell flex h-screen overflow-hidden">
      <Sidebar />
      <main className="admin-main">
        <header className="admin-header">
          <h2 className="text-2xl font-extrabold text-slate-900">Quản lý Khách hàng</h2>
          <button type="button" onClick={() => setShowCreate(true)} className="px-4 py-2.5 rounded-xl bg-[#b87414] text-white font-semibold">
            + Thêm khách hàng
          </button>
        </header>

        <div className="p-8 space-y-6">
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Tổng khách hàng</p><p className="text-3xl font-extrabold">{summary.totalCustomers}</p></div>
            <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Đang hoạt động</p><p className="text-3xl font-extrabold text-green-600">{summary.activeCustomers}</p></div>
            <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">VIP (Gold+)</p><p className="text-3xl font-extrabold text-[#b87414]">{summary.vipCustomers}</p></div>
            <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Tổng điểm tích lũy</p><p className="text-3xl font-extrabold text-blue-900">{summary.totalPoints}</p></div>
          </section>

          <section className="bg-white border border-orange-100 rounded-2xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input className="border border-orange-100 rounded-xl px-3 py-2 text-sm" placeholder="Tìm theo tên / SĐT / email" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="border border-orange-100 rounded-xl px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Tất cả trạng thái</option><option value="1">Hoạt động</option><option value="0">Khóa</option>
              </select>
              <select className="border border-orange-100 rounded-xl px-3 py-2 text-sm" value={tier} onChange={(e) => setTier(e.target.value)}>
                <option value="">Tất cả hạng</option>{TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button type="button" onClick={() => fetchCustomers(1)} className="rounded-xl bg-orange-50 border border-orange-100 text-[#b87414] font-semibold">Lọc dữ liệu</button>
            </div>
          </section>

          <section className="bg-white border border-orange-100 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-orange-50">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">KHÁCH HÀNG</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">LIÊN HỆ</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">HẠNG</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">ĐIỂM</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">CHI TIÊU</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">TRẠNG THÁI</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.map((r) => (
                  <tr key={r.customer_id} className="border-t border-orange-100">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{r.full_name}</p>
                      <p className="text-xs text-slate-500">#{r.customer_id}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      <p>{r.phone}</p>
                      <p className="text-xs text-slate-500">{r.email || '-'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        r.tier === 'platinum' ? 'bg-purple-100 text-purple-700' :
                        r.tier === 'gold' ? 'bg-yellow-100 text-yellow-700' :
                        r.tier === 'silver' ? 'bg-slate-200 text-slate-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {r.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{r.points}</td>
                    <td className="px-4 py-3 font-semibold text-[#b87414]">{formatVnd(r.total_spent)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleStatus(r.customer_id, Number(r.status) === 1 ? 0 : 1)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${Number(r.status) === 1 ? 'bg-[#b87414]' : 'bg-slate-200'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${Number(r.status) === 1 ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => adjustPoints(r.customer_id, 50)} className="px-2 py-1 rounded border border-green-200 text-green-700 text-xs">+50</button>
                        <button type="button" onClick={() => adjustPoints(r.customer_id, -50)} className="px-2 py-1 rounded border border-red-200 text-red-700 text-xs">-50</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="px-4 py-3 border-t border-orange-100 flex items-center justify-between">
              <p className="text-sm text-slate-500">Trang {pagination.page}/{pagination.totalPages} - Tổng {pagination.totalItems} khách hàng</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => fetchCustomers(Math.max(1, pagination.page - 1))} className="size-8 rounded-lg border border-orange-100">{'<'}</button>
                {pages.map((p) => (
                  <button key={p} type="button" onClick={() => fetchCustomers(p)} className={`size-8 rounded-lg border ${p === pagination.page ? 'bg-[#b87414] border-[#b87414] text-white' : 'border-orange-100'}`}>{p}</button>
                ))}
                <button type="button" onClick={() => fetchCustomers(Math.min(pagination.totalPages, pagination.page + 1))} className="size-8 rounded-lg border border-orange-100">{'>'}</button>
              </div>
            </div>
          </section>

          {errorMessage && <div className="text-red-600">{errorMessage}</div>}
        </div>
      </main>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-orange-100">
            <h3 className="text-xl font-extrabold">Thêm khách hàng</h3>
            <div className="mt-4 space-y-3">
              <input className="w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Họ và tên" value={newCustomer.full_name} onChange={(e) => setNewCustomer((s) => ({ ...s, full_name: e.target.value }))} />
              <input className="w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Số điện thoại" value={newCustomer.phone} onChange={(e) => setNewCustomer((s) => ({ ...s, phone: e.target.value }))} />
              <input className="w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Email (không bắt buộc)" value={newCustomer.email} onChange={(e) => setNewCustomer((s) => ({ ...s, email: e.target.value }))} />
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl border border-orange-100">Hủy</button>
              <button type="button" onClick={createCustomer} className="flex-1 py-2 rounded-xl bg-[#b87414] text-white font-semibold">Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

