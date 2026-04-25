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
import { daily, expenses, dailyMeta } from "../db.js";
import {
  $, el, money, num, todayISO, nowHHMM, formatDateLong, toast, confirmAsk,
  openModal, field, emptyState,
} from "../utils.js";

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
  const v = num(value);
  if (!v) return el("td", { class: "num text-mute" }, "—");
  const inner = bold ? el("strong", {}, num(v)) : num(v);
  return el("td", { class: "num" }, inner);
}
function payChip(pm) {
  const isCash = pm === "cash";
  return el("span", {
    class: "type-chip " + (isCash ? "type-in" : "type-out"),
  }, isCash ? "💰 كاش" : "💳 شبكة");
}
function computeSum(rows) {
  const sum = { total: 0, gold_18: 0, gold_21: 0, gold_22: 0, gold_24: 0, silver_925: 0, silver_999: 0 };
  for (const r of rows) {
    sum.total      += num(r.amount);
    sum.gold_18    += num(r.gold_18);
    sum.gold_21    += num(r.gold_21);
    sum.gold_22    += num(r.gold_22);
    sum.gold_24    += num(r.gold_24);
    sum.silver_925 += num(r.silver_925);
    sum.silver_999 += num(r.silver_999);
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
    total += num(e.amount);
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
  const expSum = expenses.byDailyDate(state.date).reduce((s, e) => s + num(e.amount), 0);
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
  const hasAnyPrice = KARATS.some(k => num(prices[k]) > 0);

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
    const w = num(side.gold[k]);
    if (!w) continue;
    const p = num(prices[k]);
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

  box.appendChild(rowLine("الإجمالي", money(side.total), isSale ? "val-pos" : "val-neg"));
  // weight breakdown
  for (const ln of lines) {
    box.appendChild(rowLine(`الوزن عيار ${ln.k}`, num(ln.w) + " جم × " + money(ln.p), ""));
  }
  if (totalWeight) {
    box.appendChild(rowLine("قيمة الذهب الخام", money(goldValue), ""));
    box.appendChild(el("div", { style: "border-top:1px dashed var(--border);margin:8px 0" }));
    if (isSale) {
      box.appendChild(rowLine("المصنعية", money(diff),
        diff >= 0 ? "val-pos" : "val-neg", true));
      box.appendChild(rowLine("متوسط مصنعية الجرام",
        money(avgPerGram) + " / جم", "muted"));
    } else {
      // diff = total - goldValue. For purchase, total < goldValue means profit (we bought cheap)
      const profit = -diff; // قيمة الذهب الخام - مبلغ الشراء
      box.appendChild(rowLine("فرق الشراء (ربح من الكسر)", money(profit),
        profit >= 0 ? "val-pos" : "val-neg", true));
      box.appendChild(rowLine("متوسط الفرق على الجرام",
        money(profit / totalWeight) + " / جم", "muted"));
    }
  } else if (side.total > 0) {
    box.appendChild(el("div", { class: "muted", style: "font-size:13px;margin-top:8px" },
      "أدخل وزن في العمليات لحساب المصنعية."));
  }
  return box;
}

function rowLine(label, value, cls, bold) {
  return el("div", {
    style: "display:flex;justify-content:space-between;padding:4px 0;font-size:14px",
  }, [
    el("span", { class: bold ? "" : "" }, label),
    el("span", { class: (cls || "") + (bold ? " " : ""), style: bold ? "font-weight:700;font-size:15px" : "" }, value),
  ]);
}

function kpiBox(label, value, cls) {
  return el("div", { class: "kpi-card" }, [
    el("div", { class: "kpi-label" }, label),
    el("div", { class: "kpi-value " + (cls || "") }, value),
  ]);
}

/* ───────── End-of-day balances ───────── */
function buildBalances(closed) {
  const meta = dailyMeta.byDate(state.date) || {};
  const expected = dailyMeta.expectedFor(state.date);
  const card = el("div", { class: "card", style: "margin-bottom:16px" });
  card.appendChild(el("h3", {
    style: "margin:0 0 14px;font-family:var(--font-display);font-size:20px",
  }, "🏦  أرصدة نهاية اليوم"));

  const grid = el("div", { class: "grid-2" });
  grid.appendChild(buildBalanceBox("💰 الصندوق", "cash_actual",
    meta.cash_actual || 0, expected.cash, closed));
  grid.appendChild(buildBalanceBox("🏦 البنك", "bank_actual",
    meta.bank_actual || 0, expected.bank, closed));
  card.appendChild(grid);

  card.appendChild(el("div", { class: "muted", style: "font-size:12px;margin-top:10px" },
    "💡 المتوقع = رصيد آخر يوم مقفل + كاش/شبكة المبيعات − كاش/بنك المشتريات والمصاريف."));
  return card;
}

function buildBalanceBox(title, field_key, actual, expected, closed) {
  const diff = num(actual) - num(expected);
  let status, statusCls;
  if (!actual)            { status = "لم يُدخل بعد"; statusCls = "muted"; }
  else if (Math.abs(diff) < 1)   { status = "✅ مطابق"; statusCls = "val-pos"; }
  else if (Math.abs(diff) < 100) { status = "⚠️ فرق ضئيل: " + (diff > 0 ? "+" : "") + money(diff); statusCls = "muted"; }
  else                            { status = "❌ فرق كبير: " + (diff > 0 ? "+" : "") + money(diff); statusCls = "val-neg"; }

  return el("div", {
    style: "padding:14px;border:1px solid var(--border);border-radius:8px;background:var(--bg)",
  }, [
    el("div", { style: "font-weight:600;margin-bottom:8px" }, title),
    el("input", {
      class: "input", type: "number", step: "0.01",
      value: actual || "", placeholder: "أدخل الرصيد الفعلي",
      disabled: closed,
      oninput: (e) => {
        dailyMeta.upsert(state.date, { [field_key]: Number(e.target.value) || 0 });
        // re-render only the balances box would be ideal, but full re-render is fine
      },
      onchange: () => render($("#view")),
    }),
    el("div", { class: "muted", style: "font-size:13px;margin-top:6px" },
      "المتوقع: " + money(expected)),
    el("div", { class: statusCls, style: "font-size:13px;margin-top:4px;font-weight:600" }, status),
  ]);
}

/* ───────── Paper photo ───────── */
function buildPaperPhoto(closed) {
  const meta = dailyMeta.byDate(state.date) || {};
  const card = el("div", { class: "card", style: "margin-bottom:16px" });
  card.appendChild(el("div", { class: "between mb-12" }, [
    el("h3", { style: "margin:0;font-family:var(--font-display);font-size:20px" },
      "📸  صورة الورقة الورقية"),
    el("span", { class: "muted", style: "font-size:12px" }, "اختياري"),
  ]));

  if (meta.paper_image) {
    const img = el("img", {
      src: meta.paper_image,
      style: "max-width:100%;max-height:400px;border-radius:8px;border:1px solid var(--border)",
    });
    card.appendChild(img);
    if (!closed) {
      card.appendChild(el("button", {
        class: "btn btn-sm btn-danger", style: "margin-top:10px",
        onclick: () => {
          if (confirmAsk("حذف صورة الورقة؟")) {
            dailyMeta.upsert(state.date, { paper_image: null });
            render($("#view"));
            toast("تم الحذف");
          }
        },
      }, "حذف الصورة"));
    }
    return card;
  }

  if (closed) {
    card.appendChild(el("div", { class: "muted" }, "لا توجد صورة محفوظة."));
    return card;
  }

  const inputId = "paperFileInput";
  card.appendChild(el("input", {
    id: inputId, type: "file", accept: "image/*", capture: "environment",
    style: "display:none",
    onchange: (e) => handlePhotoUpload(e),
  }));
  card.appendChild(el("button", {
    class: "btn btn-primary",
    onclick: () => document.getElementById(inputId).click(),
  }, "📸 تصوير / اختيار صورة"));
  card.appendChild(el("div", { class: "muted", style: "font-size:13px;margin-top:8px" },
    "تُحفظ الصورة محلياً مع اليومية كمرجع."));
  return card;
}

function handlePhotoUpload(ev) {
  const file = ev.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast("الصورة كبيرة جداً (الحد 5 ميجا)"); return; }
  const reader = new FileReader();
  reader.onload = () => {
    dailyMeta.upsert(state.date, { paper_image: reader.result });
    render($("#view"));
    toast("تم حفظ الصورة");
  };
  reader.readAsDataURL(file);
}

/* ───────── Save bar ───────── */
function buildSaveBar(closed, container) {
  const wrap = el("div", { style: "margin-top:24px;text-align:center;padding:20px;background:var(--panel);border-radius:8px" });
  if (closed) {
    wrap.appendChild(el("div", { class: "val-pos", style: "font-size:18px;font-weight:600" },
      "✅ يومية اليوم محفوظة ومُقفلة"));
    return wrap;
  }
  const sum = daily.summaryForDate(state.date);
  const expSum = expenses.byDailyDate(state.date).reduce((s, e) => s + num(e.amount), 0);
  const hasAny = (sum.sales.count + sum.purchases.count + expenses.byDailyDate(state.date).length) > 0;
  if (!hasAny) {
    wrap.appendChild(el("div", { class: "muted" },
      "أضف أول عملية بيع أو شراء أو مصروف لتنشيط زر الحفظ."));
    return wrap;
  }
  wrap.appendChild(el("button", {
    class: "btn btn-primary",
    style: "font-size:18px;padding:14px 28px",
    onclick: () => {
      if (confirmAsk("حفظ يومية " + state.date + "؟ بعد الإقفال يمكن إعادة فتحها لاحقاً.")) {
        dailyMeta.close(state.date);
        render(container);
        toast("✅ تم حفظ يومية اليوم بنجاح");
      }
    },
  }, "💾 حفظ يومية اليوم"));
  return wrap;
}

/* ============================================================
   Add sale / purchase modal
   ============================================================ */
function openEntryModal(type, onDone) {
  const f = {
    type,
    date: state.date,
    time: nowHHMM(),
    amount: "",
    gold_18: "", gold_21: "", gold_22: "", gold_24: "",
    silver_925: "", silver_999: "",
    payment_method: "cash",
    note: "",
  };
  const titleAr = type === "sale" ? "🛒 عملية بيع جديدة" : "🛍️ عملية شراء كسر";
  openModal(titleAr, (root) => {
    const renderForm = () => {
      root.innerHTML = "";

      // Amount (إجباري)
      root.appendChild(field("💵 المبلغ (ر.س) *", el("input", {
        class: "input", type: "number", step: "0.01", inputmode: "decimal",
        value: f.amount, oninput: (e) => f.amount = e.target.value,
        placeholder: "0.00", autofocus: true,
      })));

      // Gold weights (4 karats)
      root.appendChild(el("div", {
        style: "margin-top:14px;font-weight:600;font-size:14px",
      }, "⚖️ الوزن (املأ المستخدم فقط):"));
      const goldGrid = el("div", { class: "grid-2" });
      for (const k of KARATS) {
        goldGrid.appendChild(field("عيار " + k, el("input", {
          class: "input", type: "number", step: "0.001", inputmode: "decimal",
          value: f["gold_" + k], oninput: (e) => f["gold_" + k] = e.target.value,
          placeholder: "0",
        })));
      }
      root.appendChild(goldGrid);

      // Silver (collapsed under "more")
      const silverDetails = el("details", { style: "margin-top:10px" });
      silverDetails.appendChild(el("summary", { style: "cursor:pointer;font-size:13px;color:var(--ink-mute)" },
        "+ فضة (اختياري)"));
      const silverGrid = el("div", { class: "grid-2", style: "margin-top:8px" });
      for (const p of SILVER) {
        silverGrid.appendChild(field("فضة " + p, el("input", {
          class: "input", type: "number", step: "0.001", inputmode: "decimal",
          value: f["silver_" + p], oninput: (e) => f["silver_" + p] = e.target.value,
          placeholder: "0",
        })));
      }
      silverDetails.appendChild(silverGrid);
      root.appendChild(silverDetails);

      // Payment method
      root.appendChild(field("💳 طريقة الدفع *", el("div", { class: "seg two-col" }, [
        el("button", {
          class: f.payment_method === "cash" ? "active" : "",
          onclick: () => { f.payment_method = "cash"; renderForm(); },
        }, "💰 كاش"),
        el("button", {
          class: f.payment_method === "network" ? "active" : "",
          onclick: () => { f.payment_method = "network"; renderForm(); },
        }, "💳 شبكة"),
      ])));

      // Time + Note
      const r2 = el("div", { class: "grid-2" });
      r2.appendChild(field("الوقت", el("input", {
        class: "input", type: "time", value: f.time,
        oninput: (e) => f.time = e.target.value,
      })));
      r2.appendChild(field("ملاحظة (اختياري)", el("input", {
        class: "input", value: f.note,
        oninput: (e) => f.note = e.target.value,
      })));
      root.appendChild(r2);
    };
    renderForm();
  }, {
    onSave: () => {
      if (!Number(f.amount)) { toast("أدخل المبلغ"); return false; }
      daily.add(f);
      onDone();
      toast("تم الحفظ");
    },
    saveLabel: "حفظ ✓",
  });
}

/* ============================================================
   Add expense modal
   ============================================================ */
function openExpenseModal(onDone) {
  const f = {
    date: state.date,
    category: EXPENSE_CATS[0],
    amount: "",
    payment_method: "cash",
    description: "",
    source: "daily",
    daily_date: state.date,
  };
  openModal("💸 مصروف جديد", (root) => {
    const renderForm = () => {
      root.innerHTML = "";
      root.appendChild(field("📋 البند", (() => {
        const sel = el("select", { class: "input",
          onchange: (e) => f.category = e.target.value });
        for (const c of EXPENSE_CATS) {
          const o = el("option", { value: c }, c);
          if (c === f.category) o.selected = true;
          sel.appendChild(o);
        }
        return sel;
      })()));
      root.appendChild(field("💵 المبلغ (ر.س) *", el("input", {
        class: "input", type: "number", step: "0.01", inputmode: "decimal",
        value: f.amount, oninput: (e) => f.amount = e.target.value,
        placeholder: "0.00",
      })));
      root.appendChild(field("💳 من أين *", el("div", { class: "seg two-col" }, [
        el("button", {
          class: f.payment_method === "cash" ? "active" : "",
          onclick: () => { f.payment_method = "cash"; renderForm(); },
        }, "💰 كاش"),
        el("button", {
          class: f.payment_method === "bank" ? "active" : "",
          onclick: () => { f.payment_method = "bank"; renderForm(); },
        }, "🏦 بنك"),
      ])));
      root.appendChild(field("ملاحظة (اختياري)", el("input", {
        class: "input", value: f.description,
        oninput: (e) => f.description = e.target.value,
        placeholder: f.category === "أخرى" ? "اكتب نوع المصروف..." : "",
      })));
    };
    renderForm();
  }, {
    onSave: () => {
      if (!Number(f.amount)) { toast("أدخل المبلغ"); return false; }
      expenses.add(f);
      onDone();
      toast("تم الحفظ");
    },
    saveLabel: "حفظ ✓",
  });
}
