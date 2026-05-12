import React from 'react';
import { Link } from 'react-router-dom';
import { resolveMediaUrl } from '../utils/media';

export default function CustomerFooter() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="customer-footer">
      <div className="customer-footer__inner">
        <div className="customer-footer__top">
          <Link to="/" className="customer-footer__brand" aria-label="Về trang chủ">
            <img src={resolveMediaUrl('/uploads/logo/logo.png')} alt="Golden Roast Coffee" />
          </Link>

          <button type="button" className="customer-footer__locale" aria-label="Ngôn ngữ và khu vực">
            <span className="material-symbols-outlined">location_on</span>
            <span>Vietnam (Tiếng Việt)</span>
          </button>
        </div>

        <div className="customer-footer__bottom">
          <nav className="customer-footer__links" aria-label="Liên kết chân trang">
            <Link to="/stores">Liên hệ với chúng tôi</Link>
            <Link to="/story">Điều khoản sử dụng</Link>
            <Link to="/account">Thông báo về Quyền Riêng tư</Link>
            <Link to="/news">Thông báo Cookies</Link>
            <Link to="/">Sơ đồ trang</Link>
          </nav>

          <button type="button" className="customer-footer__to-top" onClick={scrollToTop}>
            <span aria-hidden="true">↑</span>
            <span>Về đầu trang</span>
          </button>
        </div>
      </div>
    </footer>
  );
}
