import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

function formatVnd(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('vi-VN')}đ`;
}

const PERIODS = [
  { id: 'day', label: 'Hằng ngày' },
  { id: 'week', label: 'Hằng tuần' },
  { id: 'month', label: 'Hằng tháng' }
];

export default function Stats() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('day');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState({
    overview: { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, customerCount: 0 },
    trend: [],
    topProducts: [],
    peakHours: { buckets: [], heatMap: [] },
    quickStats: { busiestDay: '-', newCustomers30d: 0, newCustomersGrowthPct: 0, lowStock: 0 }
  });

  const handleLogout = React.useCallback(() => {
    localStorage.removeItem('token');
    navigate('/login');
  }, [navigate]);

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        handleLogout();
        return;
      }
      try {
        setLoading(true);
        setErrorMessage('');
        const res = await axios.get(`/api/orders/analytics?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(res.data || {});
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          handleLogout();
          return;
        }
        setErrorMessage(err?.response?.data?.message || 'Không thể tải dữ liệu thống kê.');
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [period, handleLogout]);

  const maxTrend = useMemo(() => Math.max(1, ...(data?.trend || []).map((x) => Number(x.revenue || 0))), [data]);
  const maxTop = useMemo(() => Math.max(1, ...(data?.topProducts || []).map((x) => Number(x.qty || 0))), [data]);

  return (
    <div className="admin-shell flex h-screen overflow-hidden">
      <Sidebar />

      <main className="admin-main">
        <header className="admin-header">
          <div className="text-left">
            <h2 className="text-xl font-bold text-[#3a291c]">Thống kê doanh thu</h2>
            <p className="text-xs text-[#8f725b]">Chi nhánh chính - Trung tâm phân tích</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/90 border border-[#f0dcc6] rounded-xl p-1 flex shadow-sm">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                    period === p.id ? 'bg-[#b87414] text-white shadow-sm' : 'text-[#7a5a3a] hover:bg-[#fff5e9]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="admin-page space-y-6">
          {loading && (
            <div className="bg-white border border-orange-100 rounded-2xl p-6 text-slate-600">Đang tải thống kê...</div>
          )}
          {!loading && errorMessage && (
            <div className="bg-white border border-orange-100 rounded-2xl p-6">
              <p className="text-red-600 font-semibold">Lỗi</p>
              <p className="text-slate-600 mt-1">{errorMessage}</p>
            </div>
          )}

          {!loading && !errorMessage && (
            <>
              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="bg-white/95 border border-[#f0dcc6] rounded-2xl p-5 shadow-[0_8px_24px_rgba(74,46,20,0.07)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[#8f725b] text-sm font-semibold">Tổng doanh thu</p>
                    <span className="material-symbols-outlined text-[18px] text-[#b87414]">payments</span>
                  </div>
                  <p className="text-2xl font-bold text-[#2f2117] mt-2 tabular-nums">{formatVnd(data.overview?.totalRevenue)}</p>
                </div>
                <div className="bg-white/95 border border-[#f0dcc6] rounded-2xl p-5 shadow-[0_8px_24px_rgba(74,46,20,0.07)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[#8f725b] text-sm font-semibold">Tổng đơn đã thanh toán</p>
                    <span className="material-symbols-outlined text-[18px] text-[#b87414]">receipt_long</span>
                  </div>
                  <p className="text-2xl font-bold text-[#2f2117] mt-2 tabular-nums">{Number(data.overview?.totalOrders || 0).toLocaleString('vi-VN')}</p>
                </div>
                <div className="bg-white/95 border border-[#f0dcc6] rounded-2xl p-5 shadow-[0_8px_24px_rgba(74,46,20,0.07)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[#8f725b] text-sm font-semibold">Giá trị đơn hàng TB</p>
                    <span className="material-symbols-outlined text-[18px] text-[#b87414]">insights</span>
                  </div>
                  <p className="text-2xl font-bold text-[#2f2117] mt-2 tabular-nums">{formatVnd(data.overview?.avgOrderValue)}</p>
                </div>
                <div className="bg-white/95 border border-[#f0dcc6] rounded-2xl p-5 shadow-[0_8px_24px_rgba(74,46,20,0.07)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[#8f725b] text-sm font-semibold">Số lượng khách hàng</p>
                    <span className="material-symbols-outlined text-[18px] text-[#b87414]">group</span>
                  </div>
                  <p className="text-2xl font-bold text-[#2f2117] mt-2 tabular-nums">{Number(data.overview?.customerCount || 0).toLocaleString('vi-VN')}</p>
                </div>
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/95 border border-[#f0dcc6] rounded-3xl p-6 shadow-[0_12px_30px_rgba(74,46,20,0.08)]">
                  <h3 className="text-xl font-semibold text-[#3a291c] mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-[20px] text-[#b87414]">bar_chart</span>Doanh thu theo thời gian</h3>
                  <div className="h-64 flex items-end gap-2">
                    {(data.trend || []).map((item) => {
                      const h = Math.max(8, (Number(item.revenue || 0) / maxTrend) * 100);
                      return (
                        <div key={item.label} className="flex-1 flex flex-col items-center justify-end">
                          <div className="w-full rounded-t-md bg-[#b87414]" style={{ height: `${h}%` }} />
                          <p className="text-[11px] text-slate-500 mt-2">{item.label}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white/95 border border-[#f0dcc6] rounded-3xl p-6 shadow-[0_12px_30px_rgba(74,46,20,0.08)]">
                  <h3 className="text-xl font-semibold text-[#3a291c] mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-[20px] text-[#b87414]">local_cafe</span>Sản phẩm phổ biến nhất</h3>
                  <div className="space-y-4">
                    {(data.topProducts || []).map((p) => (
                      <div key={p.product_name}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-semibold text-slate-800">{p.product_name}</span>
                          <span className="text-slate-500">{p.qty} đơn hàng</span>
                        </div>
                        <div className="h-2 rounded-full bg-orange-100">
                          <div
                            className="h-2 rounded-full bg-[#b87414]"
                            style={{ width: `${Math.max(5, (Number(p.qty || 0) / maxTop) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white/95 border border-[#f0dcc6] rounded-3xl p-6 shadow-[0_12px_30px_rgba(74,46,20,0.08)]">
                  <h3 className="text-xl font-semibold text-[#3a291c] mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-[20px] text-[#b87414]">schedule</span>Phân tích khung giờ cao điểm</h3>
                  <div className="space-y-3">
                    {(data.peakHours?.heatMap || []).map((row) => (
                      <div key={row.day} className="flex items-center gap-3">
                        <div className="w-8 text-xs font-bold text-slate-500">{row.day}</div>
                        <div className="flex-1 grid grid-cols-7 gap-2">
                          {row.slots.map((slot) => (
                            <div
                              key={`${row.day}-${slot.hour}`}
                              title={`${row.day} ${slot.hour}h: ${slot.value} đơn`}
                              className="h-8 rounded-md border border-orange-100"
                              style={{ backgroundColor: `rgba(184,116,20,${Math.max(0.08, slot.intensity)})` }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white/95 border border-[#f0dcc6] rounded-3xl p-6 shadow-[0_12px_30px_rgba(74,46,20,0.08)]">
                  <h3 className="text-xl font-semibold text-[#3a291c] mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-[20px] text-[#b87414]">analytics</span>Thông số nhanh</h3>
                  <div className="space-y-4 text-left">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Ngày bán ổn nhất</p>
                      <p className="text-slate-600">{data.quickStats?.busiestDay}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Khách hàng mới (30 ngày)</p>
                      <p className="text-slate-600">
                        {data.quickStats?.newCustomers30d} khách ({data.quickStats?.newCustomersGrowthPct}% so với 30 ngày trước)
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Cảnh báo kho</p>
                      <p className="text-slate-600">{data.quickStats?.lowStock} nguyên liệu sắp hết hàng</p>
                    </div>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

