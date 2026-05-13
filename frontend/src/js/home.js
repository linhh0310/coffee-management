import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import ChatWidget from '../components/ChatWidget';
import PublicHeader from '../components/PublicHeader';

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

  const [activeBanner, setActiveBanner] = useState(0);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
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

  return (
    <div className="customer-home min-h-screen bg-[#f7f2eb] text-[#2d1f16]">
      <PublicHeader sticky />

      <main>
        <section className="mx-auto w-full max-w-6xl px-4 pb-8 pt-6 md:px-6 md:pb-10 md:pt-12 fx-fade-up fx-fade-up-delay-1">
          <div className="hero-image fx-parallax rounded-[28px] p-5 text-white shadow-2xl md:rounded-3xl md:p-10" style={{ '--scrollY': scrollY }}>
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/80 md:text-xs md:tracking-[0.25em]">{active.subtitle}</p>
            <h2 className="mt-3 max-w-2xl text-[30px] font-black leading-[1.08] md:text-5xl">{active.title}</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/90 md:text-base md:leading-7">{active.desc}</p>
            <div className="mt-6 flex items-center gap-3">
              {String(active.section).startsWith('/') ? (
                <Link className="rounded-full bg-white px-5 py-3 text-sm font-bold text-[#5e3519] shadow-lg shadow-black/10 active:scale-95 md:px-6" to={active.section}>
                  {active.cta}
                </Link>
              ) : (
                <a className="rounded-full bg-white px-5 py-3 text-sm font-bold text-[#5e3519] shadow-lg shadow-black/10 active:scale-95 md:px-6" href={active.section}>
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

        <section id="products" className="bg-[#efeadf] py-10 md:py-14 fx-fade-up fx-fade-up-delay-2">
          <div className="mx-auto w-full max-w-6xl px-4 md:px-6">
            <h3 className="text-center text-2xl font-black leading-tight md:text-4xl">Danh mục toàn bộ sản phẩm</h3>

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
                <div className="mt-6 flex snap-x items-center gap-2 overflow-x-auto pb-2 md:mt-8 md:flex-wrap md:overflow-visible md:pb-0">
                  {categoryList.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`snap-start whitespace-nowrap rounded-full border px-4 py-2.5 text-xs font-bold active:scale-95 ${activeCategory === cat ? 'bg-[#ef7f3b] text-white border-[#ef7f3b]' : 'bg-white text-[#555] border-[#ddd]'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:mt-8 md:grid-cols-4 md:gap-x-6 md:gap-y-8">
                  {categoryProducts.map((item, idx) => (
                    <article key={item.product_id} className="group rounded-2xl bg-white/55 p-3 text-center shadow-sm ring-1 ring-[#ead9c7]/60 transition active:scale-[0.98] hover:bg-[#fff9f3] md:bg-transparent md:p-2 md:shadow-none md:ring-0 fx-card fx-glow fx-stagger" style={{ '--i': idx }}>
                      <div className="mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#f1e7db] shadow-sm ring-1 ring-[#ead9c7] transition group-hover:scale-[1.04] group-hover:shadow-md md:h-28 md:w-28">
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

        <section id="membership" className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-10 md:grid-cols-2 md:gap-6 md:px-6 md:py-14">
          <article className="rounded-[28px] bg-[#2f1f15] p-5 text-white md:rounded-3xl md:p-9">
            <p className="text-xs uppercase tracking-[0.24em] text-[#dfbe9b]">Về cửa hàng</p>
            <h3 className="mt-3 text-2xl font-bold">Không chỉ là một ly cà phê</h3>
            <p className="mt-4 text-sm leading-7 text-[#f3e7dc]">
              Golden Roast Coffee theo đuổi chất lượng từ hạt cà phê đến phong cách phục vụ.
              Chúng tôi xây dựng không gian ấm cúng, hiện đại để mỗi lần ghé quán là một trải nghiệm đáng nhớ.
            </p>
          </article>

          <article className="rounded-[28px] border border-[#e8d4bf] bg-[#fff8ef] p-5 md:rounded-3xl md:p-9">
            <p className="text-xs uppercase tracking-[0.24em] text-[#9a7b5f]">Tài khoản khách hàng</p>
            <h3 className="mt-3 text-xl font-bold text-[#7a4a27] md:text-2xl">Tra cứu điểm tích lũy thực tế</h3>
            <form onSubmit={handleLookup} className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                className="min-h-11 flex-1 rounded-xl border border-[#e3cfb8] px-3 py-2 text-base outline-none focus:border-[#b87414] focus:ring-4 focus:ring-[#b87414]/10 sm:text-sm"
                placeholder="Nhập số điện thoại"
                value={customerLookup.phone}
                onChange={(e) => setCustomerLookup((s) => ({ ...s, phone: e.target.value }))}
              />
              <button type="submit" className="min-h-11 rounded-xl bg-[#7a4a27] px-4 py-2 text-sm font-semibold text-white active:scale-[0.98]">
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
      <ChatWidget />
    </div>
  );
}
