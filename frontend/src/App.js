import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import Login from './js/login';
import ProductList from './js/productlist';
import Register from './js/register';
import Dashboard from './js/dashboard';
import Sales from './js/sales';
import Stats from './js/stats';
import Staff from './js/staff';
import Customers from './js/customers';
import Promotions from './js/promotions';
import Invoices from './js/invoices';
import Home from './js/home';
import Story from './js/story';
import Stores from './js/stores';
import News from './js/news';
import Account from './js/account';
import CustomerRegister from './js/customerRegister';
import CustomerForgotPassword from './js/customerForgotPassword';

// Component bảo vệ tuyến đường + phân quyền role
const PrivateRoute = ({ children, roles = [] }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" />;

  let role = 'staff';
  try {
    const profile = JSON.parse(localStorage.getItem('staffProfile') || '{}');
    role = String(profile?.role || 'staff').toLowerCase();
  } catch (_) {
    role = 'staff';
  }

  if (Array.isArray(roles) && roles.length && !roles.includes(role)) {
    return <Navigate to="/sales" />;
  }

  return children;
};

const AnimatedPage = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.2, ease: 'easeOut' }}
    className="h-full"
  >
    {children}
  </motion.div>
);

function AppRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Trang chủ khách hàng */}
        <Route path="/" element={<AnimatedPage><Home /></AnimatedPage>} />
        <Route path="/story" element={<AnimatedPage><Story /></AnimatedPage>} />
        <Route path="/stores" element={<AnimatedPage><Stores /></AnimatedPage>} />
        <Route path="/news" element={<AnimatedPage><News /></AnimatedPage>} />
        <Route path="/account" element={<AnimatedPage><Account /></AnimatedPage>} />
        <Route path="/customer/login" element={<Navigate to="/login" />} />
        <Route path="/customer/register" element={<AnimatedPage><CustomerRegister /></AnimatedPage>} />
        <Route path="/customer/forgot-password" element={<AnimatedPage><CustomerForgotPassword /></AnimatedPage>} />
        {/* 1. Trang Đăng nhập */}
        <Route path="/login" element={<AnimatedPage><Login /></AnimatedPage>} />
        {/* Khóa route đăng ký cũ để tránh tạo nhầm tài khoản nhân viên */}
        <Route path="/register" element={<Navigate to="/customer/register" />} />
        <Route path="/staff/register" element={<AnimatedPage><PrivateRoute><Register /></PrivateRoute></AnimatedPage>} />
        {/* 2. Trang Sản phẩm (Được bảo vệ) */}
        <Route
          path="/products" element={<AnimatedPage><PrivateRoute roles={['admin']}><ProductList /></PrivateRoute></AnimatedPage>}/>
          {/* Trang Dashboard (Được bảo vệ) */}
          <Route path="/dashboard" element={<AnimatedPage><PrivateRoute roles={['admin']}><Dashboard /></PrivateRoute></AnimatedPage>} />
          {/* Trang Bán hàng (Được bảo vệ) */}
          <Route path="/sales" element={<AnimatedPage><PrivateRoute roles={['admin', 'staff']}><Sales /></PrivateRoute></AnimatedPage>} />
          {/* Các trang danh mục khác (Được bảo vệ) */}
          <Route path="/stats" element={<AnimatedPage><PrivateRoute roles={['admin']}><Stats /></PrivateRoute></AnimatedPage>} />
          <Route path="/staff" element={<AnimatedPage><PrivateRoute roles={['admin', 'staff']}><Staff /></PrivateRoute></AnimatedPage>} />
          <Route path="/customers" element={<AnimatedPage><PrivateRoute roles={['admin']}><Customers /></PrivateRoute></AnimatedPage>} />
          <Route path="/promotions" element={<AnimatedPage><PrivateRoute roles={['admin']}><Promotions /></PrivateRoute></AnimatedPage>} />
          <Route path="/invoices" element={<AnimatedPage><PrivateRoute roles={['admin']}><Invoices /></PrivateRoute></AnimatedPage>} />

        {/* 3. Mặc định: Link lạ thì về trang chủ khách hàng */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <Toaster position="top-right" toastOptions={{ duration: 2500 }} />
        <AppRoutes />
      </div>
    </Router>
  );
}

export default App;
