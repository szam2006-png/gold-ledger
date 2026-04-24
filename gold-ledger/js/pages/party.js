/**
 * pages/_party.js — صفحة مشتركة للموردين والعملاء
 * يستخدمها suppliers.js و customers.js
 */
import { suppliers, customers } from "../db.js";
import {
  $, el, money, todayISO, toast, confirmAsk, openModal, field,
  emptyState, pageHead, LABELS,
} from "../utils.js";

let state = { kind: "supplier", selectedId: null };

export function renderParty(container, { kind }) {
  state.kind = kind;
  state.selectedId = null;
  const store = kind === "supplier" ? suppliers : customers;

  container.innerHTML = "";
  container.appendChild(pageHead(
    "الدفاتر",
    kind === "supplier" ? "دفتر الموردين" : "دفتر العملاء",
    kind === "supplier"
      ? "إدارة قائمة الموردين، حركاتهم، والأرصدة المستحقة لهم."
      : "إدارة قائمة العملاء، حركاتهم، والأرصدة المستحقة عليهم."
  ));

  // Toolbar
  const toolbar = el("div", { class: "daily-toolbar" }, [
    el("button", {
      class: "btn btn-primary",
      onclick: () => openPartyForm(store, kind, null, () => render()),
    }, kind === "supplier" ? "+ إضافة مورد" : "+ إضافة عميل"),
    el("div", { class: "spacer" }),
    el("button", { class: "btn btn-ghost", onclick: () => window.print(), title: "طباعة" }, "🖨  طباعة"),
  ]);
  container.appendChild(toolbar);

  // Totals strip
  const totalsBox = el("div", { id: "partyTotals" });
  container.appendChild(totalsBox);

  // Body
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
  grid.appendChild(kpi(
    kind === "supplier" ? "إجمالي مستحق للموردين" : "إجمالي مستحق على العملاء",
    money(t.positive),
    "val-pos"
  ));
  grid.appendChild(kpi(
    kind === "supplier" ? "أرصدة لصالحنا (سلف للمورد)" : "أرصدة لصالح العميل (دفع زائد)",
    money(t.negative),
    "val-neg"
  ));
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
    body.appendChild(emptyState("👥",
      kind === "supplier" ? "لا يوجد موردين بعد." : "لا يوجد عملاء بعد.",
      "اضغط زر الإضافة في الأعلى."));
    return;
  }
  const wrap = el("div", { class: "ledger-wrap" });
  const table = el("table", { class: "ledger" });
  table.appendChild(el("thead", {}, el("tr", {}, [
    el("th", {}, "الاسم"),
    el("th", {}, "الجوال"),
    el("th", { class: "num" }, "الرصيد الافتتاحي"),
    el("th", { class: "num" }, "الحركات"),
    el("th", { class: "num" }, "الرصيد الحالي"),
    el("th", {}, "إجراءات"),
  ])));
  const tbody = el("tbody");
  for (const p of list.sort((a,b) => a.name.localeCompare(b.name, "ar"))) {
    const bal = store.balance(p.id);
    const balCls = bal > 0 ? "val-pos" : (bal < 0 ? "val-neg" : "");
    tbody.appendChild(el("tr", {}, [
      el("td", {}, [
        el("strong", {}, p.name || "—"),
        p.notes ? el("div", { class: "muted" }, p.notes) : null,
      ]),
      el("td", {}, p.phone || "—"),
      el("td", { class: "num" }, money(p.opening)),
      el("td", { class: "num" }, String((p.transactions || []).length)),
      el("td", { class: "num " + balCls }, money(bal)),
      el("td", {}, [
        el("button", {
          class: "btn btn-sm btn-primary", style: "margin-inline-end:4px",
          onclick: () => openPartyDetail(store, kind, p.id, rerender),
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

function openPartyForm(store, kind, id, onDone) {
  const existing = id ? store.byId(id) : null;
  const form = {
    name: existing?.name || "",
    phone: existing?.phone || "",
    opening: existing?.opening ?? 0,
    notes: existing?.notes || "",
  };
  openModal(
    existing ? "تعديل البيانات" : (kind === "supplier" ? "إضافة مورد" : "إضافة عميل"),
    (root) => {
      root.appendChild(field("الاسم *", el("input", {
        class: "input", value: form.name, oninput: (e) => form.name = e.target.value,
        placeholder: "اسم الجهة",
      })));
      const row = el("div", { class: "grid-2" });
      row.appendChild(field("الجوال", el("input", {
        class: "input", value: form.phone, oninput: (e) => form.phone = e.target.value,
        placeholder: "05xxxxxxxx",
      })));
      row.appendChild(field("الرصيد الافتتاحي (ر.س)", el("input", {
        class: "input", type: "number", step: "0.01", value: form.opening,
        oninput: (e) => form.opening = e.target.value,
      }), kind === "supplier"
        ? "موجب: نحن مدينون له. سالب: هو مدين لنا."
        : "موجب: هو مدين لنا. سالب: نحن مدينون له."));
      root.appendChild(row);
      root.appendChild(field("ملاحظات", el("textarea", {
        class: "textarea", oninput: (e) => form.notes = e.target.value,
      }, form.notes)));
    },
    {
      onSave: () => {
        if (!form.name.trim()) { toast("أدخل الاسم"); return false; }
        if (existing) store.update(id, form);
        else store.add(form);
        onDone();
        toast("تم الحفظ");
      }
    }
  );
}

function openPartyDetail(store, kind, id, onDone) {
  const p = store.byId(id);
  if (!p) return;
  openModal(
    "كشف حساب: " + (p.name || ""),
    (root) => renderDetail(root, store, kind, id, () => {
      // Re-render detail content
      const fresh = store.byId(id);
      if (!fresh) return;
      root.innerHTML = "";
      renderDetail(root, store, kind, id, onDone);
      onDone();
    }),
  );
}

function renderDetail(root, store, kind, id, refresh) {
  const p = store.byId(id);
  if (!p) return;
  const bal = store.balance(id);
  const balCls = bal > 0 ? "val-pos" : (bal < 0 ? "val-neg" : "");

  root.appendChild(el("div", { class: "between mb-20" }, [
    el("div", {}, [
      el("strong", {}, p.name || "—"),
      el("div", { class: "muted" }, p.phone ? "📞 " + p.phone : ""),
    ]),
    el("div", { class: "text-end" }, [
      el("div", { class: "muted" }, "الرصيد الحالي"),
      el("div", { class: "kpi-value " + balCls }, money(bal)),
    ]),
  ]));

  // Add tx button
  const txForm = {
    type: "in",
    amount: "",
    date: todayISO(),
    ref: "",
    note: "",
  };
  const addBox = el("div", { class: "card", style: "margin-bottom:16px" }, [
    el("h4", { style: "margin-top:0" }, "إضافة حركة جديدة"),
    el("div", { class: "seg two-col", style: "margin-bottom:10px" }, [
      el("button", {
        id: "ptxIn", class: "active",
        onclick: (e) => {
          txForm.type = "in";
          e.target.classList.add("active");
          e.target.nextElementSibling.classList.remove("active");
        }
      }, LABELS.partyTxType[kind].in),
      el("button", {
        onclick: (e) => {
          txForm.type = "out";
          e.target.classList.add("active");
          e.target.previousElementSibling.classList.remove("active");
        }
      }, LABELS.partyTxType[kind].out),
    ]),
    el("div", { class: "grid-2" }, [
      field("التاريخ", el("input", {
        class: "input", type: "date", value: txForm.date,
        oninput: (e) => txForm.date = e.target.value,
      })),
      field("المبلغ (ر.س)", el("input", {
        class: "input", type: "number", step: "0.01",
        oninput: (e) => txForm.amount = e.target.value,
      })),
    ]),
    el("div", { class: "grid-2" }, [
      field("مرجع (اختياري)", el("input", {
        class: "input", oninput: (e) => txForm.ref = e.target.value,
      })),
      field("ملاحظة", el("input", {
        class: "input", oninput: (e) => txForm.note = e.target.value,
      })),
    ]),
    el("div", { style: "text-align:end" }, el("button", {
      class: "btn btn-primary",
      onclick: () => {
        if (!Number(txForm.amount)) { toast("أدخل المبلغ"); return; }
        store.addTx(id, {
          type: txForm.type,
          date: txForm.date,
          amount: Number(txForm.amount),
          ref: txForm.ref.trim(),
          note: txForm.note.trim(),
        });
        toast("تمت إضافة الحركة");
        refresh();
      },
    }, "إضافة الحركة")),
  ]);
  root.appendChild(addBox);

  // Transactions list
  const txs = (p.transactions || []).slice().sort((a,b) => (b.date || "").localeCompare(a.date || ""));
  if (!txs.length) {
    root.appendChild(emptyState("📋", "لا توجد حركات بعد."));
    return;
  }

  const wrap = el("div", { class: "ledger-wrap" });
  const table = el("table", { class: "ledger" });
  table.appendChild(el("thead", {}, el("tr", {}, [
    el("th", {}, "التاريخ"),
    el("th", {}, "النوع"),
    el("th", { class: "num" }, "المبلغ"),
    el("th", {}, "المرجع"),
    el("th", {}, "ملاحظة"),
    el("th", {}, ""),
  ])));
  const tbody = el("tbody");
  let inSum = 0, outSum = 0;
  for (const t of txs) {
    if (t.type === "in") inSum += Number(t.amount) || 0;
    else outSum += Number(t.amount) || 0;
    tbody.appendChild(el("tr", {}, [
      el("td", {}, t.date || "—"),
      el("td", {}, el("span", {
        class: "type-chip " + (t.type === "in" ? "type-in" : "type-out"),
      }, t.type === "in" ? "+ مستحق" : "- دفعة")),
      el("td", { class: "num " + (t.type === "in" ? "val-pos" : "val-neg") },
        (t.type === "in" ? "+" : "−") + money(t.amount)),
      el("td", {}, t.ref || "—"),
      el("td", {}, t.note || "—"),
      el("td", {}, el("button", {
        class: "btn btn-sm btn-danger",
        onclick: () => {
          if (confirmAsk("حذف هذه الحركة؟")) {
            store.removeTx(id, t.id);
            toast("تم الحذف");
            refresh();
          }
        },
      }, "حذف")),
    ]));
  }
  table.appendChild(tbody);
  table.appendChild(el("tfoot", {}, el("tr", {}, [
    el("td", { colspan: "2" }, "الإجماليات"),
    el("td", { class: "num" }, [
      el("div", { class: "val-pos" }, "+" + money(inSum)),
      el("div", { class: "val-neg" }, "−" + money(outSum)),
    ]),
    el("td", { colspan: "3" }, el("strong", { class: balCls },
      "الرصيد: " + money(bal))),
  ])));
  wrap.appendChild(table);
  root.appendChild(wrap);
}
