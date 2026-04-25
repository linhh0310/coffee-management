import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';

function formatVnd(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('vi-VN')}đ`;
}

function formatDateTime(value) {
  const d = new Date(value);
  return {
    date: d.toLocaleDateString('vi-VN'),
    time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  };
}

function ModalPortal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export default function Invoices() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ revenueToday: 0, totalInvoices: 0, cancelledInvoices: 0 });
  const [staff, setStaff] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 8, totalItems: 0, totalPages: 1 });

  const [keyword, setKeyword] = useState('');
  const [date, setDate] = useState('');
  const [staffId, setStaffId] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [invoiceDetail, setInvoiceDetail] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState(null);

  const handleLogout = React.useCallback(() => {
    localStorage.removeItem('token');
    navigate('/login');
  }, [navigate]);

  const fetchData = React.useCallback(async (page = 1) => {
    const token = localStorage.getItem('token');
    if (!token) {
      handleLogout();
      return;
    }
    try {
      setLoading(true);
      setErrorMessage('');
      const params = {
        page,
        limit: pagination.limit,
        q: keyword || undefined,
        date: date || undefined,
        user_id: staffId || undefined
      };
      const res = await axios.get('/api/orders/invoices', {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });

      setRows(res.data?.invoices || []);
      setSummary(res.data?.summary || {});
      setStaff(res.data?.staff || []);
      setPagination({
        page: res.data?.page || 1,
        limit: res.data?.limit || 8,
        totalItems: res.data?.totalItems || 0,
        totalPages: res.data?.totalPages || 1
      });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        handleLogout();
        return;
      }
      setErrorMessage(err?.response?.data?.message || 'Không thể tải danh sách hóa đơn.');
    } finally {
      setLoading(false);
    }
  }, [handleLogout, pagination.limit, keyword, date, staffId]);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const pages = useMemo(() => {
    const total = pagination.totalPages || 1;
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
    const p = pagination.page;
    const start = Math.max(1, p - 2);
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [pagination]);

  const onSearch = () => fetchData(1);

  const openInvoiceDetail = async (id) => {
    const token = localStorage.getItem('token');
    if (!token) {
      handleLogout();
      return;
    }

    try {
      setDetailOpen(true);
      setDetailLoading(true);
      setDetailError('');
      setInvoiceDetail(null);

      const res = await axios.get(`/api/orders/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvoiceDetail(res.data || null);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        handleLogout();
        return;
      }
      setDetailError(err?.response?.data?.message || 'Không tải được chi tiết hóa đơn');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setInvoiceDetail(null);
    setDetailError('');
  };

  const updateOrderStatus = async (orderId, status) => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();

    try {
      setSavingId(orderId);
      await axios.patch(
        `/api/orders/invoices/${orderId}/status`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Cập nhật trạng thái đơn hàng thành công');
      fetchData(pagination.page || 1);
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401 || code === 403) return handleLogout();
      toast.error(err?.response?.data?.message || 'Không thể cập nhật trạng thái đơn hàng');
    } finally {
      setSavingId(null);
    }
  };

  const openDeleteModal = (orderId) => {
    setDeletingInvoiceId(orderId);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (savingId) return;
    setDeleteModalOpen(false);
    setDeletingInvoiceId(null);
  };

  const confirmDeleteInvoice = async () => {
    if (!deletingInvoiceId) return;

    const token = localStorage.getItem('token');
    if (!token) return handleLogout();

    try {
      setSavingId(deletingInvoiceId);
      await axios.delete(`/api/orders/invoices/${deletingInvoiceId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Xóa hóa đơn thành công');
      closeDeleteModal();
      fetchData(pagination.page || 1);
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401 || code === 403) return handleLogout();
      toast.error(err?.response?.data?.message || 'Không thể xóa hóa đơn');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="admin-shell flex h-screen overflow-hidden">
      <Sidebar />

      <main className="admin-main">
        <header className="admin-header">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-extrabold text-slate-900">Quản lý Hóa đơn</h2>
            <span className="text-xs bg-orange-100 text-[#b87414] px-2 py-1 rounded-full font-bold">
              {pagination.totalItems} hôm nay
            </span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/sales')}
            className="px-4 py-2.5 rounded-xl bg-[#b87414] text-white font-semibold text-sm"
          >
            + Tạo hóa đơn mới
          </button>
        </header>

        <div className="p-8 space-y-6">
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#b87414] text-white rounded-2xl p-5">
              <p className="text-sm font-semibold opacity-90">DOANH THU HÔM NAY</p>
              <p className="text-4xl font-extrabold mt-2">{formatVnd(summary.revenueToday)}</p>
            </div>
            <div className="bg-white border border-orange-100 rounded-2xl p-5">
              <p className="text-sm font-semibold text-slate-500">TỔNG HÓA ĐƠN</p>
              <p className="text-4xl font-extrabold text-slate-900 mt-2">{summary.totalInvoices}</p>
            </div>
            <div className="bg-white border border-orange-100 rounded-2xl p-5">
              <p className="text-sm font-semibold text-slate-500">HÓA ĐƠN HỦY</p>
              <p className="text-4xl font-extrabold text-red-600 mt-2">{summary.cancelledInvoices}</p>
            </div>
          </section>

          <section className="bg-white border border-orange-100 rounded-2xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-500">TÌM KIẾM</label>
                <input
                  className="mt-2 w-full border border-orange-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#b87414]"
                  placeholder="Mã HD, tên khách..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">NGÀY THÁNG</label>
                <input
                  type="date"
                  className="mt-2 w-full border border-orange-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#b87414]"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">NHÂN VIÊN LẬP</label>
                <select
                  className="mt-2 w-full border border-orange-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#b87414]"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                >
                  <option value="">Tất cả nhân viên</option>
                  {staff.map((s) => (
                    <option key={s.user_id} value={s.user_id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={onSearch}
                  className="w-full px-4 py-2.5 rounded-xl bg-orange-50 border border-orange-100 text-[#b87414] font-semibold"
                >
                  Lọc dữ liệu
                </button>
              </div>
            </div>
          </section>

          <section className="bg-white border border-orange-100 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-orange-50">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">MÃ HD</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">NGÀY GIỜ</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">BÀN/KHU VỰC</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">TỔNG TIỀN</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">TRẠNG THÁI</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">PHƯƠNG THỨC</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">HÀNH ĐỘNG</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.map((r) => {
                  const dt = formatDateTime(r.created_at);
                  return (
                    <tr key={r.id} className="border-t border-orange-100">
                      <td className="px-4 py-3">
                        <p className="font-extrabold text-[#b87414]">{r.code}</p>
                        <p className="text-xs text-slate-500">{r.cashier_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-slate-900">{dt.date}</p>
                        <p className="text-xs text-slate-500">{dt.time}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">{r.table}</td>
                      <td className="px-4 py-3 text-sm font-extrabold text-slate-900">{formatVnd(r.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          r.status_color === 'success' ? 'bg-green-100 text-green-700' :
                          r.status_color === 'error' ? 'bg-red-100 text-red-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {r.status_text}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{r.payment_text}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            onClick={() => openInvoiceDetail(r.id)}
                            className="px-3 py-1.5 rounded-lg border border-orange-200 text-[#b87414] font-semibold hover:bg-orange-50"
                          >
                            Xem chi tiết
                          </button>

                          <select
                            value={r.status}
                            disabled={savingId === r.id}
                            onChange={(e) => updateOrderStatus(r.id, e.target.value)}
                            className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-700"
                          >
                            <option value="pending">Chờ thanh toán</option>
                            <option value="paid">Đã thanh toán</option>
                            <option value="cancelled">Đã hủy</option>
                          </select>

                          <button
                            type="button"
                            disabled={savingId === r.id}
                            onClick={() => openDeleteModal(r.id)}
                            className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 font-semibold hover:bg-red-50 disabled:opacity-50"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="px-4 py-3 border-t border-orange-100 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Hiển thị trang {pagination.page}/{pagination.totalPages} trên tổng số {pagination.totalItems} hóa đơn
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchData(Math.max(1, pagination.page - 1))}
                  className="size-8 rounded-lg border border-orange-100 hover:bg-orange-50"
                >
                  {'<'}
                </button>
                {pages.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => fetchData(p)}
                    className={`size-8 rounded-lg border text-sm ${
                      p === pagination.page
                        ? 'bg-[#b87414] border-[#b87414] text-white'
                        : 'border-orange-100 hover:bg-orange-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => fetchData(Math.min(pagination.totalPages, pagination.page + 1))}
                  className="size-8 rounded-lg border border-orange-100 hover:bg-orange-50"
                >
                  {'>'}
                </button>
              </div>
            </div>
          </section>

          {loading && <div className="text-slate-600">Đang tải dữ liệu...</div>}
          {!loading && errorMessage && <div className="text-red-600">{errorMessage}</div>}
        </div>
      </main>

      <ModalPortal>
        {deleteModalOpen && (
          <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200">
                <h3 className="text-lg font-extrabold text-slate-900">Xác nhận xóa hóa đơn</h3>
                <p className="text-sm text-slate-600 mt-1">Bạn có chắc chắn muốn xóa hóa đơn không?</p>
              </div>

              <div className="px-5 py-4 bg-slate-50 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={!!savingId}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-white disabled:opacity-50"
                >
                  Không
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteInvoice}
                  disabled={!!savingId}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50"
                >
                  {savingId ? 'Đang xóa...' : 'Có'}
                </button>
              </div>
            </div>
          </div>
        )}

        {detailOpen && (
          <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4">
            <div className="w-full max-w-[360px] rounded-xl bg-[#f8f8f8] border border-slate-200 shadow-2xl overflow-hidden">
              <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Chi tiết hóa đơn</p>
                <button
                  type="button"
                  onClick={closeDetail}
                  className="px-2 py-1 rounded-md border border-slate-200 text-slate-600 text-xs hover:bg-slate-50"
                >
                  Đóng
                </button>
              </div>

              <div className="p-3 bg-[#f3f3f3]">
                {detailLoading && <p className="text-sm text-slate-500">Đang tải chi tiết hóa đơn...</p>}
                {!detailLoading && detailError && <p className="text-sm text-red-600">{detailError}</p>}

                {!detailLoading && !detailError && invoiceDetail && (
                  <div className="mx-auto w-full max-w-[320px] bg-white border border-slate-200 rounded-md p-4 text-slate-800">
                    <div className="text-center border-b border-dashed border-slate-300 pb-3">
                      <h3 className="text-[28px] font-black leading-none text-[#b87414] tracking-tight">GOLDEN ROAST</h3>
                      <p className="text-[11px] mt-1">123 Coffee St, City</p>
                      <p className="text-[10px] text-slate-500">Tel: 0915 123 4567</p>
                    </div>

                    <div className="mt-3 text-[11px] grid grid-cols-2 gap-y-1">
                      <p><span className="font-semibold">Hóa đơn</span> #{invoiceDetail.code}</p>
                      <p className="text-right"><span className="font-semibold">Số</span> {invoiceDetail.id}</p>
                      <p>Ngày: {formatDateTime(invoiceDetail.createdAt).date} {formatDateTime(invoiceDetail.createdAt).time}</p>
                      <p className="text-right">Thu ngân: {invoiceDetail.cashierName || 'N/A'}</p>
                      <p className="col-span-2">Khu vực/Bàn: {invoiceDetail.tableLabel || 'Mang đi'}</p>
                    </div>

                    <div className="mt-3 border-t border-b border-slate-200 py-2">
                      <div className="grid grid-cols-12 text-[10px] font-bold text-slate-500 uppercase">
                        <div className="col-span-2">SL</div>
                        <div className="col-span-7">Tên món</div>
                        <div className="col-span-3 text-right">Thành tiền</div>
                      </div>

                      <div className="mt-1 space-y-1.5">
                        {(invoiceDetail.items || []).map((it, idx) => (
                          <div key={`${it.name}-${idx}`} className="grid grid-cols-12 text-[11px]">
                            <div className="col-span-2">{it.qty}</div>
                            <div className="col-span-7">
                              <p className="font-semibold leading-tight">{it.name}</p>
                              <p className="text-[10px] text-slate-500">{formatVnd(it.unitPrice)} / món</p>
                            </div>
                            <div className="col-span-3 text-right font-semibold">{formatVnd(it.lineTotal)}</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 text-[11px] space-y-1">
                      <p className="flex items-center justify-between"><span>Tạm tính</span><span>{formatVnd(invoiceDetail.subtotal)}</span></p>
                      <p className="flex items-center justify-between"><span>Thuế GTGT</span><span>{formatVnd(invoiceDetail.tax)}</span></p>
                      <p className="flex items-center justify-between text-[#b87414] font-bold"><span>Chiết khấu thành viên</span><span>-{formatVnd(invoiceDetail.discount || 0)}</span></p>
                      <p className="flex items-center justify-between text-lg font-black border-t border-dashed border-slate-300 pt-2 mt-1">
                        <span>TỔNG CỘNG</span><span>{formatVnd(invoiceDetail.total)}</span>
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-dashed border-slate-300 text-[10px] grid grid-cols-2 gap-2">
                      <div>
                        <p className="font-bold uppercase text-slate-500">Hình thức thanh toán</p>
                        <p className="font-semibold mt-0.5">{invoiceDetail.paymentMethod || 'N/A'}</p>
                        <p className="font-bold uppercase text-slate-500 mt-2">Trạng thái</p>
                        <p className="font-black text-emerald-600">{invoiceDetail.status || 'Đã thanh toán'}</p>
                      </div>
                      <div className="text-right">
                        <div className="inline-flex flex-col items-center">
                          <div className="size-14 rounded border border-slate-300 bg-[#d8eef8]" />
                          <p className="mt-1 text-[9px] text-slate-500">Quét mã để xem lại hóa đơn</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-dashed border-slate-300 pt-2 text-center">
                      <p className="text-[10px] text-slate-500">CẢM ƠN BẠN ĐÃ LỰA CHỌN GOLDEN ROAST</p>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="mt-2 px-4 py-1.5 rounded-full bg-[#b87414] text-white text-xs font-bold"
                      >
                        In hóa đơn
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </ModalPortal>
    </div>
  );
}
