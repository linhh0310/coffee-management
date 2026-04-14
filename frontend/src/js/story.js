import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const testimonials = [
  {
    name: 'Nguyễn Thảo Vy',
    color: 'bg-[#fdecee]',
    text: 'Mình ghé The Coffee House mỗi sáng trước giờ làm. Không gian và chất lượng đồ uống luôn ổn định, tạo cảm giác dễ chịu để bắt đầu ngày mới.'
  },
  {
    name: 'Tạ Quang Anh',
    color: 'bg-[#eef8d5]',
    text: 'Dù là nhân viên mới hay lâu năm, các bạn đều rất nhiệt tình. Mình thích cách quán chú trọng trải nghiệm nhỏ như lời chào và nụ cười.'
  },
  {
    name: 'Lê Bảo Ngọc',
    color: 'bg-[#fff3cf]',
    text: 'Giá hợp lý, menu đa dạng và thường có ưu đãi theo mùa. Mỗi lần quay lại đều thấy có điểm mới thú vị.'
  },
  {
    name: 'Đăng Quân',
    color: 'bg-[#dff0ff]',
    text: 'Nơi phù hợp để gặp bạn bè hoặc làm việc nhẹ nhàng. Đồ uống ra nhanh, vị ổn định và nhân viên thân thiện.'
  }
];

export default function Story() {
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

  const handleCustomerLogout = () => {
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerProfile');
    setOpenAccountMenu(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#1f1f1f]">
      <header className="border-b border-[#e8dccf] bg-[#fffaf4]/95 backdrop-blur fx-fade-up overflow-visible">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6 overflow-visible">
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
          <div className="flex items-center gap-3 relative overflow-visible">
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
                  <div className="fixed right-6 top-16 z-[9999] w-56 rounded-xl border border-[#eadfd4] bg-white shadow-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        setOpenAccountMenu(false);
                        navigate('/account');
                      }}
                      className="block w-full text-left px-4 py-3 text-sm font-medium text-[#2f2117] hover:bg-[#faf5ef]"
                    >
                      Tài khoản của tôi
                    </button>
                    <button
                      type="button"
                      onClick={handleCustomerLogout}
                      className="block w-full text-left px-4 py-3 text-sm font-medium text-[#8b2b2b] hover:bg-[#fff1f1] border-t border-[#f2e5e5]"
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
            <p className="text-4xl font-black tracking-tight">CHUYỆN “NHÀ”</p>
            <p className="mt-3 text-xl font-extrabold text-[#d17432]">Mỗi nụ cười là một câu chuyện - và “Nhà” là nơi lưu giữ tất cả</p>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-[#5d4d3d]">
              The Coffee kể lại hành trình xây dựng một không gian nơi con người, hương vị và cảm xúc gặp nhau.
              Chúng tôi tin một ly cà phê ngon không chỉ để uống mà còn để gắn kết, để sẻ chia, và để mỗi ngày trở nên đáng nhớ hơn.
            </p>
            <img src="https://file.hstatic.net/1000075078/file/aboutus-bannertop-pc.png" alt="Banner câu chuyện The Coffee" className="mt-10 h-[360px] w-full rounded-2xl object-cover" />
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-14 md:grid-cols-2 md:px-6 md:py-20 items-center">
            <div>
              <p className="text-4xl font-black">Chuyện “Nhà”</p>
              <p className="mt-5 text-[15px] leading-8 text-[#4f4031]">
                The Coffee tin rằng nụ cười là hương vị ngọt ngào nhất trong mỗi ngày.
                Từ những ly cà phê ấm áp đến từng lời chào thân mật, chúng tôi mong mọi vị khách khi ghé “Nhà” đều mang theo
                một niềm vui nhỏ - để rồi nụ cười ấy được lan tỏa khắp nơi.
              </p>
              <p className="mt-4 text-[15px] leading-8 text-[#4f4031]">
                Không chỉ là điểm đến để thưởng thức đồ uống, “Nhà” còn là nơi để gặp gỡ, để làm việc,
                để thư giãn và để kết nối với những điều tích cực trong cuộc sống.
              </p>
            </div>
            <div className="relative">
              <img src="https://file.hstatic.net/1000075078/file/aboutus-banner1.png" alt="Chuyện Nhà The Coffee" className="h-[420px] w-full rounded-2xl object-cover rotate-1" />
              <div className="absolute -top-3 -left-3 rounded-full bg-[#d17432] px-3 py-1 text-xs font-bold text-white">#chuyennha</div>
            </div>
          </div>
        </section>

        <section className="bg-[#efeadf]">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-14 md:grid-cols-2 md:px-6 md:py-20 items-center">
            <div>
              <img src="https://file.hstatic.net/1000075078/file/aboutus-banner2.png" alt="Giá trị hạt cà phê" className="h-[330px] w-full rounded-2xl object-cover" />
            </div>
            <div>
              <h3 className="text-5xl font-black leading-tight">Nguyên bản từ giá trị hạt cà phê chất lượng</h3>
              <p className="mt-5 text-[15px] leading-8 text-[#433526]">
                Mỗi nụ cười ở The Coffee  đều bắt đầu từ một hạt cà phê nguyên bản. Chúng tôi chọn lọc nguồn hạt theo mùa vụ,
                kiểm soát kỹ quá trình rang xay để giữ lại hương vị cân bằng, đậm đà và bền vững trong từng ly uống mỗi ngày.
              </p>
              <p className="mt-4 text-[15px] leading-8 text-[#433526]">
                Chất lượng không chỉ đến từ kỹ thuật, mà còn từ sự tôn trọng nguyên liệu và tâm huyết của đội ngũ pha chế.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-14 md:grid-cols-2 md:px-6 md:py-20 items-center">
            <div>
              <h3 className="text-5xl font-black leading-tight">Chất lượng khởi nguồn từ những đồi trà tuyển chọn</h3>
              <p className="mt-5 text-[15px] leading-8 text-[#433526]">
                Giữa những đồi trà xanh mướt trong sương sớm, “Nhà” tìm thấy nguồn cảm hứng cho hành trình đồ uống thanh mát.
                Từng lá trà được tuyển chọn đúng thời điểm, lưu giữ hương thơm và vị thanh tự nhiên.
              </p>
              <p className="mt-4 text-[15px] leading-8 text-[#433526]">
                Với “Nhà”, một tách trà ngon là sự cân bằng giữa nguyên liệu tốt và cảm xúc chân thành,
                để mỗi lần thưởng thức đều nhẹ nhàng và dễ chịu.
              </p>
            </div>
            <div>
              <img src="https://file.hstatic.net/1000075078/file/aboutus-banner2.png" alt="Đồi trà tuyển chọn" className="h-[330px] w-full rounded-2xl object-cover" />
            </div>
          </div>
        </section>

        <section className="bg-[#f6f6f6]">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6 md:py-20">
            <h3 className="text-center text-5xl font-black">Những lời thương...</h3>
            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-4">
              {testimonials.map((item) => (
                <article key={item.name} className={`rounded-2xl p-5 ${item.color} border border-white/70 shadow-sm`}>
                  <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-white border border-[#e8d6c3] flex items-center justify-center text-xs font-bold text-[#8a7058]">
                    ẢNH
                  </div>
                  <p className="text-center text-lg font-extrabold">{item.name}</p>
                  <p className="mt-2 text-center text-[#e3a51f]">★★★★★</p>
                  <p className="mt-3 text-sm leading-7 text-[#4f4031]">“{item.text}”</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
