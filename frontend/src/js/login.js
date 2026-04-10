import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import '../css/login.css';

export default function Login() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!identifier.trim() || !password.trim()) {
      toast.error('Vui lòng nhập thông tin đăng nhập và mật khẩu');
      return;
    }

    const clean = identifier.trim();
    const phone = clean.replace(/\D/g, '');

    try {
      // Ưu tiên thử đăng nhập tài khoản hệ thống trước
      const staffRes = await axios.post('/api/auth/login', {
        username: clean,
        password
      });

      localStorage.setItem('token', staffRes.data?.token || '');
      localStorage.setItem('staffProfile', JSON.stringify(staffRes.data?.user || {}));
      localStorage.removeItem('customerToken');
      localStorage.removeItem('customerProfile');
      toast.success('Đăng nhập thành công');
      const staffRole = String(staffRes.data?.user?.role || 'staff').toLowerCase();
      navigate(staffRole === 'admin' ? '/dashboard' : '/sales');
      return;
    } catch (_staffErr) {
      // fallback đăng nhập tài khoản khách
    }

    try {
      const customerRes = await axios.post('/api/customers/auth/login', {
        phone: phone || clean,
        password
      });

      localStorage.setItem('customerToken', customerRes.data?.token || '');
      localStorage.setItem('customerProfile', JSON.stringify(customerRes.data?.customer || {}));
      localStorage.removeItem('token');
      toast.success('Đăng nhập thành công');
      navigate('/account');
    } catch (customerErr) {
      const message = customerErr.response?.data?.message || 'Lỗi kết nối server';
      toast.error(`Đăng nhập thất bại: ${message}`);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="coffee-logo"><i className="fas fa-mug-hot"></i></div>
        <h2>Đăng nhập</h2>
        <p className="subtitle">Chào mừng bạn quay trở lại</p>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <i className="fas fa-user"></i>
            <input
              type="text"
              placeholder="Tên đăng nhập hoặc số điện thoại"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>

          <div className="input-group">
            <i className="fas fa-lock"></i>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Mật khẩu"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <i
              className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}
              onClick={() => setShowPassword((prev) => !prev)}
            ></i>
          </div>

          <button type="submit" className="login-btn">Đăng nhập</button>
        </form>

        <div className="divider">Tuỳ chọn nhanh</div>

        <p style={{ marginTop: '8px', fontSize: '13px' }}>
          Chưa có tài khoản? <span style={{ color: '#8b6220', cursor: 'pointer' }} onClick={() => navigate('/customer/register')}>Tạo tài khoản mới</span>
        </p>
        <p style={{ marginTop: '8px', fontSize: '13px' }}>
          Quên mật khẩu? <span style={{ color: '#8b6220', cursor: 'pointer' }} onClick={() => navigate('/customer/forgot-password')}>Khôi phục mật khẩu</span>
        </p>
        <p style={{ marginTop: '8px', fontSize: '13px' }}>
          <span style={{ color: '#8b6220', cursor: 'pointer' }} onClick={() => navigate('/')}>Về trang chủ</span>
        </p>
      </div>
    </div>
  );
}
