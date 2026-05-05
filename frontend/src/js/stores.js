import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { resolveMediaUrl } from '../utils/media';

const branchList = [
  {
    id: 1,
    name: 'The Coffee House Tây Sơn',
    address: '56/100 Tây Sơn, Đống Đa, Hà Nội',
    hours: '07:00 - 22:30',
    image: 'https://file.hstatic.net/1000075078/article/3__1__2b67342f4db64bb082944cf078afd910_grande.jpg'
  },
  {
    id: 2,
    name: 'The Coffee House Hoàng Văn Thái',
    address: '71 Hoàng Văn Thái, Tân Phú, Quận 7, Thành phố Hồ Chí Minh',
    hours: '07:00 - 22:30',
    image: 'https://file.hstatic.net/1000075078/article/hn-le-thanh-nghi2_d161f1f7755249cba30f2ecc7a591e47_master_1bbacee733084b93a400eaa54762bf12_grande.jpg'
  }
];

function normalizeText(s) {
  return String(s || '').trim();
}

export default function Stores() {
  const navigate = useNavigate();
  const customerToken = localStorage.getItem('customerToken');
  const [openAccountMenu, setOpenAccountMenu] = useState(false);
  const customerProfile = (() => {
    try {
      return JSON.parse(localStorage.getItem('customerProfile') || '{}');
    } catch (_err) {
      return {};
    }
  })();

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadProducts = async () => {
      try {
        setLoadingProducts(true);
        const res = await axios.get('/api/products/public');
        if (!mounted) return;
        setProducts(Array.isArray(res.data) ? res.data : []);
      } catch (_err) {
        if (!mounted) return;
        setProducts([]);
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    };

    loadProducts();
    return () => {
      mounted = false;
    };
  }, []);

  const groupedCategories = useMemo(() => {
    const map = new Map();
    (products || []).forEach((p) => {
      const category = normalizeText(p.category_name) || 'Khác';
      if (!map.has(category)) map.set(category, []);
      map.get(category).push(p);
    });
    return Array.from(map.entries());
  }, [products]);

  const [activeCategory, setActiveCategory] = useState('');

  const handleCustomerLogout = () => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerProfile');
    setOpenAccountMenu(false);
    navigate('/');
  };

  useEffect(() => {
    if (!activeCategory && groupedCategories.length) {
      setActiveCategory(groupedCategories[0][0]);
    }
  }, [activeCategory, groupedCategories]);

  const categoryProducts = useMemo(() => {
    const found = groupedCategories.find(([name]) => name === activeCategory);
    return found ? found[1] : [];
  }, [groupedCategories, activeCategory]);

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#1f1f1f]">
      <header className="border-b border-[#e8dccf] bg-[#fffaf4]/95 backdrop-blur fx-fade-up">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <Link to="/" className="block w-[220px]">
            <div className="relative h-12 overflow-visible">
              <img
                src={resolveMediaUrl('/uploads/logo/logo.png')}
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

      <main className="fx-fade-up fx-fade-up-delay-1">
        <section className="bg-[#efeadf]">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20 text-center">
            <p className="text-4xl font-black tracking-tight">CỬA HÀNG “NHÀ”</p>
            <p className="mt-3 text-xl font-extrabold text-[#d17432]">Danh sách cơ sở & danh mục sản phẩm tại cửa hàng</p>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-[#5d4d3d]">
              The Coffee House hiện phục vụ tại nhiều khu vực với menu đa dạng.
              Dưới đây là 2 cơ sở bạn yêu cầu và toàn bộ danh mục sản phẩm đang có trong hệ thống.
            </p>
            <img
              src="https://file.hstatic.net/1000075078/article/thecoffeehouse_caphe_7_db8def55acbf426ea725921529f6f01e_grande.jpg"
              alt="Không gian cửa hàng The Coffee House"
              className="mt-10 h-[320px] w-full rounded-2xl object-cover"
            />
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6 md:py-20">
            <h3 className="text-center text-4xl font-black">Hệ thống cơ sở</h3>
            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
              {branchList.map((branch) => (
                <article key={branch.id} className="overflow-hidden rounded-2xl border border-[#ead9c7] bg-[#fff8ef] shadow-sm">
                  <img src={branch.image} alt={branch.name} className="h-56 w-full object-cover" />
                  <div className="p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9a7b5f]">Cơ sở {branch.id}</p>
                    <h4 className="mt-2 text-2xl font-extrabold text-[#2a2018]">{branch.name}</h4>
                    <p className="mt-3 text-[15px] leading-7 text-[#4f4031]">
                      <span className="font-bold">Địa chỉ:</span> {branch.address}
                    </p>
                    <p className="mt-1 text-[15px] leading-7 text-[#4f4031]">
                      <span className="font-bold">Giờ mở cửa:</span> {branch.hours}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#efeadf]">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6 md:py-20">
            <h3 className="text-center text-4xl font-black">Danh mục toàn bộ sản phẩm</h3>

            {loadingProducts ? (
              <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-56 animate-pulse rounded-2xl bg-[#f4e9dc]" />
                ))}
              </div>
            ) : groupedCategories.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-[#ead9c7] bg-white p-6 text-center text-sm text-[#6b5745]">
                Chưa có dữ liệu sản phẩm để hiển thị.
              </div>
            ) : (
              <div className="mt-8 rounded-3xl border border-[#e4d3c2] bg-[#f8f2ea] p-4 shadow-[0_12px_35px_rgba(64,35,15,0.08)] md:p-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <aside className="lg:col-span-3 rounded-2xl border border-[#ead9c7] bg-white p-4 shadow-sm">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#b26a35]">{String(activeCategory || '').toUpperCase()}</p>
                    <div className="mt-3 space-y-3">
                      {groupedCategories.map(([cat, items]) => {
                        const isActive = activeCategory === cat;
                        return (
                          <div key={cat} className="rounded-xl border border-transparent px-2 py-1 hover:border-[#f0ddca] hover:bg-[#fff9f2] transition">
                            <button
                              type="button"
                              onClick={() => setActiveCategory(cat)}
                              className={`block w-full text-left text-[13px] font-extrabold uppercase tracking-wide ${isActive ? 'text-[#ef7f3b]' : 'text-[#2a2018]'}`}
                            >
                              {cat}
                            </button>
                            {isActive && (
                              <ul className="mt-2 space-y-1.5 pl-2">
                                {items.slice(0, 8).map((item) => (
                                  <li key={`menu-${item.product_id}`} className="text-[11px] text-[#5a4738] uppercase leading-5">{item.product_name}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </aside>

                  <div className="lg:col-span-9 rounded-2xl border border-[#ead9c7] bg-white p-4 md:p-5 shadow-sm">
                    <div className="flex items-center justify-between border-b border-[#f2e5d8] pb-3">
                      <h4 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-[#111]">{activeCategory}</h4>
                      <span className="rounded-full bg-[#f9eee3] px-3 py-1 text-xs font-bold text-[#9a6d47]">{categoryProducts.length} sản phẩm</span>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
                      {categoryProducts.map((item) => (
                        <article key={item.product_id} className="group text-center rounded-xl p-2 transition hover:bg-[#fff9f3]">
                          <div className="mx-auto h-28 w-28 rounded-full bg-[#f1e7db] overflow-hidden flex items-center justify-center shadow-sm ring-1 ring-[#ead9c7] transition group-hover:scale-[1.04] group-hover:shadow-md">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.product_name} className="h-full w-full object-cover transition group-hover:scale-110" />
                            ) : (
                              <span className="material-symbols-outlined text-4xl text-[#b49a84]">local_cafe</span>
                            )}
                          </div>
                          <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[#9b7c63]">{item.category_name || 'Sản phẩm'}</p>
                          <h5 className="mt-1 text-[14px] font-bold leading-snug text-[#1f1f1f] line-clamp-2">{item.product_name}</h5>
                          <p className="mt-2 text-[18px] font-black text-[#ef7f3b]">{Math.round(Number(item.sale_price ?? item.base_price ?? 0)).toLocaleString('vi-VN')} đ</p>
                        </article>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
