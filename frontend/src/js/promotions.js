import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';

function formatVnd(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('vi-VN')}đ`;
}

const TYPE_LABEL = {
  percent: 'Giảm giá (%)',
  bogo: 'Mua 1 tặng 1',
  fixed: 'Cố định'
};

export default function Promotions() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ runningCount: 0, upcomingCount: 0, endedCount: 0, monthlyBudget: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 1 });
  const [q, setQ] = useState('');
  const [life, setLife] = useState('');
  const [type, setType] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [newPromo, setNewPromo] = useState({
    promo_code: '',
    promo_name: '',
    promo_type: 'percent',
    description: '',
    discount_value: 0,
    budget: 0,
    start_date: '',
    end_date: ''
  });
  const [editPromo, setEditPromo] = useState({
    promo_name: '',
    promo_type: 'percent',
    description: '',
    discount_value: 0,
    budget: 0,
    start_date: '',
    end_date: ''
  });

  const handleLogout = React.useCallback(() => {
    localStorage.removeItem('token');
    navigate('/login');
  }, [navigate]);

  const fetchPromotions = React.useCallback(async (page = 1) => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      setLoading(true);
      setErrorMessage('');
      const res = await axios.get('/api/promotions', {
        params: { page, limit: pagination.limit, q: q || undefined, life: life || undefined, type: type || undefined },
        headers: { Authorization: `Bearer ${token}` }
      });
      setRows(res.data?.promotions || []);
      setSummary(res.data?.summary || {});
      setPagination({
        page: res.data?.page || 1,
        limit: res.data?.limit || 10,
        totalItems: res.data?.totalItems || 0,
        totalPages: res.data?.totalPages || 1
      });
    } catch (err) {
      if ([401, 403].includes(err?.response?.status)) return handleLogout();
      setErrorMessage(err?.response?.data?.message || 'Không thể tải danh sách khuyến mãi');
    } finally {
      setLoading(false);
    }
  }, [handleLogout, pagination.limit, q, life, type]);

  useEffect(() => { fetchPromotions(1); }, [fetchPromotions]);

  const pages = useMemo(() => {
    const total = pagination.totalPages || 1;
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
    const p = pagination.page;
    const start = Math.max(1, p - 2);
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [pagination]);

  const createPromotion = async () => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      await axios.post('/api/promotions', newPromo, { headers: { Authorization: `Bearer ${token}` } });
      setShowCreate(false);
      setNewPromo({
        promo_code: '',
        promo_name: '',
        promo_type: 'percent',
        description: '',
        discount_value: 0,
        budget: 0,
        start_date: '',
        end_date: ''
      });
      toast.success('Tạo khuyến mãi thành công');
      fetchPromotions(1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Tạo khuyến mãi thất bại');
    }
  };

  const toggleStatus = async (id, next) => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      await axios.patch(`/api/promotions/${id}/status`, { status: next }, { headers: { Authorization: `Bearer ${token}` } });
      fetchPromotions(pagination.page);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Cập nhật trạng thái thất bại');
    }
  };

  const openEdit = (promo) => {
    setSelectedPromo(promo);
    setEditPromo({
      promo_name: promo.promo_name || '',
      promo_type: promo.promo_type || 'percent',
      description: promo.description || '',
      discount_value: promo.discount_value || 0,
      budget: promo.budget || 0,
      start_date: promo.start_date || '',
      end_date: promo.end_date || ''
    });
    setShowEdit(true);
  };

  const saveEdit = async () => {
    const token = localStorage.getItem('token');
    if (!token || !selectedPromo) return handleLogout();
    try {
      await axios.patch(`/api/promotions/${selectedPromo.promotion_id}`, editPromo, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Cập nhật khuyến mãi thành công');
      setShowEdit(false);
      setSelectedPromo(null);
      fetchPromotions(pagination.page);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Cập nhật khuyến mãi thất bại');
    }
  };

  const openDelete = (promo) => {
    setSelectedPromo(promo);
    setShowDeleteConfirm(true);
  };

  const submitDelete = async () => {
    const token = localStorage.getItem('token');
    if (!token || !selectedPromo) return handleLogout();
    try {
      await axios.delete(`/api/promotions/${selectedPromo.promotion_id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Xóa khuyến mãi thành công');
      setShowDeleteConfirm(false);
      setSelectedPromo(null);
      fetchPromotions(1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Xóa khuyến mãi thất bại');
    }
  };

  return (
    <div className="admin-shell flex h-screen overflow-hidden">
      <Sidebar />
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">Quản lý Khuyến mãi</h2>
            <p className="text-xs text-slate-500">Quản lý và theo dõi các chương trình ưu đãi của cửa hàng.</p>
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className="px-4 py-2.5 rounded-xl bg-[#b87414] text-white font-semibold soft-hover">
            + Tạo khuyến mãi mới
          </button>
        </header>

        <div className="p-8 space-y-6">
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Đang chạy</p><p className="text-3xl font-extrabold text-green-600">{summary.runningCount}</p></div>
            <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Sắp diễn ra</p><p className="text-3xl font-extrabold text-blue-700">{summary.upcomingCount}</p></div>
            <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Đã kết thúc</p><p className="text-3xl font-extrabold text-slate-700">{summary.endedCount}</p></div>
            <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Tổng ngân sách</p><p className="text-3xl font-extrabold text-[#b87414]">{formatVnd(summary.monthlyBudget)}</p></div>
          </section>

          <section className="bg-white border border-orange-100 rounded-2xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input className="border border-orange-100 rounded-xl px-3 py-2 text-sm" placeholder="Tìm theo mã/tên chương trình..." value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="border border-orange-100 rounded-xl px-3 py-2 text-sm" value={life} onChange={(e) => setLife(e.target.value)}>
                <option value="">Tất cả trạng thái</option>
                <option value="running">Đang chạy</option>
                <option value="upcoming">Sắp diễn ra</option>
                <option value="ended">Đã kết thúc</option>
              </select>
              <select className="border border-orange-100 rounded-xl px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">Tất cả loại hình</option>
                <option value="percent">Giảm giá (%)</option>
                <option value="bogo">Mua 1 tặng 1</option>
                <option value="fixed">Cố định</option>
              </select>
              <button type="button" onClick={() => fetchPromotions(1)} className="rounded-xl bg-orange-50 border border-orange-100 text-[#b87414] font-semibold">Lọc nâng cao</button>
            </div>
          </section>

          <section className="bg-white border border-orange-100 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-orange-50">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">MÃ KM</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">TÊN CHƯƠNG TRÌNH</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">LOẠI HÌNH</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">THỜI GIAN</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">TRẠNG THÁI</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.map((r) => (
                  <tr key={r.promotion_id} className="border-t border-orange-100">
                    <td className="px-4 py-3 font-extrabold text-[#b87414]">{r.promo_code}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{r.promo_name}</p>
                      <p className="text-xs text-slate-500">{r.description || '-'}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{TYPE_LABEL[r.promo_type] || r.promo_type}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{r.start_date} - {r.end_date}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${
                        r.lifecycle === 'running' ? 'bg-green-100 text-green-700' :
                        r.lifecycle === 'upcoming' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {r.lifecycle === 'running' ? 'Đang chạy' : r.lifecycle === 'upcoming' ? 'Sắp diễn ra' : 'Đã kết thúc'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => toggleStatus(r.promotion_id, r.status === 1 ? 0 : 1)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${r.status === 1 ? 'bg-[#b87414]' : 'bg-slate-200'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${r.status === 1 ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                        <button type="button" onClick={() => openEdit(r)} className="px-2 py-0.5 rounded-lg border border-orange-200 text-[#b87414] text-[11px] font-semibold">Sửa</button>
                        <button type="button" onClick={() => openDelete(r)} className="px-2 py-0.5 rounded-lg border border-red-200 text-red-700 text-[11px] font-semibold">Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="px-4 py-3 border-t border-orange-100 flex items-center justify-between">
              <p className="text-sm text-slate-500">Hiển thị trang {pagination.page}/{pagination.totalPages} trên {pagination.totalItems} chương trình</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => fetchPromotions(Math.max(1, pagination.page - 1))} className="size-8 rounded-lg border border-orange-100">{'<'}</button>
                {pages.map((p) => (
                  <button key={p} type="button" onClick={() => fetchPromotions(p)} className={`size-8 rounded-lg border ${p === pagination.page ? 'bg-[#b87414] border-[#b87414] text-white' : 'border-orange-100'}`}>{p}</button>
                ))}
                <button type="button" onClick={() => fetchPromotions(Math.min(pagination.totalPages, pagination.page + 1))} className="size-8 rounded-lg border border-orange-100">{'>'}</button>
              </div>
            </div>
          </section>

          {errorMessage && <div className="text-red-600">{errorMessage}</div>}
        </div>
      </main>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 border border-orange-100">
            <h3 className="text-xl font-extrabold">Tạo khuyến mãi mới</h3>
            <p className="text-xs text-slate-500 mt-1">Điền đầy đủ thông tin để chương trình áp dụng chính xác.</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Mã khuyến mãi</label>
                <input className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Ví dụ: TET2026" value={newPromo.promo_code} onChange={(e) => setNewPromo((s) => ({ ...s, promo_code: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Tên chương trình</label>
                <input className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Ví dụ: Giảm giá đầu tuần" value={newPromo.promo_name} onChange={(e) => setNewPromo((s) => ({ ...s, promo_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Loại hình</label>
                <select className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" value={newPromo.promo_type} onChange={(e) => setNewPromo((s) => ({ ...s, promo_type: e.target.value }))}>
                  <option value="percent">Giảm giá (%)</option>
                  <option value="bogo">Mua 1 tặng 1</option>
                  <option value="fixed">Cố định</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Giá trị giảm</label>
                <input type="number" className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Ví dụ: 15" value={newPromo.discount_value} onChange={(e) => setNewPromo((s) => ({ ...s, discount_value: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Ngân sách (VNĐ)</label>
                <input type="number" className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Ví dụ: 5000000" value={newPromo.budget} onChange={(e) => setNewPromo((s) => ({ ...s, budget: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Ngày bắt đầu</label>
                <input type="date" className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" value={newPromo.start_date} onChange={(e) => setNewPromo((s) => ({ ...s, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Ngày kết thúc</label>
                <input type="date" className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" value={newPromo.end_date} onChange={(e) => setNewPromo((s) => ({ ...s, end_date: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Mô tả</label>
                <input className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Mô tả ngắn về chương trình" value={newPromo.description} onChange={(e) => setNewPromo((s) => ({ ...s, description: e.target.value }))} />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl border border-orange-100">Hủy</button>
              <button type="button" onClick={createPromotion} className="flex-1 py-2 rounded-xl bg-[#b87414] text-white font-semibold">Lưu</button>
            </div>
          </div>
        </div>
      )}

      {showEdit && selectedPromo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 border border-orange-100">
            <h3 className="text-xl font-extrabold">Cập nhật khuyến mãi</h3>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Tên chương trình</label>
                <input className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" value={editPromo.promo_name} onChange={(e) => setEditPromo((s) => ({ ...s, promo_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Loại hình</label>
                <select className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" value={editPromo.promo_type} onChange={(e) => setEditPromo((s) => ({ ...s, promo_type: e.target.value }))}>
                  <option value="percent">Giảm giá (%)</option>
                  <option value="bogo">Mua 1 tặng 1</option>
                  <option value="fixed">Cố định</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Giá trị giảm</label>
                <input type="number" className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" value={editPromo.discount_value} onChange={(e) => setEditPromo((s) => ({ ...s, discount_value: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Ngân sách (VNĐ)</label>
                <input type="number" className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" value={editPromo.budget} onChange={(e) => setEditPromo((s) => ({ ...s, budget: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Ngày bắt đầu</label>
                <input type="date" className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" value={editPromo.start_date} onChange={(e) => setEditPromo((s) => ({ ...s, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Ngày kết thúc</label>
                <input type="date" className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" value={editPromo.end_date} onChange={(e) => setEditPromo((s) => ({ ...s, end_date: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-slate-600">Mô tả</label>
                <input className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" value={editPromo.description} onChange={(e) => setEditPromo((s) => ({ ...s, description: e.target.value }))} />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setShowEdit(false)} className="flex-1 py-2 rounded-xl border border-orange-100">Hủy</button>
              <button type="button" onClick={saveEdit} className="flex-1 py-2 rounded-xl bg-[#b87414] text-white font-semibold">Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && selectedPromo && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-red-100 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-red-100 bg-red-50">
              <h3 className="text-lg font-extrabold text-slate-900">Xác nhận xóa khuyến mãi</h3>
              <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
            </div>
            <div className="px-5 py-4 text-sm text-slate-700">
              Bạn có chắc muốn xóa chương trình <b>{selectedPromo.promo_name}</b> ({selectedPromo.promo_code})?
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button type="button" onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold">Hủy</button>
              <button type="button" onClick={submitDelete} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

