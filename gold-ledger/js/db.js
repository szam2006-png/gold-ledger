/**
 * db.js — طبقة تخزين البيانات (موسّعة)
 * يستخدم localStorage ويوفر واجهة بسيطة لكل دفتر.
 */

const PREFIX = "gl.";
const SCHEMA_VERSION = 2;

const keys = {
  meta:       PREFIX + "meta",
  settings:   PREFIX + "settings",
  daily:      PREFIX + "daily",
  suppliers:  PREFIX + "suppliers",
  bankCash:   PREFIX + "bankCash",
  bankTx:     PREFIX + "bankTx",
  expenses:   PREFIX + "expenses",
  advances:   PREFIX + "advances",
  inventory:    PREFIX + "inventory",
  invoices:     PREFIX + "invoices",
  consignments: PREFIX + "consignments",
  dailyMeta:    PREFIX + "dailyMeta",
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error("قراءة فاشلة:", key, e);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("كتابة فاشلة:", key, e);
    return false;
  }
}

export function uid() {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
}

function num(v) { const n = Number(v); return isFinite(n) ? n : 0; }

/* ===== init ===== */
export function initDb() {
  const meta = read(keys.meta, null);
  if (!meta) {
    write(keys.meta, {
      version: SCHEMA_VERSION,
      created_at: new Date().toISOString(),
      currency: "SAR",
    });
  } else if ((meta.version || 1) < SCHEMA_VERSION) {
    meta.version = SCHEMA_VERSION;
    write(keys.meta, meta);
  }
  // Default settings
  if (read(keys.settings, null) === null) {
    write(keys.settings, {
      shop_name: "محل الذهب",
      branch:    "الفرع الرئيسي",
      address:   "",
      phone:     "",
      tax_no:    "",
      currency:  "ر.س",
      invoice_seq: 1000,
    });
  }
  // Default bank/cash accounts
  if (read(keys.bankCash, null) === null) {
    write(keys.bankCash, [
      { id: uid(), name: "الصندوق النقدي", type: "cash",  opening: 0, created_at: new Date().toISOString() },
    ]);
  }
  // Ensure all stores exist as arrays
  for (const k of ["daily","suppliers","bankTx","expenses","advances","inventory","invoices","consignments","dailyMeta"]) {
    if (read(keys[k], null) === null) write(keys[k], []);
  }
}

/* ===== Generic store factory ===== */
function makeStore(key) {
  return {
    all() { return read(key, []); },
    byId(id) { return this.all().find(x => x.id === id) || null; },
    add(rec) {
      const list = this.all();
      const full = { id: uid(), created_at: new Date().toISOString(), ...rec };
      list.push(full);
      write(key, list);
      return full;
    },
    update(id, patch) {
      const list = this.all();
      const i = list.findIndex(x => x.id === id);
      if (i === -1) return null;
      list[i] = { ...list[i], ...patch, updated_at: new Date().toISOString() };
      write(key, list);
      return list[i];
    },
    remove(id) {
      write(key, this.all().filter(x => x.id !== id));
    },
    clear() { write(key, []); },
  };
}

/* ===== Settings ===== */
export const settings = {
  get() { return read(keys.settings, {}); },
  update(patch) {
    const cur = this.get();
    const next = { ...cur, ...patch };
    write(keys.settings, next);
    return next;
  },
  nextInvoiceNo() {
    const s = this.get();
    const n = (Number(s.invoice_seq) || 1000) + 1;
    this.update({ invoice_seq: n });
    return n;
  },
};

/* ===== Daily Ledger ===== */
const dailyStore = makeStore(keys.daily);
export const daily = {
  all() { return dailyStore.all(); },
  byId(id) { return dailyStore.byId(id); },
  byDate(dateStr) {
    return this.all()
      .filter(e => e.date === dateStr)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  },
  byRange(fromISO, toISO) {
    return this.all().filter(e => e.date >= fromISO && e.date <= toISO);
  },
  add(entry) { return dailyStore.add(entry); },
  update(id, patch) { return dailyStore.update(id, patch); },
  remove(id) { dailyStore.remove(id); },
  summaryForDate(dateStr) {
    const entries = this.byDate(dateStr);
    const sum = {
      gold:   { 18:  emptyForm(), 21: emptyForm(), 22: emptyForm(), 24: emptyForm() },
      silver: { 925: emptyForm(), 999: emptyForm() },
      cash:   { in: 0, out: 0 },
    };
    for (const e of entries) {
      if (e.category === "gold") {
        const g = sum.gold[e.karat]; if (!g) continue;
        const slot = g[e.form]; if (!slot) continue;
        if (e.flow === "in") { slot.in_w  += num(e.weight); slot.in_amt  += num(e.total); }
        else                  { slot.out_w += num(e.weight); slot.out_amt += num(e.total); }
      } else if (e.category === "silver") {
        const s = sum.silver[e.karat]; if (!s) continue;
        const slot = s[e.form]; if (!slot) continue;
        if (e.flow === "in") { slot.in_w  += num(e.weight); slot.in_amt  += num(e.total); }
        else                  { slot.out_w += num(e.weight); slot.out_amt += num(e.total); }
      } else if (e.category === "cash") {
        if (e.flow === "in") sum.cash.in  += num(e.total);
        else                  sum.cash.out += num(e.total);
      }
    }
    return sum;
  },
  overall() {
    const all = this.all();
    const today = new Date().toISOString().slice(0,10);
    return {
      totalEntries: all.length,
      todayEntries: all.filter(x => x.date === today).length,
      dates: [...new Set(all.map(x => x.date))].sort().reverse(),
    };
  }
};

function emptyForm() {
  const slot = () => ({ in_w: 0, out_w: 0, in_amt: 0, out_amt: 0 });
  return { worked: slot(), broken: slot(), pure: slot() };
}

/* ===== Suppliers / Customers (مع رصيد جاري) ===== */
function makePartyStore(storeKey) {
  const store = makeStore(storeKey);
  return {
    all() { return store.all(); },
    byId(id) { return store.byId(id); },
    add(rec) {
      return store.add({
        name: rec.name || "",
        phone: rec.phone || "",
        opening: num(rec.opening),
        notes: rec.notes || "",
        transactions: [], // [{id, date, type:'in'|'out', amount, ref, note}]
      });
    },
    update(id, patch) { return store.update(id, patch); },
    remove(id) { store.remove(id); },
    addTx(partyId, tx) {
      const p = store.byId(partyId); if (!p) return null;
      const txs = p.transactions || [];
      txs.push({ id: uid(), created_at: new Date().toISOString(), ...tx });
      return store.update(partyId, { transactions: txs });
    },
    removeTx(partyId, txId) {
      const p = store.byId(partyId); if (!p) return null;
      const txs = (p.transactions || []).filter(t => t.id !== txId);
      return store.update(partyId, { transactions: txs });
    },
    /**
     * balance: positive => the party owes you (مدين لك)
     * For suppliers: opening + (مشتريات منه) - (دفعات له) — convention varies.
     * نتبنى: المبلغ المستحق علينا للمورد (نحن مدينون له).
     * For customers: المبلغ المستحق لنا على العميل.
     * نوحّد: balance = opening + Σ(in.amount) - Σ(out.amount)
     *  - for supplier: in = شراء جديد بالآجل (يزيد ما نحن مدينون له)، out = دفعة له
     *  - for customer: in = بيع جديد بالآجل (يزيد ما هو مدين لنا)، out = دفعة منه
     */
    balance(partyId) {
      const p = store.byId(partyId); if (!p) return 0;
      const txs = p.transactions || [];
      let bal = num(p.opening);
      for (const t of txs) {
        if (t.type === "in") bal += num(t.amount);
        else                  bal -= num(t.amount);
      }
      return bal;
    },
    totals() {
      const list = store.all();
      let positive = 0, negative = 0, count = list.length;
      for (const p of list) {
        const b = this.balance(p.id);
        if (b > 0) positive += b;
        else if (b < 0) negative += Math.abs(b);
      }
      return { positive, negative, count };
    }
  };
}
export const suppliers = makePartyStore(keys.suppliers);

/* ===== Bank & Cash Accounts ===== */
const accountsStore = makeStore(keys.bankCash);
const bankTxStore   = makeStore(keys.bankTx);
export const bankCash = {
  accounts: {
    all() { return accountsStore.all(); },
    byId(id) { return accountsStore.byId(id); },
    add(rec) { return accountsStore.add({
      name: rec.name || "حساب جديد",
      type: rec.type || "bank", // bank | cash
      bank_name: rec.bank_name || "",
      iban: rec.iban || "",
      opening: num(rec.opening),
    }); },
    update(id, patch) { return accountsStore.update(id, patch); },
    remove(id) { accountsStore.remove(id); },
  },
  tx: {
    all() { return bankTxStore.all(); },
    byAccount(accountId) {
      return this.all().filter(t => t.account_id === accountId || t.to_account_id === accountId)
        .sort((a,b) => (b.date||"").localeCompare(a.date||""));
    },
    add(rec) { return bankTxStore.add(rec); },
    remove(id) { bankTxStore.remove(id); },
  },
  balance(accountId) {
    const acc = accountsStore.byId(accountId); if (!acc) return 0;
    let bal = num(acc.opening);
    for (const t of bankTxStore.all()) {
      if (t.type === "deposit"  && t.account_id === accountId) bal += num(t.amount);
      if (t.type === "withdraw" && t.account_id === accountId) bal -= num(t.amount);
      if (t.type === "transfer") {
        if (t.account_id === accountId)    bal -= num(t.amount);
        if (t.to_account_id === accountId) bal += num(t.amount);
      }
    }
    return bal;
  },
  totalCash() {
    let s = 0;
    for (const a of accountsStore.all()) s += this.balance(a.id);
    return s;
  },
};

/* ===== Expenses ===== */
const expensesStore = makeStore(keys.expenses);
export const expenses = {
  all() { return expensesStore.all(); },
  byMonth(yyyymm) { // "2026-04"
    return this.all().filter(e => (e.date || "").startsWith(yyyymm));
  },
  byDate(date) {
    return this.all().filter(e => e.date === date);
  },
  bySource(source) { // "daily" | "manual"
    return this.all().filter(e => (e.source || "manual") === source);
  },
  byDailyDate(date) {
    return this.all().filter(e => e.source === "daily" && e.daily_date === date);
  },
  add(rec) {
    return expensesStore.add({
      date: rec.date,
      category: rec.category || "أخرى",
      amount: num(rec.amount),
      description: rec.description || "",
      payment_method: rec.payment_method || "cash",
      account_id: rec.account_id || null,
      source: rec.source || "manual",        // "daily" | "manual"
      daily_date: rec.daily_date || null,    // التاريخ المرتبط إذا source=daily
    });
  },
  update(id, patch) { return expensesStore.update(id, patch); },
  remove(id) { expensesStore.remove(id); },
  totalsByCategory(yyyymm) {
    const map = {};
    for (const e of this.byMonth(yyyymm)) {
      map[e.category || "أخرى"] = (map[e.category || "أخرى"] || 0) + num(e.amount);
    }
    return map;
  },
  monthTotal(yyyymm) {
    return this.byMonth(yyyymm).reduce((s,e) => s + num(e.amount), 0);
  },
  dayTotal(date) {
    return this.byDate(date).reduce((s,e) => s + num(e.amount), 0);
  },
};

/* ===== Advances (نقدية أو ذهبية) ===== */
const advancesStore = makeStore(keys.advances);
export const advances = {
  all() { return advancesStore.all(); },
  byId(id) { return advancesStore.byId(id); },
  byType(type) { return this.all().filter(a => (a.type || "cash") === type); },
  add(rec) {
    return advancesStore.add({
      person: rec.person || "",
      kind: rec.kind || "employee",        // employee | craftsman | other
      type: rec.type || "cash",            // cash | gold
      amount: num(rec.amount),             // إذا cash
      gold_weight: num(rec.gold_weight),   // إذا gold
      gold_karat: rec.gold_karat || "21",
      gold_form: rec.gold_form || "worked",
      date: rec.date,
      due_date: rec.due_date || null,
      note: rec.note || "",
      payments: [],
      status: "active",                    // active | settled
    });
  },
  update(id, patch) { return advancesStore.update(id, patch); },
  remove(id) { advancesStore.remove(id); },
  addPayment(id, pay) {
    const a = advancesStore.byId(id); if (!a) return null;
    const arr = a.payments || [];
    // pay: { date, amount?, weight?, note }
    arr.push({
      id: uid(),
      date: pay.date,
      amount: num(pay.amount),
      weight: num(pay.weight),
      note: pay.note || "",
    });
    const r = this._calcRemaining({ ...a, payments: arr });
    const status = (r === 0) ? "settled" : "active";
    return advancesStore.update(id, { payments: arr, status });
  },
  removePayment(id, payId) {
    const a = advancesStore.byId(id); if (!a) return null;
    const arr = (a.payments || []).filter(p => p.id !== payId);
    const r = this._calcRemaining({ ...a, payments: arr });
    const status = (r === 0) ? "settled" : "active";
    return advancesStore.update(id, { payments: arr, status });
  },
  _calcRemaining(a) {
    if ((a.type || "cash") === "gold") {
      const paid = (a.payments || []).reduce((s,p) => s + num(p.weight), 0);
      return num(a.gold_weight) - paid;
    }
    const paid = (a.payments || []).reduce((s,p) => s + num(p.amount), 0);
    return num(a.amount) - paid;
  },
  remaining(id) {
    const a = advancesStore.byId(id); if (!a) return 0;
    return this._calcRemaining(a);
  },
  totals() {
    const list = this.all();
    let outstandingCash = 0, outstandingGold = 0;
    for (const a of list) {
      const r = this.remaining(a.id);
      if ((a.type || "cash") === "gold") outstandingGold += r;
      else outstandingCash += r;
    }
    return {
      count: list.length,
      outstandingCash,
      outstandingGold,
      outstanding: outstandingCash, // toBackwards-compat
    };
  },
};

/* ===== Inventory ===== */
const inventoryStore = makeStore(keys.inventory);
export const inventory = {
  all() { return inventoryStore.all(); },
  byStatus(status) { return this.all().filter(i => (i.status || "available") === status); },
  add(rec) {
    return inventoryStore.add({
      sku: rec.sku || "",
      name: rec.name || "",
      category: rec.category || "gold", // gold | silver
      karat: rec.karat || "21",
      form: rec.form || "worked",
      weight: num(rec.weight),
      cost_price: num(rec.cost_price),
      location: rec.location || "",
      status: rec.status || "available", // available | sold | reserved
      note: rec.note || "",
    });
  },
  update(id, patch) { return inventoryStore.update(id, patch); },
  remove(id) { inventoryStore.remove(id); },
  totals() {
    const all = this.byStatus("available");
    let weightG = 0, valueG = 0, weightS = 0, valueS = 0;
    for (const i of all) {
      const w = num(i.weight), v = num(i.cost_price);
      if (i.category === "gold")   { weightG += w; valueG += w * v; }
      if (i.category === "silver") { weightS += w; valueS += w * v; }
    }
    return { count: all.length, weightG, valueG, weightS, valueS };
  }
};

/* ===== Invoices ===== */
const invoicesStore = makeStore(keys.invoices);
export const invoices = {
  all() { return invoicesStore.all(); },
  byId(id) { return invoicesStore.byId(id); },
  add(rec) {
    const no = settings.nextInvoiceNo();
    return invoicesStore.add({ no, ...rec });
  },
  update(id, patch) { return invoicesStore.update(id, patch); },
  remove(id) { invoicesStore.remove(id); },
};

/* ===== Daily Meta (per-day metadata: cash/bank actual, paper image, closed) ===== */
const dailyMetaStore = makeStore(keys.dailyMeta);
export const dailyMeta = {
  all() { return dailyMetaStore.all(); },
  byDate(date) {
    return this.all().find(m => m.date === date) || null;
  },
  upsert(date, patch) {
    const existing = this.byDate(date);
    if (existing) {
      return dailyMetaStore.update(existing.id, patch);
    }
    return dailyMetaStore.add({
      date,
      cash_actual: 0,
      bank_actual: 0,
      paper_image: null,
      notes: "",
      closed: false,
      closed_at: null,
      ...patch,
    });
  },
  isClosed(date) {
    const m = this.byDate(date);
    return m ? !!m.closed : false;
  },
  close(date) {
    return this.upsert(date, { closed: true, closed_at: new Date().toISOString() });
  },
  reopen(date) {
    return this.upsert(date, { closed: false, closed_at: null });
  },
};

/* ===== Consignments (دفتر العهد) ===== */
const consignmentsStore = makeStore(keys.consignments);
export const consignments = {
  all() { return consignmentsStore.all(); },
  byId(id) { return consignmentsStore.byId(id); },
  byStatus(status) { return this.all().filter(c => (c.status || "open") === status); },
  add(rec) {
    const items = (rec.items_out || []).map(it => ({
      id: uid(),
      description: it.description || "",
      weight: num(it.weight),
      karat: it.karat || "21",
      form: it.form || "worked",
      count: num(it.count) || 1,
      price_per_gram: num(it.price_per_gram),
    }));
    const total_weight_out = items.reduce((s,i) => s + num(i.weight) * num(i.count), 0);
    const expected_value   = items.reduce((s,i) => s + num(i.weight) * num(i.count) * num(i.price_per_gram), 0);
    return consignmentsStore.add({
      date_out: rec.date_out,
      person:   rec.person || "",
      items_out: items,
      total_weight_out,
      expected_value,
      returns: [],
      total_returned_cash: 0,
      total_returned_weight: 0,
      remaining_weight: total_weight_out,
      status: "open",
      closed_at: null,
      note: rec.note || "",
    });
  },
  update(id, patch) { return consignmentsStore.update(id, patch); },
  remove(id) { consignmentsStore.remove(id); },
  addReturn(id, ret) {
    const c = this.byId(id); if (!c) return null;
    const returns = c.returns || [];
    const newRet = {
      id: uid(),
      date: ret.date,
      type: ret.type, // cash | items | mixed
      cash_amount: num(ret.cash_amount),
      items_returned: (ret.items_returned || []).map(r => ({
        item_id: r.item_id,
        count_returned: num(r.count_returned),
        weight_returned: num(r.weight_returned),
      })),
      account_id: ret.account_id || null, // إذا فيه فلوس وانخصمت لحساب
      note: ret.note || "",
    };
    returns.push(newRet);
    // recompute totals
    let totalCash = 0, totalWeight = 0;
    for (const r of returns) {
      totalCash += num(r.cash_amount);
      for (const it of (r.items_returned || [])) totalWeight += num(it.weight_returned);
    }
    const remaining = num(c.total_weight_out) - totalWeight;
    return consignmentsStore.update(id, {
      returns,
      total_returned_cash: totalCash,
      total_returned_weight: totalWeight,
      remaining_weight: remaining,
    });
  },
  removeReturn(id, retId) {
    const c = this.byId(id); if (!c) return null;
    const returns = (c.returns || []).filter(r => r.id !== retId);
    let totalCash = 0, totalWeight = 0;
    for (const r of returns) {
      totalCash += num(r.cash_amount);
      for (const it of (r.items_returned || [])) totalWeight += num(it.weight_returned);
    }
    return consignmentsStore.update(id, {
      returns,
      total_returned_cash: totalCash,
      total_returned_weight: totalWeight,
      remaining_weight: num(c.total_weight_out) - totalWeight,
    });
  },
  close(id) {
    return consignmentsStore.update(id, { status: "closed", closed_at: new Date().toISOString() });
  },
  reopen(id) {
    return consignmentsStore.update(id, { status: "open", closed_at: null });
  },
  totals() {
    const open = this.byStatus("open");
    let weightOut = 0, weightReturned = 0, cashReturned = 0;
    for (const c of open) {
      weightOut      += num(c.total_weight_out);
      weightReturned += num(c.total_returned_weight);
      cashReturned   += num(c.total_returned_cash);
    }
    return {
      openCount: open.length,
      remainingWeight: weightOut - weightReturned,
      cashReturned,
    };
  },
};

/* ===== Reports helpers ===== */
export const reports = {
  monthRange(yyyymm) {
    const [y, m] = yyyymm.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return { from: `${yyyymm}-01`, to: `${yyyymm}-${String(last).padStart(2,"0")}` };
  },
  yearRange(yyyy) {
    return { from: `${yyyy}-01-01`, to: `${yyyy}-12-31` };
  },
  dailyTotals(fromISO, toISO) {
    const list = daily.byRange(fromISO, toISO);
    let cashIn = 0, cashOut = 0;
    let goldInW = 0, goldOutW = 0, silverInW = 0, silverOutW = 0;
    let bankIn = 0, bankOut = 0, creditIn = 0, creditOut = 0;
    for (const e of list) {
      const t = num(e.total), w = num(e.weight);
      if (e.category === "gold")   { (e.flow === "in" ? goldInW : (goldOutW)); if (e.flow==="in") goldInW+=w; else goldOutW+=w; }
      if (e.category === "silver") { if (e.flow==="in") silverInW+=w; else silverOutW+=w; }
      if (e.payment_method === "cash")   { e.flow==="in" ? cashIn   += t : cashOut   += t; }
      if (e.payment_method === "bank")   { e.flow==="in" ? bankIn   += t : bankOut   += t; }
      if (e.payment_method === "credit") { e.flow==="in" ? creditIn += t : creditOut += t; }
    }
    return { count: list.length, cashIn, cashOut, bankIn, bankOut, creditIn, creditOut, goldInW, goldOutW, silverInW, silverOutW };
  },
  /** ربح تقريبي = (مبيعات - مشتريات) - مصاريف الشهر */
  monthProfit(yyyymm) {
    const r = this.monthRange(yyyymm);
    const t = this.dailyTotals(r.from, r.to);
    const sales      = t.cashIn + t.bankIn + t.creditIn;
    const purchases  = t.cashOut + t.bankOut + t.creditOut;
    const exp        = expenses.monthTotal(yyyymm);
    return { sales, purchases, expenses: exp, net: sales - purchases - exp };
  }
};

/* ===== Export / Import (for backup) ===== */
export function exportAll() {
  const data = {};
  for (const [k, v] of Object.entries(keys)) data[k] = read(v, null);
  data.__exported_at = new Date().toISOString();
  data.__schema = SCHEMA_VERSION;
  return data;
}

export function importAll(data) {
  if (!data || typeof data !== "object") return false;
  for (const [k, v] of Object.entries(keys)) {
    if (data[k] !== undefined) write(v, data[k]);
  }
  return true;
}

export function clearAll() {
  for (const v of Object.values(keys)) localStorage.removeItem(v);
}

/* ===== Storage usage ===== */
export function storageStats() {
  let bytes = 0;
  for (const v of Object.values(keys)) {
    const item = localStorage.getItem(v);
    if (item) bytes += item.length;
  }
  return { bytes, kb: (bytes / 1024).toFixed(1) };
}
