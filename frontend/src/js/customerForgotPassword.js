import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import '../css/login.css';

export default function CustomerForgotPassword() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const requestOtp = async () => {
    if (!phone.trim()) return setMessage('Vui lòng nhập số điện thoại');
    try {
      setLoading(true);
      setMessage('');
      const res = await axios.post('/api/customers/auth/forgot-password/request-otp', { phone });
      setStep(2);
      setMessage(`OTP đã gửi. Mã dev: ${res.data?.otp_debug || '***'}`);
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Không gửi được OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) return setMessage('Vui lòng nhập OTP');
    try {
      setLoading(true);
      setMessage('');
      await axios.post('/api/customers/auth/forgot-password/verify-otp', { phone, otp });
      setStep(3);
      toast.success('Xác thực OTP thành công');
    } catch (err) {
      setMessage(err?.response?.data?.message || 'OTP không hợp lệ');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 6) return setMessage('Mật khẩu tối thiểu 6 ký tự');
    try {
      setLoading(true);
      setMessage('');
      await axios.post('/api/customers/auth/forgot-password/reset', { phone, new_password: newPassword });
      toast.success('Đặt lại mật khẩu thành công');
      navigate('/customer/login');
    } catch (err) {
      setMessage(err?.response?.data?.message || 'Đặt lại mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="coffee-logo"><i className="fas fa-key"></i></div>
        <h2>Quên mật khẩu</h2>
        <p className="subtitle">Khôi phục mật khẩu tài khoản khách hàng</p>

        <div className="input-group">
          <i className="fas fa-phone"></i>
          <input type="text" placeholder="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={step > 1} />
        </div>

        {step >= 2 && (
          <div className="input-group">
            <i className="fas fa-shield-alt"></i>
            <input type="text" placeholder="Nhập OTP" value={otp} onChange={(e) => setOtp(e.target.value)} disabled={step > 2} />
          </div>
        )}

        {step >= 3 && (
          <div className="input-group">
            <i className="fas fa-lock"></i>
            <input type="password" placeholder="Mật khẩu mới" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
        )}

        {step === 1 && <button type="button" className="login-btn" onClick={requestOtp}>{loading ? 'Đang gửi...' : 'Gửi OTP'}</button>}
        {step === 2 && <button type="button" className="login-btn" onClick={verifyOtp}>{loading ? 'Đang xác thực...' : 'Xác thực OTP'}</button>}
        {step === 3 && <button type="button" className="login-btn" onClick={resetPassword}>{loading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}</button>}

        {message && <p className="error-text" style={{ marginTop: 10 }}>{message}</p>}
      </div>
    </div>
  );
}
