import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import '../css/login.css';

export default function CustomerLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!phone.trim() || !password.trim()) {
      setError('Vui lòng nhập số điện thoại và mật khẩu.');
      return;
    }

    try {
      const res = await axios.post('/api/customers/auth/login', {
        phone,
        password
      });

      localStorage.setItem('customerToken', res.data?.token || '');
      localStorage.setItem('customerProfile', JSON.stringify(res.data?.customer || {}));
      toast.success('Đăng nhập thành công');
      navigate('/account');
    } catch (err) {
      setError(err?.response?.data?.message || 'Đăng nhập thất bại');
    }
  };

  const handleChangePassword = async () => {
    const token = localStorage.getItem('customerToken');
    if (!token) {
      setError('Bạn cần đăng nhập khách hàng trước khi đổi mật khẩu.');
      return;
    }
    if (!oldPassword || !newPassword) {
      setError('Vui lòng nhập đủ mật khẩu cũ và mới.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới tối thiểu 6 ký tự.');
      return;
    }

    try {
      await axios.patch(
        '/api/customers/auth/change-password',
        { old_password: oldPassword, new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Đổi mật khẩu thành công');
      setChangingPassword(false);
      setOldPassword('');
      setNewPassword('');
      setError('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Đổi mật khẩu thất bại');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="coffee-logo"><i className="fas fa-mug-hot"></i></div>
        <h2>Đăng nhập khách hàng</h2>
        <p className="subtitle">Đăng nhập để xem điểm tích lũy và ưu đãi</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <i className="fas fa-phone"></i>
            <input
              type="text"
              placeholder="Số điện thoại"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
            <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} onClick={() => setShowPassword((v) => !v)}></i>
          </div>

          <button type="submit" className="login-btn">Đăng nhập</button>
        </form>

        <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="social-btn" onClick={() => navigate('/customer/forgot-password')}>Quên mật khẩu</button>
          <button type="button" className="social-btn" onClick={() => setChangingPassword((v) => !v)}>Đổi mật khẩu</button>
        </div>

        {changingPassword && (
          <div style={{ marginTop: 12 }}>
            <div className="input-group">
              <i className="fas fa-lock"></i>
              <input
                type="password"
                placeholder="Mật khẩu hiện tại"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>
            <div className="input-group">
              <i className="fas fa-lock"></i>
              <input
                type="password"
                placeholder="Mật khẩu mới"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <button type="button" className="login-btn" onClick={handleChangePassword}>Xác nhận đổi mật khẩu</button>
          </div>
        )}

        {error && <p className="error-text" style={{ marginTop: 10 }}>{error}</p>}

        <p style={{ marginTop: '12px', fontSize: '13px' }}>
          Chưa có tài khoản? <span style={{ color: '#8b6220', cursor: 'pointer' }} onClick={() => navigate('/customer/register')}>Đăng ký ngay</span>
        </p>
        <p style={{ marginTop: '8px', fontSize: '13px' }}>
          <span style={{ color: '#8b6220', cursor: 'pointer' }} onClick={() => navigate('/')}>Về trang chủ</span>
        </p>
      </div>
    </div>
  );
}
