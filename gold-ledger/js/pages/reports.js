/**
 * pages/reports.js — التقارير (تبويبان: فلوس + ذهب)
 */
import {
  reports, daily, expenses, suppliers, customers, bankCash, advances, inventory, consignments,
} from "../db.js?v=11";
import {
  el, money, num, pageHead, thisMonthISO, thisYearISO, formatMonthLong, LABELS,
} from "../utils.js?v=11";

function n(v) { const x = Number(v); return isFinite(x) ? x : 0; }

let state = { tab: "money", period: "month", value: thisMonthISO() };

export function renderReports(container) {
  container.innerHTML = "";
  container.appendChild(pageHead("التحليلات", "التقارير",
    "تقاريرك لمتابعة حركة الفلوس والذهب — شهرية وسنوية."));

  const toolbar = el("div", { class: "daily-toolbar" }, [
    el("div", { class: "tabs" }, [
      el("button", {
        class: state.tab === "money" ? "active" : "",
        onclick: () => { state.tab = "money"; render(); },
      }, "📊 تقارير الفلوس"),
      el("button", {
        class: state.tab === "gold" ? "active" : "",
        onclick: () => { state.tab = "gold"; render(); },
      }, "⚖️ تقارير الذهب"),
    ]),
    el("div", { class: "spacer" }),
    el("div", { class: "tabs" }, [
      el("button", {
        class: state.period === "month" ? "active" : "",
        onclick: () => { state.period = "month"; state.value = thisMonthISO(); render(); }
      }, "شهري"),
      el("button", {
        class: state.period === "year" ? "active" : "",
        onclick: () => { state.period = "year"; state.value = thisYearISO(); render(); }
      }, "سنوي"),
    ]),
    state.period === "month"
      ? el("input", { type: "month", class: "input", value: state.value,
          onchange: (e) => { state.value = e.target.value; render(); } })
      : el("input", { type: "number", class: "input", value: state.value,
          min: "2020", max: "2100", style: "max-width:120px",
          onchange: (e) => { state.value = e.target.value; render(); } }),
    el("button", { class: "btn btn-ghost", onclick: () => window.print() }, "🖨"),
  ]);
  container.appendChild(toolbar);

  const body = el("div", { id: "rptBody" });
  container.appendChild(body);

  function render() {
    body.innerHTML = "";
    const range = state.period === "month"
      ? reports.monthRange(state.value)
      : reports.yearRange(state.value);
    const periodLabel = state.period === "month"
      ? formatMonthLong(state.value)
      : "سنة " + state.value;

    body.appendChild(el("h2", { style: "margin-top:8px" }, periodLabel));

    if (state.tab === "money") renderMoneyReport(body, range);
    else renderGoldReport(body, range);
  }
  render();
}

/* ===== Money report ===== */
function renderMoneyReport(body, range) {
  const t = reports.dailyTotals(range.from, range.to);
  const totalSales     = t.cashIn + t.bankIn + t.creditIn;
  const totalPurchases = t.cashOut + t.bankOut + t.creditOut;
  const exp = state.period === "month"
    ? expenses.monthTotal(state.value)
    : monthsInYear(state.value).reduce((s, m) => s + expenses.monthTotal(m), 0);
  const profit = totalSales - totalPurchases - exp;

  body.appendChild(el("div", { class: "kpi-grid" }, [
    kpi("إجمالي المبيعات", money(totalSales), "val-pos"),
    kpi("إجمالي المشتريات", money(totalPurchases), "val-neg"),
    kpi("المصاريف", money(exp), "val-neg"),
    kpi("الربح الصافي التقديري", money(profit), profit >= 0 ? "val-pos" : "val-neg"),
  ]));

  body.appendChild(el("h3", { style: "margin-top:24px" }, "تفصيل التدفق النقدي"));
  body.appendChild(el("div", { class: "summary-grid" }, [
    flowCard("نقداً", t.cashIn, t.cashOut),
    flowCard("بنك / شبكة", t.bankIn, t.bankOut),
    flowCard("آجل", t.creditIn, t.creditOut),
  ]));

  // Expenses by category
  if (state.period === "month") {
    const cats = expenses.totalsByCategory(state.value);
    if (Object.keys(cats).length) {
      body.appendChild(el("h3", { style: "margin-top:24px" }, "المصاريف حسب التصنيف"));
      body.appendChild(el("div", { class: "summary-grid" },
        Object.entries(cats).sort((a,b) => b[1] - a[1]).map(([cat, val]) =>
          el("div", { class: "sum-card" }, [
            el("h4", {}, cat),
            el("div", { class: "sum-line net" }, [
              el("span", { class: "lbl" }, "إجمالي"),
              el("span", { class: "val val-neg" }, money(val)),
            ]),
            el("div", { class: "sum-line" }, [
              el("span", { class: "lbl" }, "النسبة"),
              el("span", { class: "val" }, ((val / exp) * 100).toFixed(1) + "%"),
            ]),
          ]),
        ),
      ));
    }
  }

  // Suppliers
  body.appendChild(el("h3", { style: "margin-top:24px" }, "الموردين والبنك"));
  const supT = suppliers.totals();
  const cusT = customers.totals();
  const advT = advances.totals();
  body.appendChild(el("div", { class: "summary-grid" }, [
    bookCard("الموردين", `مستحق لهم: ${money(supT.positiveCash)}`, `${supT.count} مورد`),
    bookCard("العملاء", `مستحق علينا: ${money(cusT.positiveCash)}`, `${cusT.count} عميل`),
    bookCard("البنك والصندوق",
      `الرصيد الكلي: ${money(bankCash.totalCash())}`,
      `${bankCash.accounts.all().length} حساب`),
    bookCard("سلف نقدية", `غير مسددة: ${money(advT.outstandingCash)}`, `${advT.count} سلفة`),
  ]));

  // Bank breakdown
  const accs = bankCash.accounts.all();
  if (accs.length) {
    body.appendChild(el("h3", { style: "margin-top:24px" }, "أرصدة الحسابات"));
    body.appendChild(el("div", { class: "summary-grid" },
      accs.map(a => {
        const bal = bankCash.balance(a.id);
        return el("div", { class: "sum-card" }, [
          el("h4", {}, (a.type === "bank" ? "🏦 " : "💵 ") + a.name),
          el("div", { class: "sum-line net" }, [
            el("span", { class: "lbl" }, "الرصيد"),
            el("span", { class: "val " + (bal >= 0 ? "val-pos" : "val-neg") }, money(bal)),
          ]),
          el("div", { class: "sum-line" }, [
            el("span", { class: "lbl" }, "النوع"),
            el("span", { class: "val" }, LABELS.accountType[a.type]),
          ]),
        ]);
      }),
    ));
  }
}

/* ===== Gold report ===== */
function renderGoldReport(body, range) {
  const t = reports.dailyTotals(range.from, range.to);
  const invT = inventory.totals();
  const advT = advances.totals();
  const consT = consignments.totals();

  body.appendChild(el("div", { class: "kpi-grid" }, [
    kpi("ذهب وارد (مشتريات)", num(t.goldInW) + " جم", "val-pos"),
    kpi("ذهب صادر (مبيعات)", num(t.goldOutW) + " جم", "val-neg"),
    kpi("صافي حركة الذهب", num(t.goldInW - t.goldOutW) + " جم",
       (t.goldInW - t.goldOutW) >= 0 ? "val-pos" : "val-neg"),
  ]));

  body.appendChild(el("h3", { style: "margin-top:24px" }, "مخزون الذهب الحالي"));
  body.appendChild(el("div", { class: "summary-grid" }, [
    el("div", { class: "sum-card" }, [
      el("h4", {}, "إجمالي الذهب المتوفر"),
      el("div", { class: "sum-line net" }, [
        el("span", { class: "lbl" }, "الوزن"),
        el("span", { class: "val val-pos" }, num(invT.weightG) + " جم"),
      ]),
      el("div", { class: "sum-line" }, [
        el("span", { class: "lbl" }, "القيمة"),
        el("span", { class: "val" }, money(invT.valueG)),
      ]),
    ]),
    el("div", { class: "sum-card" }, [
      el("h4", {}, "عدد القطع"),
      el("div", { class: "sum-line net" }, [
        el("span", { class: "lbl" }, "متوفرة"),
        el("span", { class: "val" }, String(invT.count)),
      ]),
    ]),
  ]));

  // مخزون الذهب لكل عيار
  body.appendChild(el("h3", { style: "margin-top:24px" }, "الذهب المتوفر حسب العيار"));
  const byKarat = inventoryByKarat();
  body.appendChild(el("div", { class: "summary-grid" },
    LABELS.goldKarats.map(k => {
      const data = byKarat[k] || { weight: 0, count: 0, value: 0 };
      return el("div", { class: "sum-card" }, [
        el("h4", {}, "ذهب عيار " + k),
        el("div", { class: "sum-line net" }, [
          el("span", { class: "lbl" }, "الوزن"),
          el("span", { class: "val " + (data.weight > 0 ? "val-pos" : "") },
            num(data.weight) + " جم"),
        ]),
        el("div", { class: "sum-line" }, [
          el("span", { class: "lbl" }, "العدد"),
          el("span", { class: "val" }, String(data.count)),
        ]),
        el("div", { class: "sum-line" }, [
          el("span", { class: "lbl" }, "القيمة"),
          el("span", { class: "val" }, money(data.value)),
        ]),
      ]);
    }),
  ));

  // الذهب خارج المحل
  body.appendChild(el("h3", { style: "margin-top:24px" }, "الذهب خارج المحل"));
  body.appendChild(el("div", { class: "summary-grid" }, [
    el("div", { class: "sum-card" }, [
      el("h4", {}, "🪙 ذهب لدى الصاغة (سلف ذهبية)"),
      el("div", { class: "sum-line net" }, [
        el("span", { class: "lbl" }, "الوزن غير المسدد"),
        el("span", { class: "val val-pos" }, num(advT.outstandingGold) + " جم"),
      ]),
    ]),
    el("div", { class: "sum-card" }, [
      el("h4", {}, "📗 ذهب في العهد (المندوبين)"),
      el("div", { class: "sum-line net" }, [
        el("span", { class: "lbl" }, "متبقي عند المندوبين"),
        el("span", { class: "val val-pos" }, num(consT.remainingWeight) + " جم"),
      ]),
      el("div", { class: "sum-line" }, [
        el("span", { class: "lbl" }, "عدد العهد المفتوحة"),
        el("span", { class: "val" }, String(consT.openCount)),
      ]),
    ]),
    el("div", { class: "sum-card" }, [
      el("h4", {}, "🤝 ذهب لدى الموردين"),
      el("div", { class: "sum-line muted" }, [
        el("span", { class: "lbl" }, "غير مفعّل (يحتاج تتبع منفصل)"),
      ]),
    ]),
  ]));

  // إجمالي مالك من الذهب
  const totalGold = n(invT.weightG) + n(advT.outstandingGold) + n(consT.remainingWeight);
  body.appendChild(el("h3", { style: "margin-top:24px" }, "📊 إجمالي ذهبك"));
  body.appendChild(el("div", { class: "kpi-grid" }, [
    kpi("داخل المحل", num(invT.weightG) + " جم", ""),
    kpi("سلف ذهبية", num(advT.outstandingGold) + " جم", ""),
    kpi("في العهد", num(consT.remainingWeight) + " جم", ""),
    kpi("المجموع", num(totalGold) + " جم", "val-pos"),
  ]));
}

function inventoryByKarat() {
  const map = {};
  for (const i of inventory.byStatus("available")) {
    if (i.category !== "gold") continue;
    const k = i.karat;
    const w = n(i.weight);
    const v = w * n(i.cost_price);
    if (!map[k]) map[k] = { weight: 0, count: 0, value: 0 };
    map[k].weight += w;
    map[k].count  += 1;
    map[k].value  += v;
  }
  return map;
}

function kpi(label, value, cls) {
  return el("div", { class: "kpi-card" }, [
    el("div", { class: "kpi-label" }, label),
    el("div", { class: "kpi-value " + (cls || "") }, value),
  ]);
}
function flowCard(title, inAmt, outAmt) {
  const net = inAmt - outAmt;
  return el("div", { class: "sum-card" }, [
    el("h4", {}, title),
    el("div", { class: "sum-line" }, [
      el("span", { class: "lbl" }, "وارد"),
      el("span", { class: "val val-pos" }, "+" + money(inAmt)),
    ]),
    el("div", { class: "sum-line" }, [
      el("span", { class: "lbl" }, "صادر"),
      el("span", { class: "val val-neg" }, "−" + money(outAmt)),
    ]),
    el("div", { class: "sum-line net" }, [
      el("span", { class: "lbl" }, "الصافي"),
      el("span", { class: "val " + (net >= 0 ? "val-pos" : "val-neg") },
        (net >= 0 ? "+" : "") + money(net)),
    ]),
  ]);
}
function bookCard(title, line1, line2) {
  return el("div", { class: "sum-card" }, [
    el("h4", {}, title),
    el("div", { class: "sum-line" }, [el("span", { class: "lbl" }, line1)]),
    lin