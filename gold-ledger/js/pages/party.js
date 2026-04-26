/**
 * pages/party.js — صفحة مشتركة للموردين والعملاء
 * يستخدمها suppliers.js و customers.js
 *
 * الفرق عن النسخة القديمة: تدعم رصيد ذهب بالأعيرة + رصيد نقد بشكل منفصل،
 * مع كشف حساب احترافي بأعمدة (ذهب 18/21/22/24 + فلوس).
 */
import { suppliers, customers, bankCash } from "../db.js";
import {
  $, el, money, num, todayISO, toast, confirmAsk, openModal, field,
  emptyState, pageHead, LABELS,
} from "../utils.js";

function n(v) { const x = Number(v); return isFinite(x) ? x : 0; }
const KARATS = ["18", "21", "22", "24"];

let state = { kind: "supplier" };

export function renderParty(container, { kind }) {
  state.kind = kind;
  const store = (kind === "supplier") ? suppliers : customers;
  store.migrate();

  container.innerHTML = "";
  container.appendChild(pageHead(
    "الدفاتر",
    kind === "supplier" ? "دفتر الموردين" : "دفتر العملاء",
    kind === "supplier"
      ? "إدارة الموردين، رصيد النقد ورصيد الذهب لكل عيار، حركات الشراء والسداد."
      : "إدارة العملاء، البيع الآجل، الدفعات والإرجاعات، رصيد النقد والذهب."
  ));

  const toolbar = el("div", { class: "daily-toolbar" }, [
    el("button", {
      class: "btn btn-primary",
      onclick: () => openPartyForm(store, kind, null, () => render()),
    }, kind === "supplier" ? "+ إضافة مورد" : "+ إضافة عميل"),
    el("div", { class: "spacer" }),
    el("button", { class: "btn btn-ghost", onclick: () => window.print() }, "🖨  طباعة"),
  ]);
  container.appendChild(toolbar);

  const totalsBox = el("div", { id: "partyTotals" });
  container.appendChild(totalsBox);

  const body = el("div", { id: "partyBody" });
  container.appendChild(body);

  function render() {
    renderTotals(totalsBox, store, kind);
    renderList(body, store, kind, render);
  }
  render();
}

function renderTotals(box, store, kind) {
  box.innerHTML = "";
  const t = store.totals();
  const grid = el("div", { class: "kpi-grid" });
  const labelCash = kind === "supplier" ? "نقد مستحق للموردين" : "نقد مستحق على العملاء";
  const labelGold = kind === "supplier" ? "ذهب مستحق للموردين (مرجع 21)" : "ذهب مستحق على العملاء (مرجع 21)";
  grid.appendChild(kpi(labelCash, money(t.positiveCash), "val-pos"));
  grid.appendChild(kpi(labelGold, num(t.positiveGold) + " جم", "val-pos"));
  grid.appendChild(kpi("عدد الجهات", String(t.count), ""));
  box.appendChild(grid);
}
function kpi(label, value, cls) {
  return el("div", { class: "kpi-card" }, [
    el("div", { class: "kpi-label" }, label),
    el("div", { class: "kpi-value " + (cls || "") }, value),
  ]);
}

function renderList(body, store, kind, rerender) {
  body.innerHTML = "";
  const list = store.all();
  if (!list.length) {
    body.appendChild(emptyState(kind === "supplier" ? "🤝" : "👥",
      kind === "supplier" ? "لا يوجد موردين بعد." : "لا يوجد عملاء بعد.",
      "اضغط زر الإضافة في الأعلى."));
    return;
  }
  const wrap = el("div", { class: "ledger-wrap" });
  const table = el("table", { class: "ledger" });
  table.appendChild(el("thead", {}, el("tr", {}, [
    el("th", {}, "الاسم"),
    el("th", {}, "الجوال"),
    el("th", {}, "النوع"),
    el("th", { class: "num" }, "رصيد النقد"),
    el("th", { class: "num" }, "رصيد الذهب"),
    el("th", { class: "num" }, "حركات"),
    el("th", {}, "إجراءات"),
  ])));
  const tbody = el("tbody");
  for (const p of list.sort((a,b) => a.name.localeCompare(b.name, "ar"))) {
    const balCash = store.balanceCash(p.id);
    const balGold = store.balanceGold(p.id);
    const goldLines = KARATS.map(k => n(balGold[k])).filter(v => v !== 0);
    const goldDisplay = goldLines.length === 0
      ? el("span", { class: "muted" }, "—")
      : el("div", {}, KARATS.filter(k => n(balGold[k]) !== 0).map(k =>
          el("div", { style: "font-size:12px" },
            num(balGold[k]) + " جم " + k)));
    const cashCls = balCash > 0 ? "val-pos" : (balCash < 0 ? "val-neg" : "");
    tbody.appendChild(el("tr", {}, [
      el("td", {}, [
        el("strong", {}, p.name || "—"),
        p.notes ? el("div", { class: "muted" }, p.notes) : null,
      ]),
      el("td", {}, p.phone || "—"),
      el("td", {}, partyTypeChip(p.type, kind)),
      el("td", { class: "num " + cashCls }, money(balCash)),
      el("td", { class: "num val-pos" }, goldDisplay),
      el("td", { class: "num" }, String((p.transactions || []).length)),
      el("td", {}, [
        el("button", {
          class: "btn btn-sm btn-primary", style: "margin-inline-end:4px",
          onclick: () => openStatement(store, kind, p.id, rerender),
        }, "كشف الحساب"),
        el("button", {
          class: "btn btn-sm btn-ghost", style: "margin-inline-end:4px",
          onclick: () => openPartyForm(store, kind, p.id, rerender),
        }, "تعديل"),
        el("button", {
          class: "btn btn-sm btn-danger",
          onclick: () => {
            if (confirmAsk("حذف " + (p.name || "هذه الجهة") + "؟ ستفقد كل حركاتها.")) {
              store.remove(p.id);
              rerender();
              toast("تم الحذف");
            }
          },
        }, "حذف"),
      ]),
    ]));
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  body.appendChild(wrap);
}

function partyTypeChip(type, kind) {
  const labels = kind === "customer"
    ? { regular: "عادي", vip: "مميز", wholesale: "جملة" }
    : { regular: "عادي", wholesale: "جملة" };
  return el("span", { class: "metal-chip" }, labels[type] || "عادي");
}

/* ====================================================
   Form: add / edit party
   ==================================================== */
function openPartyForm(store, kind, id, onDone) {
  const existing = id ? store.byId(id) : null;
  const f = {
    name: existing?.name || "",
    phone: existing?.phone || "",
    type: existing?.type || "regular",
    notes: existing?.notes || "",
    opening_cash: existing?.opening_cash ?? 0,
    opening_gold: { ...(existing?.opening_gold || { "18": 0, "21": 0, "22": 0, "24": 0 }) },
  };
  const typeOptions = kind === "customer"
    ? [["regular", "عادي"], ["vip", "مميز"], ["wholesale", "جملة"]]
    : [["regular", "عادي"], ["wholesale", "جملة"]];

  openModal(
    existing ? "تعديل البيانات" : (kind === "supplier" ? "إضافة مورد" : "إضافة عميل"),
    (root) => {
      const renderForm = () => {
        root.innerHTML = "";
        const r1 = el("div", { class: "grid-2" });
        r1.appendChild(field("الاسم *", el("input", {
          class: "input", value: f.name,
          oninput: (e) => f.name = e.target.value,
          placeholder: "اسم الجهة",
        })));
        r1.appendChild(field("الجوال", el("input", {
          class: "input", value: f.phone,
          oninput: (e) => f.phone = e.target.value,
          placeholder: "05xxxxxxxx",
        })));
        root.appendChild(r1);

        root.appendChild(field("التصنيف", el("div", { class: "seg" },
          typeOptions.map(([k, label]) =>
            el("button", {
              class: f.type === k ? "active" : "",
              onclick: () => { f.type = k; renderForm(); },
            }, label))
        )));

        root.appendChild(field("الرصيد الافتتاحي - نقد (ر.س)", el("input", {
          class: "input", type: "number", step: "0.01", value: f.opening_cash,
          oninput: (e) => f.opening_cash = e.target.value,
        }), kind === "supplier"
          ? "موجب: نحن مدينون له. سالب: هو مدين لنا."
          : "موجب: هو مدين لنا. سالب: نحن مدينون له."));

        root.appendChild(el("div", { style: "font-weight:600;font-size:14px;margin:10px 0 6px" },
          "🪙 الرصيد الافتتاحي - ذهب (جرام لكل عيار)"));
        const goldGrid = el("div", { class: "grid-2" });
        for (const k of KARATS) {
          goldGrid.appendChild(field("عيار " + k, el("input", {
            class: "input", type: "number", step: "0.001",
            value: f.opening_gold[k] || "",
            oninput: (e) => f.opening_gold[k] = e.target.value,
            placeholder: "0",
          })));
        }
        root.appendChild(goldGrid);

        root.appendChild(field("ملاحظات", el("textarea", {
          class: "textarea",
          oninput: (e) => f.notes = e.target.value,
        }, f.notes)));
      };
      renderForm();
    },
    {
      onSave: () => {
        if (!f.name.trim()) { toast("أدخل الاسم"); return false; }
        if (existing) store.update(id, f);
        else store.add(f);
        onDone();
        toast("تم الحفظ");
      }
    }
  );
}

/* ====================================================
   Statement: كشف الحساب الاحترافي (ذهب 4 أعيرة + فلوس)
   ==================================================== */
function openStatement(store, kind, id, onDone) {
  openModal("كشف حساب", (root) => {
    const refresh = () => {
      const p = store.byId(id);
      if (!p) return;
      root.innerHTML = "";
      renderStatementBody(root, store, kind, id, () => { refresh(); onDone(); });
    };
    refresh();
  });
}

function renderStatementBody(root, store, kind, id, refresh) {
  const p = store.byId(id);
  if (!p) return;

  // Header
  const balCash = store.balanceCash(id);
  const balGold = store.balanceGold(id);
  const balGold21 = store.balanceGoldAs21(id);

  root.appendChild(el("div", { class: "between mb-20" }, [
    el("div", {}, [
      el("strong", { style: "font-size:16px" }, p.name || "—"),
      el("div", { class: "muted" }, p.phone ? "📞 " + p.phone : ""),
      partyTypeChip(p.type, kind),
    ]),
    el("div", { class: "text-end" }, [
      el("div", { class: "muted", style: "font-size:11px" }, "الأرصدة الحالية"),
      el("div", { class: balCash > 0 ? "val-pos" : (balCash < 0 ? "val-neg" : ""), style: "font-weight:700" },
        "نقد: " + money(balCash)),
      el("div", { class: balGold21 > 0 ? "val-pos" : (balGold21 < 0 ? "val-neg" : ""), style: "font-weight:700" },
        "ذهب (مرجع 21): " + num(balGold21) + " جم"),
    ]),
  ]));

  // أزرار إضافة حركة
  const actionBar = el("div", { style: "display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px" }, [
    el("button", {
      class: "btn btn-sm btn-primary",
      onclick: () => openCashTxModal(store, kind, id, "in", refresh),
    }, kind === "supplier" ? "+ شراء آجل (ندين له)" : "+ بيع آجل (يدين لنا)"),
    el("button", {
      class: "btn btn-sm btn-primary",
      onclick: () => openCashTxModal(store, kind, id, "out", refresh),
    }, kind === "supplier" ? "+ دفعة له (نقد)" : "+ دفعة منه (نقد)"),
    el("button", {
      class: "btn btn-sm",
      onclick: () => openGoldTxModal(store, kind, id, "in", refresh),
    }, kind === "supplier" ? "+ استلام ذهب من المورد" : "+ بيع ذهب آجل"),
    el("button", {
      class: "btn btn-sm",
      onclick: () => openGoldTxModal(store, kind, id, "out", refresh),
    }, kind === "supplier" ? "+ تسليم ذهب للمورد" : "+ استلام ذهب من العميل"),
    el("div", { class: "spacer" }),
    el("button", { class: "btn btn-sm btn-ghost", onclick: () => window.print() }, "🖨"),
  ]);
  root.appendChild(actionBar);

  // كشف حساب احترافي بأعمدة
  const allTxs = (p.transactions || []).slice()
    .sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.created_at || "").localeCompare(b.created_at || ""));

  const wrap = el("div", { class: "ledger-wrap" });
  const table = el("table", { class: "ledger statement" });
  // header rows
  const head = el("thead");
  head.appendChild(el("tr", {}, [
    el("th", { rowspan: "2" }, "التاريخ"),
    el("th", { rowspan: "2" }, "البيان"),
    el("th", { rowspan: "2" }, "المرجع"),
    el("th", { colspan: "3", class: "metal-gold-18", style: "text-align:center" }, "عيار 18"),
    el("th", { colspan: "3", class: "metal-gold-21", style: "text-align:center" }, "عيار 21"),
    el("th", { colspan: "3", class: "metal-gold-22", style: "text-align:center" }, "عيار 22"),
    el("th", { colspan: "3", class: "metal-gold-24", style: "text-align:center" }, "عيار 24"),
    el("th", { colspan: "3", style: "text-align:center;background:#2d3a2d;color:#b8d4b8" }, "فلوس (ر.س)"),
    el("th", { rowspan: "2" }, ""),
  ]));
  const sub = el("tr");
  for (let i = 0; i < 5; i++) {
    sub.appendChild(el("th", { class: "num", style: "font-size:11px" }, "مدين"));
    sub.appendChild(el("th", { class: "num", style: "font-size:11px" }, "دائن"));
    sub.appendChild(el("th", { class: "num", style: "font-size:11px" }, "رصيد"));
  }
  head.appendChild(sub);
  table.appendChild(head);

  // Body
  const tbody = el("tbody");

  // ابدأ بالأرصدة الافتتاحية
  const running = {
    "18": n(p.opening_gold?.["18"]),
    "21": n(p.opening_gold?.["21"]),
    "22": n(p.opening_gold?.["22"]),
    "24": n(p.opening_gold?.["24"]),
    cash: n(p.opening_cash),
  };
  if (running["18"] || running["21"] || running["22"] || running["24"] || running.cash) {
    tbody.appendChild(buildStatementRow({
      date: "—",
      description: "الرصيد الافتتاحي",
      ref: "",
      mod18: 0, dep18: 0, runGold: { ...running },
      modCash: 0, depCash: 0, runCash: running.cash,
      hideActions: true,
      isOpening: true,
    }));
  }

  for (const t of allTxs) {
    const row = { date: t.date || "—", description: txDescription(t, kind), ref: t.ref || "—", actions: t };
    // initial slots
    row.gold_in = { "18": 0, "21": 0, "22": 0, "24": 0 };
    row.gold_out = { "18": 0, "21": 0, "22": 0, "24": 0 };
    row.cash_in = 0; row.cash_out = 0;
    if (t.kind === "gold") {
      const k = t.karat;
      const w = n(t.weight);
      if (t.direction === "in") { row.gold_in[k] = w; running[k] += w; }
      else                       { row.gold_out[k] = w; running[k] -= w; }
    } else if (t.kind === "cash") {
      const a = n(t.amount);
      if (t.direction === "in") { row.cash_in = a; running.cash += a; }
      else                       { row.cash_out = a; running.cash -= a; }
    }
    row.runGold = { ...running };
    row.runCash = running.cash;
    tbody.appendChild(buildStatementRow(row, () => {
      if (confirmAsk("حذف هذه الحركة؟")) {
        store.removeTx(id, t.id);
        toast("تم الحذف"); refresh();
      }
    }));
  }
  table.appendChild(tbody);

  // Footer = الرصيد الختامي
  const tfoot = el("tfoot");
  tfoot.appendChild(el("tr", {}, [
    el("td", { colspan: 3 }, el("strong", {}, "الرصيد الختامي")),
    ...KARATS.flatMap(k => [
      el("td", {}, ""),
      el("td", {}, ""),
      el("td", { class: "num" }, el("strong", { class: balanceCls(running[k]) }, fmtSigned(running[k]) + " جم")),
    ]),
    el("td", {}, ""),
    el("td", {}, ""),
    el("td", { class: "num" }, el("strong", { class: balanceCls(running.cash) }, fmtSignedMoney(running.cash))),
    el("td", {}, ""),
  ]));
  table.appendChild(tfoot);

  wrap.appendChild(table);
  root.appendChild(wrap);

  // ملخص نهاية
  root.appendChild(el("div", {
    style: "margin-top:16px;padding:12px;background:var(--panel);border-radius:8px",
  }, [
    el("h4", { style: "margin:0 0 8px" }, "📊 الرصيد الختامي"),
    el("div", { class: "muted", style: "font-size:13px" }, [
      el("div", {}, "⚖️ الذهب (تفصيل): " + KARATS.map(k => num(running[k]) + " جم " + k).join(" · ")),
      el("div", { style: "margin-top:4px" }, "⚖️ الذهب (مرجع 21): " + el("strong", {}, "").outerHTML +
        num(n(running["18"])*0.857 + n(running["21"]) + n(running["22"])*1.047 + n(running["24"])*1.142) + " جم"),
      el("div", { style: "margin-top:4px" }, "💰 النقد: " + el("strong", { class: balanceCls(running.cash) }, money(running.cash)).outerHTML),
    ]),
  ]));
}

function buildStatementRow(row, onDelete) {
  const cells = [
    el("td", {}, row.date),
    el("td", {}, row.description),
    el("td", { class: "muted" }, row.ref),
  ];
  for (const k of KARATS) {
    const inV  = row.gold_in  ? n(row.gold_in[k])  : 0;
    const outV = row.gold_out ? n(row.gold_out[k]) : 0;
    cells.push(el("td", { class: "num " + (inV ? "val-neg" : "muted") }, inV ? num(inV) : "—"));
    cells.push(el("td", { class: "num " + (outV ? "val-pos" : "muted") }, outV ? num(outV) : "—"));
    cells.push(el("td", { class: "num" }, el("strong", { class: balanceCls(row.runGold[k]) }, fmtSigned(row.runGold[k]))));
  }
  // فلوس
  const inC = n(row.cash_in), outC = n(row.cash_out);
  cells.push(el("td", { class: "num " + (inC ? "val-neg" : "muted") }, inC ? money(inC) : "—"));
  cells.push(el("td", { class: "num " + (outC ? "val-pos" : "muted") }, outC ? money(outC) : "—"));
  cells.push(el("td", { class: "num" }, el("strong", { class: balanceCls(row.runCash) }, fmtSignedMoney(row.runCash))));
  // actions
  cells.push(el("td", {}, (row.hideActions || !onDelete) ? "" : el("button", {
    class: "btn btn-sm btn-danger", onclick: onDelete,
  }, "✕")));
  const tr = el("tr", row.isOpening ? { style: "background:#fcf8f0;font-weight:600" } : {}, cells);
  return tr;
}

function txDescription(t, kind) {
  if (t.kind === "cash") {
    const dir = t.direction === "in"
      ? (kind === "supplier" ? "شراء آجل" : "بيع آجل")
      : (kind === "supplier" ? "دفعة للمورد" : "دفعة من العميل");
    const pm = t.payment_method ? ` (${LABELS.payment[t.payment_method] || t.payment_method})` : "";
    return dir + pm + (t.note ? " — " + t.note : "");
  }
  if (t.kind === "gold") {
    const dir = t.direction === "in"
      ? (kind === "supplier" ? "استلام ذهب من المورد" : "بيع ذهب آجل")
      : (kind === "supplier" ? "تسليم ذهب للمورد" : "استلام ذهب من العميل");
    return dir + (t.form ? ` (${LABELS.form[t.form]})` : "") + (t.note ? " — " + t.note : "");
  }
  return "—";
}

function balanceCls(v) {
  if (v > 0) return "val-pos";
  if (v < 0) return "val-neg";
  return "muted";
}
function fmtSigned(v) {
  if (v === 0) return "0";
  const s = v > 0 ? "+" : "";
  return s + num(v);
}
function fmtSignedMoney(v) {
  if (v === 0) return money(0);
  const s = v > 0 ? "+" : "−";
  return s + money(Math.abs(v));
}

/* ====================================================
   Cash transaction modal
   ==================================================== */
function openCashTxModal(store, kind, partyId, direction, onDone) {
  const accounts = bankCash.accounts.all();
  const f = {
    date: todayISO(),
    amount: "",
    payment_method: "cash",
    account_id: accounts[0]?.id || null,
    ref: "",
    note: "",
  };
  const titleAr = direction === "in"
    ? (kind === "supplier" ? "شراء آجل (يزيد دين علينا)" : "بيع آجل (يزيد دين العميل)")
    : (kind === "supplier" ? "دفعة للمورد (نقد/بنك)" : "دفعة من العميل");
  openModal(titleAr, (root) => {
    const renderForm = () => {
      root.innerHTML = "";
      const r1 = el("div", { class: "grid-2" });
      r1.appendChild(field("التاريخ", el("input", {
        class: "input", type: "date", value: f.date,
        oninput: (e) => f.date = e.target.value,
      })));
      r1.appendChild(field("المبلغ (ر.س) *", el("input", {
        class: "input", type: "number", step: "0.01",
        oninput: (e) => f.amount = e.target.value,
      })));
      root.appendChild(r1);

      // طريقة الدفع تظهر فقط للحركة "out" (دفع/قبض فعلي)
      // أو "in" لو شراء بدون آجل (لكن غالباً in = آجل، فما نطلب طريقة)
      if (direction === "out") {
        root.appendChild(field("طريقة الدفع", el("div", { class: "seg" }, [
          el("button", { class: f.payment_method === "cash" ? "active" : "",
            onclick: () => { f.payment_method = "cash"; renderForm(); } }, "💰 كاش"),
          el("button", { class: f.payment_method === "bank" ? "active" : "",
            onclick: () => { f.payment_method = "bank"; renderForm(); } }, "🏦 بنك"),
        ])));
        if (f.payment_method === "bank" && accounts.length) {
          const sel = el("select", { class: "input",
            onchange: (e) => f.account_id = e.target.value });
          for (const a of accounts.filter(a => a.type === "bank" || a.type === "cash")) {
            const o = el("option", { value: a.id }, `${a.name} (${LABELS.accountType[a.type]})`);
            if (a.id === f.account_id) o.selected = true;
            sel.appendChild(o);
          }
          root.appendChild(field("الحساب", sel,
            "ستنخصم/تنضاف الفلوس لرصيد هذا الحساب."));
        }
      }

      const r2 = el("div", { class: "grid-2" });
      r2.appendChild(field("مرجع (رقم فاتورة)", el("input", {
        class: "input", value: f.ref,
        oninput: (e) => f.ref = e.target.value,
      })));
      r2.appendChild(field("ملاحظة", el("input", {
        class: "input", value: f.note,
        oninput: (e) => f.note = e.target.value,
      })));
      root.appendChild(r2);
    };
    renderForm();
  }, {
    onSave: () => {
      if (!Number(f.amount)) { toast("أدخل المبلغ"); return false; }
      store.addTx(partyId, {
        kind: "cash",
        direction,
        date: f.date,
        amount: Number(f.amount),
        payment_method: direction === "out" ? f.payment_method : "credit",
        account_id: (direction === "out" && f.payment_method === "bank") ? f.account_id : null,
        ref: f.ref.trim(),
        note: f.note.trim(),
      });
      // ربط البنك تلقائياً
      if (direction === "out" && f.payment_method === "bank" && f.account_id) {
        bankCash.tx.add({
          type: kind === "supplier" ? "withdraw" : "deposit",
          account_id: f.account_id,
          amount: Number(f.amount),
          date: f.date,
          note: (kind === "supplier" ? "دفعة لـ " : "دفعة من ") + (store.byId(partyId)?.name || ""),
        });
      } else if (direction === "out" && f.payment_method === "cash") {
        // دفعة نقدية: ابحث عن أول حساب نقدي وأنقص منه (أو أضف لو كانت دفعة من العميل)
        const cashAcc = accounts.find(a => a.type === "cash");
        if (cashAcc) {
          bankCash.tx.add({
            type: kind === "supplier" ? "withdraw" : "deposit",
            account_id: cashAcc.id,
            amount: Number(f.amount),
            date: f.date,
            note: (kind === "supplier" ? "دفعة لـ " : "دفعة من ") + (store.byId(partyId)?.name || ""),
          });
        }
      }
      onDone();
      toast("تم تسجيل الحركة");
    },
  });
}

/* ====================================================
   Gold transaction modal
   ==================================================== */
function openGoldTxModal(store, kind, partyId, direction, onDone) {
  const f = {
    date: todayISO(),
    karat: "21",
    weight: "",
    form: "worked",
    ref: "",
    note: "",
  };
  const titleAr = direction === "in"
    ? (kind === "supplier" ? "استلام ذهب من المورد" : "بيع ذهب للعميل (آجل)")
    : (kind === "supplier" ? "تسليم ذهب للمورد" : "استلام ذهب من العميل");
  openModal(titleAr, (root) => {
    const renderForm = () => {
      root.innerHTML = "";
      const r1 = el("div", { class: "grid-2" });
      r1.appendChild(field("التاريخ", el("input", {
        class: "input", type: "date", value: f.date,
        oninput: (e) => f.date = e.target.value,
      })));
      r1.appendChild(field("الوزن (جرام) *", el("input", {
        class: "input", type: "number", step: "0.001",
        oninput: (e) => f.weight = e.target.value,
      })));
      root.appendChild(r1);

      root.appendChild(field("العيار", el("div", { class: "seg" }, KARATS.map(k =>
        el("button", { class: f.karat === k ? "active" : "",
          onclick: () => { f.karat = k; renderForm(); } }, k)))));

      root.appendChild(field("الشكل", el("div", { class: "seg" },
        ["worked", "broken", "pure"].map(fm =>
          el("button", { class: f.form === fm ? "active" : "",
            onclick: () => { f.form = fm; renderForm(); } }, LABELS.form[fm])))));

      const r2 = el("div", { class: "grid-2" });
      r2.appendChild(field("مرجع", el("input", {
        class: "input", value: f.ref,
        oninput: (e) => f.ref = e.target.value,
      })));
      r2.appendChild(field("ملاحظة", el("input", {
        class: "input", value: f.note,
        oninput: (e) => f.note = e.target.value,
      })));
      root.appendChild(r2);
    };
    renderForm();
  }, {
    onSave: () => {
      if (!Number(f.weight)) { toast("أدخل الوزن"); return false; }
      store.addTx(partyId, {
        kind: "gold",
        direction,
        date: f.date,
        karat: f.karat,
        weight: Number(f.weight),
        form: f.form,
        ref: f.ref.trim(),
        note: f.note.trim(),
      });
      onDone();
      toast("تم تسجيل حركة الذهب");
    },
  });
}
