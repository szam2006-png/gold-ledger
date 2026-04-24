/**
 * pages/reports.js — التقارير الشاملة
 */
import { reports, daily, expenses, suppliers, customers, bankCash, advances, inventory } from "../db.js";
import {
  el, money, num, toast, pageHead, thisMonthISO, thisYearISO,
  formatMonthLong, LABELS,
} from "../utils.js";

let state = { period: "month", value: thisMonthISO() };

export function renderReports(container) {
  container.innerHTML = "";
  container.appendChild(pageHead("التحليلات", "التقارير",
    "نظرة شاملة على الحركات المالية، الأرباح، وموقفك في كل دفتر."));

  const toolbar = el("div", { class: "daily-toolbar" }, [
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
    el("div", { class: "spacer" }),
    el("button", { class: "btn btn-ghost", onclick: () => window.print() }, "🖨  طباعة"),
  ]);
  container.appendChild(toolbar);

  const body = el("div", { id: "rptBody" });
  container.appendChild(body);

  function render() {
    body.innerHTML = "";
    const range = state.period === "month"
      ? reports.monthRange(state.value)
      : reports.yearRange(state.value);
    const t = reports.dailyTotals(range.from, range.to);

    const periodLabel = state.period === "month"
      ? formatMonthLong(state.value)
      : "سنة " + state.value;

    body.appendChild(el("h2", { style: "margin-top:8px" }, periodLabel));

    // KPIs
    const totalSales = t.cashIn + t.bankIn + t.creditIn;
    const totalPurchases = t.cashOut + t.bankOut + t.creditOut;
    const exp = state.period === "month"
      ? expenses.monthTotal(state.value)
      : monthsInYear(state.value).reduce((s, m) => s + expenses.monthTotal(m), 0);
    const profit = totalSales - totalPurchases - exp;

    body.appendChild(el("div", { class: "kpi-grid" }, [
      kpi("إجمالي المبيعات", money(totalSales), "val-pos"),
      kpi("إجمالي المشتريات", money(totalPurchases), "val-neg"),
      kpi("المصاريف", money(exp), "val-neg"),
      kpi("الربح الصافي", money(profit), profit >= 0 ? "val-pos" : "val-neg"),
    ]));

    // Cash flow breakdown
    body.appendChild(el("h3", { style: "margin-top:24px" }, "تفصيل التدفق النقدي"));
    body.appendChild(el("div", { class: "summary-grid" }, [
      flowCard("نقداً", t.cashIn, t.cashOut),
      flowCard("بنك / شبكة", t.bankIn, t.bankOut),
      flowCard("آجل", t.creditIn, t.creditOut),
    ]));

    // Metals
    body.appendChild(el("h3", { style: "margin-top:24px" }, "تحركات المعادن"));
    body.appendChild(el("div", { class: "summary-grid" }, [
      metalCard("ذهب", t.goldInW, t.goldOutW),
      metalCard("فضة", t.silverInW, t.silverOutW),
    ]));

    // Snapshot of all books
    body.appendChild(el("h3", { style: "margin-top:24px" }, "صورة عامة لجميع الدفاتر"));
    const supT = suppliers.totals();
    const cusT = customers.totals();
    const advT = advances.totals();
    const invT = inventory.totals();
    body.appendChild(el("div", { class: "summary-grid" }, [
      bookCard("الموردين",
        `مستحق لهم: ${money(supT.positive)}`,
        `${supT.count} مورد`),
      bookCard("العملاء",
        `مستحق علينا: ${money(cusT.positive)}`,
        `${cusT.count} عميل`),
      bookCard("البنك والصندوق",
        `الرصيد: ${money(bankCash.totalCash())}`,
        `${bankCash.accounts.all().length} حساب`),
      bookCard("السلف",
        `غير مسددة: ${money(advT.outstanding)}`,
        `${advT.count} سلفة`),
      bookCard("المخزون",
        `${num(invT.weightG)} جم ذهب · ${num(invT.weightS)} جم فضة`,
        `${invT.count} قطعة`),
      bookCard("اليومية",
        `${t.count} قيد في الفترة`,
        periodLabel),
    ]));
  }
  render();
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
function metalCard(title, inW, outW) {
  const net = inW - outW;
  return el("div", { class: "sum-card" }, [
    el("h4", {}, title),
    el("div", { class: "sum-line" }, [
      el("span", { class: "lbl" }, "داخل (شراء)"),
      el("span", { class: "val val-pos" }, "+" + num(inW) + " جم"),
    ]),
    el("div", { class: "sum-line" }, [
      el("span", { class: "lbl" }, "خارج (بيع)"),
      el("span", { class: "val val-neg" }, "−" + num(outW) + " جم"),
    ]),
    el("div", { class: "sum-line net" }, [
      el("span", { class: "lbl" }, "صافي الحركة"),
      el("span", { class: "val " + (net >= 0 ? "val-pos" : "val-neg") },
        (net >= 0 ? "+" : "") + num(net) + " جم"),
    ]),
  ]);
}
function bookCard(title, line1, line2) {
  return el("div", { class: "sum-card" }, [
    el("h4", {}, title),
    el("div", { class: "sum-line" }, [el("span", { class: "lbl" }, line1)]),
    el("div", { class: "sum-line muted" }, [el("span", { class: "lbl" }, line2)]),
  ]);
}
function monthsInYear(yyyy) {
  return Array.from({ length: 12 }, (_, i) => `${yyyy}-${String(i+1).padStart(2,"0")}`);
}
