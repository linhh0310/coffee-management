import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

function formatVnd(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('vi-VN')}đ`;
}

const PERIODS = [
  { id: 'day', label: 'Hằng ngày', chartTitle: 'Doanh thu theo ngày', orderTitle: 'Số đơn hàng theo ngày' },
  { id: 'week', label: 'Hằng tuần', chartTitle: 'Doanh thu theo tuần', orderTitle: 'Số đơn hàng theo tuần' },
  { id: 'month', label: 'Hằng tháng', chartTitle: 'Doanh thu theo tháng', orderTitle: 'Số đơn hàng theo tháng' }
];

export default function Stats() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('day');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [hoverRevenueIdx, setHoverRevenueIdx] = useState(null);
  const [hoverOrderIdx, setHoverOrderIdx] = useState(null);
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

  useEffect(() => {
    setHoverRevenueIdx(null);
    setHoverOrderIdx(null);
  }, [period]);

  const activePeriod = useMemo(() => PERIODS.find((p) => p.id === period) || PERIODS[0], [period]);

  const trendData = useMemo(
    () => (data?.trend || []).map((x) => {
      const revenue = Number(x?.revenue);
      const orders = Number(x?.orders);
      return {
        label: String(x?.label || ''),
        revenue: Number.isFinite(revenue) && revenue > 0 ? revenue : 0,
        orders: Number.isFinite(orders) && orders > 0 ? orders : 0
      };
    }),
    [data]
  );

  const maxTrend = useMemo(() => Math.max(1, ...trendData.map((x) => x.revenue)), [trendData]);
  const maxOrders = useMemo(() => Math.max(1, ...trendData.map((x) => x.orders)), [trendData]);

  const revenueTicks = useMemo(
    () => [1, 0.75, 0.5, 0.25, 0].map((r) => Math.round((maxTrend * r) / 1000)),
    [maxTrend]
  );

  const orderAxisMax = useMemo(() => {
    const peak = Math.max(1, maxOrders);
    if (peak <= 5) return 5;
    if (peak <= 10) return 10;
    if (peak <= 20) return 20;
    if (peak <= 40) return Math.ceil(peak / 5) * 5;
    return Math.ceil(peak / 10) * 10;
  }, [maxOrders]);

  const orderTicks = useMemo(
    () => [1, 0.75, 0.5, 0.25, 0].map((r) => Math.round(orderAxisMax * r)),
    [orderAxisMax]
  );

  const lineCoords = useMemo(() => {
    if (!trendData.length) return [];
    const n = trendData.length;
    const yTop = 8;
    const yBottom = 92;
    const yRange = yBottom - yTop;

    return trendData.map((item, idx) => {
      const x = n === 1 ? 50 : (idx / (n - 1)) * 100;
      const ratio = orderAxisMax > 0 ? (item.orders / orderAxisMax) : 0;
      const y = Math.max(yTop, Math.min(yBottom, yBottom - ratio * yRange));
      return { x, y, label: item.label, orders: item.orders };
    });
  }, [trendData, orderAxisMax]);

  const activeRevenueData = useMemo(() => {
    if (hoverRevenueIdx === null || hoverRevenueIdx < 0 || hoverRevenueIdx >= trendData.length) return null;
    return trendData[hoverRevenueIdx];
  }, [hoverRevenueIdx, trendData]);

  const activeOrderData = useMemo(() => {
    if (hoverOrderIdx === null || hoverOrderIdx < 0 || hoverOrderIdx >= trendData.length) return null;
    return trendData[hoverOrderIdx];
  }, [hoverOrderIdx, trendData]);

  const orderLinePoints = useMemo(
    () => lineCoords.map((p) => `${p.x},${p.y}`).join(' '),
    [lineCoords]
  );

  const smoothOrderLinePath = useMemo(() => {
    if (lineCoords.length === 0) return '';
    if (lineCoords.length === 1) {
      const p = lineCoords[0];
      return `M ${p.x} ${p.y}`;
    }

    let d = `M ${lineCoords[0].x} ${lineCoords[0].y}`;
    for (let i = 0; i < lineCoords.length - 1; i += 1) {
      const p0 = i > 0 ? lineCoords[i - 1] : lineCoords[i];
      const p1 = lineCoords[i];
      const p2 = lineCoords[i + 1];
      const p3 = i + 2 < lineCoords.length ? lineCoords[i + 2] : p2;

      const smoothness = 0.22;
      const c1x = p1.x + ((p2.x - p0.x) * smoothness);
      const c1y = p1.y + ((p2.y - p0.y) * smoothness);
      const c2x = p2.x - ((p3.x - p1.x) * smoothness);
      const c2y = p2.y - ((p3.y - p1.y) * smoothness);

      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }

    return d;
  }, [lineCoords]);

  const xLabelClass = useMemo(() => {
    if (period === 'month') return 'text-[9px]';
    if (period === 'week') return 'text-[9px]';
    return 'text-[10px]';
  }, [period]);

  return (
    <div className="admin-shell flex h-screen overflow-hidden">
      <Sidebar />

      <main className="admin-main">
        <header className="admin-header rounded-2xl border border-amber-100 bg-gradient-to-r from-[#fffaf2] via-white to-[#fff5e7] px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-left">
              <h2 className="text-xl font-semibold text-slate-900">Thống kê doanh thu</h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex rounded-xl border border-amber-200 bg-white/80 p-1 shadow-sm">
                {PERIODS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPeriod(p.id)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                      period === p.id ? 'bg-[#b87414] text-white shadow-sm' : 'text-[#7a5a3a] hover:bg-[#fff5e9]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
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
              <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="rounded-xl bg-[#fdf0df] p-2 text-[#b87414]"><span className="material-symbols-outlined text-[18px]">payments</span></div>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tổng doanh thu</p>
                  <p className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">{formatVnd(data.overview?.totalRevenue)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="rounded-xl bg-[#edf4ff] p-2 text-[#3d6edb]"><span className="material-symbols-outlined text-[18px]">receipt_long</span></div>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tổng đơn đã thanh toán</p>
                  <p className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">{Number(data.overview?.totalOrders || 0).toLocaleString('vi-VN')}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="rounded-xl bg-[#fbf2e7] p-2 text-[#9d6b2c]"><span className="material-symbols-outlined text-[18px]">insights</span></div>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Giá trị đơn hàng TB</p>
                  <p className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">{formatVnd(data.overview?.avgOrderValue)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="rounded-xl bg-[#eefaf0] p-2 text-[#2f8f57]"><span className="material-symbols-outlined text-[18px]">group</span></div>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Số lượng khách hàng</p>
                  <p className="mt-1.5 text-2xl font-semibold text-slate-900 tabular-nums">{Number(data.overview?.customerCount || 0).toLocaleString('vi-VN')}</p>
                </div>
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-slate-900">{activePeriod.chartTitle}</h3>
                  </div>
                  <div className="h-64 rounded-xl border border-slate-200 bg-white p-4 overflow-hidden">
                    {trendData.length > 0 ? (
                      <div className="h-full grid grid-cols-[44px_minmax(0,1fr)] gap-3">
                        <div className="h-full flex flex-col justify-between text-[10px] text-slate-500">
                          {revenueTicks.map((t, idx) => <span key={`rev-tick-${idx}`}>{t}</span>)}
                        </div>
                        <div className="h-full min-w-0 flex flex-col min-h-0">
                          <div className="flex-1 min-h-0 border-l border-b border-dashed border-slate-300 relative overflow-hidden">
                            <div className="absolute inset-0 grid grid-rows-4 pointer-events-none">
                              {[0, 1, 2, 3].map((i) => <div key={`grid-r-${i}`} className="border-t border-dashed border-slate-200" />)}
                            </div>

                            {activeRevenueData && (
                              <div
                                className="absolute top-2 z-20 bg-white/95 border border-slate-200 rounded-md px-2.5 py-1.5 shadow-sm pointer-events-none"
                                style={{
                                  left: `clamp(4px, calc(${((hoverRevenueIdx + 0.5) / Math.max(1, trendData.length)) * 100}% - 58px), calc(100% - 116px))`
                                }}
                              >
                                <p className="text-[11px] text-slate-700">{activeRevenueData.label}</p>
                                <p className="text-[11px] text-[#f3a10a] font-semibold">Doanh thu: {formatVnd(activeRevenueData.revenue)}</p>
                              </div>
                            )}

                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="relative z-10 w-full h-full block">
                              {trendData.map((item, idx) => {
                                const n = Math.max(1, trendData.length);
                                const slot = 100 / n;
                                const barW = Math.min(7.5, slot * 0.62);
                                const x = (idx * slot) + ((slot - barW) / 2);
                                const value = Math.max(0, Number(item.revenue || 0));
                                const ratio = maxTrend > 0 ? (value / maxTrend) : 0;
                                const h = value > 0 ? Math.max(1.5, Math.min(100, ratio * 100)) : 0;
                                const y = 100 - h;
                                const isActive = idx === hoverRevenueIdx;
                                return (
                                  <g
                                    key={`rev-bar-${item.label}-${idx}`}
                                    onMouseEnter={() => setHoverRevenueIdx(idx)}
                                    onMouseMove={() => setHoverRevenueIdx(idx)}
                                    onMouseLeave={() => setHoverRevenueIdx(null)}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    {isActive && (
                                      <rect x={x - 1.4} y="0" width={barW + 2.8} height="100" fill="rgba(148,163,184,0.2)" />
                                    )}
                                    <rect
                                      x={x}
                                      y={y}
                                      width={barW}
                                      height={h}
                                      rx="0.8"
                                      ry="0.8"
                                      fill={isActive ? '#ec8f05' : '#f3a10a'}
                                    />
                                  </g>
                                );
                              })}
                            </svg>
                          </div>
                          <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, trendData.length)}, minmax(0, 1fr))` }}>
                            {trendData.map((item) => (
                              <p key={`rev-x-${item.label}`} className={`${xLabelClass} text-slate-500 text-center truncate`} title={item.label}>{item.label}</p>
                            ))}
                          </div>
                          <p className="mt-1 text-[11px] text-[#f3a10a] font-semibold text-center">● Doanh thu</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-slate-500">Chưa có dữ liệu</div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-slate-900">{activePeriod.orderTitle}</h3>
                  </div>
                  <div className="h-64 rounded-xl border border-slate-200 bg-white p-4 overflow-hidden">
                    {trendData.length > 0 ? (
                      <div className="h-full grid grid-cols-[44px_minmax(0,1fr)] gap-3">
                        <div className="h-full flex flex-col justify-between text-[10px] text-slate-500">
                          {orderTicks.map((t, idx) => (
                            <span key={`ord-tick-${idx}`}>{Math.max(0, Number(t || 0))}</span>
                          ))}
                        </div>
                        <div className="h-full min-w-0 flex flex-col min-h-0">
                          <div className="flex-1 min-h-0 border-l border-b border-dashed border-slate-300 relative overflow-hidden">
                            <div className="absolute inset-0 grid grid-rows-4 pointer-events-none">
                              {[0, 1, 2, 3].map((i) => <div key={`grid-l-${i}`} className="border-t border-dashed border-slate-200" />)}
                            </div>

                            {activeOrderData && (
                              <div
                                className="absolute top-2 z-20 bg-white/95 border border-slate-200 rounded-md px-2.5 py-1.5 shadow-sm pointer-events-none"
                                style={{
                                  left: `clamp(4px, calc(${(Math.max(0, hoverOrderIdx) / Math.max(1, trendData.length - 1)) * 100}% - 50px), calc(100% - 104px))`
                                }}
                              >
                                <p className="text-[11px] text-slate-700">{activeOrderData.label}</p>
                                <p className="text-[11px] text-[#3468c8] font-semibold">Đơn hàng: {activeOrderData.orders}</p>
                              </div>
                            )}

                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                              {lineCoords.length > 1 && (
                                <path
                                  d={`${smoothOrderLinePath} L ${lineCoords[lineCoords.length - 1].x} 100 L ${lineCoords[0].x} 100 Z`}
                                  fill="url(#orderAreaGradient)"
                                  opacity="0.18"
                                />
                              )}
                              <defs>
                                <linearGradient id="orderAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#3468c8" />
                                  <stop offset="100%" stopColor="#3468c8" stopOpacity="0" />
                                </linearGradient>
                              </defs>
                              {lineCoords.length > 1 && (
                                <path
                                  d={smoothOrderLinePath}
                                  fill="none"
                                  stroke="#3b82f6"
                                  strokeWidth="0.85"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              )}
                              {lineCoords.length === 1 && (
                                <line x1="0" y1={lineCoords[0].y} x2="100" y2={lineCoords[0].y} stroke="#3b82f6" strokeWidth="0.85" />
                              )}
                              {lineCoords.map((point, idx) => {
                                const isActive = idx === hoverOrderIdx;
                                return (
                                  <circle
                                    key={`dot-${point.label}-${idx}`}
                                    cx={point.x}
                                    cy={point.y}
                                    r={isActive ? '1.5' : '1.05'}
                                    fill="#ffffff"
                                    stroke="#3b82f6"
                                    strokeWidth={isActive ? '0.75' : '0.4'}
                                  />
                                );
                              })}
                            </svg>

                            <div className="relative z-10 h-full flex items-end gap-2">
                              {trendData.map((item, idx) => {
                                const ratio = orderAxisMax > 0 ? (item.orders / orderAxisMax) : 0;
                                const h = Math.max(0, Math.min(100, ratio * 100));
                                const isActive = idx === hoverOrderIdx;
                                return (
                                  <div
                                    key={`ord-col-${item.label}`}
                                    className="flex-1 h-full flex items-end justify-center min-w-0"
                                    onMouseEnter={() => setHoverOrderIdx(idx)}
                                    onMouseMove={() => setHoverOrderIdx(idx)}
                                    onMouseLeave={() => setHoverOrderIdx(null)}
                                  >
                                    <div
                                      className={`w-full max-w-[18px] rounded-t-md transition-colors ${isActive ? 'bg-[#3468c8]/28' : 'bg-[#3468c8]/16'}`}
                                      style={{ height: `${Math.max(2, h)}%`, minHeight: '2px' }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, trendData.length)}, minmax(0, 1fr))` }}>
                            {trendData.map((item) => (
                              <p key={`ord-x-${item.label}`} className={`${xLabelClass} text-slate-500 text-center truncate`} title={item.label}>{item.label}</p>
                            ))}
                          </div>
                          <p className="mt-1 text-[11px] text-[#3468c8] font-semibold text-center">● Đơn hàng</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-slate-500">Chưa có dữ liệu</div>
                    )}
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_0.9fr]">
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3.5">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Best sellers</p>
                      <h3 className="mt-1.5 text-base font-semibold text-slate-900">Top 5 món bán chạy</h3>
                    </div>
                    <div className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                      {(data.topProducts || []).slice(0, 5).length} món
                    </div>
                  </div>

                  {(data.topProducts || []).length > 0 ? (
                    <div className="p-3.5 space-y-2.5">
                      {(data.topProducts || []).slice(0, 5).map((item, idx) => {
                        const qty = Number(item.qty || 0);
                        const revenue = Number(item.revenue || 0);
                        const rankStyles = [
                          'bg-gradient-to-br from-[#ffd66b] to-[#e9a926] text-[#6a3b00] ring-2 ring-[#ffe8a6]',
                          'bg-gradient-to-br from-[#edf2f7] to-[#b9c4d1] text-[#485467] ring-2 ring-[#e5ebf2]',
                          'bg-gradient-to-br from-[#f4c8a4] to-[#c97a42] text-[#5a2f10] ring-2 ring-[#f8dfca]'
                        ];
                        const rowStyles = [
                          'border-[#f3d79b] bg-gradient-to-r from-[#fff8e8] to-white',
                          'border-[#dde4eb] bg-gradient-to-r from-[#f9fbfd] to-white',
                          'border-[#efd7c7] bg-gradient-to-r from-[#fff8f2] to-white'
                        ];
                        const rankClass = rankStyles[idx] || 'bg-[#f7efe7] text-[#9b6b43]';
                        const rowClass = rowStyles[idx] || 'border-[#f1e6dc] bg-gradient-to-r from-[#fffaf6] to-white';
                        return (
                          <div
                            key={`${item.product_name}-${idx}`}
                            className={`rounded-[16px] border p-3.5 ${rowClass}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-3">
                                <div className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-extrabold shadow-sm ${rankClass}`}>
                                  {idx + 1}
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-[14px] font-bold text-[#2f2117]">{item.product_name}</p>
                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#8a6d57]">
                                    <span>{qty} đã bán</span>
                                    <span className="font-semibold text-[#d07a1d]">{formatVnd(revenue)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-[#7b5b43] shadow-[0_4px_10px_rgba(0,0,0,0.04)]">
                                #{idx + 1}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex h-36 items-center justify-center px-4 text-[12px] text-slate-500">Chưa có dữ liệu top món</div>
                  )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-4 py-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Quick overview</p>
                    <h3 className="mt-1.5 flex items-center gap-2 text-base font-semibold text-slate-900">
                      <span className="material-symbols-outlined text-[16px] text-[#b87414]">analytics</span>
                      Thông số nhanh
                    </h3>
                  </div>

                  <div className="grid gap-2.5 p-3.5">
                    <div className="rounded-[15px] border border-[#f1e6dc] bg-[#fffaf6] p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#a17755]">Ngày bán ổn nhất</p>
                      <p className="mt-1.5 text-[20px] font-black text-[#2f2117]">{data.quickStats?.busiestDay || '-'}</p>
                      <p className="mt-1 text-[11px] text-[#8c715b]">Thời điểm có doanh số tốt nhất trong kỳ thống kê.</p>
                    </div>

                    <div className="rounded-[15px] border border-[#f1e6dc] bg-[#fffaf6] p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#a17755]">Khách hàng mới 30 ngày</p>
                      <p className="mt-1.5 text-[18px] font-black text-[#2f2117]">{data.quickStats?.newCustomers30d || 0} khách</p>
                      <p className="mt-1 text-[11px] text-[#8c715b]">
                        {data.quickStats?.newCustomersGrowthPct}% so với 30 ngày trước
                      </p>
                    </div>

                    <div className="rounded-[15px] border border-[#f1e6dc] bg-[#fffaf6] p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#a17755]">Cảnh báo kho</p>
                      <p className="mt-1.5 text-[18px] font-black text-[#2f2117]">{data.quickStats?.lowStock || 0} nguyên liệu</p>
                      <p className="mt-1 text-[11px] text-[#8c715b]">Đang ở ngưỡng sắp hết hàng, cần theo dõi nhập thêm.</p>
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

