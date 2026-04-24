/**
 * pages/advances.js — دفتر السلف
 */
import { advances } from "../db.js";
import {
  $, el, money, todayISO, toast, confirmAsk, openModal, field,
  emptyState, pageHead, LABELS,
} from "../utils.js";

export function renderAdvances(container) {
  container.innerHTML = "";
  container.appendChild(pageHead("الدفاتر", "دفتر السلف",
    "تتبع السلف الممنوحة للموظفين والعملاء، مع جدول السداد لكل سلفة."));

  const toolbar = el("div", { class: "daily-toolbar" }, [
    el("button", {
      class: "btn btn-primary",
      onclick: () => openAdvanceForm(null, render),
    }, "+ سلفة جديدة"),
    el("div", { class: "spacer" }),
    el("button", { class: "btn btn-ghost", onclick: () => window.print() }, "🖨  طباعة"),
  ]);
  container.appendChild(toolbar);

  const totals = el("div", { id: "advTotals" });
  const body   = el("div", { id: "advBody" });
  container.appendChild(totals);
  container.appendChild(body);

  function render() {
    const t = advances.totals();
    totals.innerHTML = "";
    const grid = el("div", { class: "kpi-grid" });
    grid.appendChild(kpi("إجمالي السلف غير المسددة", money(t.outstanding), "val-pos"));
    grid.appendChild(kpi("عدد السلف", String(t.count), ""));
    totals.appendChild(grid);

    body.innerHTML = "";
    const list = advances.all().sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    if (!list.length) {
      body.appendChild(emptyState("💰", "لا توجد سلف."));
      return;
    }
    const wrap = el("div", { class: "ledger-wrap" });
    const table = el("table", { class: "ledger" });
    table.appendChild(el("thead", {}, el("tr", {}, [
      el("th", {}, "التاريخ"),
      el("th", {}, "المستفيد"),
      el("th", {}, "النوع"),
      el("th", { class: "num" }, "المبلغ"),
      el("th", { class: "num" }, "المسدد"),
      el("th", { class: "num" }, "المتبقي"),
      el("th", {}, ""),
    ])));
    const tb = el("tbody");
    for (const a of list) {
      const paid = (a.payments || []).reduce((s,p) => s + (Number(p.amount)||0), 0);
      const remaining = (Number(a.amount) || 0) - paid;
      const cls = remaining > 0 ? "val-pos" : "val-neg";
      tb.appendChild(el("tr", {}, [
        el("td", {}, a.date || "—"),
        el("td", {}, [
          el("strong", {}, a.person || "—"),
          a.note ? el("div", { class: "muted" }, a.note) : null,
        ]),
        el("td", {}, el("span", { class: "metal-chip" }, LABELS.advanceKind[a.kind] || "—")),
        el("td", { class: "num" }, money(a.amount)),
        el("td", { class: "num val-neg" }, money(paid)),
        el("td", { class: "num " + cls }, money(remaining)),
        el("td", {}, [
          el("button", {
            class: "btn btn-sm btn-primary", style: "margin-inline-end:4px",
            onclick: () => openPaymentsModal(a.id, render),
          }, "سداد"),
          el("button", {
            class: "btn btn-sm btn-ghost", style: "margin-inline-end:4px",
            onclick: () => openAdvanceForm(a.id, render),
          }, "تعديل"),
          el("button", {
            class: "btn btn-sm btn-danger",
            onclick: () => {
              if (confirmAsk("حذف هذه السلفة؟")) {
                advances.remove(a.id); render(); toast("تم الحذف");
              }
            },
          }, "حذف"),
        ]),
      ]));
    }
    table.appendChild(tb);
    wrap.appendChild(table);
    body.appendChild(wrap);
  }
  render();
}

function kpi(label, value, cls) {
  return el("div", { class: "kpi-card" }, [
    el("div", { class: "kpi-label" }, label),
    el("div", { class: "kpi-value " + (cls || "") }, value),
  ]);
}

function openAdvanceForm(id, onDone) {
  const exist = id ? advances.all().find(x => x.id === id) : null;
  const f = {
    person: exist?.person || "",
    kind: exist?.kind || "employee",
    amount: exist?.amount || "",
    date: exist?.date || todayISO(),
    note: exist?.note || "",
  };
  openModal(exist ? "تعديل سلفة" : "سلفة جديدة", (root) => {
    const renderForm = () => {
      root.innerHTML = "";
      root.appendChild(field("نوع المستفيد", el("div", { class: "seg" },
        Object.entries(LABELS.advanceKind).map(([k, v]) =>
          el("button", {
            class: f.kind === k ? "active" : "",
            onclick: () => { f.kind = k; renderForm(); },
          }, v)),
      )));
      root.appendChild(field("اسم المستفيد *", el("input", {
        class: "input", value: f.person, oninput: (e) => f.person = e.target.value,
      })));
      const r = el("div", { class: "grid-2" });
      r.appendChild(field("التاريخ", el("input", {
        class: "input", type: "date", value: f.date,
        oninput: (e) => f.date = e.target.value,
      })));
      r.appendChild(field("المبلغ (ر.س) *", el("input", {
        class: "input", type: "number", step: "0.01", value: f.amount,
        oninput: (e) => f.amount = e.target.value,
      })));
      root.appendChild(r);
      root.appendChild(field("ملاحظة", el("textarea", {
        class: "textarea", oninput: (e) => f.note = e.target.value,
      }, f.note)));
    };
    renderForm();
  }, {
    onSave: () => {
      if (!f.person.trim()) { toast("أدخل اسم المستفيد"); return false; }
      if (!Number(f.amount)) { toast("أدخل المبلغ"); return false; }
      if (exist) advances.update(id, f);
      else advances.add(f);
      onDone(); toast("تم الحفظ");
    }
  });
}

function openPaymentsModal(id, onDone) {
  const a = advances.all().find(x => x.id === id);
  if (!a) return;
  openModal("سداد سلفة: " + (a.person || ""), (root) => {
    const refresh = () => {
      const fresh = advances.all().find(x => x.id === id);
      if (!fresh) return;
      root.innerHTML = "";
      const paid = (fresh.payments || []).reduce((s,p) => s + (Number(p.amount)||0), 0);
      const remaining = (Number(fresh.amount) || 0) - paid;

      root.appendChild(el("div", { class: "kpi-grid" }, [
        kpi("المبلغ الأصلي", money(fresh.amount), ""),
        kpi("المسدد", money(paid), "val-neg"),
        kpi("المتبقي", money(remaining), remaining > 0 ? "val-pos" : "val-neg"),
      ]));

      // Add payment
      const f = { date: todayISO(), amount: "", note: "" };
      const addBox = el("div", { class: "card", style: "margin:16px 0" }, [
        el("h4", { style: "margin-top:0" }, "تسجيل دفعة"),
        el("div", { class: "grid-2" }, [
          field("التاريخ", el("input", {
            class: "input", type: "date", value: f.date,
            oninput: (e) => f.date = e.target.value,
          })),
          field("المبلغ", el("input", {
            class: "input", type: "number", step: "0.01",
            oninput: (e) => f.amount = e.target.value,
          })),
        ]),
        field("ملاحظة", el("input", {
          class: "input", oninput: (e) => f.note = e.target.value,
        })),
        el("div", { style: "text-align:end" }, el("button", {
          class: "btn btn-primary",
          onclick: () => {
            if (!Number(f.amount)) { toast("أدخل المبلغ"); return; }
            advances.addPayment(id, {
              date: f.date, amount: Number(f.amount), note: f.note.trim(),
            });
            toast("تم تسجيل الدفعة"); refresh(); onDone();
          },
        }, "إضافة دفعة")),
      ]);
      root.appendChild(addBox);

      // Payments list
      const pays = (fresh.payments || []).slice().sort((x,y) => (y.date || "").localeCompare(x.date || ""));
      if (!pays.length) {
        root.appendChild(emptyState("📋", "لا دفعات بعد."));
        return;
      }
      const wrap = el("div", { class: "ledger-wrap" });
      const table = el("table", { class: "ledger" });
      table.appendChild(el("thead", {}, el("tr", {}, [
        el("th", {}, "التاريخ"),
        el("th", { class: "num" }, "المبلغ"),
        el("th", {}, "ملاحظة"),
      ])));
      const tb = el("tbody");
      for (const p of pays) {
        tb.appendChild(el("tr", {}, [
          el("td", {}, p.date),
          el("td", { class: "num val-neg" }, money(p.amount)),
          el("td", {}, p.note || "—"),
        ]));
      }
      table.appendChild(tb);
      wrap.appendChild(table);
      root.appendChild(wrap);
    };
    refresh();
  });
}
