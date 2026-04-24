/**
 * utils.js — أدوات مساعدة
 */

/* ===== Formatters ===== */
const fmtSAR = new Intl.NumberFormat("ar-SA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fmtNum = new Intl.NumberFormat("ar-SA", {
  maximumFractionDigits: 3,
});
const fmtDateLong = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});
const fmtDateShort = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  year: "numeric", month: "2-digit", day: "2-digit",
});

export function money(n) {
  const v = Number(n) || 0;
  return fmtSAR.format(v) + " ر.س";
}

export function weight(g) {
  const v = Number(g) || 0;
  return fmtNum.format(v) + " جم";
}

export function num(n, digits = 3) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: digits }).format(v);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDateLong(isoStr) {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return fmtDateLong.format(date);
}

export function formatDateShort(isoStr) {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return fmtDateShort.format(date);
}

/* ===== DOM helpers ===== */
export function $(sel, root = document) { return root.querySelector(sel); }
export function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    }
    else if (v === true) node.setAttribute(k, "");
    else if (v === false || v == null) { /* skip */ }
    else node.setAttribute(k, v);
  }
  if (!Array.isArray(children)) children = [children];
  for (const c of children) {
    if (c == null) continue;
    if (typeof c === "string") node.appendChild(document.createTextNode(c));
    else node.appendChild(c);
  }
  return node;
}

/* ===== Toast ===== */
let toastTimer = null;
export function toast(msg, kind = "info") {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ===== Confirm modal (simple) ===== */
export function confirmAsk(message) {
  return window.confirm(message);
}

/* ===== Labels for enums ===== */
export const LABELS = {
  flow: { in: "وارد", out: "صادر" },
  category: { gold: "ذهب", silver: "فضة", cash: "نقد" },
  form: { worked: "مشغول", broken: "كسر", pure: "صافي" },
  payment: { cash: "نقداً", bank: "بنك/شبكة", credit: "آجل" },
  goldKarats: ["24", "22", "21", "18"],
  silverPurities: ["999", "925"],
};
