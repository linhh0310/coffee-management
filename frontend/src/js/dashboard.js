import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';

function formatVnd(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('vi-VN')}đ`;
}

function Dashboard() {
  const navigate = useNavigate();
  
  // State lưu trữ dữ liệu thực từ Backend
  const [stats, setStats] = useState({ revenueToday: 0, ordersToday: 0, lowStock: 0 });
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [hourlyAi, setHourlyAi] = useState(null);
  const [hourlyErr, setHourlyErr] = useState('');

  const handleLogout = React.useCallback(() => {
    localStorage.removeItem('token');
    navigate('/login');
  }, [navigate]);

  // Gọi API lấy dữ liệu khi Component mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setErrorMessage('');
        // Gọi song song cả 2 API để tối ưu tốc độ
        const token = localStorage.getItem('token');
        if (!token) {
          handleLogout();
          return;
        }
        const headers = { Authorization: `Bearer ${token}` };

        const [statsRes, ordersRes] = await Promise.all([
          axios.get('/api/orders/stats/daily', { headers }),
          axios.get('/api/orders/recent', { headers })
        ]);

        setStats(statsRes.data);
        setRecentOrders(ordersRes.data);
      } catch (error) {
        const status = error?.response?.status;
        if (status === 401 || status === 403) {
          handleLogout();
          return;
        }
        setErrorMessage(error?.response?.data?.message || 'Không thể tải dữ liệu dashboard.');
        console.error("Lỗi khi tải dữ liệu Dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [handleLogout]);

  useEffect(() => {
    const loadHourly = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const res = await axios.get('/api/ai/hourly-forecast?days=30&persist=0', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setHourlyAi(res.data || null);
        setHourlyErr('');
      } catch (error) {
        const status = error?.response?.status;
        if (status === 401 || status === 403) return;
        setHourlyErr(error?.response?.data?.message || 'Không tải được dự báo giờ đông.');
        setHourlyAi(null);
      }
    };
    loadHourly();
  }, [handleLogout]);

  const chartSeries = hourlyAi?.chart_series || [];
  const chartMax = Math.max(
    1,
    ...chartSeries.flatMap((s) => [Number(s.avg_orders) || 0, Number(s.forecast_orders) || 0])
  );

  return (
    <div className="admin-shell flex h-screen overflow-hidden">
      <Sidebar />

      <main className="admin-main flex flex-col">
        <header className="admin-header bg-gradient-to-r from-[#fff7ed] to-white border border-[#f1dec8] rounded-2xl px-6 py-4">
          <h2 className="text-2xl md:text-3xl font-black text-[#3a291c] tracking-tight">Tổng quan hệ thống</h2>
        </header>

        <div className="admin-page space-y-8">
          {loading && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100 text-slate-600">
              Đang tải dữ liệu dashboard...
            </div>
          )}

          {!loading && errorMessage && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100">
              <p className="text-red-600 font-semibold">Lỗi</p>
              <p className="text-slate-600 mt-1">{errorMessage}</p>
              <button
                className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-[#b87414] text-white text-sm font-medium hover:opacity-90"
                onClick={() => window.location.reload()}
              >
                Thử lại
              </button>
            </div>
          )}

          {/* Metric Cards - Đã thay số thực */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Doanh thu hôm nay" 
              value={formatVnd(stats.revenueToday)}
              trend="Hôm nay" icon="payments" color="primary" 
            />
            <StatCard 
              title="Tổng đơn hàng" 
              value={Number(stats.ordersToday || 0)}
              trend="Hôm nay" icon="receipt_long" color="info" 
            />
            <StatCard 
              title="Sản phẩm sắp hết" 
              value={Number(stats.lowStock || 0)}
              trend="Cần nhập hàng" icon="warning" color="danger" 
            />
            <StatCard 
              title="Doanh thu TB/đơn" 
              value={stats.ordersToday ? formatVnd(Math.round((Number(stats.revenueToday || 0)) / Number(stats.ordersToday || 1))) : '0đ'} 
              trend="Hôm nay" icon="insights" color="accent" 
            />
          </div>

          {/* Dự báo giờ đông + gợi ý AI */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white/90 p-6 rounded-3xl shadow-[0_12px_30px_rgba(74,46,20,0.08)] border border-[#f0dcc6]">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs font-bold text-[#b87414] uppercase tracking-widest">AI dự báo</p>
                  <h2 className="text-2xl font-extrabold text-[#3a291c]">Dự báo khung giờ đông khách</h2>
                  <p className="text-xs text-[#8f725b] mt-1">
                    So sánh trung bình thực tế (đơn đã thanh toán) với mô hình dự báo — khung {hourlyAi?.chart_window?.start ?? 7}h–
                    {hourlyAi?.chart_window?.end ?? 18}h ({hourlyAi?.period_days ?? 30} ngày gần nhất).
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-[#7a5a3a]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-orange-200" />
                    Trung bình
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-[#b87414]" />
                    Dự báo
                  </span>
                </div>
              </div>

              {hourlyErr && (
                <p className="text-sm text-red-600 mb-3">{hourlyErr}</p>
              )}

              {chartSeries.length > 0 ? (
                <div className="flex items-end gap-1.5 h-44 px-1">
                  {chartSeries.map((pt) => {
                    const avgH = Math.round(((Number(pt.avg_orders) || 0) / chartMax) * 100);
                    const fcH = Math.round(((Number(pt.forecast_orders) || 0) / chartMax) * 100);
                    return (
                      <div key={pt.hour} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div className="w-full flex items-end justify-center gap-0.5 h-[140px]">
                          <div
                            className="w-[42%] rounded-t bg-orange-200 min-h-[2px] transition-all"
                            style={{ height: `${Math.max(2, avgH)}%` }}
                            title={`TB ${pt.hour}h: ${pt.avg_orders} đơn`}
                          />
                          <div
                            className="w-[42%] rounded-t bg-[#b87414] min-h-[2px] transition-all"
                            style={{ height: `${Math.max(2, fcH)}%` }}
                            title={`Dự báo ${pt.hour}h: ${pt.forecast_orders}`}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 tabular-nums">{pt.hour}h</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                !hourlyErr && (
                  <p className="text-sm text-slate-500">Chưa có đủ đơn để vẽ biểu đồ theo giờ.</p>
                )
              )}
            </div>

            <div className="bg-gradient-to-b from-[#fff5e9] via-white to-white p-6 rounded-3xl shadow-[0_12px_30px_rgba(74,46,20,0.08)] border border-[#f0dcc6] flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[#b87414]">smart_toy</span>
                <h3 className="text-base font-bold text-slate-900">Gợi ý từ AI</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Điều phối nhân sự, chuẩn bị bar và dự trù trước giờ cao điểm.
              </p>
              <div className="flex-1 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-white/80 border border-orange-100 rounded-xl p-4 mb-4">
                {hourlyAi?.ai_analysis ||
                  'Khi có dữ liệu đơn hàng, AI sẽ tóm tắt khung giờ đông và việc cần làm. Thêm OPENAI_API_KEY để phân tích chi tiết hơn.'}
              </div>
              <button
                type="button"
                className="w-full py-3 rounded-xl bg-[#b87414] text-white text-sm font-bold shadow-sm hover:opacity-95"
                onClick={() =>
                  toast('Gợi ý: mở lịch ca và ghim thêm 1 nhân viên trước/sau giờ peak 30 phút.', { icon: '👥' })
                }
              >
                Điều phối nhân sự
              </button>
            </div>
          </section>

          {/* Recent Orders Section - Đã thay dữ liệu từ bảng order của bạn */}
          <section className="bg-white/95 p-6 rounded-3xl shadow-[0_12px_30px_rgba(74,46,20,0.08)] border border-[#f0dcc6]">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-extrabold text-[#3a291c]">Đơn hàng gần đây</h2>
              <button className="text-[#b87414] font-medium text-sm hover:underline">Xem tất cả</button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">MÃ ĐƠN</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">BÀN/GIAO</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">SẢN PHẨM</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">TỔNG TIỀN</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">TRẠNG THÁI</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">THỜI GIAN</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.length > 0 ? recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-gray-100 hover:bg-orange-50/50 transition-colors">
                      <td className="px-4 py-4 text-sm font-bold text-[#b87414]">{order.id}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{order.table}</td>
                      <td className="px-4 py-4 text-sm text-slate-600">{order.product}</td>
                      <td className="px-4 py-4 text-sm font-bold text-slate-800">{order.total}</td>
                      <td className="px-4 py-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                          order.statusColor === 'success' ? 'bg-green-100 text-green-700' :
                          order.statusColor === 'warning' ? 'bg-orange-100 text-orange-700' :
                          order.statusColor === 'shipping' ? 'bg-blue-100 text-blue-700' :
                          order.statusColor === 'error' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">{order.time}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="6" className="text-center py-10 text-slate-400">Không có đơn hàng nào</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

// Component StatCard - Giữ nguyên cấu trúc nhưng sửa màu sắc linh hoạt hơn
const StatCard = ({ title, value, trend, icon, color }) => {
  const themes = {
    primary: {
      icon: 'bg-[#fdf0df] text-[#b87414]',
      trend: 'text-[#b87414]'
    },
    info: {
      icon: 'bg-[#edf4ff] text-[#3d6edb]',
      trend: 'text-[#3d6edb]'
    },
    accent: {
      icon: 'bg-[#fbf2e7] text-[#9d6b2c]',
      trend: 'text-[#9d6b2c]'
    },
    danger: {
      icon: 'bg-[#fff0f0] text-[#d65050]',
      trend: 'text-[#d65050]'
    }
  };

  const current = themes[color] || themes.primary;

  return (
    <div className="bg-white/95 p-5 rounded-2xl border border-[#f0dcc6] shadow-[0_8px_24px_rgba(74,46,20,0.07)] hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2.5 rounded-xl ${current.icon}`}>
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
        <span className={`text-xs font-bold ${current.trend}`}>{trend}</span>
      </div>
      <h3 className="text-[#8f725b] text-sm font-semibold">{title}</h3>
      <p className="text-[30px] leading-tight font-black mt-1 text-[#2f2117] tabular-nums">{value}</p>
    </div>
  );
};

export default Dashboard;