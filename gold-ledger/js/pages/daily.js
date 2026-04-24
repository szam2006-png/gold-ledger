/**
 * pages/daily.js — دفتر اليومية
 * - شريط أدوات: تاريخ، زر قيد جديد
 * - تبويبان: تفصيلي / إجمالي
 * - القيد: ذهب (18/21/22/24) × (مشغول/كسر/صافي)، فضة (925/999)، أو نقد
 */

import { daily } from "../db.js";
import {
  $, el, money, weight, num, formatDateLong, todayISO, nowHHMM, toast, LABELS, confirmAsk,
} from "../utils.js";

let state = {
  date: todayISO(),
  tab: "detail", // detail | summary
};

export function renderDaily(container) {
  container.innerHTML = "";
  container.appendChild(buildHeader());
  container.appendChild(buildToolbar());

  const body = el("div", { id: "dailyBody" });
  container.appendChild(body);
  renderBody(body);
}

/* ---------- Header ---------- */
function buildHeader() {
  return el("div", { class: "page-head" }, [
    el("span", { class: "page-kicker" }, "الدفاتر"),
    el("h1", { class: "page-title" }, "دفتر اليومية"),
    el("p", { class: "page-subtitle" },
      "جميع الحركات اليومية من الذهب والفضة والنقد — بعرض تفصيلي لكل قيد وعرض إجمالي مُلخّص."),
  ]);
}

/* ---------- Toolbar ---------- */
function buildToolbar() {
  const bar = el("div", { class: "daily-toolbar" });

  // Date picker
  const dateWrap = el("div", { class: "date-picker" }, [
    el("label", { for: "dailyDate", class: "text-mute" }, "التاريخ:"),
    el("input", {
      id: "dailyDate",
      type: "date",
      value: state.date,
      onchange: (e) => { state.date = e.target.value; renderBody($("#dailyBody")); },
    }),
    el("button", {
      class: "btn btn-sm btn-ghost",
      onclick: () => { state.date = todayISO(); $("#dailyDate").value = state.date; renderBody($("#dailyBody")); },
    }, "اليوم"),
  ]);

  // Tabs
  const tabs = el("div", { class: "tabs" }, [
    el("button", {
      class: state.tab === "detail" ? "active" : "",
      onclick: () => { state.tab = "detail"; renderBody($("#dailyBody")); },
    }, "تفصيلي"),
    el("button", {
      class: state.tab === "summary" ? "active" : "",
      onclick: () => { state.tab = "summary"; renderBody($("#dailyBody")); },
    }, "إجمالي"),
  ]);

  const addBtn = el("button", {
    class: "btn btn-primary",
    onclick: () => openEntryModal(),
  }, [
    el("span", { html: "+&nbsp;" }),
    document.createTextNode("قيد جديد"),
  ]);

  const printBtn = el("button", {
    class: "btn btn-ghost",
    onclick: () => window.print(),
    title: "طباعة",
  }, "🖨  طباعة");

  bar.append(dateWrap, tabs, el("div", { class: "spacer" }), printBtn, addBtn);
  return bar;
}

/* ---------- Body dispatch ---------- */
function renderBody(body) {
  body.innerHTML = "";
  // Readable date line
  const dateLine = el("div", { class: "between mb-20" }, [
    el("div", { class: "text-mute" }, formatDateLong(state.date)),
    el("div", { class: "text-mute" },
      `${daily.byDate(state.date).length} قيد`),
  ]);
  body.appendChild(dateLine);

  if (state.tab === "detail") body.appendChild(renderDetailTable());
  else body.appendChild(renderSummary());
}

/* ---------- Detail table ---------- */
function renderDetailTable() {
  const rows = daily.byDate(state.date);
  if (!rows.length) {
    return el("div", { class: "ledger-wrap empty-state" }, [
      el("div", { class: "big" }, "📒"),
      el("div", {}, "لا توجد قيود مسجلة في هذا اليوم."),
      el("div", { class: "muted", style: "margin-top:6px" },
        "اضغط «قيد جديد» لإضافة أول حركة."),
    ]);
  }

  const wrap = el("div", { class: "ledger-wrap" });
  const table = el("table", { class: "ledger" });

  table.appendChild(el("thead", {}, el("tr", {}, [
    el("th", {}, "الوقت"),
    el("th", {}, "النوع"),
    el("th", {}, "البيان"),
    el("th", {}, "الصنف"),
    el("th", { class: "num" }, "الوزن (جم)"),
    el("th", { class: "num" }, "سعر الجرام"),
    el("th", { class: "num" }, "الإجمالي"),
    el("th", {}, "الدفع"),
    el("th", {}, ""),
  ])));

  const tbody = el("tbody");
  let totalIn = 0, totalOut = 0;

  for (const r of rows) {
    if (r.flow === "in") totalIn += Number(r.total) || 0;
    else totalOut += Number(r.total) || 0;

    const categoryChip = buildCategoryChip(r);

    tbody.appendChild(el("tr", {}, [
      el("td", {}, r.time || "—"),
      el("td", {}, el("span", {
        class: "type-chip " + (r.flow === "in" ? "type-in" : "type-out"),
      }, LABELS.flow[r.flow])),
      el("td", {}, [
        el("div", {}, r.description || "—"),
        r.ref ? el("div", { class: "muted" }, "مرجع: " + r.ref) : null,
      ]),
      el("td", {}, categoryChip),
      el("td", { class: "num" }, r.category === "cash" ? "—" : num(r.weight)),
      el("td", { class: "num" }, r.category === "cash" ? "—" : (r.unit_price ? num(r.unit_price, 2) : "—")),
      el("td", { class: "num" }, el("strong", {}, money(r.total))),
      el("td", {}, LABELS.payment[r.payment_method] || "—"),
      el("td", {}, el("button", {
        class: "btn btn-sm btn-danger",
        onclick: () => {
          if (confirmAsk("حذف هذا القيد؟")) {
            daily.remove(r.id);
            renderBody($("#dailyBody"));
            toast("تم حذف القيد");
          }
        },
      }, "حذف")),
    ]));
  }
  table.appendChild(tbody);

  table.appendChild(el("tfoot", {}, el("tr", {}, [
    el("td", { colspan: "6" }, "إجمالي اليوم (نقدي + مكافئ)"),
    el("td", { class: "num" }, [
      el("div", { class: "val-pos" }, "+" + money(totalIn)),
      el("div", { class: "val-neg" }, "−" + money(totalOut)),
    ]),
    el("td", { colspan: "2" }, [
      el("strong", { class: (totalIn - totalOut) >= 0 ? "val-pos" : "val-neg" },
        "صافي: " + money(totalIn - totalOut)),
    ]),
  ])));

  wrap.appendChild(table);
  return wrap;
}

function buildCategoryChip(r) {
  if (r.category === "cash") {
    return el("span", { class: "metal-chip metal-cash" }, "نقد");
  }
  if (r.category === "gold") {
    return el("span", {
      class: "metal-chip metal-gold-" + r.karat,
    }, `ذهب ${r.karat} · ${LABELS.form[r.form]}`);
  }
  if (r.category === "silver") {
    return el("span", {
      class: "metal-chip metal-silver-" + r.karat,
    }, `فضة ${r.karat} · ${LABELS.form[r.form]}`);
  }
  return el("span", { class: "metal-chip" }, "—");
}

/* ---------- Summary view ---------- */
function renderSummary() {
  const s = daily.summaryForDate(state.date);
  const grid = el("div", { class: "summary-grid" });

  // Gold cards (18, 21, 22, 24)
  for (const karat of LABELS.goldKarats) {
    grid.appendChild(buildMetalCard({
      title: `ذهب ${karat}`,
      accent: `metal-gold-${karat}`,
      data: s.gold[karat],
    }));
  }
  // Silver cards (925, 999)
  for (const pur of LABELS.silverPurities) {
    grid.appendChild(buildMetalCard({
      title: `فضة ${pur}`,
      accent: `metal-silver-${pur}`,
      data: s.silver[pur],
    }));
  }
  // Cash card
  grid.appendChild(buildCashCard(s.cash));

  return grid;
}

function buildMetalCard({ title, accent, data }) {
  const card = el("div", { class: "sum-card" });
  card.appendChild(el("h4", {}, [
    el("span", { class: "metal-chip " + accent, style: "font-size:11px" }, title),
  ]));

  // aggregate across forms
  let totalInW = 0, totalOutW = 0, totalInAmt = 0, totalOutAmt = 0;
  const formKeys = ["worked", "broken", "pure"];

  for (const f of formKeys) {
    const slot = data[f];
    const anyMove = slot.in_w || slot.out_w || slot.in_amt || slot.out_amt;
    if (!anyMove) continue;
    totalInW += slot.in_w; totalOutW += slot.out_w;
    totalInAmt += slot.in_amt; totalOutAmt += slot.out_amt;

    card.appendChild(el("div", { class: "sum-line" }, [
      el("span", { class: "lbl" }, LABELS.form[f]),
      el("span", { class: "val" }, [
        slot.in_w ? el("span", { class: "val-pos" }, `+${num(slot.in_w)} `) : null,
        slot.out_w ? el("span", { class: "val-neg" }, `−${num(slot.out_w)} `) : null,
        el("small", { class: "text-mute" }, "جم"),
      ]),
    ]));
  }

  if (!totalInW && !totalOutW) {
    card.appendChild(el("div", { class: "text-mute", style: "padding:12px 0;font-size:13px" },
      "لا حركة اليوم."));
    return card;
  }

  const netW = totalInW - totalOutW;
  const netAmt = totalInAmt - totalOutAmt;

  card.appendChild(el("div", { class: "sum-line net" }, [
    el("span", { class: "lbl" }, "صافي الوزن"),
    el("span", { class: "val " + (netW >= 0 ? "val-pos" : "val-neg") },
      (netW >= 0 ? "+" : "") + num(netW) + " جم"),
  ]));
  if (totalInAmt || totalOutAmt) {
    card.appendChild(el("div", { class: "sum-line" }, [
      el("span", { class: "lbl" }, "صافي القيمة"),
      el("span", { class: "val " + (netAmt >= 0 ? "val-pos" : "val-neg") },
        (netAmt >= 0 ? "+" : "") + money(netAmt)),
    ]));
  }

  return card;
}

function buildCashCard(cash) {
  const card = el("div", { class: "sum-card" });
  card.appendChild(el("h4", {}, [
    el("span", { class: "metal-chip metal-cash", style: "font-size:11px" }, "النقد"),
  ]));
  card.appendChild(el("div", { class: "sum-line" }, [
    el("span", { class: "lbl" }, "قبض"),
    el("span", { class: "val val-pos" }, "+" + money(cash.in)),
  ]));
  card.appendChild(el("div", { class: "sum-line" }, [
    el("span", { class: "lbl" }, "صرف"),
    el("span", { class: "val val-neg" }, "−" + money(cash.out)),
  ]));
  const net = cash.in - cash.out;
  card.appendChild(el("div", { class: "sum-line net" }, [
    el("span", { class: "lbl" }, "صافي النقد"),
    el("span", { class: "val " + (net >= 0 ? "val-pos" : "val-neg") },
      (net >= 0 ? "+" : "") + money(net)),
  ]));
  return card;
}

/* ======================================================
   Entry Modal
   ====================================================== */
let form = null;

function defaultForm() {
  return {
    date: state.date,
    time: nowHHMM(),
    flow: "in",         // in | out
    category: "gold",   // gold | silver | cash
    karat: "21",        // 18|21|22|24 or 925|999
    form: "worked",     // worked | broken | pure
    weight: "",
    unit_price: "",
    total: "",
    payment_method: "cash",
    description: "",
    ref: "",
  };
}

function openEntryModal() {
  form = defaultForm();

  const modal = el("div", { class: "modal open", id: "entryModal" });
  const body = el("div", { class: "modal-body" });

  body.appendChild(el("div", { class: "modal-head" }, [
    el("h3", {}, "قيد جديد في اليومية"),
    el("button", {
      class: "icon-btn",
      onclick: () => modal.remove(),
    }, "✕"),
  ]));

  const content = el("div", { class: "modal-content", id: "entryContent" });
  body.appendChild(content);
  renderEntryForm(content);

  body.appendChild(el("div", { class: "modal-foot" }, [
    el("button", { class: "btn btn-primary", onclick: saveEntry }, "حفظ"),
    el("button", { class: "btn btn-ghost", onclick: () => modal.remove() }, "إلغاء"),
  ]));

  modal.appendChild(body);
  document.body.appendChild(modal);
}

function renderEntryForm(root) {
  root.innerHTML = "";

  // Flow segmented (وارد / صادر)
  root.appendChild(fieldWrap("النوع", el("div", { class: "seg two-col" }, [
    el("button", {
      class: form.flow === "in" ? "active" : "",
      onclick: () => { form.flow = "in"; renderEntryForm(root); },
    }, "وارد (قبض)"),
    el("button", {
      class: form.flow === "out" ? "active" : "",
      onclick: () => { form.flow = "out"; renderEntryForm(root); },
    }, "صادر (صرف)"),
  ])));

  // Category
  root.appendChild(fieldWrap("الصنف", el("div", { class: "seg" }, [
    ...["gold", "silver", "cash"].map(c =>
      el("button", {
        class: form.category === c ? "active" : "",
        onclick: () => {
          form.category = c;
          if (c === "gold") form.karat = "21";
          if (c === "silver") form.karat = "925";
          if (c === "cash") { form.karat = null; form.form = null; }
          else form.form = "worked";
          renderEntryForm(root);
        },
      }, LABELS.category[c])),
  ])));

  if (form.category !== "cash") {
    // Karat / purity
    const karats = form.category === "gold" ? LABELS.goldKarats : LABELS.silverPurities;
    root.appendChild(fieldWrap(form.category === "gold" ? "العيار" : "النقاء",
      el("div", { class: "seg" }, karats.map(k =>
        el("button", {
          class: form.karat === k ? "active" : "",
          onclick: () => { form.karat = k; renderEntryForm(root); },
        }, k)))));

    // Form (مشغول / كسر / صافي)
    root.appendChild(fieldWrap("الشكل",
      el("div", { class: "seg" }, ["worked", "broken", "pure"].map(f =>
        el("button", {
          class: form.form === f ? "active" : "",
          onclick: () => { form.form = f; renderEntryForm(root); },
        }, LABELS.form[f])))));

    // Weight & unit price
    const row = el("div", { class: "grid-2" });
    row.appendChild(fieldWrap("الوزن (جرام)", el("input", {
      class: "input", type: "number", step: "0.001", inputmode: "decimal",
      value: form.weight,
      oninput: (e) => { form.weight = e.target.value; recalcTotal(root); },
      placeholder: "0.000",
    })));
    row.appendChild(fieldWrap("سعر الجرام (ر.س)", el("input", {
      class: "input", type: "number", step: "0.01", inputmode: "decimal",
      value: form.unit_price,
      oninput: (e) => { form.unit_price = e.target.value; recalcTotal(root); },
      placeholder: "0.00",
    })));
    root.appendChild(row);
  }

  // Total (editable; auto-computed when weight×price filled)
  const totalInput = el("input", {
    id: "entryTotal",
    class: "input", type: "number", step: "0.01", inputmode: "decimal",
    value: form.total,
    oninput: (e) => { form.total = e.target.value; },
    placeholder: "0.00",
  });
  root.appendChild(fieldWrap(
    form.category === "cash" ? "المبلغ (ر.س)" : "الإجمالي (ر.س)",
    totalInput,
    "يُحسب تلقائياً من الوزن × السعر، ويمكن تعديله."
  ));

  // Payment method
  root.appendChild(fieldWrap("طريقة الدفع", el("div", { class: "seg" }, [
    ...Object.entries(LABELS.payment).map(([k, v]) =>
      el("button", {
        class: form.payment_method === k ? "active" : "",
        onclick: () => { form.payment_method = k; renderEntryForm(root); },
      }, v)),
  ])));

  // Description + ref + time
  const row2 = el("div", { class: "grid-2" });
  row2.appendChild(fieldWrap("الوقت", el("input", {
    class: "input", type: "time",
    value: form.time,
    oninput: (e) => form.time = e.target.value,
  })));
  row2.appendChild(fieldWrap("مرجع / رقم فاتورة (اختياري)", el("input", {
    class: "input", type: "text",
    value: form.ref,
    oninput: (e) => form.ref = e.target.value,
  })));
  root.appendChild(row2);

  root.appendChild(fieldWrap("البيان / ملاحظات", el("textarea", {
    class: "textarea",
    oninput: (e) => form.description = e.target.value,
    placeholder: "مثال: بيع طقم ذهب للعميل أحمد",
  }, form.description)));
}

function fieldWrap(label, control, hint) {
  return el("div", { class: "field" }, [
    el("label", {}, label),
    control,
    hint ? el("small", { class: "text-mute" }, hint) : null,
  ]);
}

function recalcTotal(root) {
  const w = Number(form.weight) || 0;
  const p = Number(form.unit_price) || 0;
  if (w && p) {
    form.total = (w * p).toFixed(2);
    const input = root.querySelector("#entryTotal");
    if (input) input.value = form.total;
  }
}

function saveEntry() {
  // Validation
  if (form.category !== "cash") {
    if (!Number(form.weight)) { toast("أدخل الوزن."); return; }
  }
  if (!Number(form.total)) { toast("أدخل الإجمالي / المبلغ."); return; }

  const rec = {
    date: form.date,
    time: form.time || nowHHMM(),
    flow: form.flow,
    category: form.category,
    karat: form.category === "cash" ? null : form.karat,
    form: form.category === "cash" ? null : form.form,
    weight: form.category === "cash" ? 0 : Number(form.weight) || 0,
    unit_price: form.category === "cash" ? 0 : Number(form.unit_price) || 0,
    total: Number(form.total) || 0,
    payment_method: form.payment_method,
    description: form.description.trim(),
    ref: form.ref.trim(),
  };

  daily.add(rec);
  document.getElementById("entryModal")?.remove();
  renderBody($("#dailyBody"));
  toast("تم حفظ القيد بنجاح");
}
