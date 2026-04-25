import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';

const BG = '#f9f7f2';
const ACCENT = '#c07821';

function formatVnd(n) {
  return `${Math.round(Number(n || 0)).toLocaleString('vi-VN')}đ`;
}

function ingredientStatus(ing) {
  const stock = Number(ing.stock_quantity) || 0;
  const min = Number(ing.min_stock_alert) || 1;
  if (stock < min) return { key: 'urgent', label: 'CẦN NHẬP GẤP', pill: 'bg-red-500 text-white', bar: 'bg-red-500', dot: 'bg-red-500' };
  if (stock < min * 1.5) return { key: 'warn', label: 'Sắp hết', pill: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500', dot: 'bg-amber-500' };
  return { key: 'ok', label: 'Ổn định', pill: 'bg-emerald-100 text-emerald-800', bar: 'bg-emerald-500', dot: 'bg-emerald-500' };
}

function ModalPortal({ children }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export default function ProductList() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [activeTab, setActiveTab] = useState('menu');
  const [query, setQuery] = useState('');
  const [menuCategory, setMenuCategory] = useState('all');
  const [savingIds, setSavingIds] = useState(() => new Set());
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(false);
  const [productForm, setProductForm] = useState({
    product_name: '',
    category_id: '',
    base_price: '',
    sale_price: '',
    image_url: '',
    is_available: 1
  });
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const [inventorySubTab, setInventorySubTab] = useState('ingredients');
  const [, setInventoryTransactions] = useState([]);
  const [stockReceipts, setStockReceipts] = useState([]);
  const [stockTakes, setStockTakes] = useState([]);

  const [receiptForm, setReceiptForm] = useState({ supplier_name: '', receipt_date: '', note: '' });
  const [receiptItems, setReceiptItems] = useState([{ ingredient_id: '', pack_quantity: 0, conversion_factor: 1, unit_cost: 0 }]);
  const [takeForm, setTakeForm] = useState({ take_date: '', note: '' });
  const [takeItems, setTakeItems] = useState([{ ingredient_id: '', actual_quantity: 0 }]);
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('all');
  const [showIngredientDetail, setShowIngredientDetail] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showStockTakeModal, setShowStockTakeModal] = useState(false);
  const [modalIngredient, setModalIngredient] = useState(null);
  const [importQty, setImportQty] = useState('');
  const [stockTakeQty, setStockTakeQty] = useState('');


  const handleLogout = React.useCallback(() => {
    localStorage.removeItem('token');
    navigate('/login');
  }, [navigate]);

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        handleLogout();
        return;
      }
      try {
        setLoading(true);
        setErrorMessage('');
        const pRes = await axios.get('/api/products', { headers: { Authorization: `Bearer ${token}` } });
        setProducts(pRes.data || []);

        try {
          const cRes = await axios.get('/api/products/categories', { headers: { Authorization: `Bearer ${token}` } });
          setCategories(Array.isArray(cRes.data) ? cRes.data : []);
        } catch (catErr) {
          console.warn('[products] categories API unavailable:', catErr?.response?.status);
          setCategories([]);
        }

        try {
          const iRes = await axios.get('/api/ingredients', { headers: { Authorization: `Bearer ${token}` } });
          const raw = iRes.data;
          const list = Array.isArray(raw) ? raw : [];
          setIngredients(list);
        } catch (ingErr) {
          console.error('[products] Không tải được nguyên liệu:', ingErr?.response?.status, ingErr?.response?.data);
          const msg = ingErr?.response?.data?.message || ingErr?.message || 'Không tải tồn kho nguyên liệu';
          toast.error(msg);
          setIngredients([]);
        }

        try {
          const [txRes, receiptRes, takeRes] = await Promise.all([
            axios.get('/api/ingredients/transactions', { headers: { Authorization: `Bearer ${token}` } }),
            axios.get('/api/ingredients/receipts', { headers: { Authorization: `Bearer ${token}` } }),
            axios.get('/api/ingredients/stock-takes', { headers: { Authorization: `Bearer ${token}` } })
          ]);
          setInventoryTransactions(Array.isArray(txRes.data) ? txRes.data : []);
          setStockReceipts(Array.isArray(receiptRes.data) ? receiptRes.data : []);
          setStockTakes(Array.isArray(takeRes.data) ? takeRes.data : []);
        } catch (metaErr) {
          console.warn('[inventory] meta APIs unavailable:', metaErr?.response?.status);
          setInventoryTransactions([]);
          setStockReceipts([]);
          setStockTakes([]);
        }
      } catch (err) {
        if (err.response?.status === 401 || err.response?.status === 403) {
          handleLogout();
          return;
        }
        setErrorMessage(err.response?.data?.message || 'Không tải được dữ liệu.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [handleLogout]);

  const menuCategories = useMemo(() => {
    const all = (products || []).map((p) => String(p?.category_name || '').trim()).filter(Boolean);
    return ['all', ...Array.from(new Set(all.map((x) => x.toLowerCase())))];
  }, [products]);

  const formCategories = useMemo(() => {
    if (Array.isArray(categories) && categories.length) return categories;
    const fromProducts = (products || [])
      .map((p) => ({
        category_id: p.category_id,
        category_name: p.category_name
      }))
      .filter((c) => c.category_id && c.category_name);

    const map = new Map();
    fromProducts.forEach((c) => {
      if (!map.has(c.category_id)) {
        map.set(c.category_id, c);
      }
    });
    return Array.from(map.values());
  }, [categories, products]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products || []).filter((p) => {
      const name = String(p?.product_name || '').toLowerCase();
      const category = String(p?.category_name || '').toLowerCase();
      const matchQuery = q ? name.includes(q) || category.includes(q) : true;
      const matchCategory = menuCategory === 'all' ? true : category === menuCategory;
      return matchQuery && matchCategory;
    });
  }, [products, query, menuCategory]);

  const filteredIngredients = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (ingredients || []).filter((i) => {
      const matchQuery = q ? String(i?.ingredient_name || '').toLowerCase().includes(q) : true;
      if (!matchQuery) return false;
      if (inventoryStatusFilter === 'all') return true;
      const st = ingredientStatus(i).key;
      if (inventoryStatusFilter === 'urgent') return st === 'urgent';
      if (inventoryStatusFilter === 'warn') return st === 'warn';
      if (inventoryStatusFilter === 'ok') return st === 'ok';
      return true;
    });
  }, [ingredients, query, inventoryStatusFilter]);

  const lowAlerts = useMemo(() => {
    return (ingredients || [])
      .filter((i) => {
        const s = Number(i.stock_quantity) || 0;
        const m = Number(i.min_stock_alert) || 1;
        return s < m * 1.5;
      })
      .slice(0, 6);
  }, [ingredients]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  const pageButtons = useMemo(() => {
    const t = totalPages;
    if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1);
    const pages = new Set([1, t, page, page - 1, page + 1].filter((n) => n >= 1 && n <= t));
    return [...pages].sort((a, b) => a - b);
  }, [totalPages, page]);

  useEffect(() => {
    setPage(1);
  }, [query, filteredProducts.length]);

  const refreshInventoryMeta = async (token) => {
    try {
      const [txRes, receiptRes, takeRes] = await Promise.all([
        axios.get('/api/ingredients/transactions', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/ingredients/receipts', { headers: { Authorization: `Bearer ${token}` } }),
        axios.get('/api/ingredients/stock-takes', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setInventoryTransactions(Array.isArray(txRes.data) ? txRes.data : []);
      setStockReceipts(Array.isArray(receiptRes.data) ? receiptRes.data : []);
      setStockTakes(Array.isArray(takeRes.data) ? takeRes.data : []);
    } catch (metaErr) {
      console.warn('[inventory] meta APIs unavailable:', metaErr?.response?.status);
      setInventoryTransactions([]);
      setStockReceipts([]);
      setStockTakes([]);
    }
  };

  const refreshIngredients = async (token) => {
    const iRes = await axios.get('/api/ingredients', { headers: { Authorization: `Bearer ${token}` } });
    setIngredients(Array.isArray(iRes.data) ? iRes.data : []);
  };

  const createIngredientQuick = async () => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    const ingredient_name = window.prompt('Tên nguyên liệu mới');
    if (!ingredient_name || !String(ingredient_name).trim()) return;
    const unit = window.prompt('Đơn vị tính (g/ml/cái)', 'g') || 'g';
    const stock_quantity = Number(window.prompt('Tồn đầu kỳ', '0'));
    const min_stock_alert = Number(window.prompt('Ngưỡng cảnh báo', '0'));

    try {
      await axios.post(
        '/api/ingredients',
        {
          ingredient_name: String(ingredient_name).trim(),
          unit,
          stock_quantity: Number.isFinite(stock_quantity) ? stock_quantity : 0,
          min_stock_alert: Number.isFinite(min_stock_alert) ? min_stock_alert : 0
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshIngredients(token);
      toast.success('Đã thêm nguyên liệu');
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) return handleLogout();
      toast.error(err?.response?.data?.message || 'Thêm nguyên liệu thất bại');
    }
  };

  const quickImportIngredient = async (ing, quantityInput = null) => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    const qty = Number(quantityInput ?? importQty);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error('Số lượng nhập phải lớn hơn 0');

    try {
      await axios.post(
        '/api/ingredients/receipts',
        {
          supplier_name: 'Nhập nhanh tại quầy',
          note: `Nhập nhanh: ${ing.ingredient_name}`,
          items: [
            {
              ingredient_id: ing.ingredient_id,
              pack_quantity: qty,
              pack_unit: ing.unit || null,
              conversion_factor: 1,
              unit_cost: 0
            }
          ]
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshIngredients(token);
      await refreshInventoryMeta(token);
      setShowImportModal(false);
      setImportQty('');
      setModalIngredient(null);
      toast.success('Nhập kho thành công');
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) return handleLogout();
      toast.error(err?.response?.data?.message || 'Nhập kho thất bại');
    }
  };

  const quickStockTakeIngredient = async (ing, quantityInput = null) => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();
    const qty = Number(quantityInput ?? stockTakeQty);
    if (!Number.isFinite(qty) || qty < 0) return toast.error('Số lượng kiểm kê không hợp lệ');

    try {
      await axios.post(
        '/api/ingredients/stock-takes',
        {
          note: `Kiểm kê nhanh: ${ing.ingredient_name}`,
          items: [{ ingredient_id: ing.ingredient_id, actual_quantity: qty }]
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshIngredients(token);
      await refreshInventoryMeta(token);
      setShowStockTakeModal(false);
      setStockTakeQty('');
      setModalIngredient(null);
      toast.success('Kiểm kê thành công');
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) return handleLogout();
      toast.error(err?.response?.data?.message || 'Kiểm kê thất bại');
    }
  };

  const openImportModal = (ing) => {
    setModalIngredient(ing);
    setImportQty('');
    setShowImportModal(true);
  };

  const openStockTakeModal = (ing) => {
    setModalIngredient(ing);
    setStockTakeQty(String(Number(ing.stock_quantity || 0)));
    setShowStockTakeModal(true);
  };

  const openIngredientDetail = (ing) => {
    setSelectedIngredient(ing);
    setShowIngredientDetail(true);
  };

  const submitStockReceipt = async () => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();

    const items = receiptItems
      .map((x) => ({
        ingredient_id: Number(x.ingredient_id),
        pack_quantity: Number(x.pack_quantity),
        conversion_factor: Number(x.conversion_factor || 1),
        unit_cost: Number(x.unit_cost || 0)
      }))
      .filter((x) => x.ingredient_id > 0 && x.pack_quantity > 0);

    if (!items.length) return toast.error('Nhập kho cần ít nhất 1 dòng hợp lệ');

    try {
      await axios.post(
        '/api/ingredients/receipts',
        {
          supplier_name: receiptForm.supplier_name,
          receipt_date: receiptForm.receipt_date || null,
          note: receiptForm.note,
          items
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setReceiptForm({ supplier_name: '', receipt_date: '', note: '' });
      setReceiptItems([{ ingredient_id: '', pack_quantity: 0, conversion_factor: 1, unit_cost: 0 }]);
      await refreshIngredients(token);
      await refreshInventoryMeta(token);
      toast.success('Tạo phiếu nhập thành công');
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) return handleLogout();
      toast.error(err?.response?.data?.message || 'Tạo phiếu nhập thất bại');
    }
  };

  const submitStockTake = async () => {
    const token = localStorage.getItem('token');
    if (!token) return handleLogout();

    const items = takeItems
      .map((x) => ({ ingredient_id: Number(x.ingredient_id), actual_quantity: Number(x.actual_quantity) }))
      .filter((x) => x.ingredient_id > 0 && x.actual_quantity >= 0);

    if (!items.length) return toast.error('Kiểm kê cần ít nhất 1 dòng hợp lệ');

    try {
      await axios.post(
        '/api/ingredients/stock-takes',
        {
          take_date: takeForm.take_date || null,
          note: takeForm.note,
          items
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTakeForm({ take_date: '', note: '' });
      setTakeItems([{ ingredient_id: '', actual_quantity: 0 }]);
      await refreshIngredients(token);
      await refreshInventoryMeta(token);
      toast.success('Tạo phiếu kiểm kê thành công');
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) return handleLogout();
      toast.error(err?.response?.data?.message || 'Tạo phiếu kiểm kê thất bại');
    }
  };

  const setAvailability = async (productId, nextAvailable) => {
    const token = localStorage.getItem('token');
    if (!token) {
      handleLogout();
      return;
    }
    setSavingIds((prev) => new Set(prev).add(productId));
    try {
      await axios.patch(
        `/api/products/${productId}/availability`,
        { is_available: nextAvailable ? 1 : 0 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProducts((prev) =>
        prev.map((p) => (Number(p.product_id) === Number(productId) ? { ...p, is_available: nextAvailable ? 1 : 0 } : p))
      );
      toast.success('Đã cập nhật trạng thái');
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        handleLogout();
        return;
      }
      toast.error(err?.response?.data?.message || 'Cập nhật thất bại');
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  };

  const openCreateModal = () => {
    setEditingProductId(null);
    setProductForm({
      product_name: '',
      category_id: formCategories?.[0]?.category_id || '',
      base_price: '',
      sale_price: '',
      image_url: '',
      is_available: 1
    });
    setShowProductModal(true);
  };

  const openEditModal = (product) => {
    setEditingProductId(product.product_id);
    setProductForm({
      product_name: product.product_name || '',
      category_id: product.category_id || '',
      base_price: product.base_price ?? '',
      sale_price: product.sale_price ?? '',
      image_url: product.image_url || '',
      is_available: Number(product.is_available) === 1 ? 1 : 0
    });
    setShowProductModal(true);
  };

  const handleProductFormChange = (key, value) => {
    setProductForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitProductForm = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    if (!token) {
      handleLogout();
      return;
    }

    const payload = {
      product_name: String(productForm.product_name || '').trim(),
      category_id: productForm.category_id || null,
      base_price: productForm.base_price === '' ? null : Number(productForm.base_price),
      sale_price: productForm.sale_price === '' ? null : Number(productForm.sale_price),
      image_url: String(productForm.image_url || '').trim() || null,
      is_available: Number(productForm.is_available) === 1 ? 1 : 0
    };

    if (!payload.product_name) {
      toast.error('Vui lòng nhập tên sản phẩm');
      return;
    }

    setSavingProduct(true);
    try {
      if (editingProductId) {
        const res = await axios.put(`/api/products/${editingProductId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const updated = res?.data?.product;
        if (updated) {
          setProducts((prev) => prev.map((p) => (Number(p.product_id) === Number(editingProductId) ? updated : p)));
        }
        toast.success('Đã cập nhật sản phẩm');
      } else {
        const res = await axios.post('/api/products', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const created = res?.data?.product;
        if (created) {
          setProducts((prev) => [created, ...prev]);
        }
        toast.success('Đã thêm sản phẩm mới');
      }
      setShowProductModal(false);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        handleLogout();
        return;
      }
      toast.error(err?.response?.data?.message || 'Không lưu được sản phẩm');
    } finally {
      setSavingProduct(false);
    }
  };

  const requestDeleteProduct = (product) => {
    setDeleteTarget(product);
  };

  const cancelDeleteProduct = () => {
    if (deletingProduct) return;
    setDeleteTarget(null);
  };

  const confirmDeleteProduct = async () => {
    if (!deleteTarget) return;

    const token = localStorage.getItem('token');
    if (!token) {
      handleLogout();
      return;
    }

    setDeletingProduct(true);
    try {
      await axios.delete(`/api/products/${deleteTarget.product_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts((prev) => prev.filter((p) => Number(p.product_id) !== Number(deleteTarget.product_id)));
      setDeleteTarget(null);
      toast.success('Đã xóa sản phẩm');
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        handleLogout();
        return;
      }
      toast.error(err?.response?.data?.message || 'Xóa sản phẩm thất bại');
    } finally {
      setDeletingProduct(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: BG }}>
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-y-auto min-w-0">
        {/* Top bar — mockup */}
        <header
          className="shrink-0 border-b border-amber-100/80 bg-white/95 backdrop-blur-md px-4 lg:px-10 py-3 flex flex-wrap items-center gap-4 justify-between sticky top-0 z-20"
        >
          <div className="flex-1 min-w-[200px] max-w-xl relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
            <input
              className="w-full pl-11 pr-4 py-2.5 rounded-full bg-[#f3efe8] border border-transparent focus:border-amber-200 focus:bg-white focus:ring-1 focus:ring-amber-200 outline-none text-sm text-slate-800 placeholder:text-slate-400"
              placeholder={activeTab === 'menu' ? 'Tìm kiếm sản phẩm...' : 'Tìm kiếm nguyên liệu...'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button type="button" className="p-2 rounded-full hover:bg-amber-50 text-slate-600" aria-label="Thông báo">
              <span className="material-symbols-outlined text-[22px]">notifications</span>
            </button>
            <button type="button" className="p-2 rounded-full hover:bg-amber-50 text-slate-600" aria-label="Cài đặt">
              <span className="material-symbols-outlined text-[22px]">settings</span>
            </button>
            <div className="flex items-center gap-2 pl-2 border-l border-amber-100">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-800">Admin Manager</p>
                <p className="text-[10px] text-slate-500">Quản trị viên</p>
              </div>
              <div className="size-10 rounded-full border-2 border-amber-100 overflow-hidden shadow-sm shrink-0">
                <img src="https://ui-avatars.com/api/?name=Admin+Manager&background=c07821&color=fff" alt="" />
              </div>
            </div>
          </div>
        </header>

        <div className="p-4 lg:p-10 space-y-8 max-w-[1400px] mx-auto w-full">
          {/* Title + tabs */}
          <div className="text-left space-y-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">Hệ thống Quản lý</h1>
              <p className="text-sm text-slate-500 mt-1">Tách riêng quản lý thực đơn và quản lý kho để thao tác nhanh hơn.</p>
            </div>
            <div className="flex items-center gap-6 border-b border-amber-100">
              <button
                type="button"
                onClick={() => setActiveTab('menu')}
                className={`pb-2 text-sm font-bold transition-colors border-b-2 ${
                  activeTab === 'menu'
                    ? 'text-amber-800 border-amber-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                Quản lý Thực đơn
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('inventory')}
                className={`pb-2 text-sm font-bold transition-colors border-b-2 ${
                  activeTab === 'inventory'
                    ? 'text-amber-800 border-amber-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700'
                }`}
              >
                Quản lý Kho
              </button>
            </div>
          </div>

          {loading && (
            <div className="rounded-2xl border border-amber-100 bg-white p-8 animate-pulse space-y-4">
              <div className="h-8 bg-amber-100/50 rounded w-1/3" />
              <div className="h-40 bg-amber-50 rounded-xl" />
            </div>
          )}

          {!loading && errorMessage && (
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700 text-sm font-medium">{errorMessage}</div>
          )}

          {!loading && !errorMessage && (
            <>
              {activeTab === 'inventory' && (
                <>
                  <section className="rounded-2xl border border-amber-100 bg-white shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-lg font-extrabold text-slate-900">Module Quản lý Kho</h2>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold">Ổn: {Math.max(0, filteredIngredients.length - lowAlerts.length)}</span>
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-bold">Sắp hết: {lowAlerts.filter((x) => ingredientStatus(x).key === 'warn').length}</span>
                        <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-bold">Báo động: {lowAlerts.filter((x) => ingredientStatus(x).key === 'urgent').length}</span>
                      </div>
                    </div>

                    <div className="px-5 py-3 border-b border-amber-50 bg-[#faf8f3] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {[
                          ['ingredients', 'Nguyên liệu'],
                          ['receipts', 'Nhập kho'],
                          ['stocktake', 'Kiểm kê']
                        ].map(([id, label]) => {
                          const active = inventorySubTab === id;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setInventorySubTab(id)}
                              className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                                active ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-amber-200 text-slate-600'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>

                      {inventorySubTab === 'ingredients' && (
                        <button
                          type="button"
                          onClick={createIngredientQuick}
                          className="px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-bold"
                        >
                          + Thêm nguyên liệu
                        </button>
                      )}
                    </div>

                    {inventorySubTab === 'ingredients' && (
                      <div className="px-5 py-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                            <p className="text-xs text-emerald-700">Đủ hàng</p>
                            <p className="text-2xl font-extrabold text-emerald-800">{(ingredients || []).filter((x) => ingredientStatus(x).key === 'ok').length}</p>
                          </div>
                          <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                            <p className="text-xs text-amber-700">Sắp hết</p>
                            <p className="text-2xl font-extrabold text-amber-800">{(ingredients || []).filter((x) => ingredientStatus(x).key === 'warn').length}</p>
                          </div>
                          <div className="rounded-xl border border-red-100 bg-red-50 p-3">
                            <p className="text-xs text-red-700">Hết hàng</p>
                            <p className="text-2xl font-extrabold text-red-700">{(ingredients || []).filter((x) => ingredientStatus(x).key === 'urgent').length}</p>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-xs text-slate-500">Tổng nguyên liệu</p>
                            <p className="text-2xl font-extrabold text-slate-900">{(ingredients || []).length}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => setInventoryStatusFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${inventoryStatusFilter === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-amber-200 text-slate-600'}`}>Tất cả</button>
                          <button type="button" onClick={() => setInventoryStatusFilter('urgent')} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${inventoryStatusFilter === 'urgent' ? 'bg-red-600 text-white border-red-600' : 'bg-white border-red-200 text-red-700'}`}>Hết hàng</button>
                          <button type="button" onClick={() => setInventoryStatusFilter('warn')} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${inventoryStatusFilter === 'warn' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-amber-200 text-amber-700'}`}>Sắp hết</button>
                          <button type="button" onClick={() => setInventoryStatusFilter('ok')} className={`px-3 py-1.5 rounded-full text-xs font-bold border ${inventoryStatusFilter === 'ok' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-emerald-200 text-emerald-700'}`}>Đủ hàng</button>
                        </div>

                        <table className="w-full text-left">
                          <thead>
                            <tr className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-amber-100">
                              <th className="py-2">Mã</th>
                              <th className="py-2">Tên nguyên liệu</th>
                              <th className="py-2">Đơn vị</th>
                              <th className="py-2">Tồn hiện tại</th>
                              <th className="py-2">Tồn tối thiểu</th>
                              <th className="py-2">Trạng thái</th>
                              <th className="py-2 text-right">Thao tác</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredIngredients.map((ing) => {
                              const st = ingredientStatus(ing);
                              const stock = Number(ing.stock_quantity || 0);
                              const min = Number(ing.min_stock_alert || 0);
                              return (
                                <tr key={ing.ingredient_id} className="border-b border-amber-50 last:border-b-0">
                                  <td className="py-3 text-xs text-slate-500">NL-{String(ing.ingredient_id).padStart(3, '0')}</td>
                                  <td className="py-3 font-semibold text-slate-800">{ing.ingredient_name}</td>
                                  <td className="py-3 text-slate-600">{ing.unit || '—'}</td>
                                  <td className="py-3 font-bold tabular-nums" style={{ color: stock <= min ? '#dc2626' : '#111827' }}>{stock.toLocaleString('vi-VN')}</td>
                                  <td className="py-3 tabular-nums text-slate-600">{min.toLocaleString('vi-VN')}</td>
                                  <td className="py-3">
                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                      st.key === 'urgent' ? 'bg-red-100 text-red-700' : st.key === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                    }`}>
                                      {st.key === 'urgent' ? 'Hết hàng' : st.key === 'warn' ? 'Sắp hết' : 'Đủ hàng'}
                                    </span>
                                  </td>
                                  <td className="py-3 text-right">
                                    <div className="inline-flex items-center gap-1">
                                      <button type="button" onClick={() => openImportModal(ing)} className="px-2.5 py-1.5 rounded-lg border border-amber-200 text-xs font-bold text-amber-800">+ Nhập</button>
                                      <button type="button" onClick={() => openStockTakeModal(ing)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">Kiểm kê</button>
                                      <button type="button" onClick={() => openIngredientDetail(ing)} className="px-2.5 py-1.5 rounded-lg border border-indigo-200 text-xs font-bold text-indigo-700">Chi tiết</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {inventorySubTab === 'receipts' && (
                      <div className="px-5 py-4 space-y-4">
                        <div className="rounded-2xl border border-amber-100 p-5 bg-gradient-to-br from-[#fdfbf7] to-[#faf8f3] shadow-sm">
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div>
                              <h3 className="text-base font-extrabold text-slate-900">Tạo phiếu nhập kho</h3>
                              <p className="text-xs text-slate-500 mt-1">Điền rõ số lượng nhập, hệ số quy đổi và đơn giá để hệ thống tính chính xác giá trị nhập kho.</p>
                            </div>
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">Phiếu mới</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-4">
                            <div className="md:col-span-2">
                              <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">Nhà cung cấp</label>
                              <input
                                className="w-full px-3 py-2 rounded-lg border border-amber-200 text-sm bg-white"
                                placeholder="Ví dụ: NCC Cà phê Tây Nguyên"
                                value={receiptForm.supplier_name}
                                onChange={(e) => setReceiptForm((p) => ({ ...p, supplier_name: e.target.value }))}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">Ngày nhập</label>
                              <input
                                type="date"
                                className="w-full px-3 py-2 rounded-lg border border-amber-200 text-sm bg-white"
                                value={receiptForm.receipt_date}
                                onChange={(e) => setReceiptForm((p) => ({ ...p, receipt_date: e.target.value }))}
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">Ghi chú</label>
                              <input
                                className="w-full px-3 py-2 rounded-lg border border-amber-200 text-sm bg-white"
                                placeholder="Ví dụ: Nhập kho định kỳ thứ 2"
                                value={receiptForm.note}
                                onChange={(e) => setReceiptForm((p) => ({ ...p, note: e.target.value }))}
                              />
                            </div>
                          </div>

                          <div className="rounded-xl border border-amber-100 overflow-hidden bg-white">
                            <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-[#faf8f3] border-b border-amber-100 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                              <div className="col-span-12 md:col-span-4">Nguyên liệu</div>
                              <div className="col-span-4 md:col-span-2">Số lượng nhập</div>
                              <div className="col-span-4 md:col-span-2">Hệ số quy đổi</div>
                              <div className="col-span-4 md:col-span-2">Giá nhập / đơn vị</div>
                              <div className="col-span-6 md:col-span-1 text-right">Thành tiền</div>
                              <div className="col-span-6 md:col-span-1 text-right">Xóa</div>
                            </div>

                            <div className="p-3 space-y-2">
                              {receiptItems.map((row, idx) => {
                                const qty = Number(row.pack_quantity || 0);
                                const factor = Number(row.conversion_factor || 1);
                                const unitCost = Number(row.unit_cost || 0);
                                const lineTotal = qty * factor * unitCost;
                                return (
                                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-12 md:col-span-4">
                                      <select
                                        className="w-full px-3 py-2 rounded-lg border border-amber-200 text-sm"
                                        value={row.ingredient_id}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setReceiptItems((prev) => prev.map((x, i) => (i === idx ? { ...x, ingredient_id: v } : x)));
                                        }}
                                      >
                                        <option value="">Chọn nguyên liệu</option>
                                        {ingredients.map((ing) => (
                                          <option key={ing.ingredient_id} value={ing.ingredient_id}>{ing.ingredient_name}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="col-span-4 md:col-span-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        className="w-full px-3 py-2 rounded-lg border border-amber-200 text-sm"
                                        placeholder="VD: 10"
                                        value={row.pack_quantity}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setReceiptItems((prev) => prev.map((x, i) => (i === idx ? { ...x, pack_quantity: v } : x)));
                                        }}
                                      />
                                    </div>
                                    <div className="col-span-4 md:col-span-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        className="w-full px-3 py-2 rounded-lg border border-amber-200 text-sm"
                                        placeholder="VD: 1000"
                                        value={row.conversion_factor}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setReceiptItems((prev) => prev.map((x, i) => (i === idx ? { ...x, conversion_factor: v } : x)));
                                        }}
                                      />
                                    </div>
                                    <div className="col-span-4 md:col-span-2">
                                      <input
                                        type="number"
                                        step="100"
                                        className="w-full px-3 py-2 rounded-lg border border-amber-200 text-sm"
                                        placeholder="VD: 120"
                                        value={row.unit_cost}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setReceiptItems((prev) => prev.map((x, i) => (i === idx ? { ...x, unit_cost: v } : x)));
                                        }}
                                      />
                                    </div>
                                    <div className="col-span-6 md:col-span-1 text-sm font-bold text-right" style={{ color: ACCENT }}>
                                      {formatVnd(lineTotal)}
                                    </div>
                                    <div className="col-span-6 md:col-span-1 text-right">
                                      <button
                                        type="button"
                                        className="px-2 py-2 rounded-lg border border-red-200 text-red-700 text-xs font-bold"
                                        onClick={() => setReceiptItems((prev) => prev.filter((_, i) => i !== idx))}
                                      >
                                        Xóa
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="text-sm">
                              <span className="text-slate-500">Tổng số dòng: </span>
                              <span className="font-bold text-slate-900">{receiptItems.length}</span>
                              <span className="mx-2 text-slate-300">|</span>
                              <span className="text-slate-500">Tổng tiền phiếu: </span>
                              <span className="font-extrabold" style={{ color: ACCENT }}>
                                {formatVnd(
                                  receiptItems.reduce((sum, row) => {
                                    const qty = Number(row.pack_quantity || 0);
                                    const factor = Number(row.conversion_factor || 1);
                                    const cost = Number(row.unit_cost || 0);
                                    return sum + qty * factor * cost;
                                  }, 0)
                                )}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                className="px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-bold text-amber-800"
                                onClick={() => setReceiptItems((prev) => [...prev, { ingredient_id: '', pack_quantity: 0, conversion_factor: 1, unit_cost: 0 }])}
                              >
                                + Thêm dòng
                              </button>
                              <button
                                type="button"
                                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold"
                                onClick={submitStockReceipt}
                              >
                                Lưu phiếu nhập
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[640px] text-left">
                            <thead>
                              <tr className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-amber-100">
                                <th className="py-2">Mã phiếu</th>
                                <th className="py-2">Nhà cung cấp</th>
                                <th className="py-2">Ngày nhập</th>
                                <th className="py-2">Số dòng</th>
                                <th className="py-2">Tổng tiền</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stockReceipts.map((r) => (
                                <tr key={r.receipt_id} className="border-b border-amber-50">
                                  <td className="py-3 font-bold text-slate-800">REC-{String(r.receipt_id).padStart(4, '0')}</td>
                                  <td className="py-3 text-slate-600">{r.supplier_name || '—'}</td>
                                  <td className="py-3 text-slate-600">{r.receipt_date ? new Date(r.receipt_date).toLocaleDateString('vi-VN') : '—'}</td>
                                  <td className="py-3 text-slate-600">{Number(r.item_count || 0)}</td>
                                  <td className="py-3 font-bold" style={{ color: ACCENT }}>{formatVnd(r.total_cost || 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {inventorySubTab === 'stocktake' && (
                      <div className="px-5 py-4 space-y-4">
                        <div className="rounded-xl border border-amber-100 p-4 bg-[#faf8f3]">
                          <h3 className="text-sm font-extrabold text-slate-900 mb-3">Tạo phiếu kiểm kê</h3>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                            <input
                              type="date"
                              className="w-full px-3 py-2 rounded-lg border border-amber-200 text-sm"
                              value={takeForm.take_date}
                              onChange={(e) => setTakeForm((p) => ({ ...p, take_date: e.target.value }))}
                            />
                            <input
                              className="w-full md:col-span-2 px-3 py-2 rounded-lg border border-amber-200 text-sm"
                              placeholder="Ghi chú kiểm kê"
                              value={takeForm.note}
                              onChange={(e) => setTakeForm((p) => ({ ...p, note: e.target.value }))}
                            />
                          </div>

                          <div className="space-y-2">
                            {takeItems.map((row, idx) => {
                              const ing = ingredients.find((x) => Number(x.ingredient_id) === Number(row.ingredient_id));
                              const systemQty = Number(ing?.stock_quantity || 0);
                              const actualQty = Number(row.actual_quantity || 0);
                              const variance = actualQty - systemQty;
                              return (
                                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                                  <select
                                    className="md:col-span-5 px-3 py-2 rounded-lg border border-amber-200 text-sm"
                                    value={row.ingredient_id}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setTakeItems((prev) => prev.map((x, i) => (i === idx ? { ...x, ingredient_id: v } : x)));
                                    }}
                                  >
                                    <option value="">Chọn nguyên liệu</option>
                                    {ingredients.map((item) => (
                                      <option key={item.ingredient_id} value={item.ingredient_id}>{item.ingredient_name}</option>
                                    ))}
                                  </select>

                                  <div className="md:col-span-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600">
                                    HT: {systemQty.toLocaleString('vi-VN')}
                                  </div>

                                  <input
                                    type="number"
                                    step="0.01"
                                    className="md:col-span-3 px-3 py-2 rounded-lg border border-amber-200 text-sm"
                                    placeholder="SL thực tế"
                                    value={row.actual_quantity}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setTakeItems((prev) => prev.map((x, i) => (i === idx ? { ...x, actual_quantity: v } : x)));
                                    }}
                                  />

                                  <div className="md:col-span-1 text-sm font-bold tabular-nums" style={{ color: variance < 0 ? '#dc2626' : '#059669' }}>
                                    {variance > 0 ? '+' : ''}{variance.toLocaleString('vi-VN')}
                                  </div>

                                  <button
                                    type="button"
                                    className="md:col-span-1 px-2 py-2 rounded-lg border border-red-200 text-red-700 text-xs font-bold"
                                    onClick={() => setTakeItems((prev) => prev.filter((_, i) => i !== idx))}
                                  >
                                    Xóa
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-bold text-amber-800"
                              onClick={() => setTakeItems((prev) => [...prev, { ingredient_id: '', actual_quantity: 0 }])}
                            >
                              + Thêm dòng
                            </button>
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
                              onClick={submitStockTake}
                            >
                              Lưu phiếu kiểm kê
                            </button>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[640px] text-left">
                            <thead>
                              <tr className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-amber-100">
                                <th className="py-2">Mã kiểm kê</th>
                                <th className="py-2">Ngày kiểm kê</th>
                                <th className="py-2">Số dòng</th>
                                <th className="py-2">Tổng lệch</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stockTakes.map((s) => (
                                <tr key={s.stock_take_id} className="border-b border-amber-50">
                                  <td className="py-3 font-bold text-slate-800">STK-{String(s.stock_take_id).padStart(4, '0')}</td>
                                  <td className="py-3 text-slate-600">{s.take_date ? new Date(s.take_date).toLocaleDateString('vi-VN') : '—'}</td>
                                  <td className="py-3 text-slate-600">{Number(s.item_count || 0)}</td>
                                  <td className="py-3 font-bold tabular-nums" style={{ color: Number(s.total_variance || 0) < 0 ? '#dc2626' : '#059669' }}>
                                    {Number(s.total_variance || 0).toLocaleString('vi-VN')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  </section>
                </>
              )}

              {activeTab === 'menu' && (
              <>
              {/* Menu table / grid */}
              <section className="rounded-2xl border border-amber-100 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-extrabold text-slate-900">Quản lý Thực đơn</h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold"
                      onClick={openCreateModal}
                    >
                      <span className="material-symbols-outlined text-[18px]">add_circle</span>
                      Thêm sản phẩm mới
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`p-2 rounded-lg border ${viewMode === 'grid' ? 'bg-amber-100 border-amber-300 text-amber-900' : 'border-transparent text-slate-500 hover:bg-amber-50'}`}
                      aria-label="Lưới"
                    >
                      <span className="material-symbols-outlined text-[22px]">grid_view</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`p-2 rounded-lg border ${viewMode === 'list' ? 'bg-amber-100 border-amber-300 text-amber-900' : 'border-transparent text-slate-500 hover:bg-amber-50'}`}
                      aria-label="Danh sách"
                    >
                      <span className="material-symbols-outlined text-[22px]">view_list</span>
                    </button>
                  </div>
                </div>

                <div className="px-5 py-3 border-b border-amber-50 bg-[#faf8f3] flex flex-wrap items-center gap-2">
                  {menuCategories.map((cat) => {
                    const isActive = menuCategory === cat;
                    const label = cat === 'all' ? 'Tất cả' : cat.charAt(0).toUpperCase() + cat.slice(1);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setMenuCategory(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                          isActive
                            ? 'bg-amber-600 border-amber-600 text-white'
                            : 'bg-white border-amber-200 text-slate-600 hover:bg-amber-50'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {viewMode === 'list' && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[800px] text-left">
                      <thead>
                        <tr className="bg-[#faf8f3] text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                          <th className="px-5 py-3">Sản phẩm</th>
                          <th className="px-5 py-3">Phân loại</th>
                          <th className="px-5 py-3">Giá bán</th>
                          <th className="px-5 py-3">Trạng thái</th>
                          <th className="px-5 py-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageItems.map((p) => {
                          const price = Number(p.sale_price ?? p.base_price ?? 0);
                          const available = Number(p.is_available) === 1;
                          const saving = savingIds.has(p.product_id);
                          const pid = `PRD-${String(p.product_id).padStart(3, '0')}`;
                          return (
                            <tr key={p.product_id} className="border-t border-amber-50 hover:bg-amber-50/30">
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="size-12 rounded-xl bg-amber-50 border border-amber-100 overflow-hidden shrink-0 flex items-center justify-center">
                                    {p.image_url ? (
                                      <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="material-symbols-outlined text-amber-700">local_cafe</span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-bold text-slate-900">{p.product_name}</p>
                                    <p className="text-xs text-slate-400">ID: {pid}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                {p.category_name ? (
                                  <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-100">
                                    {p.category_name}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>
                              <td className="px-5 py-4 font-extrabold tabular-nums" style={{ color: ACCENT }}>
                                {formatVnd(price)}
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                  <span className={`size-2 rounded-full shrink-0 ${available ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                  <span className="text-sm font-medium text-slate-700">{available ? 'Đang bán' : 'Ngừng bán'}</span>
                                </div>
                              </td>
                              <td className="px-5 py-4 text-right">
                                <div className="inline-flex items-center gap-1 justify-end">
                                  <button
                                    type="button"
                                    className="p-2 rounded-lg hover:bg-amber-50 text-slate-600"
                                    onClick={() => openEditModal(p)}
                                  >
                                    <span className="material-symbols-outlined text-[20px]">edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="p-2 rounded-lg hover:bg-red-50 text-slate-600"
                                    onClick={() => requestDeleteProduct(p)}
                                  >
                                    <span className="material-symbols-outlined text-[20px]">delete</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => setAvailability(p.product_id, !available)}
                                    className={`ml-1 relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                                      available ? 'bg-emerald-500' : 'bg-slate-200'
                                    } ${saving ? 'opacity-50' : ''}`}
                                    title="Bật/tắt bán"
                                  >
                                    <span
                                      className={`inline-block size-6 transform rounded-full bg-white shadow transition-transform ${
                                        available ? 'translate-x-6' : 'translate-x-1'
                                      }`}
                                    />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {viewMode === 'grid' && (
                  <div className="p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                    {pageItems.map((p) => {
                      const price = Number(p.sale_price ?? p.base_price ?? 0);
                      const available = Number(p.is_available) === 1;
                      const saving = savingIds.has(p.product_id);
                      return (
                        <div
                          key={p.product_id}
                          className="rounded-2xl border border-[#e6e6e8] overflow-hidden bg-[#f7f7f8] shadow-[0_2px_8px_rgba(15,23,42,0.05)] flex flex-col"
                        >
                          <div className="h-32 bg-slate-200 flex items-center justify-center relative overflow-hidden">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.product_name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-symbols-outlined text-4xl text-slate-400">local_cafe</span>
                            )}

                            <button
                              type="button"
                              className="absolute top-2 right-2 size-7 rounded-full bg-white/95 hover:bg-white shadow-sm text-slate-600 flex items-center justify-center"
                              onClick={() => openEditModal(p)}
                              aria-label="Sửa sản phẩm"
                            >
                              <span className="material-symbols-outlined text-[15px]">edit</span>
                            </button>
                          </div>

                          <div className="px-3.5 py-3 flex-1 flex flex-col">
                            <p className="text-[17px] leading-[1.2] font-extrabold text-slate-900 tracking-tight line-clamp-2 min-h-[40px]">
                              {p.product_name}
                            </p>
                            <p className="mt-1.5 text-[30px] leading-none font-black" style={{ color: ACCENT }}>
                              {formatVnd(price)}
                            </p>

                            <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between gap-2">
                              <span className="text-[10px] tracking-[0.14em] font-extrabold text-slate-500 uppercase">Trạng thái</span>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => setAvailability(p.product_id, !available)}
                                className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                                  available ? 'bg-amber-600' : 'bg-slate-300'
                                } ${saving ? 'opacity-50' : ''}`}
                                title="Bật/tắt bán"
                              >
                                <span
                                  className={`inline-block size-5 transform rounded-full bg-white shadow transition-transform ${
                                    available ? 'translate-x-4.5' : 'translate-x-0.5'
                                  }`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="px-5 py-4 border-t border-amber-100 flex flex-wrap items-center justify-between gap-3 bg-[#faf8f3]/80">
                  <p className="text-sm text-slate-600">
                    Hiển thị <b>{pageItems.length}</b> trên <b>{filteredProducts.length}</b> sản phẩm
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg border border-amber-200 text-sm disabled:opacity-40"
                    >
                      ‹
                    </button>
                    {pageButtons.map((n, idx) => (
                      <React.Fragment key={n}>
                        {idx > 0 && pageButtons[idx - 1] !== n - 1 && <span className="px-1 text-slate-400">…</span>}
                        <button
                          type="button"
                          onClick={() => setPage(n)}
                          className={`min-w-[36px] px-2 py-1.5 rounded-lg text-sm font-bold ${
                            page === n ? 'text-white' : 'text-slate-600 hover:bg-white'
                          }`}
                          style={page === n ? { backgroundColor: ACCENT } : {}}
                        >
                          {n}
                        </button>
                      </React.Fragment>
                    ))}
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 rounded-lg border border-amber-200 text-sm disabled:opacity-40"
                    >
                      ›
                    </button>
                  </div>
                </div>
              </section>
              </>
              )}
            </>
          )}

          <ModalPortal>
            {showIngredientDetail && selectedIngredient && (
              <div className="fixed inset-0 z-[9999] bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
                <div className="w-full max-w-lg rounded-2xl bg-white border border-indigo-100 shadow-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-indigo-100 bg-indigo-50 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-900">Chi tiết nguyên liệu</h3>
                      <p className="text-xs text-slate-500">Thông tin hiện tại và thao tác nhanh</p>
                    </div>
                    <button type="button" onClick={() => setShowIngredientDetail(false)} className="p-1 rounded hover:bg-white/80">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>
                  <div className="p-5 space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Mã</p><p className="font-bold text-slate-900">NL-{String(selectedIngredient.ingredient_id).padStart(3, '0')}</p></div>
                      <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Đơn vị</p><p className="font-bold text-slate-900">{selectedIngredient.unit || '—'}</p></div>
                      <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Tồn hiện tại</p><p className="font-bold text-slate-900">{Number(selectedIngredient.stock_quantity || 0).toLocaleString('vi-VN')}</p></div>
                      <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-500">Tồn tối thiểu</p><p className="font-bold text-slate-900">{Number(selectedIngredient.min_stock_alert || 0).toLocaleString('vi-VN')}</p></div>
                    </div>

                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                      <p className="text-xs text-indigo-700">Tên nguyên liệu</p>
                      <p className="font-extrabold text-indigo-900">{selectedIngredient.ingredient_name}</p>
                    </div>

                    <div className="pt-1 flex gap-2">
                      <button type="button" onClick={() => openImportModal(selectedIngredient)} className="flex-1 py-2.5 rounded-xl border border-amber-200 text-amber-800 font-semibold">Nhập nhanh</button>
                      <button type="button" onClick={() => openStockTakeModal(selectedIngredient)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold">Kiểm kê</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showImportModal && modalIngredient && (
              <div className="fixed inset-0 z-[9999] bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl bg-white border border-amber-100 shadow-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-amber-100 bg-amber-50">
                    <h3 className="text-lg font-extrabold text-slate-900">Nhập kho nhanh</h3>
                    <p className="text-xs text-slate-500">{modalIngredient.ingredient_name} ({modalIngredient.unit || '—'})</p>
                  </div>
                  <div className="p-5 space-y-3">
                    <label className="text-xs font-semibold text-slate-600">Số lượng nhập thêm</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full rounded-xl border border-amber-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                      placeholder="Nhập số lượng"
                      value={importQty}
                      onChange={(e) => setImportQty(e.target.value)}
                    />
                  </div>
                  <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
                    <button type="button" onClick={() => { setShowImportModal(false); setModalIngredient(null); setImportQty(''); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold">Hủy</button>
                    <button type="button" onClick={() => quickImportIngredient(modalIngredient)} className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white font-semibold">Xác nhận nhập</button>
                  </div>
                </div>
              </div>
            )}

            {showStockTakeModal && modalIngredient && (
              <div className="fixed inset-0 z-[9999] bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                    <h3 className="text-lg font-extrabold text-slate-900">Kiểm kê nhanh</h3>
                    <p className="text-xs text-slate-500">{modalIngredient.ingredient_name} ({modalIngredient.unit || '—'})</p>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                      Tồn hệ thống hiện tại: <b>{Number(modalIngredient.stock_quantity || 0).toLocaleString('vi-VN')}</b>
                    </div>
                    <label className="text-xs font-semibold text-slate-600">Số lượng thực tế sau kiểm kê</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-slate-300"
                      placeholder="Nhập số lượng thực tế"
                      value={stockTakeQty}
                      onChange={(e) => setStockTakeQty(e.target.value)}
                    />
                  </div>
                  <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
                    <button type="button" onClick={() => { setShowStockTakeModal(false); setModalIngredient(null); setStockTakeQty(''); }} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold">Hủy</button>
                    <button type="button" onClick={() => quickStockTakeIngredient(modalIngredient)} className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white font-semibold">Xác nhận kiểm kê</button>
                  </div>
                </div>
              </div>
            )}

            {deleteTarget && (
              <div className="fixed inset-0 z-[9999] bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4">
                <div className="w-full max-w-md rounded-3xl bg-white border border-red-100 shadow-[0_20px_60px_rgba(15,23,42,0.18)] overflow-hidden">
                  <div className="px-5 py-4 border-b border-red-100 bg-gradient-to-r from-red-50 to-white flex items-start gap-3">
                    <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600">
                      <span className="material-symbols-outlined">warning</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-extrabold text-slate-900">Xác nhận xóa sản phẩm</h3>
                      <p className="mt-1 text-sm text-slate-500">Thao tác này sẽ xóa sản phẩm khỏi danh sách quản lý.</p>
                    </div>
                    <button type="button" onClick={cancelDeleteProduct} className="rounded-full p-1 text-slate-400 hover:bg-white hover:text-slate-600">
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>

                  <div className="px-5 py-5 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Sản phẩm sắp xóa</p>
                      <p className="mt-1 text-base font-extrabold text-slate-900">{deleteTarget.product_name}</p>
                      <p className="mt-1 text-sm text-slate-500">Bạn có chắc chắn muốn xóa sản phẩm này không?</p>
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={cancelDeleteProduct}
                        disabled={deletingProduct}
                        className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Không
                      </button>
                      <button
                        type="button"
                        onClick={confirmDeleteProduct}
                        disabled={deletingProduct}
                        className="rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {deletingProduct ? 'Đang xóa...' : 'Có, xóa sản phẩm'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showProductModal && (
              <div className="fixed inset-0 z-[9999] bg-black/40 flex items-center justify-center p-4">
                <div className="w-full max-w-xl rounded-2xl bg-white border border-amber-100 shadow-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-amber-100 flex items-center justify-between">
                    <h3 className="text-lg font-extrabold text-slate-900">{editingProductId ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                    <button type="button" onClick={() => setShowProductModal(false)} className="p-1 rounded hover:bg-slate-100">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  <form onSubmit={submitProductForm} className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">Tên sản phẩm</label>
                      <input
                        className="w-full rounded-xl border border-amber-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                        value={productForm.product_name}
                        onChange={(e) => handleProductFormChange('product_name', e.target.value)}
                        placeholder="Nhập tên sản phẩm"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Danh mục</label>
                        <select
                          className="w-full rounded-xl border border-amber-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                          value={productForm.category_id}
                          onChange={(e) => handleProductFormChange('category_id', e.target.value)}
                        >
                          <option value="">-- Chọn danh mục --</option>
                          {formCategories.map((c) => (
                            <option key={c.category_id} value={c.category_id}>
                              {c.category_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Trạng thái</label>
                        <select
                          className="w-full rounded-xl border border-amber-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                          value={productForm.is_available}
                          onChange={(e) => handleProductFormChange('is_available', Number(e.target.value))}
                        >
                          <option value={1}>Đang bán</option>
                          <option value={0}>Ngừng bán</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Giá gốc</label>
                        <input
                          type="number"
                          min="0"
                          className="w-full rounded-xl border border-amber-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                          value={productForm.base_price}
                          onChange={(e) => handleProductFormChange('base_price', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Giá bán</label>
                        <input
                          type="number"
                          min="0"
                          className="w-full rounded-xl border border-amber-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                          value={productForm.sale_price}
                          onChange={(e) => handleProductFormChange('sale_price', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">URL hình ảnh</label>
                      <input
                        className="w-full rounded-xl border border-amber-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-200"
                        value={productForm.image_url}
                        onChange={(e) => handleProductFormChange('image_url', e.target.value)}
                        placeholder="https://..."
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowProductModal(false)}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-bold"
                      >
                        Hủy
                      </button>
                      <button
                        type="submit"
                        disabled={savingProduct}
                        className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-50"
                      >
                        {savingProduct ? 'Đang lưu...' : editingProductId ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </ModalPortal>
        </div>
      </main>
    </div>
  );
}
