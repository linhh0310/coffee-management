import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Sidebar from '../components/Sidebar';

function formatVnd(value) {
  const n = Number(value || 0);
  return `${Math.round(n).toLocaleString('vi-VN')}đ`;
}

function getUnitPrice(product) {
  const price = product?.sale_price ?? product?.base_price ?? 0;
  return Number(price) || 0;
}

const SIZE_OPTIONS = [
  { id: 'S', label: 'Size S', note: 'Cơ bản', add: 0 },
  { id: 'M', label: 'Size M', note: '+5.000đ', add: 5000 },
  { id: 'L', label: 'Size L', note: '+10.000đ', add: 10000 }
];

const ICE_OPTIONS = [
  { id: 'none', label: '0% (Không đá)' },
  { id: 'less', label: '50% đá' },
  { id: 'normal', label: '100% đá' }
];

const SUGAR_OPTIONS = [
  { id: 'none', label: '0% đường' },
  { id: 'less', label: '50% đường' },
  { id: 'normal', label: '100% đường' }
];

const TOPPING_OPTIONS = [
  { id: 'black_pearls', label: 'Trân châu đen', add: 8000 },
  { id: 'jelly', label: 'Thạch Jelly', add: 5000 },
  { id: 'cheese', label: 'Kem Cheese', add: 12000 }
];

function supportsDrinkModifiers(product) {
  return !isCakeProduct(product);
}

function isCakeProduct(product) {
  const category = String(product?.category_name || '').toLowerCase();
  const name = String(product?.product_name || '').toLowerCase();
  const haystack = `${category} ${name}`;
  const cakeKeywords = ['bánh', 'banh', 'cake'];
  return cakeKeywords.some((k) => haystack.includes(k));
}

function calcModifiersPrice(modal) {
  const supports = modal.supportsDrinkModifiers !== false;
  const sizeAdd = supports ? (SIZE_OPTIONS.find((s) => s.id === modal.size)?.add || 0) : 0;
  const toppingsAdd = modal.supportsDrinkModifiers === false
    ? 0
    : (modal.toppings || []).reduce((sum, tId) => {
    const t = TOPPING_OPTIONS.find((x) => x.id === tId);
    return sum + (t?.add || 0);
    }, 0);
  return sizeAdd + toppingsAdd;
}

function makeCartKey(productId, modal) {
  const supports = modal.supportsDrinkModifiers !== false;
  const size = supports ? (modal.size || 'S') : 'default';
  const toppings = supports ? [...(modal.toppings || [])].sort().join(',') : '';
  const ice = supports ? modal.ice : 'none';
  const sugar = supports ? modal.sugar : 'none';
  return `${productId}|size=${size}|ice=${ice}|sugar=${sugar}|toppings=${toppings}`;
}

function summarizeOptions(modal) {
  const supports = modal.supportsDrinkModifiers !== false;
  const size = supports ? (modal.size || 'S') : null;
  const ice = supports ? ICE_OPTIONS.find((x) => x.id === modal.ice)?.label : null;
  const sugar = supports ? SUGAR_OPTIONS.find((x) => x.id === modal.sugar)?.label : null;
  const toppingLabels = supports
    ? (modal.toppings || [])
      .map((id) => TOPPING_OPTIONS.find((t) => t.id === id)?.label)
      .filter(Boolean)
    : [];

  const parts = [
    size ? `Size ${size}` : null,
    ice ? `Đá: ${ice}` : null,
    sugar ? `Đường: ${sugar}` : null,
    toppingLabels.length ? `Topping: ${toppingLabels.join(', ')}` : null,
    modal.usePoints ? 'Tích điểm' : null
  ].filter(Boolean);

  return parts.join(' • ');
}

const BANK_BIN = '970422';
const BANK_ACCOUNT = '1900123456789';
const BANK_ACCOUNT_NAME = 'COFFEE MANAGEMENT';

function buildVietQrUrl({ amount, orderId }) {
  const transferContent = `THANH TOAN HD${String(orderId || '').padStart(5, '0')}`;
  const params = new URLSearchParams({
    amount: String(Math.round(Number(amount || 0))),
    addInfo: transferContent,
    accountName: BANK_ACCOUNT_NAME
  });
  return `https://img.vietqr.io/image/${BANK_BIN}-${BANK_ACCOUNT}-compact2.png?${params.toString()}`;
}

function escapeHtml(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function printInvoiceReceipt(invoice) {
  if (!invoice) return;

  const created = invoice?.createdAt ? new Date(invoice.createdAt) : new Date();
  const dateText = `${created.toLocaleDateString('vi-VN')} ${created.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
  const itemsHtml = (invoice.items || [])
    .map((it) => {
      const qty = Number(it.qty || 0);
      const unitPrice = Number(it.unitPrice || 0);
      const lineTotal = Number(it.lineTotal ?? unitPrice * qty);
      return `
        <div class="row item-row">
          <div class="c1">${escapeHtml(qty)}</div>
          <div class="c2">
            <div class="name">${escapeHtml(it.name || '')}</div>
            <div class="sub">${escapeHtml(formatVnd(unitPrice))} / món</div>
          </div>
          <div class="c3">${escapeHtml(formatVnd(lineTotal))}</div>
        </div>
      `;
    })
    .join('');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>In hóa đơn</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; background:#f3f3f3; padding:12px; }
  .paper { width:320px; margin:0 auto; background:#fff; border:1px solid #e2e8f0; border-radius:6px; padding:14px; color:#1e293b; }
  .center { text-align:center; }
  .brand { font-size:28px; font-weight:900; color:#b87414; letter-spacing:-0.4px; }
  .muted { font-size:10px; color:#64748b; }
  .meta { margin-top:10px; font-size:11px; display:grid; grid-template-columns:1fr 1fr; row-gap:4px; }
  .meta .r { text-align:right; }
  .line { border-top:1px dashed #cbd5e1; margin:10px 0; }
  .thead { font-size:10px; color:#64748b; font-weight:700; text-transform:uppercase; }
  .row { display:grid; grid-template-columns:36px 1fr 92px; gap:6px; align-items:start; }
  .item-row { font-size:11px; margin-top:6px; }
  .name { font-weight:700; line-height:1.25; }
  .sub { font-size:10px; color:#64748b; margin-top:2px; }
  .c3 { text-align:right; font-weight:700; }
  .sum { font-size:11px; margin-top:8px; }
  .sum p { display:flex; justify-content:space-between; margin:4px 0; }
  .total { font-size:20px; font-weight:900; margin-top:8px; padding-top:8px; border-top:1px dashed #cbd5e1; }
  .thanks { margin-top:10px; text-align:center; font-size:10px; color:#64748b; }
</style>
</head>
<body>
  <div class="paper">
    <div class="center">
      <div class="brand">THE COFFEE</div>
      <div style="font-size:11px; margin-top:2px;">123 Coffee St, City</div>
      <div class="muted">Tel: 0915 123 4567</div>
    </div>

    <div class="line"></div>

    <div class="meta">
      <div><b>Hóa đơn</b> #${escapeHtml(invoice.code || `HD${String(invoice.orderId || '').padStart(5, '0')}`)}</div>
      <div class="r"><b>Số</b> ${escapeHtml(invoice.orderId || invoice.id || '')}</div>
      <div>Ngày: ${escapeHtml(dateText)}</div>
      <div class="r">Thu ngân: ${escapeHtml(invoice.cashierName || 'N/A')}</div>
      <div style="grid-column:1 / span 2">Khu vực/Bàn: ${escapeHtml(invoice.tableLabel || 'Mang đi')}</div>
    </div>

    <div class="line"></div>

    <div class="row thead">
      <div>SL</div>
      <div>Tên món</div>
      <div style="text-align:right">Thành tiền</div>
    </div>
    ${itemsHtml || '<div class="muted" style="margin-top:6px">Không có dữ liệu món.</div>'}

    <div class="line"></div>

    <div class="sum">
      <p><span>Tạm tính</span><span>${escapeHtml(formatVnd(invoice.subtotal || 0))}</span></p>
      <p><span>Thuế GTGT</span><span>${escapeHtml(formatVnd(invoice.tax || 0))}</span></p>
      <p><span>Chiết khấu thành viên</span><span>-${escapeHtml(formatVnd(invoice.discount || 0))}</span></p>
      <p class="total"><span>TỔNG CỘNG</span><span>${escapeHtml(formatVnd(invoice.total || 0))}</span></p>
    </div>

    <div class="line"></div>

    <div class="meta" style="grid-template-columns:1fr; row-gap:2px;">
      <div><b>Hình thức thanh toán:</b> ${escapeHtml(invoice.paymentMethod || 'N/A')}</div>
      <div><b>Trạng thái:</b> ${escapeHtml(invoice.status || 'Đã thanh toán')}</div>
    </div>

    <div class="thanks">CẢM ƠN BẠN ĐÃ LỰA CHỌN THE COFFEE</div>
  </div>
  <script>
    window.onload = () => { window.print(); setTimeout(() => window.close(), 200); };
  </script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=420,height=760');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function printCupLabels(invoice, itemIndex = null) {
  if (!invoice) return;

  const allItems = Array.isArray(invoice.items) ? invoice.items : [];
  const items = Number.isInteger(itemIndex) && itemIndex >= 0 && itemIndex < allItems.length
    ? [allItems[itemIndex]]
    : allItems;

  if (!items.length) return;

  const code = invoice.code || `HD${String(invoice.orderId || '').padStart(5, '0')}`;
  const created = invoice?.createdAt ? new Date(invoice.createdAt) : new Date();
  const dateText = `${created.toLocaleDateString('vi-VN')} ${created.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;

  const labels = [];
  for (const it of items) {
    const qty = Math.max(1, Number(it?.qty || 1));
    const isCake = Boolean(it?.isCake);

    if (isCake) {
      labels.push({
        isCake: true,
        name: it?.name || 'Bánh',
        quantity: qty,
        unitPrice: Number(it?.unitPrice || 0)
      });
      continue;
    }

    for (let i = 1; i <= qty; i += 1) {
      labels.push({
        isCake: false,
        name: it?.name || 'Món',
        size: it?.size || 'S',
        iceLabel: it?.iceLabel || '100% đá',
        sugarLabel: it?.sugarLabel || '100% đường',
        toppingText: it?.toppingText || '',
        cupIndex: i,
        cupTotal: qty,
        unitPrice: Number(it?.unitPrice || 0)
      });
    }
  }

  const labelsHtml = labels.map((lb, idx) => {
    if (lb.isCake) {
      return `
    <section class="label ${idx % 2 === 1 ? 'right' : 'left'}">
      <div class="top">
        <span class="brand">THE COFFEE</span>
        <span class="order">#${escapeHtml(code)}</span>
      </div>
      <div class="name">${escapeHtml(lb.name)}</div>
      <div class="meta">Bánh • Số lượng: ${escapeHtml(lb.quantity)}</div>
      <div class="bottom">
        <span>SL: ${escapeHtml(lb.quantity)}</span>
        <span>${escapeHtml(formatVnd(lb.unitPrice))}</span>
      </div>
      <div class="time">${escapeHtml(dateText)}</div>
    </section>
  `;
    }

    return `
    <section class="label ${idx % 2 === 1 ? 'right' : 'left'}">
      <div class="top">
        <span class="brand">THE COFFEE</span>
        <span class="order">#${escapeHtml(code)}</span>
      </div>
      <div class="name">${escapeHtml(lb.name)}</div>
      <div class="meta">Size ${escapeHtml(lb.size)} • Đá: ${escapeHtml(lb.iceLabel)} • Đường: ${escapeHtml(lb.sugarLabel)}</div>
      <div class="meta">${escapeHtml(lb.toppingText ? `Topping: ${lb.toppingText}` : 'Topping: Không')}</div>
      <div class="bottom">
        <span>Ly ${lb.cupIndex}/${lb.cupTotal}</span>
        <span>${escapeHtml(formatVnd(lb.unitPrice))}</span>
      </div>
      <div class="time">${escapeHtml(dateText)}</div>
    </section>
  `;
  }).join('');

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>In tem pha chế</title>
<style>
  @page { size: auto; margin: 6mm; }
  body { font-family: Arial, Helvetica, sans-serif; margin:0; background:#f3f3f3; padding:8px; }
  .sheet { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .label {
    background:#fff;
    border:1px dashed #c9b49e;
    border-radius:8px;
    padding:8px;
    min-height:120px;
    display:flex;
    flex-direction:column;
    justify-content:space-between;
  }
  .top { display:flex; justify-content:space-between; align-items:center; font-size:11px; }
  .brand { font-weight:800; color:#b87414; }
  .order { font-weight:700; color:#2f2117; }
  .name { margin-top:6px; font-size:14px; font-weight:800; color:#1f2937; line-height:1.2; }
  .meta { margin-top:4px; font-size:11px; color:#6b7280; min-height:28px; }
  .bottom { margin-top:8px; display:flex; justify-content:space-between; font-size:11px; font-weight:700; color:#374151; }
  .time { margin-top:4px; font-size:10px; color:#6b7280; }
  @media print {
    body { background:#fff; padding:0; }
    .sheet { gap:4px; }
    .label { break-inside:avoid; page-break-inside:avoid; }
  }
</style>
</head>
<body>
  <div class="sheet">${labelsHtml}</div>
  <script>
    window.onload = () => { window.print(); setTimeout(() => window.close(), 200); };
  </script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=560,height=760');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function Sales() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [tables, setTables] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [comboAi, setComboAi] = useState(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const [activeCategory, setActiveCategory] = useState('Tất cả');
  const [query, setQuery] = useState('');

  const [customerMode, setCustomerMode] = useState('walk_in'); // walk_in | table

  const [cart, setCart] = useState(() => new Map()); // key -> { key, product, qty, options, unitPrice }
  const [submitting, setSubmitting] = useState(false);
  const [isCheckoutConfirmOpen, setIsCheckoutConfirmOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [transferOrder, setTransferOrder] = useState(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(null);
  const [shouldPrintAfterUpdate, setShouldPrintAfterUpdate] = useState(false);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [modal, setModal] = useState({
    size: 'S',
    ice: 'normal',
    sugar: 'less',
    toppings: [],
    supportsDrinkModifiers: true,
    usePoints: false,
    phone: ''
  });

  const handleLogout = React.useCallback(() => {
    localStorage.removeItem('token');
    navigate('/login');
  }, [navigate]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      handleLogout();
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    const fetchAll = async () => {
      try {
        setLoading(true);
        setErrorMessage('');

        const [pRes, tRes, rRes, comboRes] = await Promise.all([
          axios.get('/api/products', { headers }),
          axios.get('/api/tables', { headers }),
          axios.get('/api/orders/recent', { headers }),
          axios.get('/api/ai/combo-suggestions?days=60&persist=0', { headers }).catch(() => ({ data: null }))
        ]);

        setProducts(pRes.data || []);
        setTables(tRes.data || []);
        setRecentOrders(rRes.data || []);
        setComboAi(comboRes.data || null);
      } catch (err) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          handleLogout();
          return;
        }
        setErrorMessage(err?.response?.data?.message || 'Không thể tải dữ liệu bán hàng.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [handleLogout]);

  const categories = useMemo(() => {
    const set = new Set();
    for (const p of products) {
      if (p?.category_name) set.add(p.category_name);
    }
    return ['Tất cả', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (products || [])
      .filter((p) => Number(p?.is_available) === 1)
      .filter((p) => activeCategory === 'Tất cả' ? true : p?.category_name === activeCategory)
      .filter((p) => (q ? String(p?.product_name || '').toLowerCase().includes(q) : true));
  }, [products, activeCategory, query]);

  const cartItems = useMemo(() => Array.from(cart.values()), [cart]);

  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, it) => sum + Number(it.unitPrice || 0) * it.qty, 0);
  }, [cartItems]);

  const canCustomizeSelectedDrink = selectedProduct ? supportsDrinkModifiers(selectedProduct) : true;

  const tax = useMemo(() => Math.round(subtotal * 0.1), [subtotal]);
  const total = useMemo(() => subtotal + tax, [subtotal, tax]);
  const isInvoiceLocked = Boolean(invoiceModal && String(invoiceModal?.status) === 'pending');

  const openProductModal = (product) => {
    if (isInvoiceLocked) {
      toast('Đơn đang chờ thanh toán. Vui lòng hoàn tất hoặc thoát hóa đơn trước khi thêm món mới.');
      return;
    }
    setSelectedProduct(product);
    const canCustomizeDrink = supportsDrinkModifiers(product);
    setModal((prev) => ({
      ...prev,
      size: 'S',
      ice: canCustomizeDrink ? 'normal' : 'none',
      sugar: canCustomizeDrink ? 'less' : 'none',
      toppings: [],
      supportsDrinkModifiers: canCustomizeDrink,
      usePoints: false,
      phone: ''
    }));
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const addConfiguredItemToCart = () => {
    if (!selectedProduct) return;
    if (modal.usePoints && !String(modal.phone || '').trim()) {
      toast.error('Vui lòng nhập số điện thoại khi tích điểm.');
      return;
    }

    const canCustomizeDrink = supportsDrinkModifiers(selectedProduct);
    const normalizedModal = {
      ...modal,
      ice: canCustomizeDrink ? modal.ice : 'none',
      sugar: canCustomizeDrink ? modal.sugar : 'none',
      toppings: canCustomizeDrink ? [...modal.toppings] : [],
      supportsDrinkModifiers: canCustomizeDrink
    };

    const base = getUnitPrice(selectedProduct);
    const add = calcModifiersPrice(normalizedModal);
    const unitPrice = base + add;
    const key = makeCartKey(Number(selectedProduct.product_id), normalizedModal);
    const qtyToAdd = 1;

    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(key);
      if (existing) {
        next.set(key, { ...existing, qty: existing.qty + qtyToAdd });
      } else {
        next.set(key, {
          key,
          product: selectedProduct,
          qty: qtyToAdd,
          options: normalizedModal,
          unitPrice
        });
      }
      return next;
    });

    closeModal();
  };

  const updateQty = (itemKey, delta) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(itemKey);
      if (!existing) return next;
      const qty = existing.qty + delta;
      if (qty <= 0) next.delete(itemKey);
      else next.set(itemKey, { ...existing, qty });
      return next;
    });
  };

  const clearCart = () => setCart(new Map());

  const startCheckout = () => {
    if (cartItems.length === 0 || submitting) return;

    // Theo yêu cầu: không hiển thị modal "Xác nhận thanh toán" trung gian,
    // mà mở thẳng modal "Chi tiết hóa đơn" ngay.
    setPaymentMethod('cash');
    (async () => {
      const pendingInvoice = await submitOrder({
        desiredStatus: 'pending',
        selectedPaymentMethod: 'cash'
      });
      if (!pendingInvoice) return;

      const detail = await fetchInvoiceDetail(pendingInvoice.orderId);
      setInvoiceModal(detail || { ...pendingInvoice, status: 'pending' });
    })();
  };

  const startNewOrder = () => {
    setInvoiceModal(null);
    setTransferOrder(null);
    setIsTransferModalOpen(false);
    setCustomerMode('walk_in');
  };

  const submitOrder = async ({ desiredStatus, selectedPaymentMethod }) => {
    const token = localStorage.getItem('token');
    if (!token) {
      handleLogout();
      return null;
    }
    if (cartItems.length === 0) return null;


    setSubmitting(true);
    setErrorMessage('');

    try {
      const headers = { Authorization: `Bearer ${token}` };
      const checkoutSnapshot = cartItems.map((it) => {
        const supports = it?.options?.supportsDrinkModifiers !== false;
        const size = supports ? (it?.options?.size || 'S') : null;
        const iceLabel = supports ? (ICE_OPTIONS.find((x) => x.id === it?.options?.ice)?.label || '') : '';
        const sugarLabel = supports ? (SUGAR_OPTIONS.find((x) => x.id === it?.options?.sugar)?.label || '') : '';
        const toppingText = supports
          ? (it?.options?.toppings || [])
              .map((id) => TOPPING_OPTIONS.find((t) => t.id === id)?.label)
              .filter(Boolean)
              .join(', ')
          : '';

        return {
          name: it?.product?.product_name,
          qty: Number(it?.qty || 0),
          unitPrice: Number(it?.unitPrice || 0),
          optionsText: summarizeOptions(it.options || {}),
          isCake: !supports,
          size,
          iceLabel,
          sugarLabel,
          toppingText
        };
      });
      const loyaltyItems = cartItems.filter((it) => Boolean(it?.options?.usePoints));
      const loyaltyPhones = [...new Set(loyaltyItems.map((it) => String(it?.options?.phone || '').trim()).filter(Boolean))];
      if (loyaltyItems.length > 0 && loyaltyPhones.length === 0) {
        setErrorMessage('Đơn hàng tích điểm cần số điện thoại hợp lệ.');
        setSubmitting(false);
        return null;
      }
      if (loyaltyPhones.length > 1) {
        setErrorMessage('Một đơn hàng chỉ hỗ trợ 1 số điện thoại tích điểm.');
        setSubmitting(false);
        return null;
      }

      const normalizedPaymentMethod = selectedPaymentMethod === 'transfer' ? 'momo' : 'cash';

      const body = {
        table_id: null,
        order_type: customerMode === 'table' ? 'dine_in' : 'take_away',
        payment_method: normalizedPaymentMethod,
        status: desiredStatus,
        // Backend hiện tại nhận product_id + quantity (modifiers đang giữ ở frontend)
        items: cartItems.map((it) => ({
          product_id: Number(it.product.product_id),
          quantity: Number(it.qty),
          price_at_sale: Number(it.unitPrice || 0),
          size_label: it?.options?.supportsDrinkModifiers !== false ? (it?.options?.size || 'S') : 'DEFAULT'
        })),
        loyalty: loyaltyItems.length
          ? {
              use_points: true,
              phone: loyaltyPhones[0],
              full_name: 'Khách POS'
            }
          : { use_points: false }
      };

      const res = await axios.post('/api/orders/checkout', body, { headers });
      const loyaltyText = res.data?.loyalty
        ? `\nTích điểm: +${res.data.loyalty.points_added} điểm (Tổng ${res.data.loyalty.points_total})`
        : '';
      if (desiredStatus === 'paid') {
        toast.success(`Thanh toán thành công! Mã đơn: #${res.data?.order_id}${loyaltyText}`);
      }
      const invoiceSubtotal = Number(res.data?.total_amount || subtotal);
      const invoiceTax = Number(res.data?.tax_amount || tax);
      const invoiceTotal = Number(res.data?.final_amount || total);
      const tableLabel = customerMode === 'table'
        ? `Mã order #HD${String(res.data?.order_id || '').padStart(5, '0')}`
        : 'Khách lẻ / Mang đi';

      const invoiceData = {
        orderId: res.data?.order_id,
        createdAt: new Date().toISOString(),
        status: res.data?.status || desiredStatus,
        tableLabel,
        paymentMethod: selectedPaymentMethod === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt',
        items: checkoutSnapshot,
        subtotal: invoiceSubtotal,
        tax: invoiceTax,
        total: invoiceTotal
      };

      return invoiceData;
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        handleLogout();
        return null;
      }
      setErrorMessage(err?.response?.data?.message || 'Tạo đơn thất bại.');
      console.error(err);
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckoutConfirm = async () => {
    const pendingInvoice = await submitOrder({
      desiredStatus: 'pending',
      selectedPaymentMethod: paymentMethod === 'transfer' ? 'transfer' : 'cash'
    });
    if (!pendingInvoice) return;

    setIsCheckoutConfirmOpen(false);

    if (paymentMethod === 'transfer') {
      setTransferOrder({
        ...pendingInvoice,
        qrUrl: buildVietQrUrl({ amount: pendingInvoice.total, orderId: pendingInvoice.orderId })
      });
    } else {
      setTransferOrder({
        ...pendingInvoice,
        qrUrl: null
      });
    }

    setIsTransferModalOpen(true);
  };

  const fetchInvoiceDetail = async (orderId) => {
    const token = localStorage.getItem('token');
    if (!token) {
      handleLogout();
      return null;
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`/api/orders/invoices/${orderId}`, { headers });
      const detail = res.data || {};

      const snapshotByName = new Map(
        cartItems.map((it) => [String(it?.product?.product_name || ''), it])
      );

      const mergedItems = (detail.items || []).map((it) => {
        const snap = snapshotByName.get(String(it?.name || ''));
        const supports = snap?.options?.supportsDrinkModifiers !== false;
        const size = supports ? (snap?.options?.size || 'S') : null;
        const iceLabel = supports ? (ICE_OPTIONS.find((x) => x.id === snap?.options?.ice)?.label || '') : '';
        const sugarLabel = supports ? (SUGAR_OPTIONS.find((x) => x.id === snap?.options?.sugar)?.label || '') : '';
        const toppingText = supports
          ? (snap?.options?.toppings || [])
              .map((id) => TOPPING_OPTIONS.find((t) => t.id === id)?.label)
              .filter(Boolean)
              .join(', ')
          : '';

        return {
          ...it,
          isCake: supports === false,
          size,
          iceLabel,
          sugarLabel,
          toppingText,
          optionsText: snap ? summarizeOptions(snap.options || {}) : (it?.optionsText || '')
        };
      });

      return {
        ...detail,
        items: mergedItems,
        createdAt: detail.createdAt || new Date().toISOString()
      };
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        handleLogout();
        return null;
      }
      toast.error(err?.response?.data?.message || 'Không tải được chi tiết hóa đơn.');
      return null;
    }
  };

  useEffect(() => {
    if (!shouldPrintAfterUpdate) return;
    if (!invoiceModal || String(invoiceModal?.status) !== 'paid') return;

    const timer = setTimeout(() => {
      printInvoiceReceipt(invoiceModal);
      setShouldPrintAfterUpdate(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [shouldPrintAfterUpdate, invoiceModal]);

  const confirmTransferPaid = async () => {
    if (!transferOrder?.orderId) return;

    const token = localStorage.getItem('token');
    if (!token) {
      handleLogout();
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.patch(`/api/orders/${transferOrder.orderId}/mark-paid`, {}, { headers });
      toast.success(`Đã xác nhận thanh toán đơn #${transferOrder.orderId}`);
      setIsTransferModalOpen(false);
      const detail = await fetchInvoiceDetail(transferOrder.orderId);
      setInvoiceModal(detail || { ...transferOrder, status: 'paid' });
      setTransferOrder(null);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        handleLogout();
        return;
      }
      setErrorMessage(err?.response?.data?.message || 'Không thể xác nhận chuyển khoản.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmInvoicePaid = async ({ printAfter } = { printAfter: false }) => {
    const token = localStorage.getItem('token');
    if (!token) {
      handleLogout();
      return;
    }

    const orderId = Number(invoiceModal?.orderId);
    if (!Number.isFinite(orderId) || orderId <= 0) return;

    setSubmitting(true);
    setErrorMessage('');
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.patch(`/api/orders/${orderId}/mark-paid`, {}, { headers });
      toast.success(`Đã xác nhận thanh toán đơn #${orderId}`);

      clearCart();
      const detail = await fetchInvoiceDetail(orderId);
      setInvoiceModal(detail || { ...(invoiceModal || {}), status: 'paid' });
      setShouldPrintAfterUpdate(Boolean(printAfter));
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        handleLogout();
        return;
      }
      setErrorMessage(err?.response?.data?.message || 'Không thể xác nhận thanh toán.');
      toast.error(err?.response?.data?.message || 'Không thể xác nhận thanh toán.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#faf8f5]">
      <Sidebar />

      {/* Main */}
      <main className="flex-1 flex overflow-hidden">
        {/* Menu column */}
        <section className="flex-1 overflow-y-auto">
          <div className="p-6 pb-3 flex items-center justify-between gap-4">
            <div className="text-left">
              <h2 className="text-lg font-bold text-slate-900">Thực đơn hôm nay</h2>
              <p className="text-xs text-slate-500">Chọn món để thêm vào đơn hàng</p>
              {isInvoiceLocked && (
                <p className="mt-1 text-xs font-bold text-amber-700">
                  Đơn đang chờ thanh toán: tạm khóa thao tác thêm món mới để tránh nhầm đơn.
                </p>
              )}
            </div>
            <div className="relative w-[420px] max-w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
              <input
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white border border-orange-100 focus:ring-1 focus:ring-[#b87414] outline-none text-sm"
                placeholder="Tìm kiếm món ăn, đồ uống..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Category tabs */}
          <div className="px-6 pb-4 flex items-center gap-2 overflow-x-auto">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${
                  activeCategory === c
                    ? 'bg-[#b87414] text-white'
                    : 'bg-white border border-orange-100 text-slate-700 hover:bg-orange-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* AI Smart Combo */}
          <div className="px-6 pb-4">
            <div className="relative rounded-2xl border border-orange-100 bg-gradient-to-r from-orange-50/80 via-white to-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-[280px] text-left">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-orange-100 text-[#b87414] border border-orange-200">
                      THỬ NGHIỆM
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      GỢI Ý AI
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Gợi ý combo bán chạy</h2>
                  <p className="text-sm text-slate-600 mt-1 max-w-xl">
                    Gợi ý combo theo cặp món thường đi cùng trong hóa đơn — giá ưu đãi ước tính cho thu ngân.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                {(comboAi?.combo_cards?.length ? comboAi.combo_cards : []).slice(0, 2).map((c, idx) => (
                  <div
                    key={`${c.id_a}-${c.id_b}-${idx}`}
                    className="min-w-[260px] flex-1 rounded-2xl bg-white border border-orange-100 p-4 hover:bg-orange-50/50"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Combo #{idx + 1}</p>
                      <span className="text-[10px] font-extrabold text-[#b87414] px-2 py-1 rounded-full bg-orange-50 border border-orange-100">
                        Khớp ~{c.match_score}%
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{c.title}</p>
                    <p className="text-[11px] text-slate-600 mt-2">
                      {c.pair_orders} đơn có cả hai món · Giảm {c.discount_pct}%
                    </p>
                    <div className="mt-3 flex items-baseline justify-between gap-2">
                      <span className="text-lg font-extrabold tabular-nums text-[#b87414]">{formatVnd(c.price_combo)}</span>
                      <span className="text-xs line-through text-slate-400 tabular-nums">{formatVnd(c.price_regular)}</span>
                    </div>
                  </div>
                ))}

                {!comboAi?.combo_cards?.length && (
                  <div className="rounded-2xl bg-white border border-orange-100 p-4 text-sm text-slate-600 min-w-[320px] text-left">
                    {comboAi?.ai_analysis
                      ? comboAi.ai_analysis.slice(0, 280) + (comboAi.ai_analysis.length > 280 ? '…' : '')
                      : 'Chưa có cặp combo đủ dữ liệu — cần đơn có từ 2 món trở lên trong cùng một hóa đơn.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content states */}
          <div className="px-6 pb-6">
            {loading && (
              <div className="bg-white border border-orange-100 rounded-2xl p-6 text-left text-slate-600">
                Đang tải menu...
              </div>
            )}
            {!loading && errorMessage && (
              <div className="bg-white border border-orange-100 rounded-2xl p-6 text-left">
                <p className="text-red-600 font-semibold">Lỗi</p>
                <p className="text-slate-600 mt-1">{errorMessage}</p>
              </div>
            )}

            {/* Product grid */}
            {!loading && !errorMessage && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map((p) => {
                  const price = getUnitPrice(p);
                  return (
                    <button
                      key={p.product_id}
                      onClick={() => openProductModal(p)}
                      disabled={isInvoiceLocked}
                      className={`bg-white border border-orange-100 rounded-2xl p-3 text-left transition-shadow ${
                        isInvoiceLocked ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'
                      }`}
                    >
                      <div className="aspect-square rounded-2xl bg-orange-50 border border-orange-100 overflow-hidden flex items-center justify-center">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.product_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-[#b87414] text-4xl">coffee</span>
                        )}
                      </div>
                      <div className="mt-3">
                        <p className="text-sm font-semibold text-slate-900 truncate">{p.product_name}</p>
                        <p className="text-sm font-bold text-[#b87414]">{formatVnd(price)}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Cart / Invoice details (conditional rendering) */}
        <aside className="w-[420px] max-w-full border-l border-orange-100 bg-white flex flex-col">
          {!invoiceModal ? (
            <>
              <div className="p-6 border-b border-orange-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 text-left">Chi tiết đơn hàng</h3>
                  <div className="flex items-center gap-2">
                    <button
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                        customerMode === 'walk_in' ? 'bg-orange-100 border-orange-200 text-[#b87414]' : 'bg-white border-orange-100 text-slate-600'
                      }`}
                      onClick={() => setCustomerMode('walk_in')}
                    >
                      Khách lẻ
                    </button>
                    <button
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                        customerMode === 'table' ? 'bg-orange-100 border-orange-200 text-[#b87414]' : 'bg-white border-orange-100 text-slate-600'
                      }`}
                      onClick={() => setCustomerMode('table')}
                    >
                      Tại bàn
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {cartItems.length === 0 ? (
                  <div className="text-left text-slate-500">
                    Chưa có món nào. Hãy chọn món ở danh sách bên trái.
                  </div>
                ) : (
                  cartItems.map((it) => (
                    <div key={it.key} className="flex items-center gap-3">
                      <div className="size-12 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center overflow-hidden">
                        {it.product.image_url ? (
                          <img src={it.product.image_url} alt={it.product.product_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="material-symbols-outlined text-[#b87414]">local_cafe</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-semibold text-slate-900 truncate">{it.product.product_name}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {summarizeOptions(it.options || {})}
                        </p>
                        <p className="text-xs text-slate-500">{formatVnd(it.unitPrice)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="size-8 rounded-lg border border-orange-100 hover:bg-orange-50"
                          onClick={() => updateQty(it.key, -1)}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[18px]">remove</span>
                        </button>
                        <span className="w-6 text-center text-sm font-bold text-slate-800">{it.qty}</span>
                        <button
                          className="size-8 rounded-lg border border-orange-100 hover:bg-orange-50"
                          onClick={() => updateQty(it.key, 1)}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[18px]">add</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-6 border-t border-orange-100 bg-[#fffaf4]">
                <div className="space-y-2 text-left text-sm">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Tạm tính</span>
                    <span className="font-semibold">{formatVnd(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Thuế (10%)</span>
                    <span className="font-semibold">{formatVnd(tax)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-orange-200 text-slate-900">
                    <span className="font-bold">Tổng cộng</span>
                    <span className="font-extrabold text-[#b87414]">{formatVnd(total)}</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <button
                    onClick={clearCart}
                    disabled={cartItems.length === 0 || submitting}
                    className="flex-1 py-2.5 rounded-xl border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 disabled:opacity-50"
                  >
                    Hủy đơn
                  </button>
                </div>

                <button
                  onClick={startCheckout}
                  disabled={cartItems.length === 0 || submitting}
                  className="mt-3 w-full py-3 rounded-xl bg-[#b87414] text-white font-bold hover:opacity-95 disabled:opacity-50"
                >
                  {submitting ? 'Đang xử lý...' : 'Xác nhận thanh toán'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="p-5 border-b border-slate-200 flex items-start justify-between bg-[#f4f2ef]">
                <div className="text-left">
                  <h3 className="text-[30px] leading-none font-black text-slate-900 tracking-tight">Chi tiết hóa đơn</h3>
                  <p className="mt-2 text-[11px] text-slate-500">Mã hóa đơn: <span className="font-bold text-slate-700">{invoiceModal.code || `#HD-${String(invoiceModal.orderId || '').padStart(4, '0')}`}</span></p>
                  <p className="text-[11px] text-slate-500">Thời gian: {invoiceModal.createdAt ? new Date(invoiceModal.createdAt).toLocaleString('vi-VN') : 'N/A'}</p>
                  <p className="text-[11px] text-slate-500">Thu ngân: {invoiceModal.cashierName || 'N/A'}</p>
                </div>
                <button
                  type="button"
                  className="size-8 rounded-full border border-slate-300 text-slate-600 flex items-center justify-center bg-white hover:bg-slate-50"
                  onClick={startNewOrder}
                  aria-label="Đóng"
                  disabled={submitting}
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#f6f4f1] p-4 space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
                  {(invoiceModal.items || []).length ? (
                    (invoiceModal.items || []).map((it, idx) => (
                      <div key={`${it.name}-${idx}`} className="flex items-center justify-between gap-3 pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="size-11 rounded-lg bg-[#191919] overflow-hidden flex items-center justify-center shrink-0">
                            {it.image_url ? (
                              <img src={it.image_url} alt={it.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-symbols-outlined text-amber-300">local_cafe</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-slate-900 truncate">{it.name}</p>
                            <p className="text-[10px] text-slate-500">SL sử dụng: {it.qty}</p>
                            <p className="text-[10px] text-slate-400 truncate">{it.optionsText || '—'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-lg border border-orange-200 px-2 py-1 text-[11px] font-semibold text-[#b87414] hover:bg-orange-50"
                            onClick={() => printCupLabels(invoiceModal, idx)}
                          >
                            <span className="material-symbols-outlined text-[14px]">print</span>
                            In tem
                          </button>
                          <p className="text-[18px] leading-none font-extrabold text-slate-800">{formatVnd(it.lineTotal ?? (it.unitPrice * it.qty))}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-500 py-6 text-center">Chưa có món nào trong hóa đơn.</div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between text-slate-500 text-[13px]">
                    <span>Tạm tính</span>
                    <span className="font-medium">{formatVnd(invoiceModal.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 text-[13px]">
                    <span>Thuế (VAT 10%)</span>
                    <span className="font-medium">{formatVnd(invoiceModal.tax)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-200">
                    <span className="text-[22px] leading-none font-extrabold text-slate-900">Tổng cộng</span>
                    <span className="text-[30px] leading-none font-black text-[#c07a18]">{formatVnd(invoiceModal.total)}</span>
                  </div>
                </div>

                {String(invoiceModal?.status) === 'pending' ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">Phương thức thanh toán</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`rounded-xl border p-2 text-center ${
                          paymentMethod === 'cash'
                            ? 'border-[#c07a18] bg-[#fff8ef] text-[#c07a18]'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">payments</span>
                        <p className="text-xs font-bold mt-1">Tiền mặt</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('transfer')}
                        className={`rounded-xl border p-2 text-center ${
                          paymentMethod === 'transfer'
                            ? 'border-[#c07a18] bg-[#fff8ef] text-[#c07a18]'
                            : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">account_balance</span>
                        <p className="text-xs font-bold mt-1">Chuyển khoản</p>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="p-4 border-t border-slate-200 bg-white/95 backdrop-blur sticky bottom-0 space-y-2">
                {String(invoiceModal?.status) === 'pending' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => printCupLabels(invoiceModal)}
                      className="w-full py-3 rounded-xl border border-orange-200 text-[#b87414] font-bold hover:bg-orange-50 disabled:opacity-50"
                      disabled={submitting}
                    >
                      In tem pha chế
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmInvoicePaid({ printAfter: false })}
                      className="w-full py-2.5 rounded-xl bg-[#c07a18] text-white text-sm font-semibold hover:opacity-95 disabled:opacity-50 shadow-sm"
                      disabled={submitting}
                    >
                      {submitting ? 'Đang xử lý...' : 'Thanh toán'}
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmInvoicePaid({ printAfter: true })}
                      className="w-full py-3 rounded-xl bg-white border border-slate-200 text-slate-800 font-bold hover:bg-slate-50 disabled:opacity-50"
                      disabled={submitting}
                    >
                      Thanh toán & In hóa đơn
                    </button>
                  </>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => printCupLabels(invoiceModal)}
                      className="w-full py-3 rounded-xl border border-orange-200 text-[#b87414] font-bold hover:bg-orange-50"
                    >
                      In tem pha chế
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={startNewOrder}
                        className="w-full py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
                      >
                        Thoát
                      </button>
                      <button
                        type="button"
                        onClick={() => printInvoiceReceipt(invoiceModal)}
                        className="w-full py-3 rounded-xl bg-[#c07a18] text-white font-bold hover:opacity-95"
                      >
                        In hóa đơn
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </main>

      {isCheckoutConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsCheckoutConfirmOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-3xl bg-white border border-orange-100 shadow-2xl p-6">
            <div className="mx-auto size-14 rounded-full bg-orange-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#b87414]">check_circle</span>
            </div>
            <h3 className="mt-4 text-2xl font-extrabold text-slate-900 text-center">Xác nhận thanh toán</h3>
            <p className="mt-2 text-sm text-slate-600 text-center">
              Hãy chắc chắn các món trong danh sách orders đã đúng với yêu cầu của khách hàng.
            </p>

            <div className="mt-5 rounded-xl border border-orange-100 bg-[#fffaf4] p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Tổng tiền</span>
                <span className="font-extrabold text-[#b87414]">{formatVnd(total)}</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">Số lượng: {cartItems.reduce((s, it) => s + Number(it.qty || 0), 0)} món</div>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
                  paymentMethod === 'cash'
                    ? 'border-[#b87414] bg-orange-50 text-[#b87414]'
                    : 'border-orange-100 text-slate-700 hover:bg-orange-50/60'
                }`}
              >
                Tiền mặt
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('transfer')}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold ${
                  paymentMethod === 'transfer'
                    ? 'border-[#b87414] bg-orange-50 text-[#b87414]'
                    : 'border-orange-100 text-slate-700 hover:bg-orange-50/60'
                }`}
              >
                Chuyển khoản (QR)
              </button>
            </div>

            <button
              type="button"
              className="mt-5 w-full py-3 rounded-xl bg-[#b87414] text-white font-bold hover:opacity-95"
              onClick={handleCheckoutConfirm}
            >
              {paymentMethod === 'transfer' ? 'Chuyển sang bước xác nhận chuyển khoản' : 'Chuyển sang bước xác nhận tiền mặt'}
            </button>
            <button
              type="button"
              className="mt-3 w-full py-3 rounded-xl border border-orange-100 text-slate-700 font-semibold hover:bg-orange-50"
              onClick={() => setIsCheckoutConfirmOpen(false)}
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {isTransferModalOpen && transferOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !submitting) setIsTransferModalOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-3xl bg-white border border-orange-100 shadow-2xl p-6">
            <h3 className="text-2xl font-extrabold text-slate-900 text-center">
              {transferOrder.paymentMethod === 'Chuyển khoản' ? 'Thanh toán chuyển khoản' : 'Xác nhận thu tiền mặt'}
            </h3>
            <p className="mt-2 text-sm text-slate-600 text-center">
              {transferOrder.paymentMethod === 'Chuyển khoản'
                ? 'Khách hàng quét mã QR để thanh toán. Sau khi kiểm tra tiền đã vào tài khoản, nhân viên bấm xác nhận.'
                : 'Sau khi đã nhận đủ tiền mặt từ khách hàng, nhân viên bấm xác nhận để hoàn tất đơn hàng.'}
            </p>

            <div className="mt-4 rounded-xl border border-orange-100 bg-[#fffaf4] p-4 text-sm text-left space-y-1">
              <p className="text-slate-700">Mã đơn: <span className="font-bold">#HD{String(transferOrder.orderId || '').padStart(5, '0')}</span></p>
              <p className="text-slate-700">Số tiền: <span className="font-extrabold text-[#b87414]">{formatVnd(transferOrder.total)}</span></p>
              {transferOrder.paymentMethod === 'Chuyển khoản' ? (
                <p className="text-slate-600">Nội dung CK: <span className="font-semibold">THANH TOAN HD{String(transferOrder.orderId || '').padStart(5, '0')}</span></p>
              ) : null}
            </div>

            {transferOrder.paymentMethod === 'Chuyển khoản' && transferOrder.qrUrl ? (
              <div className="mt-4 rounded-2xl border border-orange-100 p-4 bg-white flex items-center justify-center">
                <img
                  src={transferOrder.qrUrl}
                  alt="VietQR"
                  className="w-72 h-72 object-contain"
                />
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-orange-100 p-4 bg-orange-50 text-left text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Nhắc nhở thu ngân</p>
                <p className="mt-1">1. Nhận tiền mặt từ khách.</p>
                <p>2. Kiểm đếm đủ số tiền cần thu.</p>
                <p>3. Bấm xác nhận để hoàn tất đơn.</p>
              </div>
            )}

            <button
              type="button"
              className="mt-5 w-full py-3 rounded-xl bg-[#b87414] text-white font-bold hover:opacity-95 disabled:opacity-50"
              onClick={confirmTransferPaid}
              disabled={submitting}
            >
              {submitting
                ? 'Đang xác nhận...'
                : transferOrder.paymentMethod === 'Chuyển khoản'
                  ? 'Nhân viên xác nhận đã nhận chuyển khoản'
                  : 'Nhân viên xác nhận đã nhận tiền mặt'}
            </button>
            <button
              type="button"
              className="mt-3 w-full py-3 rounded-xl border border-orange-100 text-slate-700 font-semibold hover:bg-orange-50 disabled:opacity-50"
              onClick={() => setIsTransferModalOpen(false)}
              disabled={submitting}
            >
              Đóng
            </button>
          </div>
        </div>
      )}


      {/* Product modal */}
      {isModalOpen && selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-[760px] rounded-3xl overflow-hidden bg-white shadow-2xl border border-orange-100">
            {/* Header image */}
            <div className="relative h-44 bg-gradient-to-r from-black to-slate-900">
              {selectedProduct.image_url ? (
                <img src={selectedProduct.image_url} alt={selectedProduct.product_name} className="w-full h-full object-cover opacity-90" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-6xl">coffee</span>
                </div>
              )}
              <button
                className="absolute right-4 top-4 size-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/60"
                onClick={closeModal}
                type="button"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="absolute left-6 bottom-5 text-left">
                <p className="text-white text-xl font-extrabold">{selectedProduct.product_name}</p>
                <p className="text-[#f5c77f] font-bold">{formatVnd(getUnitPrice(selectedProduct))}</p>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Size */}
              {canCustomizeSelectedDrink && (
                <div>
                  <p className="text-xs font-extrabold tracking-wide text-slate-700 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#b87414]">straighten</span>
                    CHỌN KÍCH CỠ
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {SIZE_OPTIONS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setModal((m) => ({ ...m, size: s.id }))}
                        className={`rounded-2xl border p-3 text-left ${
                          modal.size === s.id ? 'border-[#b87414] bg-orange-50' : 'border-orange-100 hover:bg-orange-50/50'
                        }`}
                      >
                        <p className="text-sm font-bold text-slate-900">{s.label}</p>
                        <p className="text-xs text-slate-500">{s.note}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Table + points */}
              <div>
                <p className="text-xs font-extrabold tracking-wide text-slate-700 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#b87414]">receipt_long</span>
                  THÔNG TIN ĐƠN
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3">
                  <div className="rounded-xl border border-orange-100 bg-orange-50/40 px-3 py-2 text-left">
                    <p className="text-xs font-semibold text-slate-700">Mã order tự động</p>
                    <p className="mt-1 text-[11px] text-slate-500">Khi thêm món cho khách dùng tại bàn, không cần chọn bàn. Hệ thống tự tạo mã order để theo dõi.</p>
                  </div>

                  <label className="flex items-center gap-3 select-none">
                    <input
                      type="checkbox"
                      className="size-4 accent-[#b87414]"
                      checked={modal.usePoints}
                      onChange={(e) => setModal((m) => ({ ...m, usePoints: e.target.checked }))}
                    />
                    <span className="text-sm font-semibold text-slate-700">Tích điểm</span>
                  </label>

                  {modal.usePoints && (
                    <div>
                      <label className="text-xs font-semibold text-slate-600">Số điện thoại tích điểm</label>
                      <input
                        className="mt-2 w-full border border-orange-100 rounded-xl px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#b87414]"
                        placeholder="090..."
                        value={modal.phone}
                        onChange={(e) => setModal((m) => ({ ...m, phone: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              </div>

              {canCustomizeSelectedDrink && (
                <>
                  {/* Ice */}
                  <div>
                    <p className="text-xs font-extrabold tracking-wide text-slate-700">MỨC ĐÁ</p>
                    <div className="mt-3 space-y-2">
                      {ICE_OPTIONS.map((o) => (
                        <label
                          key={o.id}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer ${
                            modal.ice === o.id ? 'border-[#b87414] bg-orange-50' : 'border-orange-100 hover:bg-orange-50/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="ice"
                            className="accent-[#b87414]"
                            checked={modal.ice === o.id}
                            onChange={() => setModal((m) => ({ ...m, ice: o.id }))}
                          />
                          <span className="text-sm font-semibold text-slate-800">{o.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Sugar */}
                  <div>
                    <p className="text-xs font-extrabold tracking-wide text-slate-700">MỨC ĐƯỜNG</p>
                    <div className="mt-3 space-y-2">
                      {SUGAR_OPTIONS.map((o) => (
                        <label
                          key={o.id}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-2 cursor-pointer ${
                            modal.sugar === o.id ? 'border-[#b87414] bg-orange-50' : 'border-orange-100 hover:bg-orange-50/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="sugar"
                            className="accent-[#b87414]"
                            checked={modal.sugar === o.id}
                            onChange={() => setModal((m) => ({ ...m, sugar: o.id }))}
                          />
                          <span className="text-sm font-semibold text-slate-800">{o.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Toppings */}
                  <div className="md:col-span-2">
                    <p className="text-xs font-extrabold tracking-wide text-slate-700">TOPPING THÊM</p>
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {TOPPING_OPTIONS.map((t) => {
                        const checked = modal.toppings.includes(t.id);
                        return (
                          <label
                            key={t.id}
                            className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-3 cursor-pointer ${
                              checked ? 'border-[#b87414] bg-orange-50' : 'border-orange-100 hover:bg-orange-50/50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                className="accent-[#b87414]"
                                checked={checked}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  setModal((m) => ({
                                    ...m,
                                    toppings: on ? [...m.toppings, t.id] : m.toppings.filter((x) => x !== t.id)
                                  }));
                                }}
                              />
                              <span className="text-sm font-semibold text-slate-800">{t.label}</span>
                            </div>
                            <span className="text-xs font-bold text-[#b87414]">+{Math.round(t.add).toLocaleString('vi-VN')}đ</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={closeModal}
                className="w-40 py-3 rounded-xl border border-orange-100 text-slate-700 font-semibold hover:bg-orange-50"
              >
                Hủy
              </button>
              <div className="flex-1 text-right">
                <p className="text-xs text-slate-500">Giá sau tuỳ chọn</p>
                <p className="text-lg font-extrabold text-[#b87414]">
                  {formatVnd(getUnitPrice(selectedProduct) + calcModifiersPrice(modal))}
                </p>
              </div>
              <button
                type="button"
                onClick={addConfiguredItemToCart}
                className="w-64 py-3 rounded-xl bg-[#b87414] text-white font-bold hover:opacity-95"
              >
                Thêm vào đơn hàng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Sales;

