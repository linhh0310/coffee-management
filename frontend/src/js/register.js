import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import '../css/register.css';

function Register() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) return setError('Vui lòng nhập họ tên nhân viên.');
    if (!username.trim()) return setError('Vui lòng nhập username nhân viên.');
    if (!password || password.length < 6) return setError('Mật khẩu tối thiểu 6 ký tự.');
    if (password !== confirmPassword) return setError('Mật khẩu xác nhận không khớp.');

    const token = localStorage.getItem('token');
    if (!token) return setError('Cần đăng nhập admin để tạo tài khoản nhân viên.');

    try {
      await axios.post(
        '/api/auth/register',
        { full_name: fullName, username, password },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Tạo tài khoản nhân viên thành công');
      navigate('/staff');
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tạo tài khoản nhân viên');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="coffee-logo"><i className="fas fa-user-shield"></i></div>
        <h2>Tạo tài khoản nhân viên</h2>
        <p className="subtitle">Chỉ admin mới có quyền tạo</p>

        <form onSubmit={handleRegister}>
          <div className="input-group">
            <i className="fas fa-user"></i>
            <input type="text" placeholder="Họ và tên nhân viên" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="input-group">
            <i className="fas fa-id-badge"></i>
            <input type="text" placeholder="Username nhân viên" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          <div className="input-group">
            <i className="fas fa-lock"></i>
            <input type={showPassword ? 'text' : 'password'} placeholder="Mật khẩu" value={password} onChange={(e) => setPassword(e.target.value)} />
            <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} onClick={() => setShowPassword((v) => !v)}></i>
          </div>

          <div className="input-group">
            <i className="fas fa-lock"></i>
            <input type={showConfirm ? 'text' : 'password'} placeholder="Xác nhận mật khẩu" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <i className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`} onClick={() => setShowConfirm((v) => !v)}></i>
          </div>

          <button type="submit" className="login-btn">Tạo tài khoản nhân viên</button>
          {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
        </form>

        <p style={{ marginTop: '18px', fontSize: '13px' }}>
          Quay lại <span style={{ color: '#8b6220', cursor: 'pointer' }} onClick={() => navigate('/staff')}>Quản lý nhân viên</span>
        </p>
      </div>
    </div>
  );
}

export default Register;
