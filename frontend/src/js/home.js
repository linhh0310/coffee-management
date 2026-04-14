import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';

const banners = [
  {
    title: 'Đậm vị cà phê Việt',
    subtitle: 'Bộ sưu tập cà phê rang xay mới',
    desc: 'Khám phá hương vị đặc trưng với công thức pha chế được chọn lọc.',
    cta: 'Khám phá menu',
    section: '#products'
  },
  {
    title: 'Không gian chill mỗi ngày',
    subtitle: 'Làm việc, gặp gỡ, thư giãn',
    desc: 'Thiết kế hiện đại, ánh sáng ấm áp, phù hợp mọi khoảnh khắc của bạn.',
    cta: 'Xem cửa hàng',
    section: '/stores'
  },
  {
    title: 'Thành viên tích điểm',
    subtitle: 'Uống càng nhiều - ưu đãi càng lớn',
    desc: 'Đăng ký tài khoản để tích điểm đổi quà, nhận voucher sinh nhật hàng tháng.',
    cta: 'Đăng ký ngay',
    section: '/customer/register'
  }
];

const fallbackProducts = [
  { product_id: 'f1', product_name: 'Cà phê sữa đá Signature', sale_price: 39000, category_name: 'Coffee' },
  { product_id: 'f2', product_name: 'Trà đào cam sả', sale_price: 45000, category_name: 'Tea' },
  { product_id: 'f3', product_name: 'Freeze caramel', sale_price: 55000, category_name: 'Freeze' }
];

function formatVnd(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('vi-VN')}đ`;
}

function tierProgress(points = 0) {
  const p = Number(points || 0);
  if (p < 800) return { tier: 'Bronze', current: p, next: 800 };
  if (p < 2000) return { tier: 'Silver', current: p, next: 2000 };
  if (p < 5000) return { tier: 'Gold', current: p, next: 5000 };
  return { tier: 'Platinum', current: p, next: 5000 };
}

export default function Home() {
  const navigate = useNavigate();
  const customerToken = localStorage.getItem('customerToken');
  const [openAccountMenu, setOpenAccountMenu] = useState(false);

  const [activeBanner, setActiveBanner] = useState(0);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [customerProfile, setCustomerProfile] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('customerProfile') || '{}');
    } catch (_err) {
      return {};
    }
  });
  const [customerLookup, setCustomerLookup] = useState({ phone: '', loading: false, data: null, message: '' });
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveBanner((prev) => (prev + 1) % banners.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY || 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadProducts = async () => {
      try {
        setProductsLoading(true);
        const res = await axios.get('/api/products/public');
        if (!mounted) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setProducts(rows.length ? rows : fallbackProducts);
      } catch (_err) {
        if (!mounted) return;
        setProducts(fallbackProducts);
      } finally {
        if (mounted) setProductsLoading(false);
      }
    };

    loadProducts();
    return () => {
      mounted = false;
    };
  }, []);

  const active = banners[activeBanner];

  const categoryList = useMemo(() => {
    const names = (products || []).map((p) => String(p.category_name || '').trim()).filter(Boolean);
    return ['Tất cả', ...Array.from(new Set(names))];
  }, [products]);

  const [activeCategory, setActiveCategory] = useState('Tất cả');

  const categoryProducts = useMemo(() => {
    if (activeCategory === 'Tất cả') return products || [];
    return (products || []).filter((p) => String(p.category_name || '').trim() === activeCategory);
  }, [products, activeCategory]);

  const handleLookup = async (e) => {
    e.preventDefault();
    const phone = customerLookup.phone.trim();
    if (!phone) {
      setCustomerLookup((s) => ({ ...s, message: 'Vui lòng nhập số điện thoại để tra cứu điểm.' }));
      return;
    }

    try {
      setCustomerLookup((s) => ({ ...s, loading: true, message: '', data: null }));
      const res = await axios.get('/api/customers/lookup', {
        params: { phone }
      });
      if (!res.data?.customer) {
        setCustomerLookup((s) => ({ ...s, data: null, message: 'Không tìm thấy tài khoản thành viên phù hợp.' }));
        return;
      }
      setCustomerLookup((s) => ({ ...s, data: res.data.customer, message: '' }));
    } catch (err) {
      setCustomerLookup((s) => ({ ...s, data: null, message: err?.response?.data?.message || 'Chưa thể tra cứu điểm, vui lòng thử lại sau.' }));
    } finally {
      setCustomerLookup((s) => ({ ...s, loading: false }));
    }
  };

  const progress = tierProgress(customerLookup.data?.points || 0);
  const percent = progress.next <= progress.current ? 100 : Math.round((progress.current / progress.next) * 100);

  const handleCustomerLogout = () => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerProfile');
    setCustomerProfile({});
    setOpenAccountMenu(false);
    navigate('/');
  };

  return (
    <div className="customer-home min-h-screen bg-[#f7f2eb] text-[#2d1f16]">
      <header className="border-b border-[#e8dccf] bg-[#fffaf4]/95 backdrop-blur fx-fade-up">
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

      <main>
        <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-10 md:px-6 md:pt-12 fx-fade-up fx-fade-up-delay-1">
          <div className="hero-image fx-parallax rounded-3xl p-6 text-white shadow-2xl md:p-10" style={{ '--scrollY': scrollY }}>
            <p className="text-xs uppercase tracking-[0.25em] text-white/80">{active.subtitle}</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-black leading-tight md:text-5xl">{active.title}</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/90 md:text-base">{active.desc}</p>
            <div className="mt-6 flex items-center gap-3">
              {String(active.section).startsWith('/') ? (
                <Link className="rounded-full bg-white px-6 py-3 text-sm font-bold text-[#5e3519]" to={active.section}>
                  {active.cta}
                </Link>
              ) : (
                <a className="rounded-full bg-white px-6 py-3 text-sm font-bold text-[#5e3519]" href={active.section}>
                  {active.cta}
                </a>
              )}
            </div>
            <div className="mt-6 flex items-center gap-2">
              {banners.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveBanner(idx)}
                  className={`h-2.5 rounded-full transition-all ${idx === activeBanner ? 'w-8 bg-white' : 'w-2.5 bg-white/40'}`}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="products" className="bg-[#efeadf] py-14 fx-fade-up fx-fade-up-delay-2">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
            <h3 className="text-center text-4xl font-black">Danh mục toàn bộ sản phẩm</h3>

            {productsLoading ? (
              <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-56 animate-pulse rounded-2xl bg-[#f4e9dc]" />
                ))}
              </div>
            ) : categoryProducts.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-[#ead9c7] bg-white p-6 text-center text-sm text-[#6b5745]">
                Chưa có dữ liệu sản phẩm để hiển thị.
              </div>
            ) : (
              <>
                <div className="mt-8 flex flex-wrap items-center gap-2">
                  {categoryList.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`rounded-full px-4 py-2 text-xs font-bold border ${activeCategory === cat ? 'bg-[#ef7f3b] text-white border-[#ef7f3b]' : 'bg-white text-[#555] border-[#ddd]'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
                  {categoryProducts.map((item, idx) => (
                    <article key={item.product_id} className="group text-center rounded-xl p-2 transition hover:bg-[#fff9f3] fx-card fx-glow fx-stagger" style={{ '--i': idx }}>
                      <div className="mx-auto h-28 w-28 rounded-full bg-[#f1e7db] overflow-hidden flex items-center justify-center shadow-sm ring-1 ring-[#ead9c7] transition group-hover:scale-[1.04] group-hover:shadow-md">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.product_name} className="h-full w-full object-cover transition group-hover:scale-110" />
                        ) : (
                          <span className="material-symbols-outlined text-4xl text-[#b49a84]">local_cafe</span>
                        )}
                      </div>
                      <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[#9b7c63]">{item.category_name || 'Sản phẩm'}</p>
                      <h5 className="mt-1 text-[14px] font-bold leading-snug text-[#1f1f1f] line-clamp-2">{item.product_name}</h5>
                      <p className="mt-2 text-[18px] font-black text-[#ef7f3b]">{formatVnd(item.sale_price ?? item.base_price ?? 0)}</p>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        <section id="membership" className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-14 md:grid-cols-2 md:px-6">
          <article className="rounded-3xl bg-[#2f1f15] p-7 text-white md:p-9">
            <p className="text-xs uppercase tracking-[0.24em] text-[#dfbe9b]">Về cửa hàng</p>
            <h3 className="mt-3 text-2xl font-bold">Không chỉ là một ly cà phê</h3>
            <p className="mt-4 text-sm leading-7 text-[#f3e7dc]">
              Golden Roast Coffee theo đuổi chất lượng từ hạt cà phê đến phong cách phục vụ.
              Chúng tôi xây dựng không gian ấm cúng, hiện đại để mỗi lần ghé quán là một trải nghiệm đáng nhớ.
            </p>
          </article>

          <article className="rounded-3xl border border-[#e8d4bf] bg-[#fff8ef] p-7 md:p-9">
            <p className="text-xs uppercase tracking-[0.24em] text-[#9a7b5f]">Tài khoản khách hàng</p>
            <h3 className="mt-3 text-2xl font-bold text-[#7a4a27]">Tra cứu điểm tích lũy thực tế</h3>
            <form onSubmit={handleLookup} className="mt-4 flex gap-3">
              <input
                className="flex-1 rounded-xl border border-[#e3cfb8] px-3 py-2 text-sm"
                placeholder="Nhập số điện thoại"
                value={customerLookup.phone}
                onChange={(e) => setCustomerLookup((s) => ({ ...s, phone: e.target.value }))}
              />
              <button type="submit" className="rounded-xl bg-[#7a4a27] px-4 py-2 text-sm font-semibold text-white">
                {customerLookup.loading ? 'Đang tra cứu...' : 'Xem điểm'}
              </button>
            </form>

            {customerLookup.message && <p className="mt-3 text-sm text-amber-700">{customerLookup.message}</p>}

            {customerLookup.data && (
              <div className="mt-4 rounded-2xl border border-[#ead5bf] bg-white p-4">
                <p className="font-bold text-[#3f2a1a]">{customerLookup.data.full_name}</p>
                <p className="text-sm text-[#7b5f49]">Hạng hiện tại: {progress.tier}</p>
                <p className="mt-2 text-3xl font-black text-[#7a4a27]">{customerLookup.data.points} điểm</p>
                <div className="mt-3 h-2 w-full rounded-full bg-[#f1e3d2]">
                  <div className="h-2 rounded-full bg-[#b87414]" style={{ width: `${Math.min(100, percent)}%` }} />
                </div>
                <p className="mt-2 text-xs text-[#8f725b]">Tiến trình lên hạng tiếp theo: {Math.min(100, percent)}%</p>
              </div>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}
