const db = require('../config/db');

const sessionMemory = new Map();
const MAX_HISTORY_MESSAGES = 12;

const QUICK_REPLIES = [
  'Giới thiệu quán',
  'Xem menu và giá',
  'Gợi ý món',
  'Khuyến mãi hôm nay',
  'Đặt bàn / liên hệ'
];

const CATEGORY_ALIASES = {
  coffee: ['cà phê', 'coffee', 'caphe'],
  tea: ['trà', 'tea'],
  freeze: ['đá xay', 'freeze', 'ice blended'],
  cake: ['bánh', 'bánh ngọt', 'cake']
};

function formatVnd(value) {
  return `${Math.round(Number(value || 0)).toLocaleString('vi-VN')}đ`;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getSessionId(req) {
  const fromBody = String(req.body?.sessionId || '').trim();
  const fromHeader = String(req.get('x-chat-session-id') || '').trim();
  return fromBody || fromHeader || 'default-session';
}

function getSessionHistory(sessionId) {
  return sessionMemory.get(sessionId) || [];
}

function appendSessionMessage(sessionId, role, content) {
  const history = getSessionHistory(sessionId);
  history.push({ role, content, ts: Date.now() });
  sessionMemory.set(sessionId, history.slice(-MAX_HISTORY_MESSAGES));
}

function parseBudget(text) {
  const normalized = normalizeText(text).replace(/11/g, 'đ');
  const match = normalized.match(/(\d+[\.,]?\d*)\s*(k|nghìn|ngàn|đ|vnd)?/i);
  if (!match) return null;

  let amount = Number(String(match[1]).replace(',', '.'));
  if (!Number.isFinite(amount)) return null;

  const unit = String(match[2] || '').toLowerCase();
  if (unit === 'k' || unit === 'nghìn' || unit === 'ngàn') amount *= 1000;
  return Math.round(amount);
}

function detectCategoryKeyword(text) {
  const normalized = normalizeText(text);
  if (CATEGORY_ALIASES.cake.some((keyword) => normalized.includes(keyword))) return 'cake';
  if (CATEGORY_ALIASES.freeze.some((keyword) => normalized.includes(keyword))) return 'freeze';
  if (CATEGORY_ALIASES.tea.some((keyword) => normalized.includes(keyword))) return 'tea';
  if (CATEGORY_ALIASES.coffee.some((keyword) => normalized.includes(keyword))) return 'coffee';
  return null;
}

function matchesCategory(row, categoryKey) {
  const category = normalizeText(row.category_name || '');
  if (categoryKey === 'coffee') return category.includes('cà phê') || category.includes('coffee');
  if (categoryKey === 'tea') return category.includes('trà') || category.includes('tea');
  if (categoryKey === 'freeze') return category.includes('đá xay') || category.includes('freeze');
  if (categoryKey === 'cake') return category.includes('bánh');
  return false;
}

function isAskCheapest(text) {
  return /(rẻ nhất|thấp nhất|giá thấp nhất|món rẻ)/.test(normalizeText(text));
}

function isAskExpensive(text) {
  return /(đắt nhất|cao nhất|giá cao nhất|món đắt)/.test(normalizeText(text));
}

function isAskBestSelling(text) {
  return /(bán chạy nhất|best seller|món hot nhất|mua nhiều nhất)/.test(normalizeText(text));
}

function isAskPriceRange(text) {
  return /(dưới|tầm|khoảng|trên|<=|>=|bao nhiêu tiền|giá bao nhiêu)/.test(normalizeText(text));
}

function isAskCombo(text) {
  return /(combo|uống kèm|ăn kèm|kết hợp)/.test(normalizeText(text));
}

function isAskWeather(text) {
  return /(trời nóng|nóng quá|thời tiết nóng|trời lạnh|lạnh quá|trời mưa|mưa nên uống gì)/.test(normalizeText(text));
}

function isAskPreference(text) {
  return /(không uống cà phê|không uống cafe|không caffeine|ít ngọt|ngọt nhẹ|dễ uống|ít đắng|thích ngọt|không thích đắng)/.test(normalizeText(text));
}

function matchIntent(message) {
  const text = normalizeText(message);
  if (!text) return 'intro';
  if (/(combo|ăn kèm|uống kèm|set món|gợi ý combo)/.test(text)) return 'combo';
  if (/(buổi tối|tối nay|uống tối|evening|ban đêm)/.test(text)) return 'evening_recommendation';
  if (/(dễ uống|de uong|nhẹ|ít đắng|mới uống cà phê|người mới uống)/.test(text)) return 'easy_drink';
  if (isAskCombo(text) && isAskPriceRange(text) && parseBudget(text)) return 'combo_budget';
  if (isAskCombo(text)) return 'combo';
  if (isAskWeather(text)) return 'weather_suggestion';
  if (isAskPreference(text)) return 'preference_suggestion';
  if (isAskBestSelling(text)) return 'best_selling';
  if (isAskCheapest(text)) return 'cheapest';
  if (isAskExpensive(text)) return 'most_expensive';
  if (isAskPriceRange(text) && parseBudget(text)) return 'price_range';
  if (detectCategoryKeyword(text)) return 'category_lookup';
  if (/(giới thiệu|quán|cửa hàng|về quán|thông tin)/.test(text)) return 'intro';
  if (/(gợi ý|recommend|nên uống|uống gì|món nào|hợp|ngon nhất)/.test(text)) return 'suggest';
  if (/(menu|giá|báo giá|đồ uống|thực đơn|list món|danh sách|xem menu)/.test(text)) return 'menu';
  if (/(khuyến mãi|ưu đãi|voucher|giảm giá|sale|promotion|deal)/.test(text)) return 'promotion';
  if (/(đặt bàn|liên hệ|số điện thoại|hotline|địa chỉ|booking|gọi điện|call)/.test(text)) return 'contact';
  if (/(wifi|wi-fi|internet|mạng|pass wifi)/.test(text)) return 'wifi';
  if (/(thanh toán|pay|vnpay|momo|tiền mặt|thẻ|visa|master|qr|chuyển khoản)/.test(text)) return 'payment';
  if (/(giao hàng|ship|delivery|gửi hàng)/.test(text)) return 'delivery';
  if (/(giờ mở cửa|mấy giờ|đóng cửa|mở cửa|open|thời gian|opening)/.test(text)) return 'hours';
  if (/(chỗ ngồi|phòng máy lạnh|máy lạnh|yên tĩnh|học tập|làm việc|không gian)/.test(text)) return 'seating';
  return 'product_lookup';
}

async function loadMenuData() {
  const [rows] = await db.query(
    `SELECT
       p.product_id,
       p.product_name,
       p.sale_price,
       p.base_price,
       p.image_url,
       c.category_name,
       m.short_description,
       m.tags,
       m.sweet_level,
       m.has_caffeine,
       m.serving_type,
       m.recommended_for
     FROM products p
     LEFT JOIN categories c ON c.category_id = p.category_id
     LEFT JOIN product_chat_meta m ON m.product_id = p.product_id
     WHERE p.is_available = 1 OR p.is_available IS NULL
     ORDER BY p.sale_price ASC, p.product_name ASC`
  );
  return rows || [];
}

async function loadTopDrinks() {
  try {
    const [rows] = await db.query(
      `SELECT
         p.product_id,
         p.product_name,
         p.sale_price,
         p.base_price,
         p.image_url,
         c.category_name,
         SUM(oi.quantity) AS sold_qty,
         SUM(oi.quantity * COALESCE(oi.price_at_sale, p.sale_price, p.base_price, 0)) AS revenue
       FROM order_items oi
       JOIN orders o ON o.order_id = oi.order_id
       JOIN products p ON p.product_id = oi.product_id
       LEFT JOIN categories c ON c.category_id = p.category_id
       WHERE o.status = 'paid'
         AND (p.is_available = 1 OR p.is_available IS NULL)
         AND (c.category_name IS NULL OR c.category_name <> 'Bánh Ngọt')
       GROUP BY p.product_id, p.product_name, p.sale_price, p.base_price, p.image_url, c.category_name
       ORDER BY sold_qty DESC, revenue DESC, p.product_name ASC`
    );
    return rows || [];
  } catch (_err) {
    return [];
  }
}

async function loadPromotions() {
  try {
    const [rows] = await db.query(
      `SELECT promo_name, promo_type, description, discount_value, budget, start_date, end_date
       FROM promotions
       WHERE status = 1 OR status IS NULL
       ORDER BY start_date DESC
       LIMIT 5`
    );
    return rows || [];
  } catch (_err) {
    return [];
  }
}

function buildMenuItems(rows, limit = 4) {
  return rows.slice(0, limit).map((item) => ({
    title: item.product_name,
    subtitle: item.category_name || 'Món nước',
    price: formatVnd(item.sale_price ?? item.base_price ?? 0),
    imageUrl: item.image_url || ''
  }));
}

function buildTopDrinkItems(rows) {
  return rows.slice(0, 5).map((item, idx) => ({
    title: item.product_name,
    subtitle: item.category_name || 'Đồ uống bán chạy',
    rank: String(idx + 1),
    price: formatVnd(item.sale_price ?? item.base_price ?? 0),
    imageUrl: item.image_url || ''
  }));
}

function buildPromotionItems(rows) {
  if (!rows.length) {
    return [{ title: 'Khuyến mãi chưa cập nhật', subtitle: 'Hãy quay lại sau hoặc hỏi nhân viên quầy', price: '' }];
  }

  return rows.slice(0, 5).map((item) => ({
    title: item.promo_name,
    subtitle: item.description || `${item.promo_type || 'Ưu đãi'} ${item.discount_value || ''}`.trim(),
    price: item.discount_value ? `${item.promo_type === 'percent' ? `${item.discount_value}%` : formatVnd(item.discount_value)}` : ''
  }));
}

function buildSingleProductItems(rows, limit = 5) {
  return rows.slice(0, limit).map((item) => ({
    title: item.product_name,
    subtitle: item.category_name || 'Sản phẩm',
    meta: item.short_description || item.recommended_for || '',
    price: formatVnd(item.sale_price ?? item.base_price ?? 0),
    imageUrl: item.image_url || ''
  }));
}

function searchProductsByName(menu, message) {
  const normalized = normalizeText(message);
  return menu.filter((item) => normalized.includes(normalizeText(item.product_name)) || normalizeText(item.product_name).includes(normalized));
}

function buildMetaDrivenItems(rows, limit = 5) {
  return rows.slice(0, limit).map((item) => ({
    title: item.product_name,
    subtitle: item.category_name || 'Gợi ý theo nhu cầu',
    meta: item.short_description || item.recommended_for || item.tags || '',
    price: formatVnd(item.sale_price ?? item.base_price ?? 0),
    imageUrl: item.image_url || ''
  }));
}

function buildComboItems(drinks, cakes, budget = null) {
  const combos = [];

  drinks.slice(0, 8).forEach((drink) => {
    if (!cakes.length) {
      combos.push({
        title: drink.product_name,
        subtitle: 'Combo gợi ý',
        meta: drink.short_description || '',
        price: formatVnd(drink.sale_price ?? drink.base_price ?? 0),
        imageUrl: drink.image_url || ''
      });
      return;
    }

    cakes.slice(0, 5).forEach((cake) => {
      const total = Number(drink.sale_price ?? drink.base_price ?? 0) + Number(cake.sale_price ?? cake.base_price ?? 0);
      if (budget && total > budget) return;
      combos.push({
        title: `${drink.product_name} + ${cake.product_name}`,
        subtitle: 'Combo đồ uống + bánh ngọt',
        meta: 'Phù hợp cho khách muốn uống kèm đồ ngọt',
        price: formatVnd(total),
        imageUrl: drink.image_url || cake.image_url || ''
      });
    });
  });

  return combos.slice(0, 5);
}

function buildReply(intent, message, { menu, topDrinks, promotions }) {
  const featuredMenu = buildMenuItems(menu, 4);
  const categoryKey = detectCategoryKeyword(message);
  const budget = parseBudget(message);
  const matchedProducts = searchProductsByName(menu, message);
  const normalizedMessage = normalizeText(message);
  const nonCoffeeItems = menu.filter((item) => Number(item.has_caffeine || 0) === 0 && !matchesCategory(item, 'cake'));
  const lowSweetItems = menu.filter((item) => String(item.sweet_level || '').toLowerCase() === 'low');
  const easyDrinkItems = menu.filter((item) => {
    const haystack = [item.short_description, item.recommended_for, item.tags, item.product_name].map((v) => normalizeText(v)).join(' ');
    return /dễ uống|ngọt|nhẹ|ít đắng|mới uống|trẻ trung/.test(haystack);
  });
  const eveningItems = menu.filter((item) => Number(item.has_caffeine || 0) === 0 || matchesCategory(item, 'tea') || matchesCategory(item, 'cake'));
  const hotWeatherItems = menu.filter((item) => {
    const haystack = [item.short_description, item.tags, item.product_name, item.category_name].map((v) => normalizeText(v)).join(' ');
    return /thanh mát|mát lạnh|đá xay|trà|fruit|trái cây|lạnh/.test(haystack) || matchesCategory(item, 'tea') || matchesCategory(item, 'freeze');
  });
  const rainyWeatherItems = menu.filter((item) => {
    const haystack = [item.short_description, item.tags, item.product_name, item.category_name].map((v) => normalizeText(v)).join(' ');
    return /đậm vị|cà phê|ấm|béo/.test(haystack) || matchesCategory(item, 'coffee');
  });
  const cakeItems = menu.filter((item) => matchesCategory(item, 'cake'));
  const drinkItems = menu.filter((item) => !matchesCategory(item, 'cake'));
  const preferenceItems = menu.filter((item) => {
    const haystack = [item.short_description, item.recommended_for, item.tags, item.product_name].map((v) => normalizeText(v)).join(' ');
    const wantsNoCoffee = /(không uống cà phê|không uống cafe|không caffeine)/.test(normalizedMessage);
    const wantsLightSweet = /(ngọt nhẹ|ít ngọt|dễ uống|ít đắng)/.test(normalizedMessage);

    if (wantsNoCoffee && Number(item.has_caffeine || 0) !== 0) return false;
    if (wantsLightSweet) {
      return String(item.sweet_level || '').toLowerCase() !== 'high' || /dễ uống|nhẹ|ít đắng/.test(haystack);
    }
    return true;
  });

  switch (intent) {
    case 'intro':
      return {
        reply: 'Golden Roast Coffee là không gian cà phê ấm cúng, hiện đại, phù hợp làm việc, gặp gỡ và thư giãn. Quán phục vụ cà phê, trà, đá xay và bánh ngọt với phong cách thân thiện.',
        items: []
      };
    case 'menu':
      return {
        reply: 'Đây là một số món đang có trong menu kèm giá để bạn tham khảo.',
        items: featuredMenu,
        action: { label: 'Xem thêm menu', href: '/#products' }
      };
    case 'suggest':
    case 'best_selling':
      return {
        reply: topDrinks.length
          ? 'Đây là các món đồ uống được khách chọn nhiều nhất tại quán.'
          : 'Hiện chưa có đủ dữ liệu bán hàng để gợi ý món bán chạy nhất. Mình gửi bạn một vài món nổi bật trong menu nhé.',
        items: topDrinks.length ? buildTopDrinkItems(topDrinks) : featuredMenu
      };
    case 'combo': {
      const combos = buildComboItems(drinkItems, cakeItems);
      return {
        reply: combos.length
          ? 'Mình gợi ý cho bạn một vài combo đồ uống đi kèm bánh ngọt.'
          : 'Hiện mình chưa tạo được combo phù hợp từ menu hiện tại.',
        items: combos
      };
    }
    case 'combo_budget': {
      const combos = buildComboItems(drinkItems, cakeItems, budget);
      return {
        reply: combos.length
          ? `Mình tìm được một vài combo dưới ${formatVnd(budget)} cho bạn.`
          : `Hiện mình chưa tìm thấy combo nào dưới ${formatVnd(budget)}.`,
        items: combos
      };
    }
    case 'weather_suggestion': {
      const isHot = /(trời nóng|nóng quá|thời tiết nóng)/.test(normalizedMessage);
      const isRainyOrCold = /(trời lạnh|lạnh quá|trời mưa|mưa nên uống gì)/.test(normalizedMessage);
      const weatherItems = isHot ? hotWeatherItems : isRainyOrCold ? rainyWeatherItems : hotWeatherItems;
      return {
        reply: isHot
          ? 'Trời nóng thì bạn có thể ưu tiên các món thanh mát, dễ uống như trà hoặc đá xay.'
          : 'Nếu thời tiết mát hoặc mưa, bạn có thể thử các món đậm vị hơn để dễ thưởng thức.',
        items: buildMetaDrivenItems(weatherItems, 6)
      };
    }
    case 'preference_suggestion': {
      return {
        reply: preferenceItems.length
          ? 'Dựa trên sở thích bạn nói, mình gợi ý một vài món phù hợp dưới đây.'
          : 'Hiện mình chưa tìm thấy món thật sự phù hợp với sở thích đó trong dữ liệu hiện tại.',
        items: buildMetaDrivenItems(preferenceItems, 6)
      };
    }
    case 'easy_drink':
      return {
        reply: easyDrinkItems.length
          ? 'Nếu bạn thích đồ dễ uống, đây là một vài món phù hợp.'
          : 'Hiện mình chưa có nhiều dữ liệu cho nhóm đồ uống dễ uống, nhưng bạn có thể thử các món bán chạy nhé.',
        items: easyDrinkItems.length ? buildMetaDrivenItems(easyDrinkItems, 5) : (topDrinks.length ? buildTopDrinkItems(topDrinks) : featuredMenu)
      };
    case 'evening_recommendation':
      return {
        reply: eveningItems.length
          ? 'Nếu bạn muốn dùng món vào buổi tối, mình gợi ý các món nhẹ, ít caffeine hoặc dễ dùng kèm.'
          : 'Hiện mình chưa có dữ liệu gợi ý riêng cho buổi tối, bạn có thể tham khảo trà hoặc bánh ngọt nhé.',
        items: eveningItems.length ? buildMetaDrivenItems(eveningItems, 5) : buildSingleProductItems(menu.filter((item) => matchesCategory(item, 'tea') || matchesCategory(item, 'cake')), 5)
      };
    case 'combo':
      return {
        reply: cakeItems.length && drinkItems.length
          ? 'Mình gợi ý một vài combo đồ uống kèm bánh để bạn tham khảo.'
          : 'Hiện mình chưa có đủ dữ liệu để gợi ý combo hoàn chỉnh, nhưng bạn có thể chọn thêm bánh ngọt dùng kèm đồ uống nhé.',
        items: cakeItems.length && drinkItems.length ? buildComboItems(drinkItems, cakeItems) : buildSingleProductItems(menu, 4)
      };
    case 'cheapest': {
      const sorted = [...menu].sort((a, b) => Number(a.sale_price ?? a.base_price ?? 0) - Number(b.sale_price ?? b.base_price ?? 0));
      return {
        reply: 'Đây là các món có giá dễ tiếp cận nhất hiện tại.',
        items: buildSingleProductItems(sorted, 5)
      };
    }
    case 'most_expensive': {
      const sorted = [...menu].sort((a, b) => Number(b.sale_price ?? b.base_price ?? 0) - Number(a.sale_price ?? a.base_price ?? 0));
      return {
        reply: 'Đây là các món có giá cao nhất trong menu hiện tại.',
        items: buildSingleProductItems(sorted, 5)
      };
    }
    case 'price_range': {
      const filtered = menu.filter((item) => Number(item.sale_price ?? item.base_price ?? 0) <= Number(budget || 0));
      return {
        reply: filtered.length
          ? `Mình tìm thấy một số món có giá dưới ${formatVnd(budget)}.`
          : `Hiện mình chưa thấy món nào dưới ${formatVnd(budget)} trong menu.`,
        items: buildSingleProductItems(filtered, 6)
      };
    }
    case 'category_lookup': {
      const filtered = menu.filter((item) => matchesCategory(item, categoryKey));
      const categoryLabel = categoryKey === 'coffee' ? 'cà phê' : categoryKey === 'tea' ? 'trà' : categoryKey === 'freeze' ? 'đá xay' : 'bánh';
      return {
        reply: filtered.length
          ? `Quán hiện có một số món thuộc nhóm ${categoryLabel} bạn có thể tham khảo.`
          : `Hiện mình chưa tìm thấy món thuộc nhóm ${categoryLabel}.`,
        items: buildSingleProductItems(filtered, 6)
      };
    }
    case 'product_lookup': {
      if (matchedProducts.length) {
        return {
          reply: matchedProducts.length === 1
            ? `Mình đã tìm thấy món bạn hỏi trong menu.`
            : 'Mình tìm thấy một vài món gần giống với tên bạn hỏi.',
          items: buildSingleProductItems(matchedProducts, 6)
        };
      }

      if (/(không cà phê|không cafe|không caffeine)/.test(normalizedMessage)) {
        return {
          reply: nonCoffeeItems.length
            ? 'Nếu bạn không uống cà phê, đây là một vài món phù hợp.'
            : 'Hiện mình chưa tìm thấy món phù hợp với nhu cầu không cà phê.',
          items: buildMetaDrivenItems(nonCoffeeItems, 6)
        };
      }

      if (/(ít ngọt|không ngọt|low sugar)/.test(normalizedMessage)) {
        return {
          reply: lowSweetItems.length
            ? 'Đây là một vài món có mức ngọt thấp hơn để bạn tham khảo.'
            : 'Hiện mình chưa có dữ liệu món ít ngọt rõ ràng trong hệ thống.',
          items: buildMetaDrivenItems(lowSweetItems, 6)
        };
      }

      return {
        reply: 'Mình chưa tìm thấy đúng tên món bạn hỏi. Bạn có thể thử hỏi theo tên gần đúng, danh mục, khoảng giá hoặc nhu cầu như “không cà phê”, “ít ngọt” nhé.',
        items: []
      };
    }
    case 'promotion':
      return {
        reply: promotions.length
          ? 'Hiện có một số khuyến mãi nổi bật bạn có thể tham khảo.'
          : 'Hiện chưa có khuyến mãi đang hoạt động trong hệ thống.',
        items: buildPromotionItems(promotions)
      };
    case 'contact':
      return {
        reply: 'Bạn có thể liên hệ hoặc đặt bàn trực tiếp tại quán. Nếu cần hỗ trợ nhanh, hãy gọi hotline để được nhân viên hỗ trợ.',
        items: [
          { title: 'Hotline', subtitle: '0912 345 678', price: '' },
          { title: 'Địa chỉ', subtitle: 'Xem mục Cửa hàng trên website', price: '' },
          { title: 'Giờ mở cửa', subtitle: '07:00 - 22:00 mỗi ngày', price: '' }
        ]
      };
    case 'wifi':
      return {
        reply: 'Quán có wifi cho khách. Nếu bạn cần mật khẩu hoặc chỗ ngồi yên tĩnh để làm việc, hãy hỏi nhân viên quầy khi đến quán nhé.',
        items: []
      };
    case 'payment':
      return {
        reply: 'Quán hỗ trợ thanh toán linh hoạt. Bạn có thể hỏi nhân viên quầy để biết phương thức thanh toán áp dụng tại thời điểm hiện tại.',
        items: []
      };
    case 'delivery':
      return {
        reply: 'Nếu bạn muốn giao hàng, hãy đặt qua kênh hỗ trợ của quán hoặc liên hệ nhân viên để được hướng dẫn nhanh nhất.',
        items: []
      };
    case 'hours':
      return {
        reply: 'Quán mở cửa từ 07:00 đến 22:00 mỗi ngày.',
        items: []
      };
    case 'seating':
      return {
        reply: 'Quán có không gian phù hợp để ngồi làm việc, gặp gỡ và thư giãn. Nếu bạn muốn chỗ yên tĩnh hoặc khu vực có máy lạnh, hãy hỏi nhân viên quầy khi đến quán nhé.',
        items: []
      };
    default:
      return {
        reply: 'Mình có thể hỗ trợ bạn về tên món, giá món, món dưới bao nhiêu tiền, danh mục cà phê/trà/đá xay/bánh, gợi ý món, khuyến mãi và liên hệ.',
        items: []
      };
  }
}

exports.chat = async (req, res) => {
  try {
    const message = String(req.body?.message || '').trim();
    const sessionId = getSessionId(req);
    const intent = matchIntent(message);

    const [menu, topDrinks, promotions] = await Promise.all([
      loadMenuData(),
      loadTopDrinks(),
      loadPromotions()
    ]);

    appendSessionMessage(sessionId, 'user', message);

    const result = buildReply(intent, message, { menu, topDrinks, promotions });
    appendSessionMessage(sessionId, 'assistant', result.reply);

    return res.json({
      intent,
      reply: result.reply,
      items: result.items,
      action: result.action || null,
      suggestions: QUICK_REPLIES,
      sessionId,
      meta: {
        menuCount: menu.length,
        promotionCount: promotions.length,
        historyCount: getSessionHistory(sessionId).length
      }
    });
  } catch (error) {
    console.error('Chat controller error:', error);
    return res.status(500).json({
      message: 'Không thể xử lý chat lúc này.',
      suggestions: QUICK_REPLIES
    });
  }
};
