/**
 * pages/advances.js — دفتر السلف (نقدية + ذهبية)
 */
import { advances } from "../db.js";
import {
  $, el, money, weight, num, todayISO, toast, confirmAsk, openModal, field,
  emptyState, pageHead, LABELS,
} from "../utils.js";

function n(v) { const x = Number(v); return isFinite(x) ? x : 0; }

let state = { filter: "all" };

export function renderAdvances(container) {
  container.innerHTML = "";
  container.appendChild(pageHead("الدفاتر", "دفتر السلف",
    "تتبع السلف الممنوحة (نقدية أو ذهبية) للموظفين والصاغة، مع جدول السداد."));

  const toolbar = el("div", { class: "daily-toolbar" }, [
    el("button", {
      class: "btn btn-primary",
      onclick: () => openAdvanceForm(null, render),
    }, "+ سلفة جديدة"),
    el("div", { class: "tabs" }, [
      el("button", {
        class: state.filter === "all" ? "active" : "",
        onclick: () => { state.filter = "all"; render(); },
      }, "الكل"),
      el("button", {
        class: state.filter === "cash" ? "active" : "",
        onclick: () => { state.filter = "cash"; render(); },
      }, "💰 نقدية"),
      el("button", {
        class: state.filter === "gold" ? "active" : "",
        onclick: () => { state.filter = "gold"; render(); },
      }, "🪙 ذهبية"),
    ]),
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
    grid.appendChild(kpi("سلف نقدية غير مسددة", money(t.outstandingCash), "val-pos"));
    grid.appendChild(kpi("سلف ذهبية غير مسددة", num(t.outstandingGold) + " جم", "val-pos"));
    grid.appendChild(kpi("عدد السلف", String(t.count), ""));
    totals.appendChild(grid);

    body.innerHTML = "";
    let list = state.filter === "all"
      ? advances.all()
      : advances.byType(state.filter);
    list = list.sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    if (!list.length) {
      body.appendChild(emptyState("📕", "لا توجد سلف."));
      return;
    }
    const wrap = el("div", { class: "ledger-wrap" });
    const table = el("table", { class: "ledger" });
    table.appendChild(el("thead", {}, el("tr", {}, [
      el("th", {}, "التاريخ"),
      el("th", {}, "المستفيد"),
      el("th", {}, "النوع"),
      el("th", {}, "التفاصيل"),
      el("th", { class: "num" }, "الأصلي"),
      el("th", { class: "num" }, "المسدد"),
      el("th", { class: "num" }, "المتبقي"),
      el("th", {}, "الحالة"),
      el("th", {}, ""),
    ])));
    const tb = el("tbody");
    for (const a of list) {
      const isGold = (a.type || "cash") === "gold";
      const original = isGold ? n(a.gold_weight) : n(a.amount);
      const paid = (a.payments || []).reduce((s,p) => s + (isGold ? n(p.weight) : n(p.amount)), 0);
      const remaining = original - paid;
      const fmt = isGold ? (v) => num(v) + " جم" : (v) => money(v);
      const cls = remaining > 0 ? "val-pos" : "val-neg";
      tb.appendChild(el("tr", {}, [
        el("td", {}, a.date || "—"),
        el("td", {}, [
          el("strong", {}, a.person || "—"),
          a.note ? el("div", { class: "muted" }, a.note) : null,
        ]),
        el("td", {}, el("span", {
          class: "metal-chip " + (isGold ? "metal-gold-21" : "metal-cash"),
        }, isGold ? "🪙 ذهب" : "💰 نقد")),
        el("td", {}, isGold
          ? `${LABELS.form[a.gold_form]} · عيار ${a.gold_karat}`
          : LABELS.advanceKind[a.kind] || "—"),
        el("td", { class: "num" }, fmt(original)),
        el("td", { class: "num val-neg" }, fmt(paid)),
        el("td", { class: "num " + cls }, fmt(remaining)),
        el("td", {}, statusChip(a.status, remaining)),
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
function statusChip(status, remaining) {
  if (remaining <= 0 || status === "settled") {
    return el("span", { class: "type-chip type-out" }, "مسددة");
  }
  return el("span", { class: "type-chip type-in" }, "نشطة");
}

function openAdvanceForm(id, onDone) {
  const exist = id ? advances.byId(id) : null;
  const f = {
    type: exist?.type || "cash",
    kind: exist?.kind || "employee",
    person: exist?.person || "",
    amount: exist?.amount || "",
    gold_weight: exist?.gold_weight || "",
    gold_karat: exist?.gold_karat || "21",
    gold_form: exist?.gold_form || "worked",
    date: exist?.date || todayISO(),
    due_date: exist?.due_date || "",
    note: exist?.note || "",
  };
  openModal(exist ? "تعديل سلفة" : "سلفة جديدة", (root) => {
    const renderForm = () => {
      root.innerHTML = "";

      // نوع السلفة (نقدية / ذهبية)
      root.appendChild(field("نوع السلفة", el("div", { class: "seg two-col" }, [
        el("button", {
          class: f.type === "cash" ? "active" : "",
          onclick: () => { f.type = "cash"; renderForm(); },
        }, "💰 سلفة نقدية"),
        el("button", {
          class: f.type === "gold" ? "active" : "",
          onclick: () => { f.type = "gold"; renderForm(); },
        }, "🪙 سلفة ذهب"),
      ])));

      // نوع المستفيد
      root.appendChild(field("نوع المستفيد", el("div", { class: "seg" },
        Object.entries(LABELS.advanceKind).map(([k, v]) =>
          el("button", {
            class: f.kind === k ? "active" : "",
            onclick: () => { f.kind = k; renderForm(); },
          }, v)),
      )));

      // اسم المستفيد
      root.appendChild(field("اسم المستفيد *", el("input", {
        class: "input", value: f.person, oninput: (e) => f.person = e.target.value,
      })));

      // الحقول حسب النوع
      if (f.type === "cash") {
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
      } else {
        // gold
        root.appendChild(field("العيار",
          el("div", { class: "seg" }, LABELS.goldKarats.map(k =>
            el("button", {
              class: f.gold_karat === k ? "active" : "",
              onclick: () => { f.gold_karat = k; renderForm(); },
            }, k)))));
        root.appendChild(field("الشكل",
          el("div", { class: "seg" }, ["worked", "broken", "pure"].map(fm =>
            el("button", {
              class: f.gold_form === fm ? "active" : "",
              onclick: () => { f.gold_form = fm; renderForm(); },
            }, LABELS.form[fm])))));
        const r = el("div", { class: "grid-2" });
        r.appendChild(field("التاريخ", el("input", {
          class: "input", type: "date", value: f.date,
          oninput: (e) => f.date = e.target.value,
        })));
        r.appendChild(field("الوزن (جرام) *", el("input", {
          class: "input", type: "number", step: "0.001", value: f.gold_weight,
          oninput: (e) => f.gold_weight = e.target.value,
        })));
        root.appendChild(r);
      }

      root.appendChild(field("تاريخ الاستحقاق (اختياري)", el("input", {
        class: "input", type: "date", value: f.due_date,
        oninput: (e) => f.due_date = e.target.value,
      })));

      root.appendChild(field("ملاحظة", el("textarea", {
        class: "textarea", oninput: (e) => f.note = e.target.value,
      }, f.note)));
    };
    renderForm();
  }, {
    onSave: () => {
      if (!f.person.trim()) { toast("أدخل اسم المستفيد"); return false; }
      if (f.type === "cash" && !Number(f.amount)) { toast("أدخل المبلغ"); return false; }
      if (f.type === "gold" && !Number(f.gold_weight)) { toast("أدخل وزن الذهب"); return false; }
      if (exist) advances.update(id, f);
      else advances.add(f);
      onDone(); toast("تم الحفظ");
    }
  });
}

function openPaymentsModal(id, onDone) {
  const a = advances.byId(id);
  if (!a) return;
  const isGold = (a.type || "cash") === "gold";
  openModal((isGold ? "🪙 سداد سلفة ذهب: " : "💰 سداد سلفة نقدية: ") + (a.person || ""),
    (root) => {
    const refresh = () => {
      const fresh = advances.byId(id);
      if (!fresh) return;
      const original = isGold ? n(fresh.gold_weight) : n(fresh.amount);
      const paid = (fresh.payments || []).reduce((s,p) => s + (isGold ? n(p.weight) : n(p.amount)), 0);
      const remaining = original - paid;
      const fmt = isGold ? (v) => num(v) + " جم" : (v) => money(v);
      root.innerHTML = "";

      root.appendChild(el("div", { class: "kpi-grid" }, [
        kpi("الأصلي", fmt(original), ""),
        kpi("المسدد", fmt(paid), "val-neg"),
        kpi("المتبقي", fmt(remaining), remaining > 0 ? "val-pos" : "val-neg"),
      ]));

      const f = { date: todayISO(), amount: "", weight: "", note: "" };
      const addBox = el("div", { class: "card", style: "margin:16px 0" }, [
        el("h4", { style: "margin-top:0" }, "تسجيل دفعة"),
        el("div", { class: "grid-2" }, [
          field("التاريخ", el("input", {
            class: "input", type: "date", value: f.date,
            oninput: (e) => f.date = e.target.value,
          })),
          isGold
            ? field("الوزن (جم)", el("input", {
                class: "input", type: "number", step: "0.001",
                oninput: (e) => f.weight = e.target.value,
              }))
            : field("المبلغ (ر.س)", el("input", {
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
            const v = isGold ? Number(f.weight) : Number(f.amount);
            if (!v) { toast("أدخل القيمة"); return; }
            advances.addPayment(id, {
              date: f.date,
              amount: isGold ? 0 : v,
              weight: isGold ? v : 0,
              note: f.note.trim(),
            });
            toast("تم تسجيل الدفعة"); refresh(); onDone();
          },
        }, "إضافة دفعة")),
      ]);
      root.appendChild(addBox);

      const pays = (fresh.payments || []).slice().sort((x,y) => (y.date || "").localeCompare(x.date || ""));
      if (!pays.length) {
        root.appendChild(emptyState("📋", "لا دفعات بعد."));
        return;
      }
      const wrap = el("div", { class: "ledger-wrap" });
      const table = el("table", { class: "ledger" });
      table.appendChild(el("thead", {}, el("tr", {}, [
        el("th", {}, "التاريخ"),
        el("th", { class: "num" }, isGold ? "الوزن" : "المبلغ"),
        el("th", {}, "ملاحظة"),
        el("th", {}, ""),
      ])));
      const tb = el("tbody");
      for (const p of pays) {
        tb.appendChild(el("tr", {}, [
          el("td", {}, p.date),
          el("td", { class: "num val-neg" }, isGold ? (num(p.weight) + " جم") : money(p.amount)),
          el("td", {}, p.note || "—"),
          el("td", {}, el("button", {
            class: "btn btn-sm btn-danger",
            onclick: () => {
              if (confirmAsk("حذف هذه الدفعة؟")) {
                advances.removePayment(id, p.id);
                toast("تم الحذف"); refresh(); onDone();
              }
            },
          }, "حذف")),
        ]));
      }
      table.appendChild(tb);
      wrap.appendChild(table);
      root.appendChild(wrap);
    };
    refresh();
  });
}
