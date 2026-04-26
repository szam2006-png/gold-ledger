/**
 * pages/daily.js — دفتر اليومية (ورقة المدير)
 *
 * شاشة واحدة تحاكي ورقة المدير الورقية:
 *   - المبيعات (جدول: مبلغ + وزن لكل عيار + الدفع)
 *   - المشتريات (شراء كسر من الزبائن: نفس فكرة المبيعات)
 *   - المصاريف (قائمة بسيطة)
 *   - ملخص اليوم (تلقائي)
 *   - أرصدة نهاية اليوم (فعلي vs متوقع)
 *   - صورة الورقة الورقية (اختياري)
 *   - حفظ اليومية (إقفال اليوم)
 */
import { daily, expenses, dailyMeta } from "../db.js?v=11";
import {
  $, el, money, num, todayISO, nowHHMM, formatDateLong, toast, confirmAsk,
  openModal, field, emptyState,
} from "../utils.js?v=11";

const KARATS = ["18", "21", "22", "24"];
const SILVER = ["925", "999"];
const EXPENSE_CATS = [
  "كهرباء", "مياه", "هاتف وإنترنت", "إيجار",
  "صيانة", "ضيافة", "مواصلات", "قرطاسية",
  "ضريبة شبكة", "أخرى",
];

let state = {
  date: todayISO(),
};

export function renderDaily(container) {
  state.date = state.date || todayISO();
  render(container);
}

function render(container) {
  container.innerHTML = "";
  container.appendChild(buildHeader());

  const closed = dailyMeta.isClosed(state.date);
  if (closed) container.appendChild(buildClosedBanner());

  container.appendChild(buildGoldPrices(closed));

  container.appendChild(buildSection({
    icon: "💰", title: "المبيعات", type: "sale", closed,
    addLabel: "+ عملية بيع",
  }));

  container.appendChild(buildSection({
    icon: "🛍️", title: "المشتريات (شراء كسر من زبائن)", type: "purchase", closed,
    addLabel: "+ عملية شراء",
  }));

  container.appendChild(buildExpensesSection(closed));
  container.appendChild(buildSummary());
  container.appendChild(buildBalances(closed));
  container.appendChild(buildPaperPhoto(closed));
  container.appendChild(buildSaveBar(closed, container));
}

/* ───────── Gold prices section ───────── */
function buildGoldPrices(closed) {
  const meta = dailyMeta.byDate(state.date) || {};
  const prices = meta.gold_prices || { "18": 0, "21": 0, "22": 0, "24": 0 };
  const card = el("div", { class: "card", style: "margin-bottom:16px" });
  card.appendChild(el("h3", {
    style: "margin:0 0 12px;font-family:var(--font-display);font-size:20px",
  }, "📊  سعر الجرام اليوم"));
  card.appendChild(el("div", { class: "muted", style: "font-size:13px;margin-bottom:12px" },
    "أدخل سعر جرام كل عيار في بداية اليوم — يُستخدم لحساب المصنعية تلقائياً."));

  const grid = el("div", { class: "kpi-grid" });
  for (const k of KARATS) {
    grid.appendChild(el("div", { class: "kpi-card" }, [
      el("div", { class: "kpi-label" }, "عيار " + k),
      el("input", {
        class: "input", type: "number", step: "0.01", inputmode: "decimal",
        value: prices[k] || "", placeholder: "0.00",
        disabled: closed,
        style: "font-size:18px;font-weight:600;text-align:center",
        onchange: (e) => {
          const newPrices = { ...prices, [k]: Number(e.target.value) || 0 };
          dailyMeta.upsert(state.date, { gold_prices: newPrices });
          render($("#view"));
        },
      }),
      el("div", { class: "muted", style: "font-size:11px;text-align:center;margin-top:2px" }, "ر.س / جم"),
    ]));
  }
  card.appendChild(grid);
  return card;
}

/* ───────── Header ───────── */
function buildHeader() {
  const dayName = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { weekday: "long" })
    .format(parseDate(state.date));
  return el("div", { class: "page-head" }, [
    el("span", { class: "page-kicker" }, "📅 يومية"),
    el("h1", { class: "page-title" }, dayName + " " + state.date),
    el("div", { class: "between mb-12", style: "margin-top:14px;flex-wrap:wrap;gap:10px" }, [
      el("div", { class: "date-picker" }, [
        el("label", { class: "text-mute" }, "التاريخ:"),
        el("input", {
          class: "input", type: "date", value: state.date,
          onchange: (e) => { state.date = e.target.value; render($("#view")); },
        }),
        el("button", {
          class: "btn btn-sm btn-ghost",
          onclick: () => { state.date = todayISO(); render($("#view")); },
        }, "اليوم"),
      ]),
      el("div", { style: "display:flex;gap:8px" }, [
        el("button", { class: "btn btn-ghost btn-sm",
          onclick: () => navigateDay(-1) }, "← يوم سابق"),
        el("button", { class: "btn btn-ghost btn-sm",
          onclick: () => navigateDay(1) }, "يوم تالي →"),
        el("button", { class: "btn btn-ghost btn-sm",
          onclick: () => window.print() }, "🖨"),
      ]),
    ]),
  ]);
}

function navigateDay(diff) {
  const d = parseDate(state.date);
  d.setDate(d.getDate() + diff);
  state.date = d.toISOString().slice(0, 10);
  render($("#view"));
}

function parseDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function buildClosedBanner() {
  const meta = dailyMeta.byDate(state.date);
  return el("div", {
    class: "card",
    style: "background:#fcf8f0;border-inline-start:4px solid var(--gold);margin-bottom:16px",
  }, [
    el("div", { class: "between" }, [
      el("div", {}, [
        el("strong", {}, "🔒 يومية مقفلة"),
        el("div", { class: "muted", style: "font-size:13px;margin-top:4px" },
          "أُقفلت في: " + (meta?.closed_at || "").slice(0, 19).replace("T", " ")),
      ]),
      el("button", {
        class: "btn btn-sm btn-ghost",
        onclick: () => {
          if (confirmAsk("فتح اليومية يسمح بالتعديل. متابعة؟")) {
            dailyMeta.reopen(state.date);
            render($("#view"));
            toast("تم فتح اليومية");
          }
        },
      }, "🔓 إعادة فتح"),
    ]),
  ]);
}

/* ───────── Sales / Purchases section ───────── */
function buildSection({ icon, title, type, closed, addLabel }) {
  const rows = (type === "sale" ? daily.salesByDate(state.date) : daily.purchasesByDate(state.date));
  const card = el("div", { class: "card", style: "margin-bottom:16px" });
  card.appendChild(el("div", { class: "between mb-12" }, [
    el("h3", { style: "margin:0;font-family:var(--font-display);font-size:20px" },
      icon + "  " + title),
    closed ? null : el("button", {
      class: "btn btn-primary",
      onclick: () => openEntryModal(type, () => render($("#view"))),
    }, addLabel),
  ]));

  if (!rows.length) {
    card.appendChild(el("div", { class: "text-mute", style: "padding:24px 12px;text-align:center;font-size:14px" },
      type === "sale"
        ? "لا توجد مبيعات اليوم. اضغط «+ عملية بيع»."
        : "لا توجد مشتريات اليوم. اضغط «+ عملية شراء»."));
    return card;
  }

  const wrap = el("div", { class: "ledger-wrap" });
  const table = el("table", { class: "ledger" });
  table.appendChild(el("thead", {}, el("tr", {}, [
    el("th", {}, "#"),
    el("th", {}, "الوقت"),
    el("th", { class: "num" }, "المبلغ"),
    el("th", { class: "num" }, "18"),
    el("th", { class: "num" }, "21"),
    el("th", { class: "num" }, "22"),
    el("th", { class: "num" }, "24"),
    el("th", { class: "num" }, "925"),
    el("th", { class: "num" }, "999"),
    el("th", {}, "الدفع"),
    el("th", {}, "ملاحظة"),
    closed ? null : el("th", {}, ""),
  ].filter(Boolean))));

  const tb = el("tbody");
  let i = 1;
  rows.forEach(r => {
    tb.appendChild(el("tr", {}, [
      el("td", {}, String(i++)),
      el("td", {}, r.time || "—"),
      el("td", { class: "num" }, el("strong", {}, money(r.amount))),
      cellW(r.gold_18),
      cellW(r.gold_21),
      cellW(r.gold_22),
      cellW(r.gold_24),
      cellW(r.silver_925),
      cellW(r.silver_999),
      el("td", {}, payChip(r.payment_method)),
      el("td", { class: "muted" }, r.note || "—"),
      closed ? null : el("td", {}, el("button", {
        class: "btn btn-sm btn-danger",
        onclick: () => {
          if (confirmAsk("حذف هذه العملية؟")) {
            daily.remove(r.id);
            render($("#view"));
            toast("تم الحذف");
          }
        },
      }, "حذف")),
    ].filter(Boolean)));
  });
  table.appendChild(tb);

  // Footer with totals
  const sum = computeSum(rows);
  table.appendChild(el("tfoot", {}, el("tr", {}, [
    el("td", { colspan: 2 }, "الإجمالي"),
    el("td", { class: "num" }, el("strong", {}, money(sum.total))),
    cellW(sum.gold_18, true),
    cellW(sum.gold_21, true),
    cellW(sum.gold_22, true),
    cellW(sum.gold_24, true),
    cellW(sum.silver_925, true),
    cellW(sum.silver_999, true),
    el("td", { colspan: 2 }, ""),
    closed ? null : el("td", {}, ""),
  ].filter(Boolean))));

  wrap.appendChild(table);
  card.appendChild(wrap);

  // Quick weight summary
  const weightLines = [];
  for (const k of KARATS) if (sum["gold_" + k] > 0) weightLines.push(num(sum["gold_" + k]) + " جم " + k);
  for (const p of SILVER) if (sum["silver_" + p] > 0) weightLines.push(num(sum["silver_" + p]) + " جم فضة " + p);
  if (weightLines.length) {
    card.appendChild(el("div", {
      style: "margin-top:10px;padding:10px 12px;background:var(--panel);border-radius:6px;font-size:14px",
    }, [
      el("strong", {}, "الوزن: "),
      el("span", { class: "text-mute" }, weightLines.join("  ·  ")),
    ]));
  }
  return card;
}

function cellW(value, bold) {
  const v = n(value);
  if (!v) return el("td", { class: "num text-mute" }, "—");
  const display = num(v);
  const inner = bold ? el("strong", {}, display) : display;
  return el("td", { class: "num" }, inner);
}
function payChip(pm) {
  const isCash = pm === "cash";
  return el("span", {
    class: "type-chip " + (isCash ? "type-in" : "type-out"),
  }, isCash ? "💰 كاش" : "💳 شبكة");
}
function n(v) { const x = Number(v); return isFinite(x) ? x : 0; }
function computeSum(rows) {
  const sum = { total: 0, gold_18: 0, gold_21: 0, gold_22: 0, gold_24: 0, silver_925: 0, silver_999: 0 };
  for (const r of rows) {
    sum.total      += n(r.amount);
    sum.gold_18    += n(r.gold_18);
    sum.gold_21    += n(r.gold_21);
    sum.gold_22    += n(r.gold_22);
    sum.gold_24    += n(r.gold_24);
    sum.silver_925 += n(r.silver_925);
    sum.silver_999 += n(r.silver_999);
  }
  return sum;
}

/* ───────── Expenses section ───────── */
function buildExpensesSection(closed) {
  const rows = expenses.byDailyDate(state.date);
  const card = el("div", { class: "card", style: "margin-bottom:16px" });
  card.appendChild(el("div", { class: "between mb-12" }, [
    el("h3", { style: "margin:0;font-family:var(--font-display);font-size:20px" }, "💸  المصاريف"),
    closed ? null : el("button", {
      class: "btn btn-primary",
      onclick: () => openExpenseModal(() => render($("#view"))),
    }, "+ مصروف"),
  ]));

  if (!rows.length) {
    card.appendChild(el("div", { class: "text-mute", style: "padding:18px 12px;text-align:center;font-size:14px" },
      "لا توجد مصاريف اليوم."));
    return card;
  }

  const list = el("div", { style: "display:flex;flex-direction:column;gap:6px" });
  let total = 0;
  for (const e of rows) {
    total += n(e.amount);
    list.appendChild(el("div", {
      style: "display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--panel);border-radius:6px",
    }, [
      el("div", {}, [
        el("strong", {}, "• " + (e.category || "أخرى") + ": "),
        el("span", { class: "val-neg" }, money(e.amount)),
        el("span", { class: "muted", style: "font-size:12px;margin-inline-start:8px" },
          (e.payment_method === "bank" || e.payment_method === "network") ? "(بنك)" : "(كاش)"),
        e.description ? el("div", { class: "muted", style: "font-size:12px;margin-top:2px" }, e.description) : null,
      ]),
      closed ? null : el("button", {
        class: "btn btn-sm btn-danger",
        onclick: () => {
          if (confirmAsk("حذف هذا المصروف؟")) {
            expenses.remove(e.id);
            render($("#view"));
            toast("تم الحذف");
          }
        },
      }, "حذف"),
    ]));
  }
  card.appendChild(list);

  card.appendChild(el("div", {
    style: "margin-top:10px;padding:10px 12px;background:var(--panel);border-radius:6px;text-align:end",
  }, [
    el("strong", {}, "المجموع: "),
    el("span", { class: "val-neg" }, money(total)),
  ]));
  return card;
}

/* ───────── Day summary + Manufacturing analysis ───────── */
function buildSummary() {
  const sum = daily.summaryForDate(state.date);
  const expSum = expenses.byDailyDate(state.date).reduce((s, e) => s + n(e.amount), 0);
  const card = el("div", { class: "card", style: "margin-bottom:16px" });
  card.appendChild(el("h3", {
    style: "margin:0 0 14px;font-family:var(--font-display);font-size:20px",
  }, "📊  ملخص اليوم"));

  const grid = el("div", { class: "kpi-grid" });
  grid.appendChild(kpiBox("💰 المبيعات", money(sum.sales.total), "val-pos"));
  grid.appendChild(kpiBox("🛍️ المشتريات", money(sum.purchases.total), "val-neg"));
  grid.appendChild(kpiBox("💸 المصاريف", money(expSum), "val-neg"));
  card.appendChild(grid);

  if (sum.sales.total > 0) {
    card.appendChild(el("div", { style: "margin-top:14px" }, [
      el("h4", { style: "margin:0 0 8px" }, "💵 توزيع المبيعات"),
      el("div", {
        style: "display:flex;gap:10px;align-items:center;padding:10px 12px;background:var(--panel);border-radius:6px",
      }, [
        el("div", { style: "flex:1" }, [
          el("strong", {}, "كاش: "), el("span", { class: "val-pos" }, money(sum.sales.cash)),
          el("span", { class: "muted", style: "margin-inline-start:6px" },
            "(" + sum.sales.cashPct.toFixed(0) + "%)"),
        ]),
        el("div", { style: "flex:1" }, [
          el("strong", {}, "شبكة: "), el("span", { class: "val-pos" }, money(sum.sales.network)),
          el("span", { class: "muted", style: "margin-inline-start:6px" },
            "(" + sum.sales.netPct.toFixed(0) + "%)"),
        ]),
      ]),
    ]));
  }

  // ⚖️ تحليل المصنعية
  const meta = dailyMeta.byDate(state.date) || {};
  const prices = meta.gold_prices || { "18": 0, "21": 0, "22": 0, "24": 0 };
  const hasAnyPrice = KARATS.some(k => n(prices[k]) > 0);

  if ((sum.sales.total > 0 || sum.purchases.total > 0) && hasAnyPrice) {
    card.appendChild(el("h4", { style: "margin:18px 0 8px" }, "⚖️  تحليل المصنعية"));
    const analysisGrid = el("div", { class: "grid-2" });
    if (sum.sales.total > 0)     analysisGrid.appendChild(buildManufacturingBox("sale", sum.sales, prices));
    if (sum.purchases.total > 0) analysisGrid.appendChild(buildManufacturingBox("purchase", sum.purchases, prices));
    card.appendChild(analysisGrid);
  } else if ((sum.sales.total > 0 || sum.purchases.total > 0) && !hasAnyPrice) {
    card.appendChild(el("div", {
      style: "margin-top:14px;padding:10px;background:#fcf8f0;border-inline-start:4px solid var(--gold);border-radius:6px;font-size:13px;color:var(--ink-mute)",
    }, "💡 أدخل أسعار الجرام في الأعلى لعرض تحليل المصنعية."));
  }
  return card;
}

function buildManufacturingBox(type, side, prices) {
  // قيمة الذهب الخام = Σ (وزن العيار × سعر العيار)
  let goldValue = 0, totalWeight = 0;
  const lines = [];
  for (const k of KARATS) {
    const w = n(side.gold[k]);
    if (!w) continue;
    const p = n(prices[k]);
    const v = w * p;
    goldValue += v;
    totalWeight += w;
    lines.push({ k, w, p, v });
  }

  const isSale = type === "sale";
  const diff = side.total - goldValue;          // للمبيعات: مصنعية إيجابية؛ للمشتريات: سالبة = ربح
  const avgPerGram = totalWeight ? diff / totalWeight : 0;

  const box = el("div", {
    style: "padding:14px;border:1px solid var(--border);border-radius:8px;background:var(--bg)",
  });
  box.appendChild(el("div", { style: "font-weight:700;margin-bottom:10px;font-size:15px" },
    isSale ? "💰 تحليل المبيعات" : "🛍️ تحليل المشتريات (الكسر)"));

  box.appendChild(rowLine("الإجمالي"