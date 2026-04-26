/**
 * pages/party.js — صفحة مشتركة للموردين والعملاء
 * يستخدمها suppliers.js و customers.js
 *
 * الفرق عن النسخة القديمة: تدعم رصيد ذهب بالأعيرة + رصيد نقد بشكل منفصل،
 * مع كشف حساب احترافي بأعمدة (ذهب 18/21/22/24 + فلوس).
 */
import { suppliers, customers, bankCash } from "../db.js?v=11";
import {
  $, el, money, num, todayISO, toast, confirmAsk, openModal, field,
  emptyState, pageHead, LABELS,
} from "../utils.js?v=11";

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
      onclick: () => openGoldTxModal(store, kind, id, "out", refres