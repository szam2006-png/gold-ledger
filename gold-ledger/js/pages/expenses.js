/**
 * pages/expenses.js — دفتر المصاريف
 */
import { expenses } from "../db.js?v=11";
import {
  $, el, money, todayISO, toast, confirmAsk, openModal, field,
  emptyState, pageHead, LABELS, thisMonthISO, formatMonthLong,
} from "../utils.js?v=11";

let state = { month: thisMonthISO() };

export function renderExpenses(container) {
  container.innerHTML = "";
  container.appendChild(pageHead("الدفاتر", "دفتر المصاريف",
    "تسجيل المصاريف التشغيلية والإدارية، مع تصنيف وتقارير شهرية."));

  const toolbar = el("div", { class: "daily-toolbar" }, [
    el("div", { class: "date-picker" }, [
      el("label", { class: "text-mute" }, "الشهر:"),
      el("input", {
        type: "month", class: "input", value: state.month,
        onchange: (e) => { state.month = e.target.value; render(); },
      }),
      el("button", {
        class: "btn btn-sm btn-ghost",
        onclick: () => { state.month = thisMonthISO(); render(); }
      }, "هذا الشهر"),
    ]),
    el("button", {
      class: "btn btn-primary",
      onclick: () => openExpenseForm(null, render),
    }, "+ مصروف جديد"),
    el("div", { class: "spacer" }),
    el("button", { class: "btn btn-ghost", onclick: () => window.print() }, "🖨  طباعة"),
  ]);
  container.appendChild(toolbar);

  const totals = el("div", { id: "expTotals" });
  const body   = el("div", { id: "expBody" });
  container.appendChild(totals);
  container.appendChild(body);

  function render() {
    totals.innerHTML = "";
    const total = expenses.monthTotal(state.month);
    const cats = expenses.totalsByCategory(state.month);
    const grid = el("div", { class: "kpi-grid" });
    grid.appendChild(kpi(formatMonthLong(state.month), money(total), "val-neg"));
    grid.appendChild(kpi("عدد القيود", String(expenses.byMonth(state.month).length), ""));
    const topCat = Object.entries(cats).sort((a,b) => b[1] - a[1])[0];
    grid.appendChild(kpi("أعلى تصنيف",
      topCat ? `${topCat[0]} (${money(topCat[1])})` : "—", ""));
    totals.appendChild(grid);

    body.innerHTML = "";
    const rows = expenses.byMonth(state.month).sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    if (!rows.length) {
      body.appendChild(emptyState("🧾", "لا توجد مصاريف في هذا الشهر."));
      return;
    }
    const wrap = el("div", { class: "ledger-wrap" });
    const table = el("table", { class: "ledger" });
    table.appendChild(el("thead", {}, el("tr", {}, [
      el("th", {}, "التاريخ"),
      el("th", {}, "التصنيف"),
      el("th", {}, "البيان"),
      el("th", { class: "num" }, "المبلغ"),
      el("th", {}, "طريقة الدفع"),
      el("th", {}, ""),
    ])));
    const tb = el("tbody");
    for (const e of rows) {
      tb.appendChild(el("tr", {}, [
        el("td", {}, e.date),
        el("td", {}, el("span", { class: "metal-chip" }, e.category || "أخرى")),
        el("td", {}, e.description || "—"),
        el("td", { class: "num val-neg" }, "−" + money(e.amount)),
        el("td", {}, LABELS.payment[e.payment_method] || "—"),
        el("td", {}, [
          el("button", {
            class: "btn btn-sm btn-ghost", style: "margin-inline-end:4px",
            onclick: () => openExpenseForm(e.id, render),
          }, "تعديل"),
          el("button", {
            class: "btn btn-sm btn-danger",
            onclick: () => {
              if (confirmAsk("حذف هذا المصروف؟")) {
                expenses.remove(e.id); render(); toast("تم الحذف");
              }
            },
          }, "حذف"),
        ]),
      ]));
    }
    table.appendChild(tb);
    table.appendChild(el("tfoot", {}, el("tr", {}, [
      el("td", { colspan: "3" }, "الإجمالي"),
      el("td", { class: "num val-neg" }, "−" + money(total)),
      el("td", { colspan: "2" }, ""),
    ])));
    wrap.appendChild(table);
    body.appendChild(wrap);

    // Categories summary
    if (Object.keys(cats).length > 0) {
      const sumWrap = el("div", { style: "margin-top:24px" }, [
        el("h3", {}, "ملخص التصنيفات"),
        el("div", { class: "summary-grid" },
          Object.entries(cats).sort((a,b) => b[1] - a[1]).map(([cat, val]) =>
            el("div", { class: "sum-card" }, [
              el("h4", {}, cat),
              el("div", { class: "sum-line net" }, [
                el("span", { class: "lbl" }, "إجمالي"),
                el("span", { class: "val val-neg" }, money(val)),
              ]),
              el("div", { class: "sum-line" }, [
                el("span", { class: "lbl" }, "النسبة"),
                el("span", { class: "val" },
                  ((val / total) * 100).toFixed(1) + "%"),
              ]),
            ])
          )
        ),
      ]);
      body.appendChild(sumWrap);
    }
  }
  render();
}

function kpi(label, value, cls) {
  return el("div", { class: "kpi-card" }, [
    el("div", { class: "kpi-label" }, label),
    el("div", { class: "kpi-value " + (cls || "") }, value),
  ]);
}

function openExpenseForm(id, onDone) {
  const exist = id ? expenses.all().find(x => x.id === id) : null;
  const f = {
    date: exist?.date || todayISO(),
    category: exist?.category || LABELS.expenseCats[0],
    amount: exist?.amount || "",
    description: exist?.description || "",
    payment_method: exist?.payment_method || "cash",
  };
  openModal(exist ? "تعديل مصروف" : "مصروف جديد", (root) => {
    const r1 = el("div", { class: "grid-2" });
    r1.appendChild(field("التاريخ", el("input", {
      class: "input", type: "date", value: f.date,
      oninput: (e) => f.date = e.target.value,
    })));
    const sel = el("select", { class: "input",
      onchange: (e) => f.category = e.target.value });
    for (const c of LABELS.expenseCats) {
      const o = el("option", { value: c }, c);
      if (c === f.category) o.selected = true;
      sel.appendChild(o);
    }
    r1.appendChild(field("التصنيف", sel));
    root.appendChild(r1);

    root.appendChild(field("المبلغ (ر.س) *", el("input", {
      class: "input", type: "number", step: "0.01", value: f.amount,
      oninput: (e) => f.amount = e.target.value,
    })));

    root.appendChild(field("البيان", el("textarea", {
      class: "textarea",
      oninput: (e) => f.description = e.target.value,
      placeholder: "وصف المصروف",
    }, f.description)));

    root.appendChild(field("طريقة الدفع", el("div", { class: "seg" },
      Object.entries(LABELS.payment).map(([k, v]) =>
        el("button", {
          class: f.payment_method === k ? "active" : "",
          onclick: (e) => {
            f.payment_method = k;
            // toggle
            const seg = e.target.parentElement;
            [...seg.children].forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
          },
        }, v)),
    )));
  }, {
    onSave: () => {
      if (!Number(f.amount)) { toast("أدخل المبلغ"); return false; }
      if (exist) expenses.update(id, f);
      else expenses.add(f);
      onDone(); toast("تم الحفظ");
    }
  });
}
