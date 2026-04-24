/**
 * pages/inventory.js — دفتر المخزون
 */
import { inventory } from "../db.js";
import {
  $, el, money, weight, num, toast, confirmAsk, openModal, field,
  emptyState, pageHead, LABELS,
} from "../utils.js";

let state = { filter: "available", search: "" };

export function renderInventory(container) {
  container.innerHTML = "";
  container.appendChild(pageHead("الدفاتر", "دفتر المخزون",
    "جرد القطع المخزّنة من ذهب وفضة، مع وزنها وعيارها وموقعها وحالتها."));

  const toolbar = el("div", { class: "daily-toolbar" }, [
    el("button", {
      class: "btn btn-primary",
      onclick: () => openItemForm(null, render),
    }, "+ قطعة جديدة"),
    el("div", { class: "tabs" }, [
      el("button", {
        class: state.filter === "available" ? "active" : "",
        onclick: () => { state.filter = "available"; render(); },
      }, "المتوفر"),
      el("button", {
        class: state.filter === "reserved" ? "active" : "",
        onclick: () => { state.filter = "reserved"; render(); },
      }, "المحجوز"),
      el("button", {
        class: state.filter === "sold" ? "active" : "",
        onclick: () => { state.filter = "sold"; render(); },
      }, "المباع"),
      el("button", {
        class: state.filter === "all" ? "active" : "",
        onclick: () => { state.filter = "all"; render(); },
      }, "الكل"),
    ]),
    el("input", {
      class: "input", type: "search", placeholder: "بحث (SKU / اسم)…",
      style: "max-width:200px",
      oninput: (e) => { state.search = e.target.value.toLowerCase(); render(); },
    }),
    el("div", { class: "spacer" }),
    el("button", { class: "btn btn-ghost", onclick: () => window.print() }, "🖨  طباعة"),
  ]);
  container.appendChild(toolbar);

  const totals = el("div", { id: "invTotals" });
  const body   = el("div", { id: "invBody" });
  container.appendChild(totals);
  container.appendChild(body);

  function render() {
    const t = inventory.totals();
    totals.innerHTML = "";
    const grid = el("div", { class: "kpi-grid" });
    grid.appendChild(kpi("ذهب متوفر (جم)", num(t.weightG), "val-pos"));
    grid.appendChild(kpi("قيمة الذهب", money(t.valueG), ""));
    grid.appendChild(kpi("فضة متوفرة (جم)", num(t.weightS), "val-pos"));
    grid.appendChild(kpi("قيمة الفضة", money(t.valueS), ""));
    grid.appendChild(kpi("عدد القطع", String(t.count), ""));
    totals.appendChild(grid);

    body.innerHTML = "";
    let list = state.filter === "all"
      ? inventory.all()
      : inventory.byStatus(state.filter);
    if (state.search) {
      list = list.filter(i =>
        (i.sku || "").toLowerCase().includes(state.search) ||
        (i.name || "").toLowerCase().includes(state.search));
    }
    if (!list.length) {
      body.appendChild(emptyState("📦", "لا توجد قطع تطابق الفلتر."));
      return;
    }
    const wrap = el("div", { class: "ledger-wrap" });
    const table = el("table", { class: "ledger" });
    table.appendChild(el("thead", {}, el("tr", {}, [
      el("th", {}, "SKU"),
      el("th", {}, "الاسم"),
      el("th", {}, "الصنف"),
      el("th", { class: "num" }, "الوزن"),
      el("th", { class: "num" }, "تكلفة الجرام"),
      el("th", { class: "num" }, "القيمة"),
      el("th", {}, "الموقع"),
      el("th", {}, "الحالة"),
      el("th", {}, ""),
    ])));
    const tb = el("tbody");
    for (const i of list) {
      const value = (Number(i.weight) || 0) * (Number(i.cost_price) || 0);
      tb.appendChild(el("tr", {}, [
        el("td", {}, i.sku || "—"),
        el("td", {}, [
          el("strong", {}, i.name || "—"),
          i.note ? el("div", { class: "muted" }, i.note) : null,
        ]),
        el("td", {}, el("span", {
          class: "metal-chip metal-" + (i.category) + "-" + (i.karat),
        }, `${i.category === "gold" ? "ذهب" : "فضة"} ${i.karat} · ${LABELS.form[i.form]}`)),
        el("td", { class: "num" }, weight(i.weight)),
        el("td", { class: "num" }, money(i.cost_price)),
        el("td", { class: "num" }, money(value)),
        el("td", {}, i.location || "—"),
        el("td", {}, statusChip(i.status)),
        el("td", {}, [
          el("button", {
            class: "btn btn-sm btn-ghost", style: "margin-inline-end:4px",
            onclick: () => openItemForm(i.id, render),
          }, "تعديل"),
          el("button", {
            class: "btn btn-sm btn-danger",
            onclick: () => {
              if (confirmAsk("حذف هذه القطعة؟")) {
                inventory.remove(i.id); render(); toast("تم الحذف");
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
  const map = { available: "type-in", reserved: "type-out", sold: "type-out" };
  return el("span", {
    class: "type-chip " + (map[status] || ""),
  }, LABELS.inventoryStatus[status] || status);
}

function openItemForm(id, onDone) {
  const exist = id ? inventory.all().find(x => x.id === id) : null;
  const f = {
    sku: exist?.sku || "",
    name: exist?.name || "",
    category: exist?.category || "gold",
    karat: exist?.karat || "21",
    form: exist?.form || "worked",
    weight: exist?.weight || "",
    cost_price: exist?.cost_price || "",
    location: exist?.location || "",
    status: exist?.status || "available",
    note: exist?.note || "",
  };
  openModal(exist ? "تعديل قطعة" : "قطعة جديدة", (root) => {
    const renderForm = () => {
      root.innerHTML = "";
      const r1 = el("div", { class: "grid-2" });
      r1.appendChild(field("SKU / كود", el("input", {
        class: "input", value: f.sku, oninput: (e) => f.sku = e.target.value,
        placeholder: "G-001",
      })));
      r1.appendChild(field("الاسم", el("input", {
        class: "input", value: f.name, oninput: (e) => f.name = e.target.value,
        placeholder: "طقم زفاف، خاتم، …",
      })));
      root.appendChild(r1);

      root.appendChild(field("الصنف", el("div", { class: "seg two-col" }, [
        el("button", { class: f.category === "gold" ? "active" : "",
          onclick: () => { f.category = "gold"; f.karat = "21"; renderForm(); } }, "ذهب"),
        el("button", { class: f.category === "silver" ? "active" : "",
          onclick: () => { f.category = "silver"; f.karat = "925"; renderForm(); } }, "فضة"),
      ])));

      const karats = f.category === "gold" ? LABELS.goldKarats : LABELS.silverPurities;
      root.appendChild(field(f.category === "gold" ? "العيار" : "النقاء",
        el("div", { class: "seg" }, karats.map(k =>
          el("button", { class: f.karat === k ? "active" : "",
            onclick: () => { f.karat = k; renderForm(); } }, k)))));

      root.appendChild(field("الشكل", el("div", { class: "seg" },
        ["worked", "broken", "pure"].map(fm =>
          el("button", { class: f.form === fm ? "active" : "",
            onclick: () => { f.form = fm; renderForm(); } }, LABELS.form[fm])))));

      const r2 = el("div", { class: "grid-2" });
      r2.appendChild(field("الوزن (جرام) *", el("input", {
        class: "input", type: "number", step: "0.001", value: f.weight,
        oninput: (e) => f.weight = e.target.value,
      })));
      r2.appendChild(field("تكلفة الجرام (ر.س)", el("input", {
        class: "input", type: "number", step: "0.01", value: f.cost_price,
        oninput: (e) => f.cost_price = e.target.value,
      })));
      root.appendChild(r2);

      const r3 = el("div", { class: "grid-2" });
      r3.appendChild(field("الموقع", el("input", {
        class: "input", value: f.location, oninput: (e) => f.location = e.target.value,
        placeholder: "خزنة 1، رف A، …",
      })));
      const sel = el("select", { class: "input",
        onchange: (e) => f.status = e.target.value });
      for (const [k, v] of Object.entries(LABELS.inventoryStatus)) {
        const o = el("option", { value: k }, v);
        if (k === f.status) o.selected = true;
        sel.appendChild(o);
      }
      r3.appendChild(field("الحالة", sel));
      root.appendChild(r3);

      root.appendChild(field("ملاحظة", el("textarea", {
        class: "textarea", oninput: (e) => f.note = e.target.value,
      }, f.note)));
    };
    renderForm();
  }, {
    onSave: () => {
      if (!Number(f.weight)) { toast("أدخل الوزن"); return false; }
      if (exist) inventory.update(id, f);
      else inventory.add(f);
      onDone(); toast("تم الحفظ");
    }
  });
}
