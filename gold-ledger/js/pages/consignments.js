/**
 * pages/consignments.js — دفتر العهد
 * قطع ذهب تخرج من المحل لمندوب/موظف لبيعها خارج المحل،
 * يرجع إما بفلوس أو قطع أو مختلط.
 */
import { consignments, bankCash } from "../db.js";
import {
  $, el, money, num, todayISO, toast, confirmAsk, openModal, field,
  emptyState, pageHead, LABELS,
} from "../utils.js";

function n(v) { const x = Number(v); return isFinite(x) ? x : 0; }

let state = { filter: "open" };

export function renderConsignments(container) {
  container.innerHTML = "";
  container.appendChild(pageHead("الدفاتر", "دفتر العهد",
    "ذهب يخرج من المحل لمندوب/صانع لبيعه خارجاً، يرجع كاش أو قطع أو مختلط."));

  const toolbar = el("div", { class: "daily-toolbar" }, [
    el("button", {
      class: "btn btn-primary",
      onclick: () => openConsignmentForm(null, render),
    }, "+ إضافة عهدة جديدة"),
    el("div", { class: "tabs" }, [
      el("button", {
        class: state.filter === "open" ? "active" : "",
        onclick: () => { state.filter = "open"; render(); },
      }, "مفتوحة"),
      el("button", {
        class: state.filter === "closed" ? "active" : "",
        onclick: () => { state.filter = "closed"; render(); },
      }, "مقفلة"),
      el("button", {
        class: state.filter === "all" ? "active" : "",
        onclick: () => { state.filter = "all"; render(); },
      }, "الكل"),
    ]),
    el("div", { class: "spacer" }),
    el("button", { class: "btn btn-ghost", onclick: () => window.print() }, "🖨  طباعة"),
  ]);
  container.appendChild(toolbar);

  const totals = el("div", { id: "consTotals" });
  const body   = el("div", { id: "consBody" });
  container.appendChild(totals);
  container.appendChild(body);

  function render() {
    const t = consignments.totals();
    totals.innerHTML = "";
    const grid = el("div", { class: "kpi-grid" });
    grid.appendChild(kpi("عهد مفتوحة", String(t.openCount), ""));
    grid.appendChild(kpi("ذهب متبقي عند المندوبين", num(t.remainingWeight) + " جم", "val-pos"));
    grid.appendChild(kpi("نقد رجع من العهد", money(t.cashReturned), ""));
    totals.appendChild(grid);

    body.innerHTML = "";
    let list = state.filter === "all"
      ? consignments.all()
      : consignments.byStatus(state.filter);
    list = list.sort((a,b) => (b.date_out || "").localeCompare(a.date_out || ""));
    if (!list.length) {
      body.appendChild(emptyState("📗", "لا توجد عهد.",
        "اضغط زر «إضافة عهدة جديدة» للبدء."));
      return;
    }
    const wrap = el("div", { class: "ledger-wrap" });
    const table = el("table", { class: "ledger" });
    table.appendChild(el("thead", {}, el("tr", {}, [
      el("th", {}, "التاريخ"),
      el("th", {}, "المندوب/الموظف"),
      el("th", { class: "num" }, "وزن خارج"),
      el("th", { class: "num" }, "وزن رجع"),
      el("th", { class: "num" }, "كاش رجع"),
      el("th", { class: "num" }, "متبقي"),
      el("th", { class: "num" }, "القيمة المتوقعة"),
      el("th", {}, "الحالة"),
      el("th", {}, ""),
    ])));
    const tb = el("tbody");
    for (const c of list) {
      const remaining = n(c.remaining_weight);
      const cls = remaining > 0 ? "val-pos" : "val-neg";
      tb.appendChild(el("tr", {}, [
        el("td", {}, c.date_out || "—"),
        el("td", {}, [
          el("strong", {}, c.person || "—"),
          c.note ? el("div", { class: "muted" }, c.note) : null,
        ]),
        el("td", { class: "num" }, num(c.total_weight_out) + " جم"),
        el("td", { class: "num val-neg" }, num(c.total_returned_weight) + " جم"),
        el("td", { class: "num" }, money(c.total_returned_cash)),
        el("td", { class: "num " + cls }, num(remaining) + " جم"),
        el("td", { class: "num" }, money(c.expected_value)),
        el("td", {}, statusChip(c.status)),
        el("td", {}, [
          el("button", {
            class: "btn btn-sm btn-primary", style: "margin-inline-end:4px",
            onclick: () => openConsignmentDetail(c.id, render),
          }, "تفاصيل"),
          el("button", {
            class: "btn btn-sm btn-danger",
            onclick: () => {
              if (confirmAsk("حذف هذه العهدة بكل حركاتها؟")) {
                consignments.remove(c.id); render(); toast("تم الحذف");
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
function statusChip(status) {
  if (status === "closed") {
    return el("span", { class: "type-chip type-out" }, "مقفلة");
  }
  return el("span", { class: "type-chip type-in" }, "مفتوحة");
}

/* ===== Add new consignment ===== */
function openConsignmentForm(id, onDone) {
  const exist = id ? consignments.byId(id) : null;
  const f = {
    date_out: exist?.date_out || todayISO(),
    person: exist?.person || "",
    items: exist ? [...(exist.items_out || [])] : [emptyItem()],
    note: exist?.note || "",
  };
  openModal(exist ? "تعديل عهدة" : "إضافة عهدة جديدة", (root) => {
    const renderForm = () => {
      root.innerHTML = "";
      const r1 = el("div", { class: "grid-2" });
      r1.appendChild(field("اسم المندوب/الموظف *", el("input", {
        class: "input", value: f.person, oninput: (e) => f.person = e.target.value,
      })));
      r1.appendChild(field("تاريخ الخروج", el("input", {
        class: "input", type: "date", value: f.date_out,
        oninput: (e) => f.date_out = e.target.value,
      })));
      root.appendChild(r1);

      root.appendChild(el("h4", { style: "margin-top:18px;margin-bottom:8px" }, "القطع الخارجة"));
      root.appendChild(el("div", { class: "muted", style: "font-size:12px;margin-bottom:8px" },
        "الوصف | الوزن (جم) | العيار | الشكل | العدد | سعر/جم"));

      f.items.forEach((it, idx) => {
        const ir = el("div", {
          style: "display:grid;grid-template-columns:2fr 0.9fr 0.7fr 1fr 0.7fr 1fr auto;gap:6px;margin-bottom:6px",
        }, [
          el("input", { class: "input", placeholder: "خاتم...", value: it.description,
            oninput: (e) => it.description = e.target.value }),
          el("input", { class: "input", type: "number", step: "0.001", placeholder: "وزن", value: it.weight,
            oninput: (e) => { it.weight = e.target.value; updateTotals(); } }),
          karatSelect(it.karat, (v) => it.karat = v),
          formSelect(it.form, (v) => it.form = v),
          el("input", { class: "input", type: "number", step: "1", value: it.count || 1,
            oninput: (e) => { it.count = e.target.value; updateTotals(); } }),
          el("input", { class: "input", type: "number", step: "0.01", placeholder: "سعر", value: it.price_per_gram,
            oninput: (e) => { it.price_per_gram = e.target.value; updateTotals(); } }),
          el("button", {
            class: "btn btn-sm btn-danger", title: "حذف",
            onclick: () => { f.items.splice(idx, 1); renderForm(); },
          }, "✕"),
        ]);
        root.appendChild(ir);
      });
      root.appendChild(el("button", {
        class: "btn btn-sm btn-ghost",
        onclick: () => { f.items.push(emptyItem()); renderForm(); },
      }, "+ سطر آخر"));

      const totalsBox = el("div", { id: "consTotalsBox", style: "margin-top:16px;padding:12px;background:var(--panel);border-radius:8px;border:1px solid var(--border)" });
      root.appendChild(totalsBox);
      function updateTotals() {
        const tw = f.items.reduce((s,i) => s + (n(i.weight) * (n(i.count) || 1)), 0);
        const tv = f.items.reduce((s,i) => s + (n(i.weight) * (n(i.count) || 1) * n(i.price_per_gram)), 0);
        totalsBox.innerHTML = "";
        totalsBox.appendChild(el("div", { class: "between" }, [
          el("strong", {}, "إجمالي الوزن: " + num(tw) + " جم"),
          el("strong", {}, "القيمة المتوقعة: " + money(tv)),
        ]));
      }
      updateTotals();

      root.appendChild(field("ملاحظة", el("textarea", {
        class: "textarea", oninput: (e) => f.note = e.target.value,
      }, f.note)));
    };
    renderForm();
  }, {
    onSave: () => {
      if (!f.person.trim()) { toast("أدخل اسم المندوب"); return false; }
      const valid = f.items.filter(i => n(i.weight) > 0);
      if (!valid.length) { toast("أضف قطعة واحدة على الأقل بوزن"); return false; }
      const payload = {
        date_out: f.date_out,
        person: f.person.trim(),
        items_out: valid,
        note: f.note.trim(),
      };
      if (exist) {
        // التعديل بسيط: نعيد كتابة items وحفظها
        const c = consignments.byId(id);
        const totalW = valid.reduce((s,i) => s + n(i.weight) * (n(i.count) || 1), 0);
        const expV   = valid.reduce((s,i) => s + n(i.weight) * (n(i.count) || 1) * n(i.price_per_gram), 0);
        consignments.update(id, {
          date_out: payload.date_out,
          person: payload.person,
          items_out: valid.map(it => ({
            id: it.id || (Date.now().toString(36) + Math.random().toString(36).slice(2,8)),
            description: it.description || "",
            weight: n(it.weight),
            karat: it.karat || "21",
            form: it.form || "worked",
            count: n(it.count) || 1,
            price_per_gram: n(it.price_per_gram),
          })),
          total_weight_out: totalW,
          expected_value: expV,
          remaining_weight: totalW - n(c.total_returned_weight || 0),
          note: payload.note,
        });
      } else {
        consignments.add(payload);
      }
      onDone(); toast("تم الحفظ");
    }
  });
}

function emptyItem() {
  return { description: "", weight: "", karat: "21", form: "worked", count: 1, price_per_gram: "" };
}
function karatSelect(value, onChange) {
  const sel = el("select", { class: "input", onchange: (e) => onChange(e.target.value) });
  for (const k of LABELS.goldKarats) {
    const o = el("option", { value: k }, k);
    if (k === value) o.selected = true;
    sel.appendChild(o);
  }
  return sel;
}
function formSelect(value, onChange) {
  const sel = el("select", { class: "input", onchange: (e) => onChange(e.target.value) });
  for (const fm of ["worked", "broken", "pure"]) {
    const o = el("option", { value: fm }, LABELS.form[fm]);
    if (fm === value) o.selected = true;
    sel.appendChild(o);
  }
  return sel;
}

/* ===== Consignment detail (with returns) ===== */
function openConsignmentDetail(id, onDone) {
  const c = consignments.byId(id);
  if (!c) return;
  openModal("تفاصيل العهدة", (root) => {
    const refresh = () => {
      const fresh = consignments.byId(id);
      if (!fresh) return;
      root.innerHTML = "";

      // Header
      root.appendChild(el("div", { class: "between mb-20" }, [
        el("div", {}, [
          el("strong", { style: "font-size:16px" }, fresh.person),
          el("div", { class: "muted" }, "تاريخ الخروج: " + fresh.date_out),
          fresh.note ? el("div", { class: "muted" }, fresh.note) : null,
        ]),
        el("div", { class: "text-end" }, [
          statusChip(fresh.status),
          fresh.closed_at ? el("div", { class: "muted", style: "font-size:11px;margin-top:4px" },
            "أُقفلت: " + fresh.closed_at.slice(0,10)) : null,
        ]),
      ]));

      // KPIs
      root.appendChild(el("div", { class: "kpi-grid" }, [
        kpi("وزن خرج", num(fresh.total_weight_out) + " جم", ""),
        kpi("وزن رجع", num(fresh.total_returned_weight) + " جم", "val-neg"),
        kpi("متبقي", num(fresh.remaining_weight) + " جم",
          fresh.remaining_weight > 0 ? "val-pos" : "val-neg"),
        kpi("نقد رجع", money(fresh.total_returned_cash), ""),
        kpi("القيمة المتوقعة", money(fresh.expected_value), ""),
      ]));

      // قائمة القطع الخارجة
      root.appendChild(el("h4", { style: "margin-top:20px" }, "القطع الخارجة"));
      const itemsTable = el("table", { class: "ledger" });
      itemsTable.appendChild(el("thead", {}, el("tr", {}, [
        el("th", {}, "الوصف"),
        el("th", { class: "num" }, "الوزن"),
        el("th", {}, "العيار"),
        el("th", {}, "الشكل"),
        el("th", { class: "num" }, "العدد"),
        el("th", { class: "num" }, "سعر/جم"),
      ])));
      const itb = el("tbody");
      for (const it of (fresh.items_out || [])) {
        itb.appendChild(el("tr", {}, [
          el("td", {}, it.description || "—"),
          el("td", { class: "num" }, num(it.weight) + " جم"),
          el("td", {}, it.karat),
          el("td", {}, LABELS.form[it.form]),
          el("td", { class: "num" }, String(it.count || 1)),
          el("td", { class: "num" }, money(it.price_per_gram)),
        ]));
      }
      itemsTable.appendChild(itb);
      root.appendChild(el("div", { class: "ledger-wrap" }, itemsTable));

      // الإرجاعات
      root.appendChild(el("div", { class: "between", style: "margin-top:24px;align-items:center" }, [
        el("h4", { style: "margin:0" }, "الإرجاعات"),
        el("div", { style: "display:flex;gap:8px" }, [
          fresh.status === "open" ? el("button", {
            class: "btn btn-sm btn-primary",
            onclick: () => openReturnForm(id, refresh, onDone),
          }, "+ إضافة إرجاع") : null,
          fresh.status === "open" && fresh.remaining_weight <= 0 ? el("button", {
            class: "btn btn-sm btn-ghost",
            onclick: () => {
              if (confirmAsk("إقفال هذه العهدة؟")) {
                consignments.close(id); refresh(); onDone(); toast("تم الإقفال");
              }
            },
          }, "إقفال العهدة") : null,
          fresh.status === "closed" ? el("button", {
            class: "btn btn-sm btn-ghost",
            onclick: () => { consignments.reopen(id); refresh(); onDone(); toast("تم الفتح"); },
          }, "إعادة فتح") : null,
        ].filter(Boolean)),
      ]));

      const returns = (fresh.returns || []).slice().sort((a,b) => (b.date || "").localeCompare(a.date || ""));
      if (!returns.length) {
        root.appendChild(emptyState("↩️", "لا إرجاعات بعد."));
      } else {
        const rTable = el("table", { class: "ledger" });
        rTable.appendChild(el("thead", {}, el("tr", {}, [
          el("th", {}, "التاريخ"),
          el("th", {}, "النوع"),
          el("th", { class: "num" }, "كاش"),
          el("th", { class: "num" }, "وزن قطع"),
          el("th", {}, "ملاحظة"),
          el("th", {}, ""),
        ])));
        const rtb = el("tbody");
        for (const r of returns) {
          const totalW = (r.items_returned || []).reduce((s,i) => s + n(i.weight_returned), 0);
          rtb.appendChild(el("tr", {}, [
            el("td", {}, r.date || "—"),
            el("td", {}, returnTypeLabel(r.type)),
            el("td", { class: "num" }, r.cash_amount ? money(r.cash_amount) : "—"),
            el("td", { class: "num" }, totalW ? (num(totalW) + " جم") : "—"),
            el("td", {}, r.note || "—"),
            el("td", {}, fresh.status === "open" ? el("button", {
              class: "btn btn-sm btn-danger",
              onclick: () => {
                if (confirmAsk("حذف هذا الإرجاع؟")) {
                  consignments.removeReturn(id, r.id);
                  refresh(); onDone(); toast("تم الحذف");
                }
              },
            }, "حذف") : null),
          ]));
        }
        rTable.appendChild(rtb);
        root.appendChild(el("div", { class: "ledger-wrap" }, rTable));
      }
    };
    refresh();
  });
}

function returnTypeLabel(t) {
  return t === "cash" ? "💰 فلوس فقط"
       : t === "items" ? "🪙 قطع فقط"
       : t === "mixed" ? "💰🪙 مختلط"
       : t || "—";
}

/* ===== Add return ===== */
function openReturnForm(consId, refreshDetail, refreshList) {
  const c = consignments.byId(consId);
  if (!c) return;
  const accounts = bankCash.accounts.all();
  const f = {
    type: "cash",
    date: todayISO(),
    cash_amount: "",
    account_id: accounts[0]?.id || null,
    items_returned: (c.items_out || []).map(it => ({
      item_id: it.id,
      description: it.description,
      weight: it.weight,
      karat: it.karat,
      form: it.form,
      count: it.count,
      count_returned: 0,
      weight_returned: 0,
    })),
    note: "",
  };
  openModal("إضافة إرجاع", (root) => {
    const renderForm = () => {
      root.innerHTML = "";
      root.appendChild(field("نوع الإرجاع", el("div", { class: "seg" }, [
        el("button", { class: f.type === "cash" ? "active" : "",
          onclick: () => { f.type = "cash"; renderForm(); }
        }, "💰 فلوس فقط"),
        el("button", { class: f.type === "items" ? "active" : "",
          onclick: () => { f.type = "items"; renderForm(); }
        }, "🪙 قطع فقط"),
        el("button", { class: f.type === "mixed" ? "active" : "",
          onclick: () => { f.type = "mixed"; renderForm(); }
        }, "💰🪙 مختلط"),
      ])));

      root.appendChild(field("تاريخ الإرجاع", el("input", {
        class: "input", type: "date", value: f.date,
        oninput: (e) => f.date = e.target.value,
      })));

      // Cash inputs
      if (f.type === "cash" || f.type === "mixed") {
        const r = el("div", { class: "grid-2" });
        r.appendChild(field("المبلغ (ر.س)", el("input", {
          class: "input", type: "number", step: "0.01", value: f.cash_amount,
          oninput: (e) => f.cash_amount = e.target.value,
        })));
        // Account select
        if (accounts.length) {
          const sel = el("select", { class: "input",
            onchange: (e) => f.account_id = e.target.value });
          for (const a of accounts) {
            const o = el("option", { value: a.id }, `${a.name} (${LABELS.accountType[a.type]})`);
            if (a.id === f.account_id) o.selected = true;
            sel.appendChild(o);
          }
          r.appendChild(field("إلى حساب", sel,
            "ستُضاف الفلوس لرصيد هذا الحساب"));
        }
        root.appendChild(r);
      }

      // Items inputs
      if (f.type === "items" || f.type === "mixed") {
        root.appendChild(el("h4", { style: "margin-top:14px" }, "اختر القطع التي رجعت"));
        for (const item of f.items_returned) {
          const cap = n(item.count) || 1;
          const wpu = n(item.weight); // weight per unit
          const ir = el("div", {
            style: "display:grid;grid-template-columns:2.5fr 0.8fr 1fr;gap:8px;margin-bottom:6px;align-items:center;padding:8px;background:var(--panel);border-radius:6px",
          }, [
            el("div", {}, [
              el("strong", {}, item.description || "—"),
              el("div", { class: "muted", style: "font-size:11px" },
                `عيار ${item.karat} · ${LABELS.form[item.form]} · أصل: ${cap} قطعة (${num(wpu)} جم/قطعة)`),
            ]),
            el("input", {
              class: "input", type: "number", min: "0", max: cap, value: item.count_returned,
              oninput: (e) => {
                const c = Math.min(Number(e.target.value) || 0, cap);
                item.count_returned = c;
                item.weight_returned = c * wpu;
                e.target.parentElement.querySelector(".weight-display").textContent = num(item.weight_returned) + " جم";
              },
              placeholder: "عدد رجع",
            }),
            el("div", { class: "weight-display num", style: "font-weight:600" }, num(item.weight_returned) + " جم"),
          ]);
          root.appendChild(ir);
        }
      }

      root.appendChild(field("ملاحظة", el("textarea", {
        class: "textarea", oninput: (e) => f.note = e.target.value,
      }, f.note)));
    };
    renderForm();
  }, {
    onSave: () => {
      const cashOk = (f.type === "cash" || f.type === "mixed") && Number(f.cash_amount) > 0;
      const itemsOk = (f.type === "items" || f.type === "mixed") &&
        f.items_returned.some(it => n(it.weight_returned) > 0);
      if (f.type === "cash" && !cashOk) { toast("أدخل المبلغ"); return false; }
      if (f.type === "items" && !itemsOk) { toast("اختر قطعة واحدة على الأقل"); return false; }
      if (f.type === "mixed" && !cashOk && !itemsOk) { toast("أدخل مبلغاً أو قطعاً"); return false; }

      const ret = {
        date: f.date,
        type: f.type,
        cash_amount: cashOk ? Number(f.cash_amount) : 0,
        items_returned: f.items_returned
          .filter(it => n(it.weight_returned) > 0)
          .map(it => ({
            item_id: it.item_id,
            count_returned: it.count_returned,
            weight_returned: it.weight_returned,
          })),
        account_id: cashOk ? f.account_id : null,
        note: f.note.trim(),
      };
      consignments.addReturn(consId, ret);
      // إذا فيه مبلغ نقدي، نسجّله في حساب البنك المختار كحركة إيداع
      if (cashOk && f.account_id) {
        bankCash.tx.add({
          type: "deposit",
          account_id: f.account_id,
          amount: Number(f.cash_amount),
          date: f.date,
          note: "إرجاع عهدة من " + (c.person || ""),
        });
      }
      refreshDetail(); refreshList(); toast("تم تسجيل الإرجاع");
    }
  });
}
