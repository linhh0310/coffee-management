import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';

function formatDate(value) {
  return new Date(value).toLocaleDateString('vi-VN');
}

function formatTime(value) {
  if (!value) return '--:--';
  const text = String(value);
  const m = text.match(/(\d{2}):(\d{2})(?::\d{2})?$/);
  if (m) return `${m[1]}:${m[2]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function hhmmToMinutes(hhmm) {
  const m = String(hhmm || '').match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export default function Staff() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const role = String(JSON.parse(localStorage.getItem('staffProfile') || '{}')?.role || 'staff').toLowerCase();
      return role === 'admin' ? 'list' : 'attendance';
    } catch (_) {
      return 'attendance';
    }
  }); // list | attendance | payroll
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ totalUsers: 0, totalStaff: 0, totalAdmin: 0, activeUsers: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, totalItems: 0, totalPages: 1 });
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [savingIds, setSavingIds] = useState(() => new Set());
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [attendanceSearch, setAttendanceSearch] = useState('');
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().toISOString().slice(0, 7));
  const [showAdjustAttendance, setShowAdjustAttendance] = useState(false);
  const [adjustAttendanceForm, setAdjustAttendanceForm] = useState({ check_in: '', check_out: '', reason: '' });
  const [shiftForm, setShiftForm] = useState({ shift_start: '08:00', shift_end: '17:00' });
  const [payrollMonth, setPayrollMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payrollRows, setPayrollRows] = useState([]);
  const [payrollSummary, setPayrollSummary] = useState({ totalFund: 0, paidFund: 0, pendingFund: 0, totalStaff: 0 });
  const [payrollSearch, setPayrollSearch] = useState('');
  const [payrollStatusFilter, setPayrollStatusFilter] = useState('');
  const [showPayrollConfirm, setShowPayrollConfirm] = useState(false);
  const [pendingPayrollAction, setPendingPayrollAction] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showUserMonthlyDetail, setShowUserMonthlyDetail] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailMonth, setDetailMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlyDetail, setMonthlyDetail] = useState(null);
  const [monthlyDetailLoading, setMonthlyDetailLoading] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', full_name: '', role: 'staff', phone: '', base_salary: 0, allowance: 0 });
  const [editUser, setEditUser] = useState({ full_name: '', role: 'staff', phone: '', base_salary: 0, allowance: 0 });
  const [resetPassword, setResetPassword] = useState('');

  const staffProfile = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('staffProfile') || '{}');
    } catch (_) {
      return {};
    }
  }, []);
  const currentRole = String(staffProfile?.role || 'staff').toLowerCase();
  const currentUserId = Number(staffProfile?.user_id || 0);
  const isAdmin = currentRole === 'admin';

  const handleLogout = React.useCallback(() => {
    localStorage.removeItem('token');
    navigate('/login');
  }, [navigate]);

  const fetchUsers = React.useCallback(async (page = 1) => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      setLoading(true);
      setErrorMessage('');
      const res = await axios.get('/api/users', {
        params: { page, limit: pagination.limit, q: q || undefined, role: role || undefined, status: status || undefined },
        headers: { Authorization: `Bearer ${token}` }
      });
      setRows(res.data?.users || []);
      setSummary(res.data?.summary || {});
      setPagination({
        page: res.data?.page || 1,
        limit: res.data?.limit || 10,
        totalItems: res.data?.totalItems || 0,
        totalPages: res.data?.totalPages || 1
      });
    } catch (err) {
      if ([401, 403].includes(err?.response?.status)) return handleLogout();
      setErrorMessage(err?.response?.data?.message || 'Không thể tải danh sách nhân viên');
    } finally {
      setLoading(false);
    }
  }, [handleLogout, pagination.limit, q, role, status]);

  const fetchAttendance = React.useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      setLoading(true);
      setErrorMessage('');
      const res = await axios.get('/api/users/attendance', {
        params: { date: attendanceDate, q: attendanceSearch || undefined },
        headers: { Authorization: `Bearer ${token}` }
      });
      setAttendanceRows(res.data?.attendance || []);
    } catch (err) {
      if ([401, 403].includes(err?.response?.status)) return handleLogout();
      setErrorMessage(err?.response?.data?.message || 'Không thể tải dữ liệu chấm công');
    } finally {
      setLoading(false);
    }
  }, [handleLogout, attendanceDate, attendanceSearch]);

  const fetchPayroll = React.useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      setLoading(true);
      setErrorMessage('');
      const res = await axios.get('/api/users/payroll', {
        params: { month: payrollMonth },
        headers: { Authorization: `Bearer ${token}` }
      });
      setPayrollRows(res.data?.payroll || []);
      setPayrollSummary(res.data?.summary || {});
    } catch (err) {
      if ([401, 403].includes(err?.response?.status)) return handleLogout();
      setErrorMessage(err?.response?.data?.message || 'Không thể tải dữ liệu bảng lương');
    } finally {
      setLoading(false);
    }
  }, [handleLogout, payrollMonth]);

  useEffect(() => {
    if (!isAdmin && activeTab === 'list') {
      setActiveTab('attendance');
      return;
    }
    if (activeTab === 'list') fetchUsers(1);
    if (activeTab === 'attendance') fetchAttendance();
    if (activeTab === 'payroll') fetchPayroll();
  }, [activeTab, fetchUsers, fetchAttendance, fetchPayroll, isAdmin]);

  const pages = useMemo(() => {
    const total = pagination.totalPages || 1;
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
    const p = pagination.page;
    const start = Math.max(1, p - 2);
    const end = Math.min(total, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [pagination]);

  const upsertAttendance = async (userId, action) => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      await axios.post(
        `/api/users/${userId}/attendance`,
        { action, date: attendanceDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchAttendance();
    } catch (err) {
      if ([401, 403].includes(err?.response?.status)) return handleLogout();
      toast.error(err?.response?.data?.message || 'Cập nhật chấm công thất bại');
    }
  };

  const openAdjustAttendance = (row) => {
    setSelectedUser(row);
    setAdjustAttendanceForm({
      check_in: row?.check_in ? formatTime(row.check_in) : '',
      check_out: row?.check_out ? formatTime(row.check_out) : '',
      reason: ''
    });
    setShiftForm({
      shift_start: String(row?.shift_start || '08:00:00').slice(0, 5),
      shift_end: String(row?.shift_end || '17:00:00').slice(0, 5)
    });
    setShowAdjustAttendance(true);
  };


  const submitAdjustAttendance = async () => {
    const token = localStorage.getItem('token');
    if (!token || !selectedUser) return handleLogout();

    try {
      await axios.patch(
        `/api/users/${selectedUser.user_id}/attendance/adjust`,
        {
          date: attendanceDate,
          check_in: adjustAttendanceForm.check_in || null,
          check_out: adjustAttendanceForm.check_out || null,
          reason: adjustAttendanceForm.reason
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await axios.patch(
        `/api/users/${selectedUser.user_id}/shift`,
        {
          shift_start: shiftForm.shift_start,
          shift_end: shiftForm.shift_end
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Cập nhật công và ca làm thành công');
      setShowAdjustAttendance(false);
      fetchAttendance();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Cập nhật công/ca thất bại');
    }
  };

  const exportAttendanceCsv = async () => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      const res = await axios.get('/api/users/attendance/export', {
        params: { date: attendanceDate, month: attendanceMonth },
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance-${attendanceMonth || attendanceDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Xuất báo cáo thất bại');
    }
  };

  const toggleStatus = async (userId, nextStatus) => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    setSavingIds((prev) => new Set(prev).add(userId));
    try {
      await axios.patch(`/api/users/${userId}/status`, { status: nextStatus }, { headers: { Authorization: `Bearer ${token}` } });
      setRows((prev) => prev.map((u) => Number(u.user_id) === Number(userId) ? { ...u, status: nextStatus } : u));
    } catch (err) {
      if ([401, 403].includes(err?.response?.status)) return handleLogout();
      toast.error(err?.response?.data?.message || 'Cập nhật trạng thái thất bại');
    } finally {
      setSavingIds((prev) => {
        const n = new Set(prev);
        n.delete(userId);
        return n;
      });
    }
  };

  const createUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      await axios.post('/api/users', newUser, { headers: { Authorization: `Bearer ${token}` } });
      setShowCreate(false);
      setNewUser({ username: '', password: '', full_name: '', role: 'staff', phone: '', base_salary: 0, allowance: 0 });
      toast.success('Tạo nhân viên thành công');
      fetchUsers(1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Tạo nhân viên thất bại');
    }
  };

  const openEdit = (u) => {
    setSelectedUser(u);
    setEditUser({
      full_name: u.full_name || '',
      role: u.role || 'staff',
      phone: u.phone || '',
      base_salary: Number(u.base_salary || 0),
      allowance: Number(u.allowance || 0)
    });
    setShowEdit(true);
  };

  const saveEditUser = async () => {
    const token = localStorage.getItem('token');
    if (!token || !selectedUser) return handleLogout();
    try {
      await axios.patch(`/api/users/${selectedUser.user_id}`, editUser, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Cập nhật nhân viên thành công');
      setShowEdit(false);
      fetchUsers(pagination.page || 1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Cập nhật nhân viên thất bại');
    }
  };

  const openResetPassword = (u) => {
    setSelectedUser(u);
    setResetPassword('');
    setShowResetPwd(true);
  };

  const submitResetPassword = async () => {
    const token = localStorage.getItem('token');
    if (!token || !selectedUser) return handleLogout();
    try {
      await axios.patch(
        `/api/users/${selectedUser.user_id}/reset-password`,
        { new_password: resetPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Đặt lại mật khẩu thành công');
      setShowResetPwd(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Đặt lại mật khẩu thất bại');
    }
  };

  const openDeleteConfirm = (u) => {
    setSelectedUser(u);
    setShowDeleteConfirm(true);
  };

  const submitDeleteUser = async () => {
    const token = localStorage.getItem('token');
    if (!token || !selectedUser) return handleLogout();

    try {
      await axios.delete(`/api/users/${selectedUser.user_id}`, { headers: { Authorization: `Bearer ${token}` } });
      toast.success('Xóa nhân viên thành công');
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      fetchUsers(1);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Xóa nhân viên thất bại');
    }
  };

  const togglePayrollPaymentStatus = async (userId, paymentStatus) => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      await axios.patch(
        `/api/users/payroll/${userId}/payment-status`,
        { payment_status: paymentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPayrollRows((prev) => prev.map((r) => (Number(r.user_id) === Number(userId) ? { ...r, payment_status: paymentStatus } : r)));
      toast.success('Cập nhật trạng thái lương thành công');
      fetchPayroll();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Cập nhật trạng thái lương thất bại');
    }
  };

  const filteredPayrollRows = useMemo(() => {
    const key = String(payrollSearch || '').trim().toLowerCase();
    return (payrollRows || []).filter((r) => {
      const matchSearch = key
        ? String(r.full_name || '').toLowerCase().includes(key) || String(r.employee_code || '').toLowerCase().includes(key)
        : true;
      const matchStatus = payrollStatusFilter ? String(r.payment_status) === payrollStatusFilter : true;
      return matchSearch && matchStatus;
    });
  }, [payrollRows, payrollSearch, payrollStatusFilter]);

  const openPayrollConfirm = (row, paymentStatus) => {
    setPendingPayrollAction({ row, paymentStatus });
    setShowPayrollConfirm(true);
  };

  const submitPayrollStatusChange = async () => {
    if (!pendingPayrollAction?.row || !pendingPayrollAction?.paymentStatus) return;
    await togglePayrollPaymentStatus(pendingPayrollAction.row.user_id, pendingPayrollAction.paymentStatus);
    setShowPayrollConfirm(false);
    setPendingPayrollAction(null);
  };

  const exportPayrollCsv = () => {
    const rows = filteredPayrollRows || [];
    if (!rows.length) {
      toast.error('Không có dữ liệu để xuất CSV');
      return;
    }

    const header = ['Mã NV', 'Họ tên', 'Lương cơ bản', 'Phụ cấp', 'Thưởng', 'Tổng lương', 'Trạng thái'];
    const body = rows.map((r) => [
      r.employee_code,
      String(r.full_name || '').replaceAll(',', ' '),
      Number(r.base_salary || 0),
      Number(r.allowance || 0),
      Number(r.bonus || 0),
      Number(r.total_salary || 0),
      r.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'
    ]);

    const csv = `\uFEFF${header.join(',')}\n${body.map((r) => r.join(',')).join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${payrollMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchUserMonthlyDetail = async (userId, monthValue = detailMonth) => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    try {
      setMonthlyDetailLoading(true);
      const res = await axios.get(`/api/users/${userId}/monthly-detail`, {
        params: { month: monthValue },
        headers: { Authorization: `Bearer ${token}` }
      });
      setMonthlyDetail(res.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Không thể tải chi tiết tháng của nhân viên');
      setMonthlyDetail(null);
    } finally {
      setMonthlyDetailLoading(false);
    }
  };

  const openUserMonthlyDetail = async (u) => {
    setSelectedUser(u);
    setShowUserMonthlyDetail(true);
    await fetchUserMonthlyDetail(u.user_id, detailMonth);
  };

  const openMyMonthlyDetail = async () => {
    if (!currentUserId) {
      toast.error('Không xác định được tài khoản hiện tại');
      return;
    }

    const fromPayroll = (payrollRows || []).find((r) => Number(r.user_id) === currentUserId);
    const fromAttendance = (attendanceRows || []).find((r) => Number(r.user_id) === currentUserId);

    const fallbackUser = {
      user_id: currentUserId,
      full_name: staffProfile?.full_name || staffProfile?.username || 'Nhân viên',
      username: staffProfile?.username || 'staff',
      employee_code: fromPayroll?.employee_code || fromAttendance?.employee_code || `NV-${String(currentUserId).padStart(3, '0')}`
    };

    await openUserMonthlyDetail(fromPayroll || fromAttendance || fallbackUser);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8f7f6]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 border-b border-orange-100 bg-white/90 flex items-center justify-between px-8 sticky top-0 z-10">
          <h2 className="text-2xl font-extrabold text-slate-900">Quản lý Nhân viên</h2>
          {isAdmin && activeTab === 'list' && (
            <button type="button" onClick={() => setShowCreate(true)} className="px-4 py-2.5 rounded-xl bg-[#b87414] text-white font-semibold">
              + Thêm nhân viên
            </button>
          )}
        </header>

        <div className="p-8 space-y-6">
          <section className="flex items-center gap-2 border-b border-orange-100 pb-3">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className={`px-4 py-2 rounded-t-xl font-semibold text-sm ${activeTab === 'list' ? 'text-[#b87414] border-b-2 border-[#b87414]' : 'text-slate-600'}`}
              >
                Danh sách nhân viên
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab('attendance')}
              className={`px-4 py-2 rounded-t-xl font-semibold text-sm ${activeTab === 'attendance' ? 'text-[#b87414] border-b-2 border-[#b87414]' : 'text-slate-600'}`}
            >
              Bảng chấm công
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('payroll')}
              className={`px-4 py-2 rounded-t-xl font-semibold text-sm ${activeTab === 'payroll' ? 'text-[#b87414] border-b-2 border-[#b87414]' : 'text-slate-600'}`}
            >
              Bảng lương
            </button>
          </section>

          {isAdmin && activeTab === 'list' && (
            <>
          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Tổng tài khoản</p><p className="text-3xl font-extrabold">{summary.totalUsers}</p></div>
            <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Nhân viên</p><p className="text-3xl font-extrabold">{summary.totalStaff}</p></div>
            <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Admin</p><p className="text-3xl font-extrabold">{summary.totalAdmin}</p></div>
            <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Đang hoạt động</p><p className="text-3xl font-extrabold text-green-600">{summary.activeUsers}</p></div>
          </section>

          <section className="bg-white border border-orange-100 rounded-2xl p-5">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <input className="border border-orange-100 rounded-xl px-3 py-2 text-sm" placeholder="Tìm username / họ tên" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="border border-orange-100 rounded-xl px-3 py-2 text-sm" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">Tất cả vai trò</option><option value="admin">Admin</option><option value="staff">Staff</option>
              </select>
              <select className="border border-orange-100 rounded-xl px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Tất cả trạng thái</option><option value="1">Hoạt động</option><option value="0">Khóa</option>
              </select>
              <button type="button" onClick={() => fetchUsers(1)} className="rounded-xl bg-orange-50 border border-orange-100 text-[#b87414] font-semibold">Lọc dữ liệu</button>
            </div>
          </section>

          <section className="bg-white border border-orange-100 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-orange-50">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">NHÂN VIÊN</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">USERNAME</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">VAI TRÒ</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">ĐƠN ĐÃ LẬP</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">NGÀY TẠO</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">TRẠNG THÁI</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600">THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                {!loading && rows.map((u) => (
                  <tr key={u.user_id} className="border-t border-orange-100">
                    <td className="px-4 py-3 font-semibold text-slate-900">{u.full_name || '(Chưa cập nhật)'}</td>
                    <td className="px-4 py-3 text-slate-700">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900">{u.orders_count}</td>
                    <td className="px-4 py-3 text-slate-700">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={savingIds.has(u.user_id)}
                        onClick={() => toggleStatus(u.user_id, Number(u.status) === 1 ? 0 : 1)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${Number(u.status) === 1 ? 'bg-[#b87414]' : 'bg-slate-200'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${Number(u.status) === 1 ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" onClick={() => openUserMonthlyDetail(u)} className="px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-semibold">Xem tháng</button>
                        <button type="button" onClick={() => openEdit(u)} className="px-2.5 py-1 rounded-lg border border-orange-200 text-[#b87414] text-xs font-semibold">Sửa</button>
                        <button type="button" onClick={() => openResetPassword(u)} className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold">Đặt lại mật khẩu</button>
                        <button type="button" onClick={() => openDeleteConfirm(u)} className="px-2.5 py-1 rounded-lg border border-red-200 text-red-700 text-xs font-semibold">Xóa</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-orange-100 flex items-center justify-between">
              <p className="text-sm text-slate-500">Trang {pagination.page}/{pagination.totalPages} - Tổng {pagination.totalItems} nhân viên</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => fetchUsers(Math.max(1, pagination.page - 1))} className="size-8 rounded-lg border border-orange-100">{'<'}</button>
                {pages.map((p) => (
                  <button key={p} type="button" onClick={() => fetchUsers(p)} className={`size-8 rounded-lg border ${p === pagination.page ? 'bg-[#b87414] border-[#b87414] text-white' : 'border-orange-100'}`}>{p}</button>
                ))}
                <button type="button" onClick={() => fetchUsers(Math.min(pagination.totalPages, pagination.page + 1))} className="size-8 rounded-lg border border-orange-100">{'>'}</button>
              </div>
            </div>
          </section>
            </>
          )}

          {activeTab === 'attendance' && (
            <>
              <section className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-3xl font-extrabold text-slate-900">Bảng chấm công</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {!isAdmin && (
                    <button
                      type="button"
                      onClick={openMyMonthlyDetail}
                      className="px-4 py-2 rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50 font-semibold"
                    >
                      Xem lịch sử chấm công theo tháng
                    </button>
                  )}
                  {isAdmin && (
                    <input
                      type="text"
                      className="border border-orange-100 rounded-xl px-3 py-2 text-sm"
                      placeholder="Tìm mã NV / họ tên"
                      value={attendanceSearch}
                      onChange={(e) => setAttendanceSearch(e.target.value)}
                    />
                  )}
                  <input
                    type="date"
                    className="border border-orange-100 rounded-xl px-3 py-2"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                  />
                  <input
                    type="month"
                    className="border border-orange-100 rounded-xl px-3 py-2"
                    value={attendanceMonth}
                    onChange={(e) => setAttendanceMonth(e.target.value)}
                  />
                  <button type="button" onClick={fetchAttendance} className="px-4 py-2 rounded-xl bg-orange-50 border border-orange-100 text-[#b87414] font-semibold">Lọc</button>
                  {isAdmin && <button type="button" onClick={exportAttendanceCsv} className="px-4 py-2 rounded-xl bg-[#b87414] text-white font-semibold">Xuất CSV</button>}
                </div>
              </section>

              <section className="bg-white border border-orange-100 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-orange-50">
                    <tr className="text-left">
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">MÃ NV</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">HỌ TÊN</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">CHECK-IN</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">CHECK-OUT</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">GIỜ CÔNG</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">CA LÀM</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">ĐI MUỘN/VỀ SỚM</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">TRẠNG THÁI</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRows.map((r) => (
                      <tr key={r.user_id} className="border-t border-orange-100">
                        <td className="px-4 py-3 font-semibold text-slate-900">{r.employee_code}</td>
                        <td className="px-4 py-3 text-slate-800">{r.full_name}</td>
                        <td className="px-4 py-3 text-slate-700">{formatTime(r.check_in)}</td>
                        <td className="px-4 py-3 text-slate-700">{formatTime(r.check_out)}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{(Number(r.worked_minutes || 0) / 60).toFixed(1)}h</td>
                        <td className="px-4 py-3 text-slate-700 text-sm">{String(r.shift_start || '08:00').slice(0, 5)} - {String(r.shift_end || '17:00').slice(0, 5)}</td>
                        <td className="px-4 py-3 text-sm">
                          {(() => {
                            const checkInMins = hhmmToMinutes(formatTime(r.check_in));
                            const shiftStartMins = hhmmToMinutes(String(r.shift_start || '08:00').slice(0, 5));
                            const lateMinutes = (checkInMins !== null && shiftStartMins !== null)
                              ? Math.max(0, checkInMins - shiftStartMins)
                              : 0;

                            if (lateMinutes >= 30) {
                              return (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold">
                                  Đi muộn ({lateMinutes}p)
                                </span>
                              );
                            }

                            return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">Đúng giờ</span>;
                          })()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${
                            r.status === 'checked_out' ? 'bg-green-50 text-green-700' :
                            r.status === 'checked_in' ? 'bg-orange-50 text-orange-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {r.status === 'checked_out' ? 'Đã check-out' : r.status === 'checked_in' ? 'Đã check-in' : 'Chưa bắt đầu'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {r.role !== 'admin' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => upsertAttendance(r.user_id, 'check_in')}
                                  disabled={r.status !== 'not_started'}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                    r.status === 'not_started'
                                      ? 'border-orange-200 text-[#b87414] bg-orange-50 hover:bg-orange-100'
                                      : 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
                                  }`}
                                >
                                  Check-in
                                </button>
                                <button
                                  type="button"
                                  onClick={() => upsertAttendance(r.user_id, 'check_out')}
                                  disabled={r.status !== 'checked_in'}
                                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                                    r.status === 'checked_in'
                                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                      : 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
                                  }`}
                                >
                                  Check-out
                                </button>
                              </>
                            )}
                            {isAdmin && <button type="button" onClick={() => openAdjustAttendance(r)} className="px-2 py-1 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 text-[11px] font-semibold transition-colors">Điều chỉnh / Ca</button>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}

          {activeTab === 'payroll' && (
            <>
              <section className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-3xl font-extrabold text-slate-900">Bảng lương tháng {payrollMonth}</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {!isAdmin && (
                    <button
                      type="button"
                      onClick={openMyMonthlyDetail}
                      className="px-4 py-2 rounded-xl border border-indigo-200 text-indigo-700 bg-indigo-50 font-semibold"
                    >
                      Xem chi tiết bảng lương theo tháng
                    </button>
                  )}
                  {isAdmin && (
                    <input
                      type="text"
                      className="border border-orange-100 rounded-xl px-3 py-2 text-sm"
                      placeholder="Tìm mã NV / họ tên"
                      value={payrollSearch}
                      onChange={(e) => setPayrollSearch(e.target.value)}
                    />
                  )}
                  {isAdmin && (
                    <select
                      className="border border-orange-100 rounded-xl px-3 py-2 text-sm"
                      value={payrollStatusFilter}
                      onChange={(e) => setPayrollStatusFilter(e.target.value)}
                    >
                      <option value="">Tất cả trạng thái lương</option>
                      <option value="paid">Đã thanh toán</option>
                      <option value="pending">Chưa thanh toán</option>
                    </select>
                  )}
                  <input
                    type="month"
                    className="border border-orange-100 rounded-xl px-3 py-2"
                    value={payrollMonth}
                    onChange={(e) => setPayrollMonth(e.target.value)}
                  />
                  <button type="button" onClick={fetchPayroll} className="px-4 py-2 rounded-xl bg-orange-50 border border-orange-100 text-[#b87414] font-semibold">Lọc</button>
                  {isAdmin && <button type="button" onClick={exportPayrollCsv} className="px-4 py-2 rounded-xl bg-[#b87414] text-white font-semibold">Xuất CSV</button>}
                </div>
              </section>

              {isAdmin && (
                <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Tổng quỹ lương</p><p className="text-3xl font-extrabold text-[#b87414]">{Number(payrollSummary.totalFund || 0).toLocaleString('vi-VN')}đ</p></div>
                  <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Đã thanh toán</p><p className="text-3xl font-extrabold text-green-700">{Number(payrollSummary.paidFund || 0).toLocaleString('vi-VN')}đ</p></div>
                  <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Còn lại</p><p className="text-3xl font-extrabold text-blue-900">{Number(payrollSummary.pendingFund || 0).toLocaleString('vi-VN')}đ</p></div>
                  <div className="bg-white border border-orange-100 rounded-2xl p-4"><p className="text-xs text-slate-500">Tổng nhân sự</p><p className="text-3xl font-extrabold">{payrollSummary.totalStaff}</p></div>
                </section>
              )}

              <section className="bg-white border border-orange-100 rounded-2xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-orange-50">
                    <tr className="text-left">
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">MÃ NV</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">HỌ TÊN</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">LƯƠNG CƠ BẢN</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">PHỤ CẤP</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">THƯỞNG</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">TỔNG LƯƠNG</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">TRẠNG THÁI</th>
                      <th className="px-4 py-3 text-xs font-bold text-slate-600">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayrollRows.map((r) => (
                      <tr key={r.user_id} className="border-t border-orange-100">
                        <td className="px-4 py-3 font-semibold text-slate-900">{r.employee_code}</td>
                        <td className="px-4 py-3 font-semibold text-slate-800">{r.full_name}</td>
                        <td className="px-4 py-3 text-slate-800">{Number(r.base_salary).toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-3 text-slate-800">{Number(r.allowance).toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-3 text-green-700 font-semibold">+{Number(r.bonus).toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-3 text-[#b87414] font-extrabold">{Number(r.total_salary).toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            r.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                          }`}>
                            {r.payment_status === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isAdmin ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openPayrollConfirm(r, 'paid')}
                                className="px-2.5 py-1 rounded-lg border border-green-200 text-green-700 text-xs font-semibold"
                              >
                                Đánh dấu đã trả
                              </button>
                              <button
                                type="button"
                                onClick={() => openPayrollConfirm(r, 'pending')}
                                className="px-2.5 py-1 rounded-lg border border-orange-200 text-orange-700 text-xs font-semibold"
                              >
                                Chưa trả
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">Xem thông tin</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}

          {errorMessage && <div className="text-red-600">{errorMessage}</div>}
        </div>
      </main>

      {isAdmin && showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-orange-100">
            <h3 className="text-xl font-extrabold">Thêm nhân viên</h3>
            <p className="text-xs text-slate-500 mt-1">Nhập đầy đủ thông tin hồ sơ để phục vụ chấm công và tính lương.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Họ và tên</label>
                <input className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Ví dụ: Nguyễn Văn A" value={newUser.full_name} onChange={(e) => setNewUser((s) => ({ ...s, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Tên đăng nhập</label>
                <input className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Ví dụ: nv_a" value={newUser.username} onChange={(e) => setNewUser((s) => ({ ...s, username: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Mật khẩu ban đầu</label>
                <input type="password" className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Tối thiểu 6 ký tự" value={newUser.password} onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Số điện thoại</label>
                <input className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Ví dụ: 09xxxxxxxx" value={newUser.phone} onChange={(e) => setNewUser((s) => ({ ...s, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Lương cơ bản (VNĐ)</label>
                  <input type="number" className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="VD: 6000000" value={newUser.base_salary} onChange={(e) => setNewUser((s) => ({ ...s, base_salary: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Phụ cấp (VNĐ)</label>
                  <input type="number" className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="VD: 500000" value={newUser.allowance} onChange={(e) => setNewUser((s) => ({ ...s, allowance: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Vai trò tài khoản</label>
                <select className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" value={newUser.role} onChange={(e) => setNewUser((s) => ({ ...s, role: e.target.value }))}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl border border-orange-100">Hủy</button>
              <button type="button" onClick={createUser} className="flex-1 py-2 rounded-xl bg-[#b87414] text-white font-semibold">Lưu</button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && showAdjustAttendance && selectedUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 border border-orange-100">
            <h3 className="text-xl font-extrabold">Điều chỉnh công & cập nhật ca</h3>
            <p className="text-xs text-slate-500 mt-1">Nhân viên: <b>{selectedUser.full_name || selectedUser.username}</b> • Ngày: <b>{attendanceDate}</b></p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Giờ check-in</label>
                <input
                  type="time"
                  className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2"
                  value={adjustAttendanceForm.check_in}
                  onChange={(e) => setAdjustAttendanceForm((s) => ({ ...s, check_in: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Giờ check-out</label>
                <input
                  type="time"
                  className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2"
                  value={adjustAttendanceForm.check_out}
                  onChange={(e) => setAdjustAttendanceForm((s) => ({ ...s, check_out: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Ca bắt đầu</label>
                <input
                  type="time"
                  className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2"
                  value={shiftForm.shift_start}
                  onChange={(e) => setShiftForm((s) => ({ ...s, shift_start: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Ca kết thúc</label>
                <input
                  type="time"
                  className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2"
                  value={shiftForm.shift_end}
                  onChange={(e) => setShiftForm((s) => ({ ...s, shift_end: e.target.value }))}
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold text-slate-600">Lý do điều chỉnh</label>
              <textarea
                rows={3}
                className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2"
                placeholder="Ví dụ: Quên chấm công đầu ca"
                value={adjustAttendanceForm.reason}
                onChange={(e) => setAdjustAttendanceForm((s) => ({ ...s, reason: e.target.value }))}
              />
            </div>

            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setShowAdjustAttendance(false)} className="flex-1 py-2 rounded-xl border border-orange-100">Hủy</button>
              <button type="button" onClick={submitAdjustAttendance} className="flex-1 py-2 rounded-xl bg-[#b87414] text-white font-semibold">Lưu cập nhật</button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && showEdit && selectedUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-orange-100">
            <h3 className="text-xl font-extrabold">Cập nhật nhân viên</h3>
            <p className="text-xs text-slate-500 mt-1">Chỉnh sửa thông tin hồ sơ, lương và vai trò tài khoản nhân sự.</p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600">Họ và tên</label>
                <input className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Ví dụ: Nguyễn Văn A" value={editUser.full_name} onChange={(e) => setEditUser((s) => ({ ...s, full_name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Số điện thoại</label>
                <input className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Ví dụ: 09xxxxxxxx" value={editUser.phone} onChange={(e) => setEditUser((s) => ({ ...s, phone: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Lương cơ bản (VNĐ)</label>
                  <input type="number" className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="VD: 6000000" value={editUser.base_salary} onChange={(e) => setEditUser((s) => ({ ...s, base_salary: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Phụ cấp (VNĐ)</label>
                  <input type="number" className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="VD: 500000" value={editUser.allowance} onChange={(e) => setEditUser((s) => ({ ...s, allowance: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Vai trò tài khoản</label>
                <select className="mt-1 w-full border border-orange-100 rounded-xl px-3 py-2" value={editUser.role} onChange={(e) => setEditUser((s) => ({ ...s, role: e.target.value }))}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setShowEdit(false)} className="flex-1 py-2 rounded-xl border border-orange-100">Hủy</button>
              <button type="button" onClick={saveEditUser} className="flex-1 py-2 rounded-xl bg-[#b87414] text-white font-semibold">Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && showResetPwd && selectedUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 border border-orange-100">
            <h3 className="text-xl font-extrabold">Đặt lại mật khẩu</h3>
            <p className="text-sm text-slate-500 mt-1">Nhân viên: <b>{selectedUser.full_name || selectedUser.username}</b></p>
            <div className="mt-4">
              <input type="password" className="w-full border border-orange-100 rounded-xl px-3 py-2" placeholder="Mật khẩu mới (>= 6 ký tự)" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
            </div>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setShowResetPwd(false)} className="flex-1 py-2 rounded-xl border border-orange-100">Hủy</button>
              <button type="button" onClick={submitResetPassword} className="flex-1 py-2 rounded-xl bg-[#b87414] text-white font-semibold">Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {showUserMonthlyDetail && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-5xl rounded-2xl bg-white border border-indigo-100 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 border-b border-indigo-100 bg-indigo-50 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Chi tiết tháng của nhân viên</h3>
                <p className="text-xs text-slate-500">
                  {selectedUser.full_name || selectedUser.username} ({selectedUser.employee_code})
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="month"
                  className="border border-indigo-200 rounded-lg px-3 py-1.5 text-sm"
                  value={detailMonth}
                  onChange={(e) => setDetailMonth(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => fetchUserMonthlyDetail(selectedUser.user_id, detailMonth)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
                >
                  Xem
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMonthlyDetail(false);
                    setMonthlyDetail(null);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-sm font-semibold"
                >
                  Đóng
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {monthlyDetailLoading && <p className="text-sm text-slate-500">Đang tải dữ liệu tháng...</p>}

              {!monthlyDetailLoading && monthlyDetail && (
                <>
                  <section className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="bg-white border border-indigo-100 rounded-xl p-3"><p className="text-xs text-slate-500">Ca làm</p><p className="text-sm font-bold text-slate-900">{String(monthlyDetail?.staff?.shift_start || '08:00').slice(0, 5)} - {String(monthlyDetail?.staff?.shift_end || '17:00').slice(0, 5)}</p></div>
                    <div className="bg-white border border-indigo-100 rounded-xl p-3"><p className="text-xs text-slate-500">Ngày công</p><p className="text-sm font-bold text-slate-900">{monthlyDetail?.payroll?.work_days || 0}</p></div>
                    <div className="bg-white border border-indigo-100 rounded-xl p-3"><p className="text-xs text-slate-500">Lương cơ bản</p><p className="text-sm font-bold text-slate-900">{Number(monthlyDetail?.payroll?.base_salary || 0).toLocaleString('vi-VN')}đ</p></div>
                    <div className="bg-white border border-indigo-100 rounded-xl p-3"><p className="text-xs text-slate-500">Phụ cấp + Thưởng</p><p className="text-sm font-bold text-slate-900">{(Number(monthlyDetail?.payroll?.allowance || 0) + Number(monthlyDetail?.payroll?.bonus || 0)).toLocaleString('vi-VN')}đ</p></div>
                    <div className="bg-indigo-600 text-white rounded-xl p-3"><p className="text-xs opacity-90">Tổng lương</p><p className="text-sm font-extrabold">{Number(monthlyDetail?.payroll?.total_salary || 0).toLocaleString('vi-VN')}đ</p></div>
                  </section>

                  <section className="bg-white border border-indigo-100 rounded-2xl overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-indigo-50">
                        <tr className="text-left">
                          <th className="px-4 py-2 text-xs font-bold text-slate-600">NGÀY</th>
                          <th className="px-4 py-2 text-xs font-bold text-slate-600">CHECK-IN</th>
                          <th className="px-4 py-2 text-xs font-bold text-slate-600">CHECK-OUT</th>
                          <th className="px-4 py-2 text-xs font-bold text-slate-600">GIỜ CÔNG</th>
                          <th className="px-4 py-2 text-xs font-bold text-slate-600">ĐI MUỘN/VỀ SỚM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(monthlyDetail.attendance || []).map((it, idx) => (
                          <tr key={`${it.work_date}-${idx}`} className="border-t border-indigo-100">
                            <td className="px-4 py-2 text-sm text-slate-800">{formatDate(it.work_date)}</td>
                            <td className="px-4 py-2 text-sm text-slate-700">{formatTime(it.check_in)}</td>
                            <td className="px-4 py-2 text-sm text-slate-700">{formatTime(it.check_out)}</td>
                            <td className="px-4 py-2 text-sm font-semibold text-slate-900">{(Number(it.worked_minutes || 0) / 60).toFixed(1)}h</td>
                            <td className="px-4 py-2 text-sm text-slate-700">Muộn {Number(it.late_minutes || 0)}p / Sớm {Number(it.early_leave_minutes || 0)}p</td>
                          </tr>
                        ))}
                        {!(monthlyDetail.attendance || []).length && (
                          <tr>
                            <td className="px-4 py-4 text-sm text-slate-500" colSpan={5}>Không có dữ liệu chấm công trong tháng này.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isAdmin && showPayrollConfirm && pendingPayrollAction?.row && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-orange-100 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-orange-100 bg-orange-50">
              <h3 className="text-lg font-extrabold text-slate-900">Xác nhận đổi trạng thái lương</h3>
              <p className="text-xs text-slate-500">Vui lòng kiểm tra thông tin trước khi xác nhận</p>
            </div>
            <div className="px-5 py-4 text-sm text-slate-700 space-y-2">
              <p>Nhân viên: <b>{pendingPayrollAction.row.full_name}</b> ({pendingPayrollAction.row.employee_code})</p>
              <p>Trạng thái mới: <b>{pendingPayrollAction.paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán'}</b></p>
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPayrollConfirm(false);
                  setPendingPayrollAction(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={submitPayrollStatusChange}
                className="flex-1 py-2.5 rounded-xl bg-[#b87414] text-white font-semibold hover:opacity-95"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && showDeleteConfirm && selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-red-100 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-red-100 bg-red-50 flex items-center gap-3">
              <div className="size-9 rounded-full bg-white border border-red-200 text-red-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">warning</span>
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">Xác nhận xóa nhân viên</h3>
                <p className="text-xs text-slate-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <div className="px-5 py-4 text-sm text-slate-700 space-y-2">
              <p>Bạn có chắc muốn xóa nhân viên sau?</p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p><span className="text-slate-500">Họ tên:</span> <b>{selectedUser.full_name || '(Chưa cập nhật)'}</b></p>
                <p><span className="text-slate-500">Username:</span> <b>{selectedUser.username}</b></p>
                <p><span className="text-slate-500">Mã NV:</span> <b>{selectedUser.employee_code || `NV-${String(selectedUser.user_id || '').padStart(3, '0')}`}</b></p>
              </div>
              <p className="text-xs text-red-600">Lưu ý: nếu nhân viên đã có đơn hàng, hệ thống sẽ từ chối xóa để đảm bảo toàn vẹn dữ liệu.</p>
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedUser(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={submitDeleteUser}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700"
              >
                Xóa nhân viên
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

