const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        
        if (rows.length === 0) {
            return res.status(401).json({ message: "Tài khoản không tồn tại" });
        }

        const user = rows[0];

        // Nếu database lưu password dạng hash (bcrypt) thì dùng bcrypt.compare
        // Nếu lưu password plaintext thì so sánh trực tiếp (môi trường dev).
        const isHashed = /^\$2[aby]\$/.test(user.password);
        const isMatch = isHashed
            ? await bcrypt.compare(password.toString(), user.password)
            : password === user.password;

        if (!isMatch) {
            return res.status(401).json({ message: "Mật khẩu không chính xác" });
        }

        const token = jwt.sign(
            { id: user.user_id, role: user.role || 'staff' }, 
            process.env.JWT_SECRET, 
            { expiresIn: '1d' }
        );

        const { password: _, ...userWithoutPassword } = user;
        res.status(200).json({
            message: "Đăng nhập thành công",
            token: token,
            user: userWithoutPassword
        });

    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
    }
};

exports.register = async (req, res) => {
    const { full_name, username, password } = req.body;

    try {
        const [existingUser] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser.length > 0) {
            return res.status(400).json({ message: "Tên đăng nhập đã tồn tại" });
        }

        const hashedPassword = await bcrypt.hash(password.toString(), 10);

        const [result] = await db.query(
            'INSERT INTO users (full_name, username, password, role) VALUES (?, ?, ?, ?)',
            [full_name || null, username, hashedPassword, 'staff']
        );

        const token = jwt.sign(
            { id: result.insertId, role: 'staff' },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        res.status(201).json({
            message: "Đăng ký thành công",
            token: token,
            user: { user_id: result.insertId, full_name, username, role: 'staff' }
        });

    } catch (error) {
        res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
    }
};