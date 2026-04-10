import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import '../css/register.css';

function isValidPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 12;
}

function isValidEmail(value) {
  if (!value) return true;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value).trim());
}

export default function CustomerRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', password: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.full_name.trim()) return setError('Vui lòng nhập họ và tên.');
    if (!isValidPhone(form.phone)) return setError('Số điện thoại không hợp lệ (9-12 số).');
    if (!isValidEmail(form.email)) return setError('Email không hợp lệ.');
    if (!form.password || form.password.length < 6) return setError('Mật khẩu tối thiểu 6 ký tự.');
    if (form.password !== form.confirm) return setError('Mật khẩu xác nhận không khớp.');

    try {
      const res = await axios.post('/api/customers/auth/register', {
        full_name: form.full_name,
        phone: form.phone,
        email: form.email || null,
        password: form.password
      });

      localStorage.setItem('customerToken', res.data?.token || '');
      localStorage.setItem('customerProfile', JSON.stringify(res.data?.customer || {}));
      toast.success('Đăng ký thành công');
      navigate('/account');
    } catch (err) {
      setError(err?.response?.data?.message || 'Đăng ký thất bại');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="coffee-logo"><i className="fas fa-user-plus"></i></div>
        <h2>Đăng ký khách hàng</h2>
        <p className="subtitle">Tạo tài khoản để tích điểm và nhận ưu đãi</p>

        <form onSubmit={submit}>
          <div className="input-group">
            <i className="fas fa-user"></i>
            <input type="text" placeholder="Họ và tên" value={form.full_name} onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))} />
          </div>

          <div className="input-group">
            <i className="fas fa-phone"></i>
            <input type="text" placeholder="Số điện thoại" value={form.phone} onChange={(e) => setForm((s) => ({ ...s, phone: e.target.value }))} />
          </div>

          <div className="input-group">
            <i className="fas fa-envelope"></i>
            <input type="text" placeholder="Email (không bắt buộc)" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          </div>

          <div className="input-group">
            <i className="fas fa-lock"></i>
            <input type={showPassword ? 'text' : 'password'} placeholder="Mật khẩu" value={form.password} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} />
            <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} onClick={() => setShowPassword((v) => !v)}></i>
          </div>

          <div className="input-group">
            <i className="fas fa-lock"></i>
            <input type={showConfirm ? 'text' : 'password'} placeholder="Xác nhận mật khẩu" value={form.confirm} onChange={(e) => setForm((s) => ({ ...s, confirm: e.target.value }))} />
            <i className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`} onClick={() => setShowConfirm((v) => !v)}></i>
          </div>

          <button type="submit" className="login-btn">Đăng ký</button>
          {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}
        </form>

        <p style={{ marginTop: '20px', fontSize: '13px' }}>
          Đã có tài khoản? <span style={{ color: '#8b6220', cursor: 'pointer' }} onClick={() => navigate('/customer/login')}>Đăng nhập</span>
        </p>
        <p style={{ marginTop: '8px', fontSize: '13px' }}>
          <span style={{ color: '#8b6220', cursor: 'pointer' }} onClick={() => navigate('/')}>Về trang chủ</span>
        </p>
      </div>
    </div>
  );
}
