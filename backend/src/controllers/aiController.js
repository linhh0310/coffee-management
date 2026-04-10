const db = require('../config/db');
const { chatCompletion } = require('../services/llmService');

const clampInt = (v, min, max, fallback) => {
  const n = parseInt(String(v), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

function heuristicConfidence(sampleSize, minForFull = 30) {
  if (!sampleSize || sampleSize <= 0) return 0.2;
  return Math.min(0.95, 0.35 + (Math.min(sampleSize, minForFull) / minForFull) * 0.6);
}

async function persistInsight(type, payload, confidence) {
  await db.query(
    `INSERT INTO ai_insights (insight_type, prediction_target_date, content, confidence_score)
     VALUES (?, NULL, ?, ?)`,
    [type, JSON.stringify(payload), confidence]
  );
}

async function safePersist(type, payload, confidence) {
  try {
    await persistInsight(type, payload, confidence);
  } catch (e) {
    console.warn('[ai] Không ghi được ai_insights:', e.message);
  }
}

/** 1) Phân tích món bán chạy */
const getBestSellingAnalysis = async (req, res) => {
  const days = clampInt(req.query.days, 7, 365, 30);
  const persist = String(req.query.persist || '') === '1';

  try {
    const [rows] = await db.query(
      `
      SELECT
        p.product_id,
        p.product_name,
        COALESCE(SUM(oi.quantity), 0) AS total_qty,
        COALESCE(SUM(oi.quantity * oi.price_at_sale), 0) AS revenue
      FROM order_items oi
      JOIN orders o ON o.order_id = oi.order_id
      JOIN products p ON p.product_id = oi.product_id
      WHERE o.status = 'paid'
        AND o.created_at >= NOW() - INTERVAL ? DAY
      GROUP BY p.product_id, p.product_name
      ORDER BY total_qty DESC, revenue DESC
      LIMIT 20
      `,
      [days]
    );

    const [orderCountRows] = await db.query(
      `
      SELECT COUNT(*) AS cnt FROM orders
      WHERE status = 'paid' AND created_at >= NOW() - INTERVAL ? DAY
      `,
      [days]
    );
    const paidOrders = Number(orderCountRows[0]?.cnt || 0);

    const ranking = (rows || []).map((r, i) => ({
      rank: i + 1,
      product_id: r.product_id,
      product_name: r.product_name,
      total_qty: Number(r.total_qty) || 0,
      revenue: Number(r.revenue) || 0
    }));

    /** Top 5: % tăng trưởng so kỳ trước + dự báo nguyên liệu (recipes) */
    let trendCards = [];
    const topIds = ranking.slice(0, 5).map((x) => x.product_id);
    if (topIds.length) {
      const placeholders = topIds.map(() => '?').join(',');
      const growthMap = new Map();
      try {
        const [gRows] = await db.query(
          `
          SELECT oi.product_id,
            COALESCE(SUM(CASE WHEN o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) THEN oi.quantity ELSE 0 END), 0) AS q_now,
            COALESCE(SUM(CASE
              WHEN o.created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
               AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
              THEN oi.quantity ELSE 0 END), 0) AS q_prev
          FROM order_items oi
          JOIN orders o ON o.order_id = oi.order_id AND o.status = 'paid'
          WHERE oi.product_id IN (${placeholders})
          GROUP BY oi.product_id
          `,
          [days, days, days * 2, ...topIds]
        );
        for (const g of gRows || []) {
          growthMap.set(Number(g.product_id), {
            q_now: Number(g.q_now) || 0,
            q_prev: Number(g.q_prev) || 0
          });
        }
      } catch (e) {
        console.warn('[ai] growth query:', e.message);
      }

      const ingByProduct = new Map();
      try {
        const [ingRows] = await db.query(
          // Tiêu thụ thực tế kỳ hiện tại theo định mức
          `
          SELECT
            oi.product_id,
            i.ingredient_name,
            i.unit,
            COALESCE(SUM(oi.quantity * r.amount_needed), 0) AS consumed
          FROM order_items oi
          JOIN orders o ON o.order_id = oi.order_id AND o.status = 'paid'
            AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
          JOIN recipes r ON r.product_id = oi.product_id
          JOIN ingredients i ON i.ingredient_id = r.ingredient_id
          WHERE oi.product_id IN (${placeholders})
          GROUP BY oi.product_id, i.ingredient_id, i.ingredient_name, i.unit
          `,
          [days, ...topIds]
        );
        for (const row of ingRows || []) {
          const pid = Number(row.product_id);
          const list = ingByProduct.get(pid) || [];
          list.push({
            ingredient_name: row.ingredient_name,
            unit: row.unit,
            consumed: Number(row.consumed) || 0
          });
          ingByProduct.set(pid, list);
        }
      } catch (e) {
        if (e.code !== 'ER_NO_SUCH_TABLE') console.warn('[ai] recipes/ingredients:', e.message);
      }

      const [metaRows] = await db.query(
        `SELECT product_id, image_url FROM products WHERE product_id IN (${placeholders})`,
        topIds
      );
      const imageMap = new Map((metaRows || []).map((m) => [Number(m.product_id), m.image_url || null]));

      const fmtAmt = (n) => {
        const x = Number(n) || 0;
        if (x >= 100) return Math.round(x).toLocaleString('vi-VN');
        return x.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
      };

      trendCards = ranking.slice(0, 5).map((r) => {
        const g = growthMap.get(r.product_id) || { q_now: r.total_qty, q_prev: 0 };
        let growth_pct = 0;
        if (g.q_prev > 0) growth_pct = Math.round(((g.q_now - g.q_prev) / g.q_prev) * 100);
        else if (g.q_now > 0) growth_pct = 100;

        const ingList = ingByProduct.get(r.product_id) || [];
        ingList.sort((a, b) => b.consumed - a.consumed);
        const topIng = ingList[0];
        const factor = 7 / Math.max(1, days);
        let ingredient_pill = null;
        if (topIng && topIng.consumed > 0) {
          const est = topIng.consumed * factor;
          ingredient_pill = `${topIng.ingredient_name}: +${fmtAmt(est)} ${topIng.unit || ''}/tuần`.trim();
        }

        return {
          rank: r.rank,
          product_id: r.product_id,
          product_name: r.product_name,
          image_url: imageMap.get(r.product_id) || null,
          total_qty: r.total_qty,
          revenue: r.revenue,
          growth_pct,
          ingredient_pill
        };
      });
    }

    const top = ranking[0] || null;
    const dataJson = JSON.stringify({ days, paid_orders: paidOrders, ranking: ranking.slice(0, 10) });

    const system =
      'Bạn là chuyên gia phân tích F&B cho quán cà phê tại Việt Nam. Trả lời bằng tiếng Việt, ngắn gọn, thực tế.';

    let llmText = null;
    try {
      llmText = await chatCompletion(
        system,
        `Dữ liệu bán hàng ${days} ngày gần nhất (đơn đã thanh toán: ${paidOrders}).\n` +
          `Top món (JSON): ${dataJson}\n\n` +
          `Hãy:\n` +
          `1) Nêu món bán chạy nhất và gợi ý ngắn vì sao có thể bán tốt.\n` +
          `2) Đề xuất 2–3 hành động kinh doanh (upsell, trưng bày, combo nhẹ).\n` +
          `Viết 4–8 câu, có thể dùng gạch đầu dòng.`
      );
    } catch (e) {
      llmText = null;
    }

    let aiNarrative = llmText;
    if (!aiNarrative) {
      aiNarrative =
        (top
          ? `Món bán chạy nhất trong ${days} ngày: **${top.product_name}** (${top.total_qty} ly/phần). `
          : 'Chưa đủ dữ liệu đơn hàng trong khoảng thời gian này. ') +
        (paidOrders < 5
          ? 'Khi có thêm đơn hàng, phân tích AI sẽ chi tiết hơn. Thêm OPENAI_API_KEY vào .env để dùng LLM.'
          : 'Thêm OPENAI_API_KEY vào file .env backend để bật phân tích bằng AI (OpenAI).');
    }

    const confidence = heuristicConfidence(paidOrders, 40);

    const payload = {
      insight_type: 'best_selling',
      period_days: days,
      paid_orders: paidOrders,
      ranking,
      trend_cards: trendCards,
      generated_at: new Date().toISOString(),
      ai_analysis: aiNarrative,
      llm_used: Boolean(llmText)
    };

    if (persist) {
      await safePersist('best_selling', payload, confidence);
    }

    return res.json({ ...payload, confidence });
  } catch (error) {
    console.error('getBestSellingAnalysis error:', error);
    return res.status(500).json({ message: 'Lỗi phân tích món bán chạy', error: error.message });
  }
};

/** 2) Gợi ý combo — cặp món hay mua cùng (market basket) + AI đề xuất khuyến mãi */
const getComboSuggestions = async (req, res) => {
  const days = clampInt(req.query.days, 14, 180, 60);
  const persist = String(req.query.persist || '') === '1';

  try {
    const [pairs] = await db.query(
      `
      SELECT
        p1.product_id AS id_a,
        p2.product_id AS id_b,
        p1.product_name AS product_a,
        p2.product_name AS product_b,
        COUNT(DISTINCT oi1.order_id) AS pair_orders
      FROM order_items oi1
      INNER JOIN order_items oi2
        ON oi1.order_id = oi2.order_id
        AND oi1.product_id < oi2.product_id
      JOIN orders o ON o.order_id = oi1.order_id AND o.status = 'paid'
      JOIN products p1 ON p1.product_id = oi1.product_id
      JOIN products p2 ON p2.product_id = oi2.product_id
      WHERE o.created_at >= NOW() - INTERVAL ? DAY
      GROUP BY oi1.product_id, oi2.product_id, p1.product_name, p2.product_name
      HAVING pair_orders >= 1
      ORDER BY pair_orders DESC
      LIMIT 15
      `,
      [days]
    );

    const pairsList = (pairs || []).map((r) => ({
      id_a: Number(r.id_a),
      id_b: Number(r.id_b),
      product_a: r.product_a,
      product_b: r.product_b,
      pair_orders: Number(r.pair_orders) || 0
    }));

    let comboCards = [];
    try {
      for (const p of pairsList.slice(0, 2)) {
        const [pr] = await db.query(
          `
          SELECT product_id, product_name, COALESCE(sale_price, base_price, 0) AS price
          FROM products WHERE product_id IN (?, ?)
          `,
          [p.id_a, p.id_b]
        );
        const byId = Object.fromEntries((pr || []).map((x) => [Number(x.product_id), x]));
        const pa = byId[p.id_a];
        const pb = byId[p.id_b];
        if (!pa || !pb) continue;
        const sum = (Number(pa.price) || 0) + (Number(pb.price) || 0);
        const discount = 0.1;
        comboCards.push({
          id_a: p.id_a,
          id_b: p.id_b,
          title: `Combo ${p.product_a} + ${p.product_b}`,
          product_a: p.product_a,
          product_b: p.product_b,
          price_regular: Math.round(sum),
          price_combo: Math.max(0, Math.round(sum * (1 - discount))),
          discount_pct: 10,
          pair_orders: p.pair_orders,
          match_score: Math.min(99, 65 + Math.min(34, p.pair_orders * 2))
        });
      }
    } catch (e) {
      console.warn('[ai] combo_cards:', e.message);
    }

    const [orderCountRows] = await db.query(
      `SELECT COUNT(*) AS cnt FROM orders WHERE status = 'paid' AND created_at >= NOW() - INTERVAL ? DAY`,
      [days]
    );
    const paidOrders = Number(orderCountRows[0]?.cnt || 0);

    const system =
      'Bạn là chuyên gia marketing F&B. Trả lời tiếng Việt, súc tích, đề xuất combo thực tế cho quán cà phê.';

    let llmText = null;
    try {
      llmText = await chatCompletion(
        system,
        `Dữ liệu cặp sản phẩm thường mua cùng nhau trong ${days} ngày (số đơn có cả hai món trong một hóa đơn):\n` +
          JSON.stringify(pairsList.slice(0, 10), null, 0) +
          `\nTổng đơn đã thanh toán trong khoảng này: ${paidOrders}.\n\n` +
          `Hãy:\n` +
          `1) Chọn 1–3 cặp tiềm năng nhất để làm combo.\n` +
          `2) Với mỗi combo gợi ý mức giảm % hợp lý (ví dụ 8–12%) và tên gọi combo.\n` +
          `3) Một dòng CTA ngắn cho nhân viên thu ngân.\n` +
          `Format: dùng gạch đầu dòng, dễ đọc.`
      );
    } catch (_) {
      llmText = null;
    }

    let aiNarrative = llmText;
    if (!aiNarrative) {
      const best = pairsList[0];
      aiNarrative = best
        ? `Cặp mua cùng nhiều nhất: **${best.product_a}** + **${best.product_b}** (${best.pair_orders} đơn). Gợi ý: combo giảm 10% cho cặp này. Thêm OPENAI_API_KEY để AI soạn nội dung chi tiết.`
        : 'Chưa đủ cặp sản phẩm trùng trong một đơn — cần thêm đơn hàng có từ 2 món trở lên.';
    }

    const confidence = heuristicConfidence(pairsList.length * 2 + paidOrders, 50);

    const payload = {
      insight_type: 'combo_recommendation',
      period_days: days,
      paid_orders: paidOrders,
      frequent_pairs: pairsList,
      combo_cards: comboCards,
      ai_analysis: aiNarrative,
      llm_used: Boolean(llmText)
    };

    if (persist) {
      await safePersist('combo_recommendation', payload, confidence);
    }

    return res.json({ ...payload, confidence });
  } catch (error) {
    console.error('getComboSuggestions error:', error);
    return res.status(500).json({ message: 'Lỗi gợi ý combo', error: error.message });
  }
};

/** 3) Dự đoán giờ đông — dựa trên lịch sử + AI diễn giải */
const getHourlyForecast = async (req, res) => {
  const days = clampInt(req.query.days, 7, 90, 30);
  const persist = String(req.query.persist || '') === '1';

  try {
    const [hourRows] = await db.query(
      `
      SELECT
        HOUR(o.created_at) AS hour_num,
        COUNT(*) AS order_cnt
      FROM orders o
      WHERE o.status = 'paid'
        AND o.created_at >= NOW() - INTERVAL ? DAY
      GROUP BY HOUR(o.created_at)
      ORDER BY hour_num
      `,
      [days]
    );

    const byHour = Array.from({ length: 24 }, (_, h) => {
      const found = (hourRows || []).find((r) => Number(r.hour_num) === h);
      return { hour: h, orders: found ? Number(found.order_cnt) : 0 };
    });

    const totalOrders = byHour.reduce((s, x) => s + x.orders, 0);
    const avgPerHour = totalOrders / 24;
    const predictedScores = byHour.map((x) => ({
      hour: x.hour,
      historical_orders: x.orders,
      /** Điểm dự đoán đơn giản: trọng số lịch sử + nền trung bình */
      score: x.orders * 0.75 + avgPerHour * 0.25
    }));

    const peakPredicted = [...predictedScores]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => ({
        hour: x.hour,
        label: `${String(x.hour).padStart(2, '0')}:00–${String((x.hour + 1) % 24).padStart(2, '0')}:00`,
        score: Math.round(x.score * 100) / 100
      }));

    const system =
      'Bạn là quản lý vận hành quán cà phê. Trả lời tiếng Việt, thực tế, giúp xếp ca và chuẩn bị nhân sự/nguyên liệu.';

    const histSummary = byHour
      .filter((x) => x.orders > 0)
      .map((x) => `${x.hour}h: ${x.orders} đơn`)
      .join(', ');

    let llmText = null;
    try {
      llmText = await chatCompletion(
        system,
        `Trong ${days} ngày gần nhất, phân bố đơn theo giờ (đơn đã thanh toán): ${histSummary || 'chưa có đơn'}.\n` +
          `Tổng đơn: ${totalOrders}. Top giờ dự đoán đông (theo mô hình đơn giản): ${JSON.stringify(peakPredicted)}.\n\n` +
          `Hãy:\n` +
          `1) Mô tả khung giờ dự kiến đông khách.\n` +
          `2) Gợi ý 3–5 việc cần làm (nhân sự, pha chế, dự trù).\n` +
          `Ngắn gọn, dùng gạch đầu dòng.`
      );
    } catch (_) {
      llmText = null;
    }

    let aiNarrative = llmText;
    if (!aiNarrative) {
      aiNarrative =
        peakPredicted.length && totalOrders > 0
          ? `Dựa trên lịch sử ${days} ngày, các khung giờ có nhiều đơn nhất: ${peakPredicted
              .map((p) => `${p.hour}h`)
              .join(', ')}. Gợi ý: tăng nhân sự ca trước/sau giờ cao điểm 30 phút. Thêm OPENAI_API_KEY để phân tích chi tiết bằng LLM.`
          : 'Chưa đủ đơn hàng để dự đoán giờ đông — hãy thu thập thêm dữ liệu bán.';
    }

    const confidence = heuristicConfidence(totalOrders, 60);

    const chartStart = 7;
    const chartEnd = 18;
    const chart_series = [];
    for (let h = chartStart; h <= chartEnd; h += 1) {
      const hist = byHour[h]?.orders ?? 0;
      const pred = predictedScores.find((x) => x.hour === h);
      const forecastVal = pred ? Math.max(0, Math.round(pred.score)) : 0;
      chart_series.push({
        hour: h,
        label: `${String(h).padStart(2, '0')}:00`,
        avg_orders: hist,
        forecast_orders: forecastVal
      });
    }

    const payload = {
      insight_type: 'hourly_forecast',
      period_days: days,
      total_paid_orders: totalOrders,
      hourly_history: byHour,
      predicted_peak_hours: peakPredicted,
      chart_window: { start: chartStart, end: chartEnd },
      chart_series,
      ai_analysis: aiNarrative,
      llm_used: Boolean(llmText)
    };

    if (persist) {
      await safePersist('hourly_forecast', payload, confidence);
    }

    return res.json({ ...payload, confidence });
  } catch (error) {
    console.error('getHourlyForecast error:', error);
    return res.status(500).json({ message: 'Lỗi dự đoán giờ đông', error: error.message });
  }
};

const listInsightHistory = async (req, res) => {
  const limit = clampInt(req.query.limit, 1, 100, 30);
  const type = req.query.type ? String(req.query.type).slice(0, 50) : null;

  try {
    let sql = `SELECT insight_id, insight_type, prediction_target_date, content, confidence_score, created_at
               FROM ai_insights`;
    const params = [];
    if (type) {
      sql += ' WHERE insight_type = ?';
      params.push(type);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const [rows] = await db.query(sql, params);
    return res.json({
      items: (rows || []).map((r) => {
        let c = r.content;
        if (typeof c === 'string') {
          try {
            c = JSON.parse(c);
          } catch (_) {
            /* giữ nguyên chuỗi */
          }
        }
        return {
          insight_id: r.insight_id,
          insight_type: r.insight_type,
          prediction_target_date: r.prediction_target_date,
          content: c,
          confidence_score: r.confidence_score,
          created_at: r.created_at
        };
      })
    });
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ items: [], message: 'Chưa có bảng ai_insights — chạy migration hoặc init-db.' });
    }
    console.error('listInsightHistory error:', error);
    return res.status(500).json({ message: 'Lỗi đọc lịch sử AI', error: error.message });
  }
};

module.exports = {
  getBestSellingAnalysis,
  getComboSuggestions,
  getHourlyForecast,
  listInsightHistory
};
