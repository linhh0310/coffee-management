import React from 'react';
import { Link } from 'react-router-dom';

const newsItems = [
  {
    id: 1,
    title: 'Sống trọn vị cùng The Coffee House',
    date: '08.04.2026',
    desc: 'Hành trình trải nghiệm không gian, món uống và câu chuyện thương hiệu trong một ngày thư giãn.',
    tag: 'Coffeeholic',
    image: 'https://file.hstatic.net/1000075078/article/tch_1112202102997st_bc065ad82df743f4858ad3d49b55c883_grande.jpg'
  },
  {
    id: 2,
    title: 'Blog: Điều làm nên một quán cà phê đáng nhớ',
    date: '05.04.2026',
    desc: 'Không chỉ là đồ uống, trải nghiệm tổng thể mới là điều giữ chân khách hàng quay lại.',
    tag: 'Blog',
    image: 'https://file.hstatic.net/1000075078/article/blog_892d5f75b50242c2a805a4d5808b2596_grande.jpg'
  },
  {
    id: 3,
    title: 'Latte nóng lifestyle cho ngày dịu nhẹ',
    date: '02.04.2026',
    desc: 'Gợi ý món latte ấm áp với hương vị cân bằng, phù hợp những buổi chiều cần chút thư giãn.',
    tag: 'Sản phẩm mới',
    image: 'https://file.hstatic.net/1000075078/article/latte_nong_lifestyle__2__9ed6ca8b89eb4189bcf78abdde2d536f_grande.jpg'
  },
  {
    id: 4,
    title: 'Khuyến mãi theo tuần tại hệ thống cửa hàng',
    date: '30.03.2026',
    desc: 'Nhiều ưu đãi hấp dẫn dành cho thành viên và khách hàng mới trong khung giờ vàng.',
    tag: 'Khuyến mãi',
    image: 'https://file.hstatic.net/1000075078/article/3_84a7b01b11534be8a28b78d26f2b502c_grande.jpg'
  },
  {
    id: 5,
    title: 'Từ hương vị đến cảm xúc',
    date: '27.03.2026',
    desc: 'The Coffee House chia sẻ góc nhìn mới về trải nghiệm quán cà phê hiện đại.',
    tag: 'Chuyện Nhà',
    image: 'https://file.hstatic.net/1000075078/article/_downloader.la_-61eac05cf31fe_a7f5546657fa45739592e2fa7f83bbfe_grande.jpg'
  },
  {
    id: 6,
    title: 'Menu cập nhật theo mùa đã có mặt',
    date: '24.03.2026',
    desc: 'Thêm các lựa chọn mới dành cho khách yêu vị thanh mát và nhẹ nhàng.',
    tag: 'Teaholic',
    image: 'https://file.hstatic.net/1000075078/article/3_954251d7defe4b1aaf5e94b3c92ed6a4_grande.jpg'
  },
  {
    id: 7,
    title: 'Đường đá và bí quyết cân bằng vị',
    date: '21.03.2026',
    desc: 'Mẹo nhỏ để bạn thưởng thức thức uống đúng gu hơn tại quán và khi mang đi.',
    tag: 'Chia sẻ',
    image: 'https://file.hstatic.net/1000075078/article/duong_da_80f152c5b04a4171b82ef084ec99db50_grande.jpg'
  },
  {
    id: 8,
    title: 'Khoảnh khắc tại cửa hàng trung tâm',
    date: '18.03.2026',
    desc: 'Những góc check-in và trải nghiệm được yêu thích bởi cộng đồng khách hàng trẻ.',
    tag: 'Cửa hàng',
    image: 'https://file.hstatic.net/1000075078/article/img_3206_7d1706cebcb94555a14e0a355511e2b7_1024x1024.jpg'
  },
  {
    id: 9,
    title: 'Không gian mới tại Lê Thanh Nghị',
    date: '15.03.2026',
    desc: 'Cập nhật địa điểm mới với thiết kế hiện đại, phù hợp học tập và làm việc.',
    tag: 'Cửa hàng mới',
    image: 'https://file.hstatic.net/1000075078/article/hn-le-thanh-nghi2_d161f1f7755249cba30f2ecc7a591e47_master_1bbacee733084b93a400eaa54762bf12_grande.jpg'
  },
  {
    id: 10,
    title: 'Workshop cuối tuần cùng The Coffee House',
    date: '12.03.2026',
    desc: 'Hoạt động tương tác dành cho khách hàng yêu thích trải nghiệm và sáng tạo.',
    tag: 'Sự kiện',
    image: 'https://cdn.hstatic.net/files/1000075078/article/poster_workshop_nuoc_hoa_-_dao_the_anh_4990a65590374ee6ab7b744ae23e4c54_1024x1024.jpeg'
  }
];

export default function News() {
  return (
    <div className="min-h-screen bg-[#f7f3ee] text-[#1f1f1f]">
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
          <div className="flex items-center gap-3">
            <Link className="rounded-full border border-[#d5b899] px-4 py-2 text-sm font-semibold hover:bg-[#f7eadb]" to="/customer/login">
              Đăng nhập
            </Link>
            <Link className="rounded-full bg-[#7a4a27] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5e3519]" to="/customer/register">
              Đăng ký
            </Link>
          </div>
        </div>
      </header>

      <main className="fx-fade-up fx-fade-up-delay-1">
        <section className="bg-[#efeadf]">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6 md:py-20 text-center">
            <p className="text-4xl font-black tracking-tight">TIN TỨC “NHÀ”</p>
            <p className="mt-3 text-xl font-extrabold text-[#d17432]">Cập nhật mới nhất từ The Coffee</p>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-[#5d4d3d]">
              Nơi cập nhật những thông tin mới nhất về sản phẩm, chương trình ưu đãi,
              sự kiện và các hoạt động cộng đồng của The Coffee.
            </p>
            <img
              src="https://file.hstatic.net/1000075078/article/signaturebythecoffeehouse_03_16b2ab7101e14d62835a4b231e73b65d_1024x1024.jpg"
              alt="Banner tin tức The Coffee"
              className="mt-10 h-[360px] w-full rounded-2xl object-cover"
            />
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-14 md:grid-cols-2 md:px-6 md:py-20 items-center">
            <div>
              <p className="text-4xl font-black">Điểm tin nổi bật</p>
              <p className="mt-5 text-[15px] leading-8 text-[#4f4031]">
                Mỗi tuần, “Nhà” mang đến những cập nhật quan trọng về trải nghiệm khách hàng,
                các dòng sản phẩm theo mùa và chương trình khuyến mãi mới.
              </p>
              <p className="mt-4 text-[15px] leading-8 text-[#4f4031]">
                Theo dõi chuyên mục Tin tức để không bỏ lỡ bất kỳ thông báo hữu ích nào từ hệ thống.
              </p>
            </div>
            <div className="relative">
              <img
                src="https://cdn.hstatic.net/files/1000075078/article/poster_workshop_nuoc_hoa_-_dao_the_anh_4990a65590374ee6ab7b744ae23e4c54_1024x1024.jpeg"
                alt="Sự kiện workshop The Coffee"
                className="h-[420px] w-full rounded-2xl object-cover rotate-1"
              />
              <div className="absolute -top-3 -left-3 rounded-full bg-[#d17432] px-3 py-1 text-xs font-bold text-white">#news</div>
              <div className="absolute -bottom-3 -right-3 rounded-full bg-[#f6d6bb] px-3 py-1 text-xs font-bold text-[#9a5b2e]">Bạn sẽ thay ảnh thật sau</div>
            </div>
          </div>
        </section>

        <section className="bg-[#efeadf]">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 md:px-6 md:py-20">
            <h3 className="text-center text-5xl font-black">Bản tin mới</h3>
            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {newsItems.map((item, idx) => (
                <article key={item.id} className="overflow-hidden rounded-2xl border border-[#ead9c7] bg-[#f7f0e6] shadow-sm fx-card fx-glow fx-stagger" style={{ '--i': idx }}>
                  <img src={item.image} alt={item.title} className="h-48 w-full object-cover fx-image" />
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-[#b0825d]">{item.tag}</span>
                      <span className="text-[10px] font-semibold text-[#8a725f]">{item.date}</span>
                    </div>
                    <h4 className="mt-2 text-[18px] leading-snug font-bold text-[#2a2018] line-clamp-2">{item.title}</h4>
                    <p className="mt-2 text-[13px] leading-6 text-[#4f4031] line-clamp-3">{item.desc}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
