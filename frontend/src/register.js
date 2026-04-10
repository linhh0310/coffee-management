import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import './register.css'; // CSS riêng cho trang Register

function Register() {
    const [fullName, setFullName] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);


    const [fullNameError, setFullNameError] = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [confirmError, setConfirmError] = useState('');
    const [generalError, setGeneralError] = useState('');

    const navigate = useNavigate();

    const validateEmailOrPhone = (value) => {
        const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
        const phoneRegex = /^\d{9,12}$/;
        return emailRegex.test(value) || phoneRegex.test(value);
    };



    const handleRegister = async (e) => {
        e.preventDefault();
        setFullNameError('');
        setUsernameError('');
        setPasswordError('');
        setConfirmError('');
        setGeneralError('');

        if (!fullName.trim()) {
            setFullNameError('Vui lòng nhập tên đầy đủ.');
            return;
        }

        if (!username.trim()) {
            setUsernameError('Vui lòng nhập email hoặc số điện thoại.');
            return;
        }

        if (!validateEmailOrPhone(username.trim())) {
            setUsernameError('Vui lòng nhập email hợp lệ hoặc số điện thoại 9–12 chữ số.');
            return;
        }

        if (!password.trim()) {
            setPasswordError('Vui lòng nhập mật khẩu.');
            return;
        }

        if (password.length < 6) {
            setPasswordError('Mật khẩu phải ít nhất 6 ký tự.');
            return;
        }


        if (password !== confirmPassword) {
            setConfirmError('Mật khẩu xác nhận không khớp.');
            return;
        }

        try {
            await axios.post('/api/auth/register', {
                full_name: fullName,
                username,
                password,
            });
            toast.success('Đăng ký thành công! Hãy đăng nhập.');
            navigate('/login');
        } catch (error) {
            setGeneralError(error.response?.data?.message || 'Server error');
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <div className="coffee-logo"><i className="fas fa-user-plus"></i></div>
                <h2>Đăng ký</h2>
                <p className="subtitle">Vui lòng đăng ký để tiếp tục</p>
                <form onSubmit={handleRegister}>
                    <div className="input-group">
                        <i className="fas fa-user"></i>
                        <input
                            type="text"
                            placeholder="Họ và tên"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                        />
                    </div>
                    {fullNameError && <p className="error-text">{fullNameError}</p>}

                    <div className="input-group">
                        <i className="fas fa-envelope"></i>
                        <input
                            type="text"
                            placeholder="Số điện thoại hoặc Email"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    {usernameError && <p className="error-text">{usernameError}</p>}
                    <div className="input-group">
                        <i className="fas fa-lock"></i>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Mật khẩu"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <i
                            className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}
                            onClick={() => setShowPassword((prev) => !prev)}
                        ></i>
                    </div>
                    {passwordError && <p className="error-text">{passwordError}</p>}

                    <div className="input-group">
                        <i className="fas fa-lock"></i>
                        <input
                            type={showConfirm ? 'text' : 'password'}
                            placeholder="Xác nhận mật khẩu"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                        <i
                            className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`}
                            onClick={() => setShowConfirm((prev) => !prev)}
                        ></i>
                    </div>
                    {confirmError && <p className="error-text">{confirmError}</p>}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                        <button type="submit" className="login-btn" style={{ flex: 1 }}>
                            Đăng ký
                        </button>
                    </div>
                    {generalError && <p className="error-text" style={{ marginTop: '12px' }}>{generalError}</p>}
                </form>
                <div className="divider">Hoặc tiếp tục bằng</div>

        <div className="social-login">
            <button className="social-btn"><i className="fab fa-google" style={{color: '#db4437'}}></i> Google</button>
            <button className="social-btn"><i className="fab fa-facebook" style={{color: '#4267B2'}}></i> Facebook</button>
        </div>
                <p style={{marginTop: '20px'}}>
                    Đã có tài khoản? <span style={{color: '#8b6220', cursor: 'pointer', fontWeight: 'bold'}} onClick={() => navigate('/login')}>Đăng nhập</span>
                </p>
            </div>
        </div>
    );
}

export default Register;