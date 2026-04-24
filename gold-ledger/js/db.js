/**
 * db.js — طبقة تخزين البيانات
 * يستخدم localStorage ويوفر واجهة بسيطة لكل دفتر.
 * البيانات منظمة بمفاتيح:
 *   gl.meta          → بيانات عامة (إصدار، إعدادات)
 *   gl.daily         → مصفوفة قيود اليومية
 *   gl.suppliers     → (لاحقاً)
 *   gl.bankCash      → (لاحقاً)
 *   ...
 */

const PREFIX = "gl.";
const SCHEMA_VERSION = 1;

const keys = {
  meta:       PREFIX + "meta",
  daily:      PREFIX + "daily",
  suppliers:  PREFIX + "suppliers",
  bankCash:   PREFIX + "bankCash",
  expenses:   PREFIX + "expenses",
  advances:   PREFIX + "advances",
  inventory:  PREFIX + "inventory",
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

function uid() {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
}

/* ===== init ===== */
export function initDb() {
  const meta = read(keys.meta, null);
  if (!meta) {
    write(keys.meta, {
      version: SCHEMA_VERSION,
      created_at: new Date().toISOString(),
      currency: "SAR",
    });
  }
  // Ensure ledger arrays exist
  if (read(keys.daily, null) === null)     write(keys.daily, []);
  if (read(keys.suppliers, null) === null) write(keys.suppliers, []);
}

/* ===== Daily Ledger ===== */
export const daily = {
  all() {
    return read(keys.daily, []);
  },
  byDate(dateStr) {
    return this.all()
      .filter(e => e.date === dateStr)
      .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
  },
  add(entry) {
    const list = this.all();
    const rec = {
      id: uid(),
      created_at: new Date().toISOString(),
      ...entry,
    };
    list.push(rec);
    write(keys.daily, list);
    return rec;
  },
  update(id, patch) {
    const list = this.all();
    const idx = list.findIndex(x => x.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch, updated_at: new Date().toISOString() };
    write(keys.daily, list);
    return list[idx];
  },
  remove(id) {
    const list = this.all().filter(x => x.id !== id);
    write(keys.daily, list);
  },
  /**
   * Aggregate per-day by metal+form.
   * Returns: { gold: {18:{worked:{in,out,weight}}...}, silver:{...}, cash:{in,out} }
   */
  summaryForDate(dateStr) {
    const entries = this.byDate(dateStr);
    const sum = {
      gold:   { 18:  emptyForm(), 21: emptyForm(), 22: emptyForm(), 24: emptyForm() },
      silver: { 925: emptyForm(), 999: emptyForm() },
      cash:   { in: 0, out: 0 },
    };
    for (const e of entries) {
      if (e.category === "gold") {
        const g = sum.gold[e.karat];
        if (!g) continue;
        const slot = g[e.form]; // worked / broken / pure
        if (!slot) continue;
        if (e.flow === "in")  { slot.in_w  += num(e.weight); slot.in_amt  += num(e.total); }
        else                   { slot.out_w += num(e.weight); slot.out_amt += num(e.total); }
      } else if (e.category === "silver") {
        const s = sum.silver[e.karat];
        if (!s) continue;
        const slot = s[e.form];
        if (!slot) continue;
        if (e.flow === "in")  { slot.in_w  += num(e.weight); slot.in_amt  += num(e.total); }
        else                   { slot.out_w += num(e.weight); slot.out_amt += num(e.total); }
      } else if (e.category === "cash") {
        if (e.flow === "in")  sum.cash.in  += num(e.total);
        else                   sum.cash.out += num(e.total);
      }
    }
    return sum;
  },
  /** totals across all dates for KPIs */
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
function num(v) { const n = Number(v); return isFinite(n) ? n : 0; }

/* ===== Export / Import (for backup) ===== */
export function exportAll() {
  const data = {};
  for (const [k, v] of Object.entries(keys)) {
    data[k] = read(v, null);
  }
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
  return {
    bytes,
    kb: (bytes / 1024).toFixed(1),
  };
}
