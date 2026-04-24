/**
 * pages/bank-cash.js — دفتر البنك والصندوق
 */
import { bankCash } from "../db.js";
import {
  $, el, money, todayISO, toast, confirmAsk, openModal, field,
  emptyState, pageHead, LABELS,
} from "../utils.js";

export function renderBankCash(container) {
  container.innerHTML = "";
  container.appendChild(pageHead("الدفاتر", "دفتر البنك والصندوق",
    "إدارة الحسابات البنكية والصندوق النقدي، وتسجيل الإيداع والسحب والتحويلات بين الحسابات."));

  const toolbar = el("div", { class: "daily-toolbar" }, [
    el("button", {
      class: "btn btn-primary",
      onclick: () => openAccountForm(null, render),
    }, "+ إضافة حساب"),
    el("button", {
      class: "btn btn-ghost", style: "margin-inline-start:8px",
      onclick: () => openTxForm(null, render),
    }, "+ تسجيل حركة"),
    el("div", { class: "spacer" }),
    el("button", { class: "btn btn-ghost", onclick: () => window.print() }, "🖨  طباعة"),
  ]);
  container.appendChild(toolbar);

  const totals = el("div", { id: "bcTotals" });
  container.appendChild(totals);

  const body = el("div", { id: "bcBody" });
  container.appendChild(body);

  function render() {
    const accounts = bankCash.accounts.all();
    totals.innerHTML = "";
    const grid = el("div", { class: "kpi-grid" });
    grid.appendChild(kpi("إجمالي السيولة", money(bankCash.totalCash()), "val-pos"));
    grid.appendChild(kpi("عدد الحسابات", String(accounts.length), ""));
    totals.appendChild(grid);

    body.innerHTML = "";
    if (!accounts.length) {
      body.appendChild(emptyState("🏦", "لا توجد حسابات بعد.",
        "أضف حساباً بنكياً أو صندوقاً نقدياً للبدء."));
      return;
    }
    // Account cards grid
    const accGrid = el("div", { class: "summary-grid" });
    for (const a of accounts) {
      const bal = bankCash.balance(a.id);
      const card = el("div", { class: "sum-card" }, [
        el("h4", {}, [
          a.type === "bank" ? "🏦 " : "💵 ",
          a.name,
          el("span", { class: "muted", style: "font-size:11px;margin-inline-start:8px" },
            LABELS.accountType[a.type]),
        ]),
        a.bank_name ? el("div", { class: "sum-line" }, [
          el("span", { class: "lbl" }, "البنك"), el("span", { class: "val" }, a.bank_name)
        ]) : null,
        a.iban ? el("div", { class: "sum-line" }, [
          el("span", { class: "lbl" }, "الآيبان"), el("span", { class: "val", style: "font-family:monospace;font-size:12px" }, a.iban)
        ]) : null,
        el("div", { class: "sum-line" }, [
          el("span", { class: "lbl" }, "الافتتاحي"),
          el("span", { class: "val" }, money(a.opening)),
        ]),
        el("div", { class: "sum-line net" }, [
          el("span", { class: "lbl" }, "الرصيد الحالي"),
          el("span", { class: "val " + (bal >= 0 ? "val-pos" : "val-neg") }, money(bal)),
        ]),
        el("div", { style: "display:flex;gap:6px;margin-top:10px;flex-wrap:wrap" }, [
          el("button", { class: "btn btn-sm btn-primary",
            onclick: () => openTxForm(a.id, render) }, "حركة"),
          el("button", { class: "btn btn-sm btn-ghost",
            onclick: () => openTxList(a.id) }, "السجل"),
          el("button", { class: "btn btn-sm btn-ghost",
            onclick: () => openAccountForm(a.id, render) }, "تعديل"),
          el("button", { class: "btn btn-sm btn-danger",
            onclick: () => {
              if (confirmAsk("حذف الحساب " + a.name + "؟")) {
                bankCash.accounts.remove(a.id);
                render(); toast("تم الحذف");
              }
            } }, "حذف"),
        ]),
      ]);
      accGrid.appendChild(card);
    }
    body.appendChild(accGrid);
  }
  render();
}

function kpi(label, value, cls) {
  return el("div", { class: "kpi-card" }, [
    el("div", { class: "kpi-label" }, label),
    el("div", { class: "kpi-value " + (cls || "") }, value),
  ]);
}

function openAccountForm(id, onDone) {
  const exist = id ? bankCash.accounts.byId(id) : null;
  const f = {
    name: exist?.name || "",
    type: exist?.type || "bank",
    bank_name: exist?.bank_name || "",
    iban: exist?.iban || "",
    opening: exist?.opening ?? 0,
  };
  openModal(exist ? "تعديل الحساب" : "إضافة حساب", (root) => {
    const renderForm = () => {
      root.innerHTML = "";
      root.appendChild(field("نوع الحساب", el("div", { class: "seg two-col" }, [
        el("button", { class: f.type === "bank" ? "active" : "",
          onclick: () => { f.type = "bank"; renderForm(); } }, "بنكي"),
        el("button", { class: f.type === "cash" ? "active" : "",
          onclick: () => { f.type = "cash"; renderForm(); } }, "صندوق نقدي"),
      ])));
      root.appendChild(field("اسم الحساب *", el("input", {
        class: "input", value: f.name, oninput: (e) => f.name = e.target.value,
        placeholder: "مثال: الراجحي - الجاري",
      })));
      if (f.type === "bank") {
        const r = el("div", { class: "grid-2" });
        r.appendChild(field("اسم البنك", el("input", {
          class: "input", value: f.bank_name, oninput: (e) => f.bank_name = e.target.value,
        })));
        r.appendChild(field("رقم الآيبان", el("input", {
          class: "input", value: f.iban, oninput: (e) => f.iban = e.target.value,
        })));
        root.appendChild(r);
      }
      root.appendChild(field("الرصيد الافتتاحي (ر.س)", el("input", {
        class: "input", type: "number", step: "0.01", value: f.opening,
        oninput: (e) => f.opening = e.target.value,
      })));
    };
    renderForm();
  }, {
    onSave: () => {
      if (!f.name.trim()) { toast("أدخل اسم الحساب"); return false; }
      if (exist) bankCash.accounts.update(id, f);
      else bankCash.accounts.add(f);
      onDone(); toast("تم الحفظ");
    }
  });
}

function openTxForm(defaultAccId, onDone) {
  const accounts = bankCash.accounts.all();
  if (!accounts.length) { toast("أضف حساباً أولاً"); return; }
  const f = {
    type: "deposit",
    account_id: defaultAccId || accounts[0].id,
    to_account_id: accounts[1]?.id || accounts[0].id,
    amount: "",
    date: todayISO(),
    note: "",
  };
  openModal("تسجيل حركة", (root) => {
    const renderForm = () => {
      root.innerHTML = "";
      root.appendChild(field("نوع الحركة", el("div", { class: "seg" }, [
        el("button", { class: f.type === "deposit" ? "active" : "",
          onclick: () => { f.type = "deposit"; renderForm(); } }, "إيداع"),
        el("button", { class: f.type === "withdraw" ? "active" : "",
          onclick: () => { f.type = "withdraw"; renderForm(); } }, "سحب"),
        el("button", { class: f.type === "transfer" ? "active" : "",
          onclick: () => { f.type = "transfer"; renderForm(); } }, "تحويل"),
      ])));
      root.appendChild(field(f.type === "transfer" ? "من حساب" : "الحساب",
        accountSelect(accounts, f.account_id, (v) => f.account_id = v)));
      if (f.type === "transfer") {
        root.appendChild(field("إلى حساب",
          accountSelect(accounts, f.to_account_id, (v) => f.to_account_id = v)));
      }
      const r = el("div", { class: "grid-2" });
      r.appendChild(field("التاريخ", el("input", {
        class: "input", type: "date", value: f.date,
        oninput: (e) => f.date = e.target.value,
      })));
      r.appendChild(field("المبلغ (ر.س)", el("input", {
        class: "input", type: "number", step: "0.01", value: f.amount,
        oninput: (e) => f.amount = e.target.value,
      })));
      root.appendChild(r);
      root.appendChild(field("ملاحظة", el("input", {
        class: "input", value: f.note, oninput: (e) => f.note = e.target.value,
      })));
    };
    renderForm();
  }, {
    onSave: () => {
      if (!Number(f.amount)) { toast("أدخل المبلغ"); return false; }
      if (f.type === "transfer" && f.account_id === f.to_account_id) {
        toast("لا يمكن التحويل لنفس الحساب"); return false;
      }
      bankCash.tx.add({
        type: f.type, account_id: f.account_id,
        to_account_id: f.type === "transfer" ? f.to_account_id : null,
        amount: Number(f.amount), date: f.date, note: f.note.trim(),
      });
      onDone(); toast("تم تسجيل الحركة");
    }
  });
}

function accountSelect(accounts, value, onChange) {
  const sel = el("select", { class: "input",
    onchange: (e) => onChange(e.target.value),
  });
  for (const a of accounts) {
    const opt = el("option", { value: a.id }, `${a.name} (${LABELS.accountType[a.type]})`);
    if (a.id === value) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}

function openTxList(accountId) {
  const acc = bankCash.accounts.byId(accountId);
  if (!acc) return;
  openModal("سجل الحركات: " + acc.name, (root) => {
    const txs = bankCash.tx.byAccount(accountId);
    if (!txs.length) {
      root.appendChild(emptyState("📋", "لا حركات بعد.")); return;
    }
    const wrap = el("div", { class: "ledger-wrap" });
    const table = el("table", { class: "ledger" });
    table.appendChild(el("thead", {}, el("tr", {}, [
      el("th", {}, "التاريخ"), el("th", {}, "النوع"),
      el("th", { class: "num" }, "المبلغ"),
      el("th", {}, "ملاحظة"), el("th", {}, ""),
    ])));
    const tbody = el("tbody");
    for (const t of txs) {
      const isOut = (t.type === "withdraw") ||
                    (t.type === "transfer" && t.account_id === accountId);
      const isIn  = (t.type === "deposit")  ||
                    (t.type === "transfer" && t.to_account_id === accountId);
      const sign = isOut ? "−" : "+";
      const cls = isOut ? "val-neg" : "val-pos";
      let label = LABELS.bankTxType[t.type] || t.type;
      if (t.type === "transfer") {
        const other = isOut
          ? bankCash.accounts.byId(t.to_account_id)?.name
          : bankCash.accounts.byId(t.account_id)?.name;
        label = "تحويل " + (isOut ? "إلى " : "من ") + (other || "—");
      }
      tbody.appendChild(el("tr", {}, [
        el("td", {}, t.date || "—"),
        el("td", {}, label),
        el("td", { class: "num " + cls }, sign + money(t.amount)),
        el("td", {}, t.note || "—"),
        el("td", {}, el("button", {
          class: "btn btn-sm btn-danger",
          onclick: () => {
            if (confirmAsk("حذف هذه الحركة؟")) {
              bankCash.tx.remove(t.id);
              document.querySelector(".modal.open")?.remove();
              toast("تم الحذف");
              window.dispatchEvent(new HashChangeEvent("hashchange"));
            }
          },
        }, "حذف")),
      ]));
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    root.appendChild(wrap);
  });
}
